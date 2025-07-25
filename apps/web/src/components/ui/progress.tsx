'use client';

import * as React from "react"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={`relative h-2 w-full overflow-hidden rounded-full bg-gray-800 ${className || ''}`}
      {...props}
    >
      <div
        className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500 ease-out rounded-full"
        style={{ width: `${Math.min(Math.max(value || 0, 0), 100)}%` }}
      />
    </div>
  )
)
Progress.displayName = "Progress"

export { Progress }