import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Unmount React trees between tests so DOM state never leaks across cases.
afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// jsdom gaps
// ---------------------------------------------------------------------------
// jsdom implements neither of these, but shadcn/Radix components and several
// pages call them during render. Without stubs, unrelated tests fail on a
// missing-API TypeError rather than on the behaviour under test.
// ---------------------------------------------------------------------------

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),      // deprecated, still called by some libs
    removeListener: vi.fn(),   // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Radix uses these for positioning; jsdom returns nothing useful but the
// components only need them not to throw.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (!window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false) as never;
}
if (!window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = vi.fn() as never;
}
