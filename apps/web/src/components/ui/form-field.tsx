/**
 * Accessible form field component with proper labeling and error handling
 */

import * as React from 'react'
import { cn } from '../../lib/utils'
import { HIGH_CONTRAST_CLASSES } from '../../lib/accessibility/high-contrast'

export interface FormFieldProps {
  children: React.ReactElement
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  className?: string
  labelClassName?: string
  errorClassName?: string
  helperClassName?: string
}

export function FormField({
  children,
  label,
  error,
  helperText,
  required = false,
  className,
  labelClassName,
  errorClassName,
  helperClassName,
}: FormFieldProps) {
  const fieldId = React.useId()
  const errorId = error ? `${fieldId}-error` : undefined
  const helperId = helperText ? `${fieldId}-helper` : undefined
  
  // Clone the child element with proper IDs and ARIA attributes
  const childElement = React.cloneElement(children, {
    id: fieldId,
    'aria-describedby': [
      children.props['aria-describedby'],
      helperId,
      errorId,
    ].filter(Boolean).join(' ') || undefined,
    'aria-invalid': !!error,
    'aria-required': required,
  })

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label
          htmlFor={fieldId}
          className={cn(
            'block text-sm font-medium text-gray-200',
            HIGH_CONTRAST_CLASSES.textPrimary,
            required && 'after:content-["*"] after:ml-1 after:text-red-500',
            labelClassName
          )}
        >
          {label}
        </label>
      )}
      
      {childElement}
      
      {helperText && !error && (
        <p
          id={helperId}
          className={cn(
            'text-sm text-gray-400',
            HIGH_CONTRAST_CLASSES.textSecondary,
            helperClassName
          )}
        >
          {helperText}
        </p>
      )}
      
      {error && (
        <p
          id={errorId}
          className={cn(
            'text-sm text-red-400 flex items-center',
            HIGH_CONTRAST_CLASSES.error,
            errorClassName
          )}
          role="alert"
          aria-live="polite"
        >
          <span className="mr-1" aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}

FormField.displayName = 'FormField'