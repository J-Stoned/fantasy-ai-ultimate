'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '../ui'

interface MobileNavProps {
  user?: any
  profile?: any
}

export function MobileNav({ user, profile }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/patterns', label: 'Patterns', icon: '🎯' },
    { href: '/lineup-optimizer', label: 'Lineup', icon: '🚀' },
    { href: '/trade-analyzer', label: 'Trades', icon: '💱' },
    { href: '/waiver-wire', label: 'Waivers', icon: '📈' },
    { href: '/live', label: 'Live', icon: '📡' },
    { href: '/ai-assistant', label: 'AI Chat', icon: '🤖' },
    { href: '/import-league', label: 'Import', icon: '📥' },
  ]

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden p-2 text-gray-300 hover:text-white"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-gray-900 border-l border-gray-800 transform transition-transform duration-300 z-50 md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-white">Menu</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
            <div className="mb-6 p-4 glass-card rounded-lg">
              <p className="text-sm text-gray-400">Signed in as</p>
              <p className="text-white font-medium truncate">
                {profile?.username || user.email}
              </p>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
            <Link
              href="/pricing"
              className="flex items-center justify-center w-full px-4 py-3 mb-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all"
              onClick={() => setIsOpen(false)}
            >
              ⚡ Upgrade to Pro
            </Link>
            
            {user && (
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full text-center px-4 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Sign Out
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}