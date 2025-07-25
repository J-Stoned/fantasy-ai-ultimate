import * as React from "react"

interface TooltipProviderProps {
  children: React.ReactNode
}

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  return <>{children}</>
}

interface TooltipProps {
  children: React.ReactNode
}

export const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  return <>{children}</>
}

interface TooltipTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

export const TooltipTrigger: React.FC<TooltipTriggerProps> = ({ children, asChild }) => {
  return <>{children}</>
}

interface TooltipContentProps {
  children: React.ReactNode
  className?: string
}

export const TooltipContent: React.FC<TooltipContentProps> = ({ children, className }) => {
  return (
    <div className={`absolute z-50 bg-black/90 text-white px-2 py-1 rounded text-sm ${className || ''}`}>
      {children}
    </div>
  )
}