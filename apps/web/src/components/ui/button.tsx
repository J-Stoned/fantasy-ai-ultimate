'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { MOTION_SAFE_CLASSES, useReducedMotion } from '../../lib/accessibility/reduced-motion'
import { HIGH_CONTRAST_CLASSES, getHighContrastFocusRing } from '../../lib/accessibility/high-contrast'
import { getButtonAriaProps, type AriaProps } from '../../lib/accessibility/aria-helpers'

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: `bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow-glow-md focus:ring-primary-500 ${MOTION_SAFE_CLASSES.hoverScale} ${HIGH_CONTRAST_CLASSES.button}`,
        secondary: `bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700 focus:ring-gray-500 ${MOTION_SAFE_CLASSES.hoverScale} ${HIGH_CONTRAST_CLASSES.buttonSecondary}`,
        destructive: `bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-red-500/25 focus:ring-red-500 ${MOTION_SAFE_CLASSES.hoverScale} ${HIGH_CONTRAST_CLASSES.error}`,
        outline: `border border-gray-700 bg-transparent hover:bg-white/5 text-gray-300 hover:text-white focus:ring-gray-500 ${MOTION_SAFE_CLASSES.hoverScale} ${HIGH_CONTRAST_CLASSES.borderPrimary}`,
        ghost: `hover:bg-white/5 text-gray-300 hover:text-white border border-transparent hover:border-white/10 ${MOTION_SAFE_CLASSES.hoverScale}`,
        link: `text-primary-400 hover:text-primary-300 underline-offset-4 hover:underline ${HIGH_CONTRAST_CLASSES.textLink}`,
        success: `bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-green-500/25 focus:ring-green-500 ${MOTION_SAFE_CLASSES.hoverScale} ${HIGH_CONTRAST_CLASSES.success}`,
      },
      size: {
        default: 'h-10 px-5 text-base rounded-lg min-w-[44px]', // Min touch target size
        sm: 'h-8 px-3 text-sm rounded-md min-w-[32px]',
        lg: 'h-12 px-8 text-lg rounded-lg min-w-[48px]',
        icon: 'h-10 w-10 rounded-lg min-w-[44px] min-h-[44px]', // WCAG touch target
      },
      fullWidth: {
        true: 'w-full',
      },
      loading: {
        true: 'relative text-transparent pointer-events-none',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants>,
    Partial<AriaProps> {
  loading?: boolean
  loadingText?: string
  tooltip?: string
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    fullWidth, 
    loading, 
    loadingText,
    tooltip,
    children, 
    disabled,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    ...props 
  }, ref) => {
    const prefersReducedMotion = useReducedMotion()
    
    // Generate proper ARIA attributes
    const ariaProps = getButtonAriaProps({
      label: ariaLabel || tooltip,
      describedBy: ariaDescribedBy,
      disabled: disabled || loading,
    })

    return (
      <button
        className={cn(
          buttonVariants({ variant, size, fullWidth, loading }), 
          getHighContrastFocusRing(),
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...ariaProps}
        {...props}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className={`w-5 h-5 border-2 border-gray-300 border-t-current rounded-full ${
                prefersReducedMotion ? '' : 'animate-spin'
              }`}
              aria-hidden="true"
            />
            {loadingText && (
              <span className="sr-only">{loadingText}</span>
            )}
          </div>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }