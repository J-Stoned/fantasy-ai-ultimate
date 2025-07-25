/**
 * Accessibility testing and monitoring dashboard
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { 
  runAccessibilityAudit, 
  generateAccessibilityReport,
  type AccessibilityIssue 
} from '../../lib/accessibility/testing'
import { useAccessibility } from './AccessibilityProvider'
import { getContrastRatio } from '../../lib/accessibility/color-contrast'

export function AccessibilityDashboard() {
  const [auditResults, setAuditResults] = useState<{
    issues: AccessibilityIssue[]
    summary: { total: number; errors: number; warnings: number; info: number }
  } | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const { prefersReducedMotion, prefersHighContrast, fontSize, setFontSize } = useAccessibility()

  const runAudit = async () => {
    setIsRunning(true)
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500))
      const results = runAccessibilityAudit()
      setAuditResults(results)
    } finally {
      setIsRunning(false)
    }
  }

  const downloadReport = () => {
    if (!auditResults) return
    
    const report = generateAccessibilityReport()
    const blob = new Blob([report], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'destructive'
      case 'warning': return 'warning'
      case 'info': return 'secondary'
      default: return 'secondary'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '•'
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accessibility Dashboard</h1>
          <p className="text-gray-400">Monitor and test WCAG 2.1 AA compliance</p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={runAudit}
            loading={isRunning}
            loadingText="Running audit..."
            aria-label="Run accessibility audit"
          >
            Run Audit
          </Button>
          {auditResults && (
            <Button
              variant="outline"
              onClick={downloadReport}
              aria-label="Download accessibility report"
            >
              Download Report
            </Button>
          )}
        </div>
      </div>

      {/* User Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>User Preferences</CardTitle>
          <CardDescription>Current accessibility settings and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motion Preference</label>
              <Badge variant={prefersReducedMotion ? 'secondary' : 'outline'}>
                {prefersReducedMotion ? 'Reduced Motion' : 'Standard Motion'}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Contrast Preference</label>
              <Badge variant={prefersHighContrast ? 'secondary' : 'outline'}>
                {prefersHighContrast ? 'High Contrast' : 'Standard Contrast'}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="font-size-select" className="text-sm font-medium">Font Size</label>
              <select
                id="font-size-select"
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value as 'small' | 'medium' | 'large')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select font size preference"
              >
                <option value="small">Small (14px)</option>
                <option value="medium">Medium (16px)</option>
                <option value="large">Large (18px)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Results */}
      {auditResults && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Summary</CardTitle>
              <CardDescription>Overall accessibility compliance status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">{auditResults.summary.total}</div>
                  <div className="text-sm text-gray-400">Total Issues</div>
                </div>
                <div className="text-center p-4 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-red-400">{auditResults.summary.errors}</div>
                  <div className="text-sm text-gray-400">Errors</div>
                </div>
                <div className="text-center p-4 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-400">{auditResults.summary.warnings}</div>
                  <div className="text-sm text-gray-400">Warnings</div>
                </div>
                <div className="text-center p-4 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">{auditResults.summary.info}</div>
                  <div className="text-sm text-gray-400">Info</div>
                </div>
              </div>
              
              {auditResults.summary.total === 0 && (
                <div className="mt-4 p-4 bg-green-900/20 border border-green-800 rounded-lg text-center">
                  <div className="text-green-400 text-lg font-medium">✅ No accessibility issues found!</div>
                  <div className="text-green-300 text-sm mt-1">Your application meets WCAG 2.1 AA standards</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issues List */}
          {auditResults.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Issues Found</CardTitle>
                <CardDescription>Detailed list of accessibility issues that need attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {auditResults.issues.map((issue, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-700 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getSeverityIcon(issue.severity)}</span>
                          <Badge variant={getSeverityColor(issue.severity) as any}>
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">
                            {issue.type}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="text-white font-medium">{issue.message}</div>
                      
                      {issue.selector && (
                        <div className="text-sm text-gray-400">
                          <strong>Element:</strong> <code className="bg-gray-800 px-1 rounded">{issue.selector}</code>
                        </div>
                      )}
                      
                      {issue.fix && (
                        <div className="text-sm text-blue-300">
                          <strong>How to fix:</strong> {issue.fix}
                        </div>
                      )}
                      
                      {issue.element && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            issue.element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            issue.element?.focus()
                          }}
                          aria-label={`Navigate to problematic element: ${issue.selector}`}
                        >
                          Focus Element
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Quick Tests */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Accessibility Tests</CardTitle>
          <CardDescription>Common accessibility checks you can perform manually</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">Keyboard Navigation</h3>
              <p className="text-sm text-gray-400 mb-3">
                Test that all interactive elements can be reached and activated using only the keyboard.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Use Tab to navigate forward</li>
                <li>• Use Shift+Tab to navigate backward</li>
                <li>• Use Enter/Space to activate buttons</li>
                <li>• Use arrow keys in menus/lists</li>
              </ul>
            </div>
            
            <div className="p-4 border border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">Screen Reader</h3>
              <p className="text-sm text-gray-400 mb-3">
                Test with a screen reader to ensure content is properly announced.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Images have alt text</li>
                <li>• Buttons have accessible names</li>
                <li>• Form fields have labels</li>
                <li>• Headings are properly structured</li>
              </ul>
            </div>
            
            <div className="p-4 border border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">Color & Contrast</h3>
              <p className="text-sm text-gray-400 mb-3">
                Ensure sufficient color contrast and information isn't conveyed by color alone.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Text contrast ≥ 4.5:1 (normal)</li>
                <li>• Text contrast ≥ 3:1 (large)</li>
                <li>• Non-text contrast ≥ 3:1</li>
                <li>• Focus indicators visible</li>
              </ul>
            </div>
            
            <div className="p-4 border border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">Responsive Design</h3>
              <p className="text-sm text-gray-400 mb-3">
                Test responsiveness and touch target sizes on mobile devices.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Touch targets ≥ 44px</li>
                <li>• Content reflows properly</li>
                <li>• No horizontal scrolling</li>
                <li>• Zoom up to 200% works</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

AccessibilityDashboard.displayName = 'AccessibilityDashboard'