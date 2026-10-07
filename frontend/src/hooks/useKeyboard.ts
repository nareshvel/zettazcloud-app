import { useEffect, useState } from 'react';

/**
 * True while the on-screen keyboard is (probably) open — an editable element is
 * focused or the visual viewport has shrunk. Used to hide the bottom nav so it
 * can't float above the keyboard.
 */
export function useKeyboard() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      const el = document.activeElement;
      const editable = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);
      const covered = vv ? window.innerHeight - vv.height - vv.offsetTop : 0;
      setOpen(editable || covered > 80);
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  return open;
}
