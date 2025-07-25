/**
 * Focus management utilities for keyboard navigation and accessibility
 */

import { useEffect, useRef, useCallback } from 'react';
import { logger } from '../logging/logger';

/**
 * Hook for managing focus trap in modals and dropdowns
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element initially
    if (firstElement) {
      firstElement.focus();
    }

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab (backward)
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab (forward)
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for restoring focus to previously focused element
 */
export function useFocusRestore() {
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  const captureFocus = useCallback(() => {
    previouslyFocusedElement.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previouslyFocusedElement.current) {
      previouslyFocusedElement.current.focus();
      previouslyFocusedElement.current = null;
    }
  }, []);

  return { captureFocus, restoreFocus };
}

/**
 * Hook for skip links navigation
 */
export function useSkipLink(targetId: string) {
  const skipToContent = useCallback(() => {
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [targetId]);

  return skipToContent;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
}

/**
 * Check if element is currently focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false;
  if (element.hasAttribute('disabled')) return false;
  if (element.hasAttribute('aria-hidden') && element.getAttribute('aria-hidden') === 'true') return false;
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  
  return true;
}

/**
 * Focus management for roving tabindex pattern (like in menus)
 */
export function useRovingTabindex<T extends HTMLElement>() {
  const itemsRef = useRef<T[]>([]);
  const currentIndexRef = useRef(0);

  const registerItem = useCallback((item: T | null, index: number) => {
    if (item) {
      itemsRef.current[index] = item;
      // Set initial tabindex
      item.tabIndex = index === 0 ? 0 : -1;
    }
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent, currentIndex: number) => {
    const items = itemsRef.current.filter(Boolean);
    if (items.length === 0) return;

    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        newIndex = (currentIndex + 1) % items.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;
      default:
        return;
    }

    // Update tabindex and focus
    items[currentIndex].tabIndex = -1;
    items[newIndex].tabIndex = 0;
    items[newIndex].focus();
    currentIndexRef.current = newIndex;
  }, []);

  return { registerItem, handleKeyDown, currentIndex: currentIndexRef.current };
}

/**
 * Focus visible element utility
 */
export function focusElement(element: HTMLElement | null, options: {
  preventScroll?: boolean;
  selectText?: boolean;
} = {}) {
  if (!element || !isFocusable(element)) return false;

  try {
    element.focus({ preventScroll: options.preventScroll });
    
    if (options.selectText && element instanceof HTMLInputElement) {
      element.select();
    }
    
    return true;
  } catch (error) {
    logger.warn('Failed to focus element:', error);
    return false;
  }
}

/**
 * Keyboard event helpers
 */
export const KeyboardKeys = {
  ENTER: 'Enter',
  SPACE: ' ',
  TAB: 'Tab',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

/**
 * Check if key should trigger action (Enter or Space for buttons)
 */
export function isActionKey(event: KeyboardEvent): boolean {
  return event.key === KeyboardKeys.ENTER || event.key === KeyboardKeys.SPACE;
}

/**
 * Check if key is navigation key
 */
export function isNavigationKey(event: KeyboardEvent): boolean {
  return [
    KeyboardKeys.TAB,
    KeyboardKeys.ARROW_UP,
    KeyboardKeys.ARROW_DOWN,
    KeyboardKeys.ARROW_LEFT,
    KeyboardKeys.ARROW_RIGHT,
    KeyboardKeys.HOME,
    KeyboardKeys.END,
    KeyboardKeys.PAGE_UP,
    KeyboardKeys.PAGE_DOWN,
  ].includes(event.key as any);
}