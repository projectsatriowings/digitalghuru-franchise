import { useEffect } from 'react';

interface UseModalKeyboardOptions {
  isOpen: boolean;
  onClose?: () => void;
  onEnter?: (e: KeyboardEvent) => void;
  autoFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Reusable hook to handle keyboard functionality for modals & forms:
 * - Escape key dismisses / closes the modal
 * - Enter key triggers next step or submits form (ignoring textareas unless Ctrl/Cmd is held)
 * - Optional auto-focus on open
 */
export function useModalKeyboard({
  isOpen,
  onClose,
  onEnter,
  autoFocusRef,
}: UseModalKeyboardOptions) {
  useEffect(() => {
    if (!isOpen) return;

    // Auto focus the initial input element
    if (autoFocusRef?.current) {
      const timer = setTimeout(() => {
        autoFocusRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoFocusRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to dismiss / close modal
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }

      // Enter key for form advancement or submit
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        // Do not intercept Enter if actively focusing a button or link (native click behavior)
        if (target && (target.tagName === 'BUTTON' || target.tagName === 'A')) {
          return;
        }
        // In textareas, allow regular Enter for new lines unless Ctrl or Meta (Cmd) is pressed
        if (target && target.tagName === 'TEXTAREA' && !e.ctrlKey && !e.metaKey) {
          return;
        }

        if (onEnter) {
          e.preventDefault();
          onEnter(e);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onEnter]);
}
