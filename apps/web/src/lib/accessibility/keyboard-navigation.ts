/**
 * Keyboard navigation utilities and hooks
 */

import { useCallback, useEffect, useRef } from 'react';
import { KeyboardKeys } from './focus-management';

/**
 * Hook for handling keyboard navigation in lists/menus
 */
export function useKeyboardNavigation<T extends HTMLElement>({
  items,
  orientation = 'vertical',
  loop = true,
  onSelect,
}: {
  items: T[];
  orientation?: 'vertical' | 'horizontal';
  loop?: boolean;
  onSelect?: (item: T, index: number) => void;
}) {
  const currentIndexRef = useRef(0);

  const getNextIndex = useCallback((currentIndex: number, direction: 'next' | 'prev'): number => {
    const itemCount = items.length;
    if (itemCount === 0) return -1;

    let newIndex = currentIndex;

    if (direction === 'next') {
      newIndex = currentIndex + 1;
      if (newIndex >= itemCount) {
        newIndex = loop ? 0 : itemCount - 1;
      }
    } else {
      newIndex = currentIndex - 1;
      if (newIndex < 0) {
        newIndex = loop ? itemCount - 1 : 0;
      }
    }

    return newIndex;
  }, [items.length, loop]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const currentIndex = currentIndexRef.current;
    let newIndex = currentIndex;
    let shouldHandle = false;

    if (orientation === 'vertical') {
      if (event.key === KeyboardKeys.ARROW_DOWN) {
        newIndex = getNextIndex(currentIndex, 'next');
        shouldHandle = true;
      } else if (event.key === KeyboardKeys.ARROW_UP) {
        newIndex = getNextIndex(currentIndex, 'prev');
        shouldHandle = true;
      }
    } else {
      if (event.key === KeyboardKeys.ARROW_RIGHT) {
        newIndex = getNextIndex(currentIndex, 'next');
        shouldHandle = true;
      } else if (event.key === KeyboardKeys.ARROW_LEFT) {
        newIndex = getNextIndex(currentIndex, 'prev');
        shouldHandle = true;
      }
    }

    if (event.key === KeyboardKeys.HOME) {
      newIndex = 0;
      shouldHandle = true;
    } else if (event.key === KeyboardKeys.END) {
      newIndex = items.length - 1;
      shouldHandle = true;
    } else if (event.key === KeyboardKeys.ENTER || event.key === KeyboardKeys.SPACE) {
      if (onSelect && items[currentIndex]) {
        event.preventDefault();
        onSelect(items[currentIndex], currentIndex);
        return;
      }
    }

    if (shouldHandle && newIndex !== currentIndex && items[newIndex]) {
      event.preventDefault();
      currentIndexRef.current = newIndex;
      items[newIndex].focus();
    }
  }, [items, orientation, getNextIndex, onSelect]);

  return {
    currentIndex: currentIndexRef.current,
    handleKeyDown,
    setCurrentIndex: (index: number) => {
      if (index >= 0 && index < items.length) {
        currentIndexRef.current = index;
      }
    },
  };
}

/**
 * Hook for escape key handling
 */
export function useEscapeKey(callback: () => void, isEnabled: boolean = true) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === KeyboardKeys.ESCAPE) {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [callback, isEnabled]);
}

/**
 * Hook for handling Enter/Space key activation
 */
export function useActivationKeys(
  callback: () => void,
  isEnabled: boolean = true,
  preventDefault: boolean = true
) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isEnabled) return;

    if (event.key === KeyboardKeys.ENTER || event.key === KeyboardKeys.SPACE) {
      if (preventDefault) {
        event.preventDefault();
      }
      callback();
    }
  }, [callback, isEnabled, preventDefault]);

  return handleKeyDown;
}

/**
 * Skip link component utilities
 */
export function createSkipLink(targetId: string, label: string) {
  return {
    href: `#${targetId}`,
    'aria-label': label,
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === KeyboardKeys.ENTER) {
        event.preventDefault();
        const target = document.getElementById(targetId);
        if (target) {
          target.focus();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
  };
}

/**
 * Table keyboard navigation
 */
export function useTableKeyboardNavigation({
  rows,
  columns,
  onCellSelect,
}: {
  rows: number;
  columns: number;
  onCellSelect?: (row: number, column: number) => void;
}) {
  const currentCellRef = useRef({ row: 0, column: 0 });

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { row, column } = currentCellRef.current;
    let newRow = row;
    let newColumn = column;
    let shouldHandle = false;

    switch (event.key) {
      case KeyboardKeys.ARROW_UP:
        newRow = Math.max(0, row - 1);
        shouldHandle = true;
        break;
      case KeyboardKeys.ARROW_DOWN:
        newRow = Math.min(rows - 1, row + 1);
        shouldHandle = true;
        break;
      case KeyboardKeys.ARROW_LEFT:
        newColumn = Math.max(0, column - 1);
        shouldHandle = true;
        break;
      case KeyboardKeys.ARROW_RIGHT:
        newColumn = Math.min(columns - 1, column + 1);
        shouldHandle = true;
        break;
      case KeyboardKeys.HOME:
        if (event.ctrlKey) {
          newRow = 0;
          newColumn = 0;
        } else {
          newColumn = 0;
        }
        shouldHandle = true;
        break;
      case KeyboardKeys.END:
        if (event.ctrlKey) {
          newRow = rows - 1;
          newColumn = columns - 1;
        } else {
          newColumn = columns - 1;
        }
        shouldHandle = true;
        break;
      case KeyboardKeys.ENTER:
      case KeyboardKeys.SPACE:
        if (onCellSelect) {
          event.preventDefault();
          onCellSelect(row, column);
          return;
        }
        break;
    }

    if (shouldHandle && (newRow !== row || newColumn !== column)) {
      event.preventDefault();
      currentCellRef.current = { row: newRow, column: newColumn };
      
      // Focus the new cell
      const cellId = `cell-${newRow}-${newColumn}`;
      const cell = document.getElementById(cellId);
      if (cell) {
        cell.focus();
      }
    }
  }, [rows, columns, onCellSelect]);

  return {
    currentCell: currentCellRef.current,
    handleKeyDown,
    getCellProps: (row: number, column: number) => ({
      id: `cell-${row}-${column}`,
      tabIndex: currentCellRef.current.row === row && currentCellRef.current.column === column ? 0 : -1,
      role: 'gridcell',
      onFocus: () => {
        currentCellRef.current = { row, column };
      },
    }),
  };
}

/**
 * Dropdown/Menu keyboard navigation
 */
export function useDropdownKeyboardNavigation({
  isOpen,
  onClose,
  onToggle,
  items,
  onItemSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  items: HTMLElement[];
  onItemSelect?: (item: HTMLElement, index: number) => void;
}) {
  const { handleKeyDown: handleListKeyDown } = useKeyboardNavigation({
    items,
    orientation: 'vertical',
    loop: true,
    onSelect: onItemSelect,
  });

  const handleTriggerKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case KeyboardKeys.ENTER:
      case KeyboardKeys.SPACE:
      case KeyboardKeys.ARROW_DOWN:
        event.preventDefault();
        if (!isOpen) {
          onToggle();
        }
        break;
      case KeyboardKeys.ARROW_UP:
        event.preventDefault();
        if (!isOpen) {
          onToggle();
        }
        break;
      case KeyboardKeys.ESCAPE:
        if (isOpen) {
          event.preventDefault();
          onClose();
        }
        break;
    }
  }, [isOpen, onToggle, onClose]);

  const handleMenuKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === KeyboardKeys.ESCAPE) {
      event.preventDefault();
      onClose();
      return;
    }

    handleListKeyDown(event);
  }, [onClose, handleListKeyDown]);

  return {
    handleTriggerKeyDown,
    handleMenuKeyDown,
  };
}