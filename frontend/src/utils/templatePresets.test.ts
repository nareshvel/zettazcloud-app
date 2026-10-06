import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_PRESETS, presetsByVertical, findPreset,
  VERTICAL_LABELS, SALES_MODE_LABELS,
} from './templatePresets';

/**
 * Template presets.
 *
 * A preset is a starting point, not a constraint. Its job is to spare a
 * pharmacist from discovering, on a blank canvas, that their receipt needs an
 * Rx block, a drug identifier, a lot number and a beyond-use date.
 *
 * The integrity checks below matter because a preset that points at a
 * non-existent fixture or an unknown template type fails at creation time —
 * in front of the user, on their first action in the module.
 */

/*
 * Derived from DEFAULT_BLOCKS rather than hand-listed.
 *
 * A hardcoded list has to be remembered every time a document type is added,
 * and the failure it produces ("preset maps to an unknown type") points at the
 * preset rather than at the stale list — which is exactly backwards. Deriving
 * it means the test can only fail for a real reason.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const VALID_TEMPLATE_TYPES = new Set<string>(
  Object.keys(require('../../../backend/services/printTemplateService').DEFAULT_BLOCKS),
);

const VALID_PAPER = new Set(['58mm', '80mm', 'a4', 'label']);

describe('the derived type list is real', () => {
  it('picked up the template types', () => {
    // Guards every assertion below against passing because the require failed
    // and the set is empty.
    expect(VALID_TEMPLATE_TYPES.size).toBeGreaterThan(4);
    expect(VALID_TEMPLATE_TYPES.has('receipt')).toBe(true);
  });
});

describe('preset integrity', () => {
  it('every preset has a unique id', () => {
    const ids = TEMPLATE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset maps to a real template type', () => {
    // An unknown type would make the backend fall back to receipt defaults,
    // silently producing the wrong document.
    TEMPLATE_PRESETS.forEach((p) => {
      expect(VALID_TEMPLATE_TYPES.has(p.templateType), `${p.id}: ${p.templateType}`).toBe(true);
    });
  });

  it('every preset declares a valid paper size', () => {
    TEMPLATE_PRESETS.forEach((p) => {
      expect(VALID_PAPER.has(p.paperSize), `${p.id}: ${p.paperSize}`).toBe(true);
    });
  });

  it('every preset has a description and at least two highlights', () => {
    // Highlights are what tell a user why to pick this over a blank template.
    TEMPLATE_PRESETS.forEach((p) => {
      expect(p.description.length, `${p.id} description`).toBeGreaterThan(20);
      expect(p.highlights.length, `${p.id} highlights`).toBeGreaterThanOrEqual(2);
    });
  });

  it('every preset names a fixture as [type, name]', () => {
    TEMPLATE_PRESETS.forEach((p) => {
      expect(Array.isArray(p.fixture), `${p.id}`).toBe(true);
      expect(p.fixture).toHaveLength(2);
      expect(p.fixture[0]).toBeTruthy();
      expect(p.fixture[1]).toBeTruthy();
    });
  });

  it('every referenced fixture actually exists', () => {
    // A dangling fixture reference means an empty preview at creation time.
    const fixtures = require('../../../backend/services/printFixtures');
    TEMPLATE_PRESETS.forEach((p) => {
      const [type, name] = p.fixture;
      expect(
        fixtures.getFixture(type, name),
        `${p.id} points at missing fixture ${type}/${name}`,
      ).toBeTruthy();
    });
  });

  it('every vertical and sales mode has a display label', () => {
    TEMPLATE_PRESETS.forEach((p) => {
      expect(VERTICAL_LABELS[p.vertical], `${p.id} vertical`).toBeTruthy();
      expect(SALES_MODE_LABELS[p.salesMode], `${p.id} salesMode`).toBeTruthy();
    });
  });
});

describe('coverage', () => {
  it('covers all six target verticals', () => {
    const covered = new Set(TEMPLATE_PRESETS.map((p) => p.vertical));
    ['retail', 'grocery', 'pharmacy', 'electronics', 'apparel', 'jewelry'].forEach((v) => {
      expect(covered.has(v as never), `no preset for ${v}`).toBe(true);
    });
  });

  it('covers every sales mode, not just domestic', () => {
    // Duty-free and tax-refund are core use cases, not edge cases.
    const modes = new Set(TEMPLATE_PRESETS.map((p) => p.salesMode));
    ['domestic', 'duty_free', 'tax_refund', 'b2b'].forEach((m) => {
      expect(modes.has(m as never), `no preset for ${m}`).toBe(true);
    });
  });

  it('offers a gift receipt with price suppression', () => {
    const gift = TEMPLATE_PRESETS.find((p) => p.overrides?.giftMode);
    expect(gift).toBeDefined();
    expect(gift!.description.toLowerCase()).toMatch(/price|paid/);
  });

  it('the duty-free jewelry preset explains the no-reprint rule', () => {
    // The rule is non-obvious and consequential, so it belongs in the copy.
    const df = findPreset('jewelry-dutyfree-a4')!;
    expect(df.description.toLowerCase()).toMatch(/reprint|duplicate|customs/);
  });
});

describe('presetsByVertical', () => {
  it('groups every preset without loss', () => {
    const total = presetsByVertical().reduce((n, g) => n + g.presets.length, 0);
    expect(total).toBe(TEMPLATE_PRESETS.length);
  });

  it('omits verticals with no presets rather than showing empty groups', () => {
    presetsByVertical().forEach((g) => expect(g.presets.length).toBeGreaterThan(0));
  });
});

describe('findPreset', () => {
  it('finds a known preset', () => {
    expect(findPreset('grocery-receipt-80')?.vertical).toBe('grocery');
  });

  it('returns undefined for an unknown id rather than throwing', () => {
    expect(findPreset('nope')).toBeUndefined();
  });
});
