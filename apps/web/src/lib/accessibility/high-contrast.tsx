'use client';

/**
 * High contrast mode utilities and theme support
 */

import { useEffect, useState } from 'react';

/**
 * Hook to detect high contrast mode preference
 */
export function useHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-contrast: high)');
      
      // Set initial value
      setPrefersHighContrast(mediaQuery.matches);
      
      // Listen for changes
      const handleChange = (event: MediaQueryListEvent) => {
        setPrefersHighContrast(event.matches);
      };
      
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, []);

  return prefersHighContrast;
}

/**
 * High contrast color palette
 */
export const HIGH_CONTRAST_COLORS = {
  // Text colors
  text: {
    primary: '#000000',    // Pure black
    secondary: '#ffffff',  // Pure white
    link: '#0000ff',       // Pure blue
    visited: '#800080',    // Purple
    focus: '#ffffff',      // White on dark background
  },
  
  // Background colors
  background: {
    primary: '#ffffff',    // Pure white
    secondary: '#000000',  // Pure black
    highlight: '#ffff00',  // Pure yellow
    selected: '#0000ff',   // Pure blue
  },
  
  // Border colors
  border: {
    primary: '#000000',    // Pure black
    secondary: '#808080',  // Gray
    focus: '#ffffff',      // White for focus rings on dark backgrounds
  },
  
  // Status colors
  status: {
    success: '#008000',    // Pure green
    error: '#ff0000',      // Pure red
    warning: '#ff8000',    // Orange
    info: '#0000ff',       // Pure blue
  },
} as const;

/**
 * Get high contrast styles based on user preference
 */
export function getHighContrastStyles(
  element: 'text' | 'background' | 'border' | 'button' | 'input' | 'link',
  variant: 'primary' | 'secondary' | 'accent' = 'primary',
  prefersHighContrast?: boolean
): React.CSSProperties {
  if (!prefersHighContrast) {
    return {};
  }
  
  switch (element) {
    case 'text':
      return {
        color: variant === 'primary' ? HIGH_CONTRAST_COLORS.text.primary : HIGH_CONTRAST_COLORS.text.secondary,
        fontWeight: '600', // Slightly bolder for better visibility
      };
    
    case 'background':
      return {
        backgroundColor: variant === 'primary' ? HIGH_CONTRAST_COLORS.background.primary : HIGH_CONTRAST_COLORS.background.secondary,
      };
    
    case 'border':
      return {
        borderColor: HIGH_CONTRAST_COLORS.border.primary,
        borderWidth: '2px', // Thicker borders for better visibility
      };
    
    case 'button':
      return {
        backgroundColor: HIGH_CONTRAST_COLORS.background.secondary,
        color: HIGH_CONTRAST_COLORS.text.secondary,
        border: `2px solid ${HIGH_CONTRAST_COLORS.border.primary}`,
        fontWeight: '600',
      };
    
    case 'input':
      return {
        backgroundColor: HIGH_CONTRAST_COLORS.background.primary,
        color: HIGH_CONTRAST_COLORS.text.primary,
        border: `2px solid ${HIGH_CONTRAST_COLORS.border.primary}`,
      };
    
    case 'link':
      return {
        color: HIGH_CONTRAST_COLORS.text.link,
        textDecoration: 'underline',
        fontWeight: '600',
      };
    
    default:
      return {};
  }
}

/**
 * High contrast CSS classes
 */
export const HIGH_CONTRAST_CLASSES = {
  // Text
  textPrimary: 'contrast-more:text-black contrast-more:font-semibold',
  textSecondary: 'contrast-more:text-white contrast-more:font-semibold',
  textLink: 'contrast-more:text-blue-600 contrast-more:underline contrast-more:font-semibold',
  
  // Backgrounds
  bgPrimary: 'contrast-more:bg-white',
  bgSecondary: 'contrast-more:bg-black',
  bgHighlight: 'contrast-more:bg-yellow-400',
  
  // Borders
  borderPrimary: 'contrast-more:border-black contrast-more:border-2',
  borderSecondary: 'contrast-more:border-gray-600 contrast-more:border-2',
  borderFocus: 'contrast-more:focus:border-white contrast-more:focus:border-2',
  
  // Buttons
  button: 'contrast-more:bg-black contrast-more:text-white contrast-more:border-black contrast-more:border-2 contrast-more:font-semibold',
  buttonSecondary: 'contrast-more:bg-white contrast-more:text-black contrast-more:border-black contrast-more:border-2 contrast-more:font-semibold',
  
  // Inputs
  input: 'contrast-more:bg-white contrast-more:text-black contrast-more:border-black contrast-more:border-2',
  
  // Status colors
  success: 'contrast-more:text-green-800 contrast-more:bg-green-100 contrast-more:border-green-800',
  error: 'contrast-more:text-red-800 contrast-more:bg-red-100 contrast-more:border-red-800',
  warning: 'contrast-more:text-orange-800 contrast-more:bg-orange-100 contrast-more:border-orange-800',
  info: 'contrast-more:text-blue-800 contrast-more:bg-blue-100 contrast-more:border-blue-800',
} as const;

/**
 * Theme provider for high contrast mode
 */
interface HighContrastProviderProps {
  children: React.ReactNode
  className?: string
}

export function HighContrastProvider({ children, className = '' }: HighContrastProviderProps) {
  const prefersHighContrast = useHighContrast()
  
  const themeClass = prefersHighContrast ? 'high-contrast-theme' : ''
  
  return (
    <div className={`${themeClass} ${className}`}>
      {children}
    </div>
  )
}

/**
 * Hook for applying high contrast styles conditionally
 */
export function useHighContrastStyles<T extends Record<string, any>>(
  normalStyles: T,
  highContrastStyles: Partial<T>
): T {
  const prefersHighContrast = useHighContrast();
  
  if (prefersHighContrast) {
    return { ...normalStyles, ...highContrastStyles };
  }
  
  return normalStyles;
}

/**
 * Utility to combine regular classes with high contrast classes
 */
export function combineWithHighContrast(
  regularClasses: string,
  highContrastClasses: string
): string {
  return `${regularClasses} ${highContrastClasses}`;
}

/**
 * Focus ring utility that works in high contrast mode
 */
export function getHighContrastFocusRing(
  color: 'blue' | 'white' | 'black' = 'blue'
): string {
  switch (color) {
    case 'white':
      return 'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black contrast-more:focus:ring-white contrast-more:focus:ring-2';
    case 'black':
      return 'focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-white contrast-more:focus:ring-black contrast-more:focus:ring-2';
    case 'blue':
    default:
      return 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 contrast-more:focus:ring-blue-600 contrast-more:focus:ring-2';
  }
}

/**
 * Image overlay for better visibility in high contrast mode
 */
export function HighContrastImageOverlay({
  children,
  overlayOpacity = 0.8,
}: {
  children: React.ReactNode
  overlayOpacity?: number
}) {
  const prefersHighContrast = useHighContrast()
  
  if (!prefersHighContrast) {
    return <>{children}</>
  }
  
  return (
    <div className="relative">
      {children}
      <div 
        className="absolute inset-0 bg-black pointer-events-none"
        style={{ opacity: overlayOpacity }}
        aria-hidden="true"
      />
    </div>
  )
}

/**
 * Chart/visualization accessibility for high contrast
 */
export const HIGH_CONTRAST_CHART_COLORS = [
  '#000000', // Black
  '#ffffff', // White
  '#ff0000', // Red
  '#00ff00', // Green
  '#0000ff', // Blue
  '#ffff00', // Yellow
  '#ff00ff', // Magenta
  '#00ffff', // Cyan
] as const;

/**
 * Get chart colors that work in high contrast mode
 */
export function getHighContrastChartColors(count: number): string[] {
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(HIGH_CONTRAST_CHART_COLORS[i % HIGH_CONTRAST_CHART_COLORS.length]);
  }
  return colors;
}