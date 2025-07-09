import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow-glow-md focus:ring-primary-500 transform hover:scale-105',
        secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700 focus:ring-gray-500',
        destructive: 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-red-500/25 focus:ring-red-500',
        outline: 'border border-gray-700 bg-transparent hover:bg-white/5 text-gray-300 hover:text-white focus:ring-gray-500',
        ghost: 'hover:bg-white/5 text-gray-300 hover:text-white border border-transparent hover:border-white/10',
        link: 'text-primary-400 hover:text-primary-300 underline-offset-4 hover:underline',
        success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-green-500/25 focus:ring-green-500',
      },
      size: {
        default: 'h-10 px-5 text-base rounded-lg',
        sm: 'h-8 px-3 text-sm rounded-md',
        lg: 'h-12 px-8 text-lg rounded-lg',
        icon: 'h-10 w-10 rounded-lg',
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
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, loading }), className)}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="spinner w-5 h-5"></div>
          </div>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }