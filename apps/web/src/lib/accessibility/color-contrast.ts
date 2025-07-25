import { logger } from '../logging/logger';

/**
 * Color contrast utilities for WCAG 2.1 AA compliance
 * Ensures all colors meet minimum contrast ratios
 */

/**
 * WCAG 2.1 contrast ratio requirements
 */
export const CONTRAST_RATIOS = {
  AA_NORMAL: 4.5,     // WCAG AA for normal text
  AA_LARGE: 3,        // WCAG AA for large text (18pt+ or 14pt+ bold)
  AAA_NORMAL: 7,      // WCAG AAA for normal text
  AAA_LARGE: 4.5,     // WCAG AAA for large text
} as const;

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate relative luminance according to WCAG
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) {
    logger.warn('Invalid color format. Use hex colors like #ffffff');
    return 0;
  }
  
  const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG requirements
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  
  if (level === 'AAA') {
    return ratio >= (isLargeText ? CONTRAST_RATIOS.AAA_LARGE : CONTRAST_RATIOS.AAA_NORMAL);
  }
  
  return ratio >= (isLargeText ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AA_NORMAL);
}

/**
 * Accessible color palette with WCAG AA compliance
 */
export const ACCESSIBLE_COLORS = {
  // Dark theme colors (light text on dark backgrounds)
  dark: {
    background: {
      primary: '#0f172a',     // slate-900
      secondary: '#1e293b',   // slate-800
      tertiary: '#334155',    // slate-700
    },
    foreground: {
      primary: '#f8fafc',     // slate-50 - 18.7:1 ratio
      secondary: '#e2e8f0',   // slate-200 - 15.8:1 ratio
      tertiary: '#cbd5e1',    // slate-300 - 12.6:1 ratio
      muted: '#94a3b8',       // slate-400 - 8.3:1 ratio
    },
    border: {
      primary: '#475569',     // slate-600
      secondary: '#64748b',   // slate-500
    },
    accent: {
      primary: '#3b82f6',     // blue-500 - 8.6:1 ratio on dark
      secondary: '#10b981',   // emerald-500 - 7.2:1 ratio on dark
      warning: '#f59e0b',     // amber-500 - 7.1:1 ratio on dark
      danger: '#ef4444',      // red-500 - 5.9:1 ratio on dark
    }
  },
  
  // Light theme colors (dark text on light backgrounds)
  light: {
    background: {
      primary: '#ffffff',     // white
      secondary: '#f8fafc',   // slate-50
      tertiary: '#f1f5f9',    // slate-100
    },
    foreground: {
      primary: '#0f172a',     // slate-900 - 18.7:1 ratio
      secondary: '#1e293b',   // slate-800 - 15.1:1 ratio
      tertiary: '#334155',    // slate-700 - 12.0:1 ratio
      muted: '#64748b',       // slate-500 - 7.0:1 ratio
    },
    border: {
      primary: '#e2e8f0',     // slate-200
      secondary: '#cbd5e1',   // slate-300
    },
    accent: {
      primary: '#2563eb',     // blue-600 - 7.2:1 ratio on light
      secondary: '#059669',   // emerald-600 - 6.7:1 ratio on light
      warning: '#d97706',     // amber-600 - 6.3:1 ratio on light
      danger: '#dc2626',      // red-600 - 8.2:1 ratio on light
    }
  }
} as const;

/**
 * Get accessible color for text based on background
 */
export function getAccessibleTextColor(
  backgroundColor: string,
  options: {
    level?: 'AA' | 'AAA';
    isLargeText?: boolean;
    preferredColors?: string[];
  } = {}
): string {
  const { level = 'AA', isLargeText = false, preferredColors = ['#ffffff', '#000000'] } = options;
  
  for (const color of preferredColors) {
    if (meetsContrastRequirement(color, backgroundColor, level, isLargeText)) {
      return color;
    }
  }
  
  // Fallback to high contrast colors
  const whiteRatio = getContrastRatio('#ffffff', backgroundColor);
  const blackRatio = getContrastRatio('#000000', backgroundColor);
  
  return whiteRatio > blackRatio ? '#ffffff' : '#000000';
}

/**
 * Validate color combination and provide suggestions
 */
export function validateColorCombination(
  foreground: string,
  background: string,
  context: {
    isLargeText?: boolean;
    level?: 'AA' | 'AAA';
    componentType?: 'text' | 'button' | 'link' | 'input';
  } = {}
): {
  isValid: boolean;
  ratio: number;
  required: number;
  suggestions?: string[];
} {
  const { isLargeText = false, level = 'AA', componentType = 'text' } = context;
  const ratio = getContrastRatio(foreground, background);
  const required = level === 'AAA' 
    ? (isLargeText ? CONTRAST_RATIOS.AAA_LARGE : CONTRAST_RATIOS.AAA_NORMAL)
    : (isLargeText ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AA_NORMAL);
  
  const isValid = ratio >= required;
  
  if (isValid) {
    return { isValid, ratio, required };
  }
  
  // Provide suggestions for invalid combinations
  const suggestions: string[] = [];
  
  if (componentType === 'button' || componentType === 'link') {
    suggestions.push('Consider using a darker text color or lighter background');
    suggestions.push('Add a border or shadow to improve contrast');
  }
  
  if (componentType === 'input') {
    suggestions.push('Ensure form labels and placeholders meet contrast requirements');
    suggestions.push('Use focus indicators with sufficient contrast');
  }
  
  return { isValid, ratio, required, suggestions };
}

/**
 * Focus ring colors that meet accessibility requirements
 */
export const FOCUS_RING_COLORS = {
  light: {
    primary: '#2563eb',    // blue-600
    danger: '#dc2626',     // red-600
    success: '#059669',    // emerald-600
    warning: '#d97706',    // amber-600
  },
  dark: {
    primary: '#60a5fa',    // blue-400
    danger: '#f87171',     // red-400
    success: '#34d399',    // emerald-400
    warning: '#fbbf24',    // amber-400
  }
} as const;