import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * TitleTooltip — instant replacement for native `title=""` tooltips.
 *
 * Native title tooltips carry a ~1s browser-enforced delay that can't be
 * styled or configured, which made every icon-only action button feel
 * unresponsive. Rather than rewriting ~200 call sites to Radix tooltips,
 * this component listens for hovers on ANY element bearing a `title`
 * attribute, suppresses the native tooltip for the duration of the hover,
 * and renders our own styled one after a short 120ms delay.
 *
 * Mechanics:
 *  - Delegated `mouseover` on document — works for dynamically rendered
 *    elements (table rows, modals, portals) with zero per-site changes.
 *  - `title` is moved to `data-tt` while hovered so the browser tooltip
 *    never fires, then restored on leave; `aria-label` is backfilled for
 *    icon-only buttons that relied on `title` for an accessible name.
 *  - Hides on scroll, click, mouseleave and window blur.
 *
 * New code: keep using `title="..."` — it's now fast everywhere. For rich
 * content use the Radix `Tooltip` components in ui/tooltip.tsx instead.
 */
const SHOW_DELAY_MS = 120;

const TitleTooltip = () => {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; flip: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const activeEl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const restore = () => {
      const el = activeEl.current;
      if (el) {
        const t = el.getAttribute('data-tt');
        if (t !== null) {
          el.setAttribute('title', t);
          el.removeAttribute('data-tt');
        }
        activeEl.current = null;
      }
      window.clearTimeout(timer.current);
      setTip(null);
    };

    const onMouseOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('[title]') as HTMLElement | null;
      if (el === activeEl.current) return;
      restore();
      if (!el) return;

      const text = el.getAttribute('title');
      if (!text) return;
      el.setAttribute('data-tt', text);
      el.removeAttribute('title');
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', text);
      activeEl.current = el;

      timer.current = window.setTimeout(() => {
        if (activeEl.current !== el) return;
        const r = el.getBoundingClientRect();
        const flip = r.top < 48; // not enough room above — show below
        setTip({ text, x: r.left + r.width / 2, y: flip ? r.bottom + 8 : r.top - 8, flip });
      }, SHOW_DELAY_MS);
    };

    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('scroll', restore, true);
    document.addEventListener('mousedown', restore, true);
    window.addEventListener('blur', restore);
    return () => {
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('scroll', restore, true);
      document.removeEventListener('mousedown', restore, true);
      window.removeEventListener('blur', restore);
      restore();
    };
  }, []);

  if (!tip) return null;
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[100] max-w-xs break-words rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.flip ? '0%' : '-100%'})` }}
    >
      {tip.text}
    </div>,
    document.body
  );
};

export default TitleTooltip;
