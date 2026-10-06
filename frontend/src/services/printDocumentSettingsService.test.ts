import { describe, expect, it } from 'vitest';
import { resolveDocumentAction } from './printDocumentSettingsService';

describe('resolveDocumentAction', () => {
  it('opens preview for an enabled route when auto print is off', () => {
    expect(resolveDocumentAction({ enabled: true, autoPrint: false })).toBe('preview');
  });

  it('prints an enabled route when auto print is on', () => {
    expect(resolveDocumentAction({ enabled: true, autoPrint: true })).toBe('print');
  });

  it('does nothing for a disabled route', () => {
    expect(resolveDocumentAction({ enabled: false, autoPrint: true })).toBe('none');
  });

  it('always previews when view mode is explicitly requested', () => {
    expect(resolveDocumentAction({ enabled: false, autoPrint: true }, 'view')).toBe('preview');
  });
});
