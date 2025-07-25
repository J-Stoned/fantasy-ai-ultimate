/**
 * ARIA helpers for proper semantic markup and screen reader support
 */

export interface AriaProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-haspopup'?: boolean | 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-hidden'?: boolean;
  'aria-disabled'?: boolean;
  'aria-current'?: boolean | 'false' | 'true' | 'page' | 'step' | 'location' | 'date' | 'time';
  'aria-selected'?: boolean;
  'aria-checked'?: boolean | 'mixed';
  'aria-pressed'?: boolean | 'mixed';
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling';
  'aria-required'?: boolean;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-busy'?: boolean;
  'aria-relevant'?: 'additions' | 'removals' | 'text' | 'all';
  role?: string;
}

/**
 * Generate accessible button props
 */
export function getButtonAriaProps({
  label,
  pressed,
  expanded,
  controls,
  describedBy,
  disabled = false,
  hasPopup = false,
}: {
  label?: string;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  describedBy?: string;
  disabled?: boolean;
  hasPopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
}): AriaProps {
  return {
    'aria-label': label,
    'aria-pressed': pressed,
    'aria-expanded': expanded,
    'aria-controls': controls,
    'aria-describedby': describedBy,
    'aria-disabled': disabled,
    'aria-haspopup': hasPopup || undefined,
  };
}

/**
 * Generate accessible form field props
 */
export function getFormFieldAriaProps({
  label,
  labelledBy,
  describedBy,
  invalid = false,
  required = false,
  errorId,
}: {
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  invalid?: boolean;
  required?: boolean;
  errorId?: string;
}): AriaProps {
  const describedByIds = [describedBy, invalid ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return {
    'aria-label': label,
    'aria-labelledby': labelledBy,
    'aria-describedby': describedByIds,
    'aria-invalid': invalid,
    'aria-required': required,
  };
}

/**
 * Generate accessible navigation props
 */
export function getNavigationAriaProps({
  label,
  current,
}: {
  label?: string;
  current?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
}): AriaProps {
  return {
    'aria-label': label,
    'aria-current': current,
  };
}

/**
 * Generate accessible table props
 */
export function getTableAriaProps({
  label,
  describedBy,
  rowCount,
  columnCount,
}: {
  label?: string;
  describedBy?: string;
  rowCount?: number;
  columnCount?: number;
}): AriaProps & { 'aria-rowcount'?: number; 'aria-colcount'?: number } {
  return {
    role: 'table',
    'aria-label': label,
    'aria-describedby': describedBy,
    'aria-rowcount': rowCount,
    'aria-colcount': columnCount,
  };
}

/**
 * Generate accessible modal/dialog props
 */
export function getDialogAriaProps({
  label,
  labelledBy,
  describedBy,
  modal = true,
}: {
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  modal?: boolean;
}): AriaProps {
  return {
    role: modal ? 'dialog' : 'alertdialog',
    'aria-label': label,
    'aria-labelledby': labelledBy,
    'aria-describedby': describedBy,
    'aria-modal': modal,
  };
}

/**
 * Generate accessible dropdown/combobox props
 */
export function getComboboxAriaProps({
  label,
  expanded = false,
  controls,
  activeDescendant,
  autocomplete = 'none',
}: {
  label?: string;
  expanded?: boolean;
  controls?: string;
  activeDescendant?: string;
  autocomplete?: 'none' | 'inline' | 'list' | 'both';
}): AriaProps & { 'aria-autocomplete'?: string; 'aria-activedescendant'?: string } {
  return {
    role: 'combobox',
    'aria-label': label,
    'aria-expanded': expanded,
    'aria-controls': controls,
    'aria-autocomplete': autocomplete,
    'aria-activedescendant': activeDescendant,
  };
}

/**
 * Generate unique IDs for accessibility relationships
 */
export function generateId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if element should be hidden from screen readers
 */
export function shouldHideFromScreenReader(element: {
  decorative?: boolean;
  redundant?: boolean;
  interactive?: boolean;
}): boolean {
  return element.decorative || element.redundant || false;
}

/**
 * Get appropriate ARIA live region settings
 */
export function getLiveRegionProps(urgency: 'low' | 'medium' | 'high' = 'medium'): AriaProps {
  switch (urgency) {
    case 'high':
      return {
        'aria-live': 'assertive',
        'aria-atomic': true,
      };
    case 'medium':
      return {
        'aria-live': 'polite',
        'aria-atomic': false,
      };
    case 'low':
    default:
      return {
        'aria-live': 'off',
      };
  }
}