import * as React from "react"
import { cn } from '../../lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { getFormFieldAriaProps, type AriaProps, generateId } from '../../lib/accessibility/aria-helpers'
import { HIGH_CONTRAST_CLASSES, getHighContrastFocusRing } from '../../lib/accessibility/high-contrast'

const inputVariants = cva(
  `w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-gray-100 placeholder-gray-500 transition-all duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] ${HIGH_CONTRAST_CLASSES.input}`,
  {
    variants: {
      variant: {
        default: `border-gray-800 focus:border-primary-500 focus:ring-primary-500 ${HIGH_CONTRAST_CLASSES.borderPrimary}`,
        error: `border-red-500 focus:border-red-500 focus:ring-red-500 ${HIGH_CONTRAST_CLASSES.error}`,
        success: `border-green-500 focus:border-green-500 focus:ring-green-500 ${HIGH_CONTRAST_CLASSES.success}`,
      },
      inputSize: {
        sm: 'h-8 text-sm px-3 py-1 min-h-[32px]',
        md: 'h-10 text-base min-h-[44px]',
        lg: 'h-12 text-lg px-5 min-h-[48px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'md',
    },
  }
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants>,
    Partial<AriaProps> {
  icon?: React.ReactNode
  rightElement?: React.ReactNode
  label?: string
  error?: string
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type, 
    variant, 
    inputSize, 
    icon, 
    rightElement, 
    label,
    error,
    helperText,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    required,
    ...props 
  }, ref) => {
    const inputId = React.useId()
    const errorId = error ? `${inputId}-error` : undefined
    const helperId = helperText ? `${inputId}-helper` : undefined
    
    // Determine variant based on error state
    const inputVariant = error ? 'error' : variant
    
    // Generate ARIA props
    const ariaProps = getFormFieldAriaProps({
      label: ariaLabel || label,
      labelledBy: ariaLabelledBy,
      describedBy: [ariaDescribedBy, helperId, errorId].filter(Boolean).join(' ') || undefined,
      invalid: !!error,
      required: required,
      errorId,
    })

    const inputElement = (
      <input
        type={type}
        className={cn(
          inputVariants({ variant: inputVariant, inputSize }),
          getHighContrastFocusRing(),
          icon && 'pl-10',
          rightElement && 'pr-10',
          className
        )}
        ref={ref}
        id={inputId}
        {...ariaProps}
        required={required}
        {...props}
      />
    )

    if (icon || rightElement) {
      return (
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true">
              {icon}
            </div>
          )}
          {inputElement}
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>
      )
    }

    return inputElement
  }
)
Input.displayName = "Input"

export { Input, inputVariants }