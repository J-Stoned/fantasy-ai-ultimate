import React from 'react'

export interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  gradient?: boolean
  onClick?: () => void
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  gradient = false,
  onClick,
}) => {
  const baseStyles = 'rounded-xl'
  const bgStyles = gradient 
    ? 'bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg' 
    : 'bg-white/10 backdrop-blur-lg'
  const hoverStyles = hover ? 'hover:bg-white/15 transition-colors duration-200' : ''
  
  return (
    <div 
      className={`${baseStyles} ${bgStyles} ${hoverStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}