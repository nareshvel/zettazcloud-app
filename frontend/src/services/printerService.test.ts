import { describe, expect, it } from 'vitest';
import { buildNetworkAgentJob, resolveLocalAgentPrinterId, rgbaToEscposRasterBase64, shouldUseLocalAgent } from './printerService';

const printers = [
  { id: '_192_168_1_100', name: '_192_168_1_100' },
  { id: 'Canon_TS3700_series', name: 'Canon_TS3700_series', isDefault: true },
];

describe('resolveLocalAgentPrinterId', () => {
  it('uses an exact CUPS queue match', () => {
    expect(resolveLocalAgentPrinterId('_192_168_1_100', printers)).toBe('_192_168_1_100');
  });

  it('rejects a network address instead of silently selecting the default queue', () => {
    expect(() => resolveLocalAgentPrinterId('127.0.0.1:9100', printers)).toThrow('is not available in the Local Agent');
  });

  it('lets CUPS select its default when no printer was configured', () => {
    expect(resolveLocalAgentPrinterId(undefined, printers)).toBe('Canon_TS3700_series');
  });
});

describe('shouldUseLocalAgent', () => {
  it('uses the Local Agent only for explicit local-agent delivery', () => {
    expect(shouldUseLocalAgent('local-agent')).toBe(true);
    expect(shouldUseLocalAgent('direct')).toBe(false);
    expect(shouldUseLocalAgent('browser')).toBe(false);
  });
});

describe('buildNetworkAgentJob', () => {
  it('sends ESC/POS bytes to the configured address over TCP', () => {
    const job = buildNetworkAgentJob('127.0.0.1:9100', 'G0BA', '80mm');
    expect(job).toMatchObject({
      destination: 'tcp',
      address: '127.0.0.1:9100',
      printerId: '',
      contentType: 'escpos',
      payloadBase64: 'G0BA',
      mediaSize: '80mm',
    });
  });
});

describe('rgbaToEscposRasterBase64', () => {
  it('encodes monochrome pixels with an ESC/POS raster header, feed, and cut', () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]);
    const bytes = Uint8Array.from(atob(rgbaToEscposRasterBase64(rgba, 8, 1)), (char) => char.charCodeAt(0));
    expect(Array.from(bytes.slice(0, 10))).toEqual([0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x01, 0x00]);
    expect(bytes[10]).toBe(0x80);
    expect(Array.from(bytes.slice(-6))).toEqual([0x1b, 0x64, 0x05, 0x1d, 0x56, 0x00]);
  });
});
