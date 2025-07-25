'use client';

/**
 * Reduced motion utilities for respecting user preferences
 */

import { useEffect, useState } from 'react';

/**
 * Hook to detect user's motion preference
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if the browser supports the media query
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      
      // Set initial value
      setPrefersReducedMotion(mediaQuery.matches);
      
      // Listen for changes
      const handleChange = (event: MediaQueryListEvent) => {
        setPrefersReducedMotion(event.matches);
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

  return prefersReducedMotion;
}

/**
 * Safe animation utilities that respect motion preferences
 */
export const SAFE_ANIMATIONS = {
  // Instant changes for reduced motion users
  instant: {
    transition: 'none',
    animation: 'none',
  },
  
  // Gentle animations that are acceptable even for reduced motion
  gentle: {
    transition: 'opacity 150ms ease-in-out',
    animation: 'none',
  },
  
  // Standard animations for users who don't prefer reduced motion
  standard: {
    transition: 'all 300ms ease-in-out',
    transform: 'scale(1.02)',
  },
  
  // More dramatic animations
  enhanced: {
    transition: 'all 500ms cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'scale(1.05) rotate(2deg)',
  },
} as const;

/**
 * Get animation styles based on user preference
 */
export function getAnimationStyles(
  level: 'instant' | 'gentle' | 'standard' | 'enhanced' = 'standard',
  prefersReducedMotion?: boolean
): React.CSSProperties {
  // If user prefers reduced motion, use gentler alternatives
  if (prefersReducedMotion) {
    switch (level) {
      case 'enhanced':
      case 'standard':
        return SAFE_ANIMATIONS.gentle;
      case 'gentle':
        return SAFE_ANIMATIONS.gentle;
      case 'instant':
      default:
        return SAFE_ANIMATIONS.instant;
    }
  }
  
  return SAFE_ANIMATIONS[level];
}

/**
 * Animation hook that respects motion preferences
 */
export function useRespectfulAnimation(
  normalAnimation: React.CSSProperties,
  reducedMotionFallback?: React.CSSProperties
): React.CSSProperties {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return reducedMotionFallback || SAFE_ANIMATIONS.gentle;
  }
  
  return normalAnimation;
}

/**
 * CSS classes for reduced motion support
 */
export const MOTION_SAFE_CLASSES = {
  // Transform animations
  scale: 'motion-safe:hover:scale-105 motion-reduce:hover:scale-100',
  rotate: 'motion-safe:hover:rotate-1 motion-reduce:hover:rotate-0',
  translate: 'motion-safe:hover:-translate-y-1 motion-reduce:hover:translate-y-0',
  
  // Transition durations
  fast: 'motion-safe:duration-150 motion-reduce:duration-0',
  normal: 'motion-safe:duration-300 motion-reduce:duration-75',
  slow: 'motion-safe:duration-500 motion-reduce:duration-150',
  
  // Animation states
  spin: 'motion-safe:animate-spin motion-reduce:animate-none',
  bounce: 'motion-safe:animate-bounce motion-reduce:animate-none',
  pulse: 'motion-safe:animate-pulse motion-reduce:animate-none',
  ping: 'motion-safe:animate-ping motion-reduce:animate-none',
  
  // Hover effects
  hoverScale: 'motion-safe:hover:scale-102 motion-reduce:hover:scale-100 transition-transform motion-safe:duration-200 motion-reduce:duration-0',
  hoverGlow: 'motion-safe:hover:shadow-lg motion-reduce:hover:shadow-none transition-shadow motion-safe:duration-300 motion-reduce:duration-0',
  hoverSlide: 'motion-safe:hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-transform motion-safe:duration-200 motion-reduce:duration-0',
} as const;

/**
 * Component wrapper that disables animations for users who prefer reduced motion
 */
interface MotionWrapperProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
  fallbackClassName?: string;
}

export function MotionWrapper({
  children,
  className = '',
  animate = true,
  fallbackClassName = '',
}: MotionWrapperProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const finalClassName = prefersReducedMotion || !animate
    ? fallbackClassName
    : className;
  
  return (
    <div className={finalClassName}>
      {children}
    </div>
  );
}

/**
 * Safe loading spinner that respects motion preferences
 */
export function SafeLoadingSpinner({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  
  if (prefersReducedMotion) {
    // Static loading indicator for reduced motion users
    return (
      <div className={`${sizeClasses[size]} ${className}`}>
        <div className="w-full h-full border-2 border-gray-300 border-t-blue-600 rounded-full" />
      </div>
    );
  }
  
  // Animated spinner for users who don't prefer reduced motion
  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="w-full h-full border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

/**
 * Transition helper for page/component transitions
 */
export function getTransitionClasses(
  type: 'fade' | 'slide' | 'scale' | 'none' = 'fade',
  prefersReducedMotion?: boolean
): string {
  if (prefersReducedMotion) {
    return 'transition-opacity duration-75';
  }
  
  switch (type) {
    case 'fade':
      return 'transition-opacity duration-300 ease-in-out';
    case 'slide':
      return 'transition-transform duration-300 ease-in-out';
    case 'scale':
      return 'transition-transform duration-300 ease-in-out';
    case 'none':
    default:
      return '';
  }
}

/**
 * Auto-play controls for media that respect motion preferences
 */
export function useAutoPlayPreference(): boolean {
  const prefersReducedMotion = useReducedMotion();
  
  // Don't auto-play if user prefers reduced motion
  return !prefersReducedMotion;
}

/**
 * Parallax effect that respects motion preferences
 */
export function useParallaxEffect(
  offset: number = 0.5,
  enabled: boolean = true
): React.CSSProperties {
  const prefersReducedMotion = useReducedMotion();
  const [scrollY, setScrollY] = useState(0);
  
  useEffect(() => {
    if (prefersReducedMotion || !enabled) return;
    
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prefersReducedMotion, enabled]);
  
  if (prefersReducedMotion || !enabled) {
    return {};
  }
  
  return {
    transform: `translateY(${scrollY * offset}px)`,
    transition: 'transform 0.1s ease-out',
  };
}