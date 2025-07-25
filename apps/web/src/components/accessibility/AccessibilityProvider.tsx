/**
 * Accessibility context provider for global accessibility settings
 */

'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useReducedMotion } from '../../lib/accessibility/reduced-motion'
import { useHighContrast } from '../../lib/accessibility/high-contrast'
import { HighContrastProvider } from '../../lib/accessibility/high-contrast'

interface AccessibilityContextValue {
  prefersReducedMotion: boolean
  prefersHighContrast: boolean
  fontSize: 'small' | 'medium' | 'large'
  setFontSize: (size: 'small' | 'medium' | 'large') => void
  announceMessage: (message: string, priority?: 'polite' | 'assertive') => void
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined)

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return context
}

interface AccessibilityProviderProps {
  children: React.ReactNode
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const prefersReducedMotion = useReducedMotion()
  const prefersHighContrast = useHighContrast()
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium')

  // Announce messages to screen readers
  const announceMessage = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message
    
    document.body.appendChild(announcement)
    
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement)
      }
    }, 1000)
  }

  // Apply font size to document
  useEffect(() => {
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px',
    }
    
    document.documentElement.style.fontSize = fontSizeMap[fontSize]
  }, [fontSize])

  // Apply accessibility classes to document
  useEffect(() => {
    const classes = []
    
    if (prefersReducedMotion) {
      classes.push('reduce-motion')
    }
    
    if (prefersHighContrast) {
      classes.push('high-contrast')
    }
    
    classes.push(`font-size-${fontSize}`)
    
    document.documentElement.className = classes.join(' ')
  }, [prefersReducedMotion, prefersHighContrast, fontSize])

  const value: AccessibilityContextValue = {
    prefersReducedMotion,
    prefersHighContrast,
    fontSize,
    setFontSize,
    announceMessage,
  }

  return (
    <AccessibilityContext.Provider value={value}>
      <HighContrastProvider>
        {children}
      </HighContrastProvider>
    </AccessibilityContext.Provider>
  )
}

AccessibilityProvider.displayName = 'AccessibilityProvider'