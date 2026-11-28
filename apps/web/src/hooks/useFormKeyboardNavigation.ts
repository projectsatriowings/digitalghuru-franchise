import { useEffect } from 'react';

/**
 * Global Keyboard Handler for Web Forms and Modals:
 * 1. Escape key: Dispatches close action to topmost open modal.
 * 2. Enter key:
 *    - In textarea: Enter inserts newline; Ctrl+Enter or Cmd+Enter submits the form.
 *    - In standard forms: Enter submits the form.
 * 3. Prevents lost submissions and provides desktop-grade keyboard navigation.
 */
export function useFormKeyboardNavigation(): void {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. ESCAPE KEY: Close topmost open modal or dialog
      if (e.key === 'Escape') {
        const modals = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.fixed.inset-0, [role="dialog"], .modal-overlay'
          )
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });

        if (modals.length > 0) {
          const topModal = modals[modals.length - 1];
          // Look for an explicit close button inside the topmost modal
          const closeBtn = topModal.querySelector<HTMLButtonElement>(
            'button[aria-label="Close"], button.modal-close-btn, button:has(svg.lucide-x), button.close-btn'
          );
          if (closeBtn && !closeBtn.disabled) {
            e.preventDefault();
            e.stopPropagation();
            closeBtn.click();
            return;
          }
        }
      }

      // 2. TEXTAREA: Ctrl+Enter or Cmd+Enter submits the parent form
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === 'TEXTAREA') {
          const form = target.closest('form');
          if (form) {
            e.preventDefault();
            const submitBtn = form.querySelector<HTMLButtonElement>(
              'button[type="submit"]:not([disabled])'
            );
            if (submitBtn) {
              submitBtn.click();
            } else if (typeof form.requestSubmit === 'function') {
              form.requestSubmit();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
}
