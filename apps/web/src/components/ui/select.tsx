import * as React from "react"
import { cn } from '../../lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const selectVariants = cva(
  'w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-gray-100 transition-all duration-200 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'border-gray-800 focus:border-primary-500 focus:ring-primary-500',
        error: 'border-red-500 focus:border-red-500 focus:ring-red-500',
        success: 'border-green-500 focus:border-green-500 focus:ring-green-500',
      },
      selectSize: {
        sm: 'h-8 text-sm px-3 py-1',
        md: 'h-10 text-base',
        lg: 'h-12 text-lg px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      selectSize: 'md',
    },
  }
)

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>,
    VariantProps<typeof selectVariants> {
  icon?: React.ReactNode
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant, selectSize, icon, children, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            {icon}
          </div>
        )}
        <select
          className={cn(
            selectVariants({ variant, selectSize }),
            icon && 'pl-10',
            'pr-10',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select, selectVariants }