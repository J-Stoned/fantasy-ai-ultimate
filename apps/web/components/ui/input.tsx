import * as React from "react"
import { cn } from '../../lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const inputVariants = cva(
  'w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-gray-100 placeholder-gray-500 transition-all duration-200 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-gray-800 focus:border-primary-500 focus:ring-primary-500',
        error: 'border-red-500 focus:border-red-500 focus:ring-red-500',
        success: 'border-green-500 focus:border-green-500 focus:ring-green-500',
      },
      inputSize: {
        sm: 'h-8 text-sm px-3 py-1',
        md: 'h-10 text-base',
        lg: 'h-12 text-lg px-5',
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
    VariantProps<typeof inputVariants> {
  icon?: React.ReactNode
  rightElement?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, icon, rightElement, ...props }, ref) => {
    if (icon || rightElement) {
      return (
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {icon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ variant, inputSize }),
              icon && 'pl-10',
              rightElement && 'pr-10',
              className
            )}
            ref={ref}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>
      )
    }

    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }