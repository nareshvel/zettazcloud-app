'use strict';

const assert = require('assert');
const {
  OLD_INVOICE, OLD_JEWELRY_INVOICE, withDutyFreeVisible, classifyStoredBlocks,
} = require('../services/legacyInvoiceBlocksSnapshot');
const printTemplateService = require('../services/printTemplateService');

/**
 * The classification the sync-clean-invoice-templates.js backfill script
 * relies on to decide whether a tenant's stored invoice template is still the
 * shipped default (safe to update) or has been customised (must be left
 * alone). Getting this wrong in either direction is a real failure mode:
 *
 *   TOO LOOSE  → a tenant's genuine customisation gets silently overwritten.
 *   TOO STRICT → a duty-free store stays on the stale layout forever, which
 *                is the exact bug this whole round of work is fixing.
 *
 * Mutation-style: every rule below is asserted in both directions — the
 * shape that MUST match, and the nearby shape that MUST NOT.
 */

describe('legacyInvoiceBlocksSnapshot.classifyStoredBlocks', () => {
  it('matches an untouched invoice row exactly as provisioned', () => {
    const result = classifyStoredBlocks('invoice', OLD_INVOICE);
    assert.deepStrictEqual(result, { matched: true, dutyFree: false });
  });

  it('matches an untouched jewelry_invoice row (domestic)', () => {
    const result = classifyStoredBlocks('jewelry_invoice', OLD_JEWELRY_INVOICE);
    assert.deepStrictEqual(result, { matched: true, dutyFree: false });
  });

  it('matches an untouched jewelry_invoice row provisioned duty-free', () => {
    // blocksForPlanEntry flips the dutyFree block's `visible` flag on at
    // creation time for a duty-free plan entry — the stored row never equals
    // the plain OLD_JEWELRY_INVOICE for those tenants.
    const dutyFreeRow = withDutyFreeVisible(OLD_JEWELRY_INVOICE);
    const result = classifyStoredBlocks('jewelry_invoice', dutyFreeRow);
    assert.deepStrictEqual(result, { matched: true, dutyFree: true });
  });

  it('does NOT match a row with one field renamed — even a single character', () => {
    const edited = JSON.parse(JSON.stringify(OLD_INVOICE));
    edited[1].config.headerFields = ['invoiceNumber', 'date']; // tenant removed dueDate
    const result = classifyStoredBlocks('invoice', edited);
    assert.strictEqual(result.matched, false);
  });

  it('does NOT match a row where a block was hidden', () => {
    const edited = JSON.parse(JSON.stringify(OLD_JEWELRY_INVOICE));
    edited.find((b) => b.id === 'gemstones').visible = false;
    const result = classifyStoredBlocks('jewelry_invoice', edited);
    assert.strictEqual(result.matched, false);
  });

  it('does NOT match a row with blocks reordered', () => {
    const edited = [...OLD_INVOICE];
    [edited[0], edited[1]] = [edited[1], edited[0]];
    const result = classifyStoredBlocks('invoice', edited);
    assert.strictEqual(result.matched, false);
  });

  it('does NOT match a row that already carries the NEW clean blocks', () => {
    // A store that got the "Invoice (Clean)" opt-in preset before this round,
    // or was provisioned today, already has the new shape. Re-running the
    // script against it must be a no-op, not an error.
    const result = classifyStoredBlocks('invoice', printTemplateService.DEFAULT_BLOCKS.invoice);
    assert.strictEqual(result.matched, false);
  });

  it('returns not-matched for an unknown template type rather than throwing', () => {
    assert.strictEqual(classifyStoredBlocks('receipt', OLD_INVOICE).matched, false);
  });

  it('is a pure function — the OLD snapshots are never mutated by classification', () => {
    const before = JSON.stringify(OLD_INVOICE);
    classifyStoredBlocks('invoice', OLD_INVOICE);
    classifyStoredBlocks('invoice', JSON.parse(JSON.stringify(OLD_INVOICE)));
    assert.strictEqual(JSON.stringify(OLD_INVOICE), before);
  });
});

describe('legacyInvoiceBlocksSnapshot — the snapshots themselves', () => {
  it('OLD_INVOICE differs from the current shipped default', () => {
    // If this ever passes, DEFAULT_BLOCKS.invoice has reverted to the old
    // shape and the backfill script (and this whole redesign) is moot.
    assert.notStrictEqual(
      JSON.stringify(OLD_INVOICE),
      JSON.stringify(printTemplateService.DEFAULT_BLOCKS.invoice),
    );
  });

  it('OLD_JEWELRY_INVOICE differs from the current shipped default', () => {
    assert.notStrictEqual(
      JSON.stringify(OLD_JEWELRY_INVOICE),
      JSON.stringify(printTemplateService.DEFAULT_BLOCKS.jewelry_invoice),
    );
  });

  it('withDutyFreeVisible only touches the dutyFree block', () => {
    const result = withDutyFreeVisible(OLD_JEWELRY_INVOICE);
    result.forEach((block, i) => {
      if (block.type === 'dutyFree') {
        assert.strictEqual(block.visible, true);
      } else {
        assert.deepStrictEqual(block, OLD_JEWELRY_INVOICE[i]);
      }
    });
  });
});
