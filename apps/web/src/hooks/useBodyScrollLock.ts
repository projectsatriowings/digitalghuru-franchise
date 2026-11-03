import { useEffect } from 'react';

/**
 * Custom hook to lock body / background scroll when a modal or dialog is open.
 * Automatically restores previous overflow setting when closed or on unmount.
 */
export function useBodyScrollLock(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked) return;

    // Save previous styles
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const originalHtmlStyle = window.getComputedStyle(document.documentElement).overflow;

    // Lock scrolling on document and body
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Also lock main scrollable container if present
    const mainContainer = document.querySelector('main');
    const originalMainStyle = mainContainer ? mainContainer.style.overflow : '';
    if (mainContainer) {
      mainContainer.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalStyle;
      document.documentElement.style.overflow = originalHtmlStyle;
      if (mainContainer) {
        mainContainer.style.overflow = originalMainStyle;
      }
    };
  }, [isLocked]);
}

