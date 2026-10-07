import { useEffect, useState } from 'react';

/**
 * True while the on-screen keyboard is (probably) open — i.e. the visual
 * viewport has shrunk by more than a browser-chrome amount. Used to hide the
 * bottom nav so it can't float above the keyboard.
 *
 * NOTE: this deliberately does NOT treat "an editable element is focused" as
 * keyboard-open — pages like Stock Count autofocus a scan input on mount,
 * which would hide the nav until the user happened to blur the field.
 */
export function useKeyboard() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      const covered = vv ? window.innerHeight - vv.height - vv.offsetTop : 0;
      setOpen(covered > 80);
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
