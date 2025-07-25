'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '../ui'
import { 
  useFocusTrap, 
  useFocusRestore, 
  useEscapeKey, 
  KeyboardKeys 
} from '../../lib/accessibility/focus-management'
import { getNavigationAriaProps } from '../../lib/accessibility/aria-helpers'
import { useStatusAnnouncer } from '../../lib/accessibility/live-region'
import { HIGH_CONTRAST_CLASSES } from '../../lib/accessibility/high-contrast'

interface MobileNavProps {
  user?: any
  profile?: any
}

export function MobileNav({ user, profile }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const drawerRef = useFocusTrap(isOpen)
  const { captureFocus, restoreFocus } = useFocusRestore()
  const { announceInfo } = useStatusAnnouncer()

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠', description: 'Go to main dashboard' },
    { href: '/dfs-optimizer', label: 'DFS Lineup', icon: '🚀', description: 'Build daily fantasy lineups' },
    { href: '/players', label: 'Players', icon: '👥', description: 'Browse player database' },
    { href: '/leagues', label: 'Leagues', icon: '🏆', description: 'Manage your leagues' },
    { href: '/trade-analyzer', label: 'Trades', icon: '💱', description: 'Analyze trade opportunities' },
    { href: '/waiver-wire', label: 'Waivers', icon: '📈', description: 'Check waiver wire targets' },
    { href: '/import-league', label: 'Import', icon: '📥', description: 'Import league data' },
  ]

  const openDrawer = () => {
    captureFocus()
    setIsOpen(true)
    announceInfo('Mobile navigation menu opened')
  }

  const closeDrawer = () => {
    setIsOpen(false)
    restoreFocus()
    announceInfo('Mobile navigation menu closed')
  }

  // Close on escape key
  useEscapeKey(closeDrawer, isOpen)

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={openDrawer}
        className={`md:hidden p-2 text-gray-300 hover:text-white min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-md ${HIGH_CONTRAST_CLASSES.button}`}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
        aria-haspopup="true"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Mobile Menu Drawer */}
      <nav
        ref={drawerRef}
        id="mobile-nav-menu"
        className={`fixed top-0 right-0 h-full w-64 bg-gray-900 border-l border-gray-800 transform transition-transform duration-300 z-50 md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${HIGH_CONTRAST_CLASSES.bgSecondary} ${HIGH_CONTRAST_CLASSES.borderPrimary}`}
        aria-label="Main navigation"
        aria-hidden={!isOpen}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className={`text-xl font-bold text-white ${HIGH_CONTRAST_CLASSES.textSecondary}`}>
              Menu
            </h2>
            <button
              onClick={closeDrawer}
              className={`p-2 text-gray-400 hover:text-white min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-md ${HIGH_CONTRAST_CLASSES.button}`}
              aria-label="Close navigation menu"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* User Info */}
          {user && (
            <div className={`mb-6 p-4 glass-card rounded-lg ${HIGH_CONTRAST_CLASSES.bgPrimary} ${HIGH_CONTRAST_CLASSES.borderPrimary}`}>
              <p className={`text-sm text-gray-400 ${HIGH_CONTRAST_CLASSES.textSecondary}`}>
                Signed in as
              </p>
              <p className={`text-white font-medium truncate ${HIGH_CONTRAST_CLASSES.textPrimary}`}>
                {profile?.username || user.email}
              </p>
            </div>
          )}

          {/* Navigation Links */}
          <div className="space-y-2" role="list">
            {navItems.map((item, index) => (
              <div key={item.href} role="listitem">
                <Link
                  href={item.href}
                  onClick={closeDrawer}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${HIGH_CONTRAST_CLASSES.textLink}`}
                  aria-describedby={`nav-desc-${index}`}
                  {...getNavigationAriaProps({ current: false })}
                >
                  <span className="text-xl" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
                <span id={`nav-desc-${index}`} className="sr-only">
                  {item.description}
                </span>
              </div>
            ))}
          </div>

          {/* Bottom Actions */}
          <div className={`absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 ${HIGH_CONTRAST_CLASSES.borderPrimary}`}>
            <Link
              href="/pricing"
              className={`flex items-center justify-center w-full px-4 py-3 mb-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all min-h-[44px] focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${HIGH_CONTRAST_CLASSES.button}`}
              onClick={closeDrawer}
              aria-label="Upgrade to Pro plan"
            >
              <span aria-hidden="true">⚡</span> Upgrade to Pro
            </Link>
            
            {user && (
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className={`w-full text-center px-4 py-3 text-gray-400 hover:text-white transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-md ${HIGH_CONTRAST_CLASSES.button}`}
                  aria-label="Sign out of your account"
                >
                  Sign Out
                </button>
              </form>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}