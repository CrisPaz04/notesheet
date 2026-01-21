/**
 * useModal Hook
 *
 * Provides state management for modal open/close behavior
 */

import { useState } from 'react';

function useModal() {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  return { isOpen, open, close, toggle };
}

export default useModal;
