/**
 * Accessibility testing utilities for development and quality assurance
 */

import { getContrastRatio, CONTRAST_RATIOS } from './color-contrast'

export interface AccessibilityIssue {
  type: 'contrast' | 'focus' | 'aria' | 'structure' | 'keyboard'
  severity: 'error' | 'warning' | 'info'
  message: string
  element?: HTMLElement
  selector?: string
  fix?: string
}

/**
 * Audit color contrast for all text elements
 */
export function auditColorContrast(container: HTMLElement = document.body): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const textElements = container.querySelectorAll('*')

  textElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    const styles = window.getComputedStyle(htmlElement)
    const textContent = htmlElement.textContent?.trim()

    if (!textContent || textContent.length === 0) return

    const color = styles.color
    const backgroundColor = styles.backgroundColor
    const fontSize = parseFloat(styles.fontSize)
    const fontWeight = styles.fontWeight

    // Skip if colors are not defined or transparent
    if (!color || !backgroundColor || backgroundColor === 'rgba(0, 0, 0, 0)') return

    try {
      const ratio = getContrastRatio(rgbToHex(color), rgbToHex(backgroundColor))
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700))
      const requiredRatio = isLargeText ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AA_NORMAL

      if (ratio < requiredRatio) {
        issues.push({
          type: 'contrast',
          severity: 'error',
          message: `Insufficient color contrast: ${ratio.toFixed(2)}:1 (required: ${requiredRatio}:1)`,
          element: htmlElement,
          selector: getElementSelector(htmlElement),
          fix: `Increase contrast between text color (${color}) and background (${backgroundColor})`,
        })
      }
    } catch (error) {
      // Skip elements with unparseable colors
    }
  })

  return issues
}

/**
 * Audit ARIA attributes and roles
 */
export function auditAria(container: HTMLElement = document.body): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []

  // Check for missing alt text on images
  const images = container.querySelectorAll('img')
  images.forEach((img) => {
    if (!img.alt && !img.getAttribute('aria-hidden')) {
      issues.push({
        type: 'aria',
        severity: 'error',
        message: 'Image missing alt text',
        element: img,
        selector: getElementSelector(img),
        fix: 'Add descriptive alt text or aria-hidden="true" for decorative images',
      })
    }
  })

  // Check for buttons without accessible names
  const buttons = container.querySelectorAll('button, [role="button"]')
  buttons.forEach((button) => {
    const htmlButton = button as HTMLElement
    const accessibleName = getAccessibleName(htmlButton)
    
    if (!accessibleName) {
      issues.push({
        type: 'aria',
        severity: 'error',
        message: 'Button missing accessible name',
        element: htmlButton,
        selector: getElementSelector(htmlButton),
        fix: 'Add aria-label, aria-labelledby, or visible text content',
      })
    }
  })

  // Check for form inputs without labels
  const inputs = container.querySelectorAll('input, select, textarea')
  inputs.forEach((input) => {
    const htmlInput = input as HTMLInputElement
    const hasLabel = htmlInput.labels && htmlInput.labels.length > 0
    const hasAriaLabel = htmlInput.getAttribute('aria-label')
    const hasAriaLabelledBy = htmlInput.getAttribute('aria-labelledby')

    if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
      issues.push({
        type: 'aria',
        severity: 'error',
        message: 'Form input missing label',
        element: htmlInput,
        selector: getElementSelector(htmlInput),
        fix: 'Add a <label> element or aria-label/aria-labelledby attribute',
      })
    }
  })

  return issues
}

/**
 * Audit heading structure
 */
export function auditHeadingStructure(container: HTMLElement = document.body): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  
  let previousLevel = 0
  
  headings.forEach((heading) => {
    const level = parseInt(heading.tagName.substring(1))
    
    if (level - previousLevel > 1) {
      issues.push({
        type: 'structure',
        severity: 'warning',
        message: `Heading level skipped: jumped from h${previousLevel} to h${level}`,
        element: heading as HTMLElement,
        selector: getElementSelector(heading as HTMLElement),
        fix: 'Use consecutive heading levels (h1 → h2 → h3) for proper document structure',
      })
    }
    
    previousLevel = level
  })

  return issues
}

/**
 * Audit keyboard navigation
 */
export function auditKeyboardNavigation(container: HTMLElement = document.body): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  
  // Check for interactive elements without proper focus handling
  const interactiveElements = container.querySelectorAll('button, a, input, select, textarea, [tabindex], [role="button"], [role="link"]')
  
  interactiveElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    
    // Check if element is focusable
    if (htmlElement.tabIndex < 0 && !htmlElement.hasAttribute('disabled')) {
      issues.push({
        type: 'keyboard',
        severity: 'warning',
        message: 'Interactive element not focusable',
        element: htmlElement,
        selector: getElementSelector(htmlElement),
        fix: 'Remove negative tabindex or add proper focus handling',
      })
    }
    
    // Check for custom interactive elements without keyboard support
    const role = htmlElement.getAttribute('role')
    if ((role === 'button' || role === 'link') && htmlElement.tagName !== 'BUTTON' && htmlElement.tagName !== 'A') {
      issues.push({
        type: 'keyboard',
        severity: 'info',
        message: 'Custom interactive element may need keyboard event handlers',
        element: htmlElement,
        selector: getElementSelector(htmlElement),
        fix: 'Add onKeyDown handler for Enter and Space keys',
      })
    }
  })

  return issues
}

/**
 * Audit focus indicators
 */
export function auditFocusIndicators(container: HTMLElement = document.body): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const focusableElements = container.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')
  
  focusableElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    const styles = window.getComputedStyle(htmlElement, ':focus')
    
    // Check if focus styles are present
    const hasOutline = styles.outline !== 'none' && styles.outline !== '0px'
    const hasBoxShadow = styles.boxShadow !== 'none'
    const hasBorderChange = styles.borderColor !== window.getComputedStyle(htmlElement).borderColor
    
    if (!hasOutline && !hasBoxShadow && !hasBorderChange) {
      issues.push({
        type: 'focus',
        severity: 'warning',
        message: 'Element lacks visible focus indicator',
        element: htmlElement,
        selector: getElementSelector(htmlElement),
        fix: 'Add :focus styles with outline, box-shadow, or border changes',
      })
    }
  })

  return issues
}

/**
 * Run comprehensive accessibility audit
 */
export function runAccessibilityAudit(container: HTMLElement = document.body): {
  issues: AccessibilityIssue[]
  summary: {
    total: number
    errors: number
    warnings: number
    info: number
  }
} {
  const allIssues = [
    ...auditColorContrast(container),
    ...auditAria(container),
    ...auditHeadingStructure(container),
    ...auditKeyboardNavigation(container),
    ...auditFocusIndicators(container),
  ]

  const summary = {
    total: allIssues.length,
    errors: allIssues.filter(issue => issue.severity === 'error').length,
    warnings: allIssues.filter(issue => issue.severity === 'warning').length,
    info: allIssues.filter(issue => issue.severity === 'info').length,
  }

  return { issues: allIssues, summary }
}

/**
 * Helper functions
 */

function rgbToHex(rgb: string): string {
  const result = rgb.match(/\d+/g)
  if (!result || result.length < 3) return '#000000'
  
  const [r, g, b] = result.map(num => parseInt(num))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function getElementSelector(element: HTMLElement): string {
  if (element.id) return `#${element.id}`
  if (element.className) return `${element.tagName.toLowerCase()}.${element.className.split(' ')[0]}`
  return element.tagName.toLowerCase()
}

function getAccessibleName(element: HTMLElement): string {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel
  
  const ariaLabelledBy = element.getAttribute('aria-labelledby')
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy)
    if (labelElement) return labelElement.textContent || ''
  }
  
  return element.textContent?.trim() || ''
}

/**
 * Generate accessibility report
 */
export function generateAccessibilityReport(container?: HTMLElement): string {
  const { issues, summary } = runAccessibilityAudit(container)
  
  let report = `# Accessibility Audit Report\n\n`
  report += `**Summary:**\n`
  report += `- Total Issues: ${summary.total}\n`
  report += `- Errors: ${summary.errors}\n`
  report += `- Warnings: ${summary.warnings}\n`
  report += `- Info: ${summary.info}\n\n`

  if (issues.length === 0) {
    report += `✅ No accessibility issues found!\n`
    return report
  }

  const groupedIssues = issues.reduce((groups, issue) => {
    if (!groups[issue.type]) groups[issue.type] = []
    groups[issue.type].push(issue)
    return groups
  }, {} as Record<string, AccessibilityIssue[]>)

  Object.entries(groupedIssues).forEach(([type, typeIssues]) => {
    report += `## ${type.charAt(0).toUpperCase() + type.slice(1)} Issues\n\n`
    
    typeIssues.forEach((issue, index) => {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'
      report += `${index + 1}. ${icon} **${issue.severity.toUpperCase()}**: ${issue.message}\n`
      if (issue.selector) report += `   - Selector: \`${issue.selector}\`\n`
      if (issue.fix) report += `   - Fix: ${issue.fix}\n`
      report += `\n`
    })
  })

  return report
}