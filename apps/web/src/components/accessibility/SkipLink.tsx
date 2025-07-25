/**
 * Skip link component for keyboard navigation
 */

import { useSkipLink } from '../../lib/accessibility/focus-management'
import { HIGH_CONTRAST_CLASSES } from '../../lib/accessibility/high-contrast'

export interface SkipLinkProps {
  href: string
  children: React.ReactNode
  className?: string
}

export function SkipLink({ href, children, className = '' }: SkipLinkProps) {
  const targetId = href.replace('#', '')
  const skipToContent = useSkipLink(targetId)

  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        skipToContent()
      }}
      className={`
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 
        focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md 
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        focus:no-underline focus:font-medium focus:text-sm
        ${HIGH_CONTRAST_CLASSES.button}
        ${className}
      `}
    >
      {children}
    </a>
  )
}

/**
 * Skip navigation component with multiple skip links
 */
export function SkipNavigation() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <SkipLink href="#primary-navigation">Skip to navigation</SkipLink>
      <SkipLink href="#search">Skip to search</SkipLink>
    </div>
  )
}

SkipLink.displayName = 'SkipLink'
SkipNavigation.displayName = 'SkipNavigation'