/**
 * 🔥 PRODUCTION READINESS CHECKLIST & VALIDATION 🔥
 * 
 * Comprehensive production readiness testing for Fantasy AI admin dashboards.
 * Validates deployment, monitoring, security, and operational requirements.
 */

import { test, expect, Page } from '@playwright/test';

interface ProductionCheck {
  category: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  details: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  remediation?: string;
}

interface ProductionReadinessReport {
  timestamp: string;
  overallStatus: 'READY' | 'NOT_READY' | 'CONDITIONAL';
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  checks: ProductionCheck[];
  recommendations: string[];
}

test.describe('Production Readiness Validation', () => {
  let productionChecks: ProductionCheck[] = [];

  test.describe('Infrastructure & Deployment', () => {
    test('should verify application health endpoints', async ({ page }) => {
      const healthChecks = [
        { endpoint: '/api/health', name: 'Application Health' },
        { endpoint: '/api/health/db', name: 'Database Health' },
        { endpoint: '/api/health/ready', name: 'Readiness Check' },
        { endpoint: '/api/health/live', name: 'Liveness Check' }
      ];
      
      for (const check of healthChecks) {
        try {
          const response = await page.goto(check.endpoint);
          const status = response?.status() || 0;
          
          if (status === 200) {
            productionChecks.push({
              category: 'Infrastructure',
              name: check.name,
              status: 'PASS',
              details: `${check.endpoint} returned 200 OK`,
              severity: 'critical'
            });
          } else {
            productionChecks.push({
              category: 'Infrastructure',
              name: check.name,
              status: 'FAIL',
              details: `${check.endpoint} returned ${status}`,
              severity: 'critical',
              remediation: 'Implement health check endpoints for monitoring'
            });
          }
        } catch (error) {
          productionChecks.push({
            category: 'Infrastructure',
            name: check.name,
            status: 'FAIL',
            details: `${check.endpoint} not accessible: ${error}`,
            severity: 'critical',
            remediation: 'Implement health check endpoints'
          });
        }
      }
    });

    test('should validate SSL/TLS configuration', async ({ page }) => {
      await page.goto('/admin/ml-training');
      
      const currentUrl = page.url();
      const isHttps = currentUrl.startsWith('https://');
      
      if (isHttps) {
        productionChecks.push({
          category: 'Infrastructure',
          name: 'HTTPS Enabled',
          status: 'PASS',
          details: 'Application served over HTTPS',
          severity: 'critical'
        });
      } else if (currentUrl.includes('localhost')) {
        productionChecks.push({
          category: 'Infrastructure',
          name: 'HTTPS Enabled',
          status: 'WARNING',
          details: 'Development environment - HTTPS not required',
          severity: 'high',
          remediation: 'Ensure HTTPS is enabled in production'
        });
      } else {
        productionChecks.push({
          category: 'Infrastructure',
          name: 'HTTPS Enabled',
          status: 'FAIL',
          details: 'Application not served over HTTPS',
          severity: 'critical',
          remediation: 'Enable HTTPS with valid SSL certificate'
        });
      }
    });

    test('should check environment configuration', async ({ page }) => {
      // Check for development indicators that shouldn't be in production
      await page.goto('/admin/ml-training');
      
      const pageContent = await page.content();
      
      // Check for debug indicators
      const debugPatterns = [
        /console\.log/gi,
        /debugger/gi,
        /development/gi,
        /localhost/gi,
        /debug.*true/gi
      ];
      
      let hasDebugCode = false;
      for (const pattern of debugPatterns) {
        if (pattern.test(pageContent)) {
          hasDebugCode = true;
          break;
        }
      }
      
      if (!hasDebugCode) {
        productionChecks.push({
          category: 'Infrastructure',
          name: 'Production Environment',
          status: 'PASS',
          details: 'No debug code detected in production build',
          severity: 'medium'
        });
      } else {
        productionChecks.push({
          category: 'Infrastructure',
          name: 'Production Environment',
          status: 'WARNING',
          details: 'Debug code detected - may be development environment',
          severity: 'medium',
          remediation: 'Remove debug code and console.log statements'
        });
      }
    });

    test('should validate resource optimization', async ({ page }) => {
      await page.goto('/admin/ml-training');
      
      // Check for minified assets
      const response = await page.goto('/admin/ml-training');
      const contentType = response?.headers()['content-type'];
      const contentLength = response?.headers()['content-length'];
      
      // Check for compression
      const contentEncoding = response?.headers()['content-encoding'];
      const hasCompression = contentEncoding && (contentEncoding.includes('gzip') || contentEncoding.includes('br'));
      
      if (hasCompression) {
        productionChecks.push({
          category: 'Infrastructure',
          name: 'Content Compression',
          status: 'PASS',
          details: `Content compressed with ${contentEncoding}`,
          severity: 'medium'
        });
      } else {
        productionChecks.push({
          category: 'Infrastructure',
          name: 'Content Compression',
          status: 'WARNING',
          details: 'Content compression not detected',
          severity: 'medium',
          remediation: 'Enable gzip or Brotli compression'
        });
      }
      
      // Check bundle size (approximate)
      if (contentLength) {
        const sizeKB = parseInt(contentLength) / 1024;
        if (sizeKB < 1024) { // Less than 1MB
          productionChecks.push({
            category: 'Infrastructure',
            name: 'Bundle Size',
            status: 'PASS',
            details: `Page size: ${sizeKB.toFixed(2)}KB`,
            severity: 'low'
          });
        } else {
          productionChecks.push({
            category: 'Infrastructure',
            name: 'Bundle Size',
            status: 'WARNING',
            details: `Page size: ${sizeKB.toFixed(2)}KB - consider optimization`,
            severity: 'low',
            remediation: 'Optimize bundle size with code splitting'
          });
        }
      }
    });
  });

  test.describe('Security & Compliance', () => {
    test('should validate security headers', async ({ page }) => {
      const response = await page.goto('/admin/ml-training');
      const headers = response?.headers() || {};
      
      const requiredSecurityHeaders = {
        'x-frame-options': 'Clickjacking protection',
        'x-content-type-options': 'MIME type sniffing protection',
        'x-xss-protection': 'XSS protection',
        'strict-transport-security': 'HTTPS enforcement',
        'content-security-policy': 'XSS and injection protection',
        'referrer-policy': 'Referrer information control'
      };
      
      for (const [header, description] of Object.entries(requiredSecurityHeaders)) {
        if (headers[header]) {
          productionChecks.push({
            category: 'Security',
            name: `Security Header: ${header}`,
            status: 'PASS',
            details: `${description} enabled: ${headers[header]}`,
            severity: 'high'
          });
        } else {
          productionChecks.push({
            category: 'Security',
            name: `Security Header: ${header}`,
            status: 'FAIL',
            details: `Missing ${description} header`,
            severity: 'high',
            remediation: `Add ${header} header to improve security`
          });
        }
      }
    });

    test('should check authentication security', async ({ page, context }) => {
      // Clear authentication
      await context.clearCookies();
      
      // Try to access admin routes without authentication
      const response = await page.goto('/admin/ml-training');
      const hasUnauthorizedAccess = response?.status() === 200 && 
        await page.locator('[data-testid="admin-layout"]').count() > 0;
      
      if (!hasUnauthorizedAccess) {
        productionChecks.push({
          category: 'Security',
          name: 'Authentication Required',
          status: 'PASS',
          details: 'Admin routes properly protected',
          severity: 'critical'
        });
      } else {
        productionChecks.push({
          category: 'Security',
          name: 'Authentication Required',
          status: 'FAIL',
          details: 'Admin routes accessible without authentication',
          severity: 'critical',
          remediation: 'Implement authentication middleware'
        });
      }
    });

    test('should validate session security', async ({ page, context }) => {
      // Mock authenticated session
      await context.addCookies([{
        name: 'admin_token',
        value: 'test_session_token',
        domain: 'localhost',
        path: '/',
        secure: false, // Would be true in production
        httpOnly: false // Would be true in production
      }]);
      
      await page.goto('/admin/ml-training');
      
      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(c => 
        c.name.includes('session') || c.name.includes('token') || c.name.includes('auth')
      );
      
      let securityScore = 0;
      let totalChecks = 0;
      
      for (const cookie of sessionCookies) {
        totalChecks += 3; // secure, httpOnly, sameSite
        
        if (cookie.secure) securityScore++;
        if (cookie.httpOnly) securityScore++;
        if (cookie.sameSite && cookie.sameSite !== 'None') securityScore++;
      }
      
      if (sessionCookies.length === 0) {
        productionChecks.push({
          category: 'Security',
          name: 'Session Cookie Security',
          status: 'SKIP',
          details: 'No session cookies found',
          severity: 'medium'
        });
      } else {
        const securityPercentage = (securityScore / totalChecks) * 100;
        
        if (securityPercentage >= 80) {
          productionChecks.push({
            category: 'Security',
            name: 'Session Cookie Security',
            status: 'PASS',
            details: `Cookie security: ${securityPercentage.toFixed(1)}%`,
            severity: 'high'
          });
        } else {
          productionChecks.push({
            category: 'Security',
            name: 'Session Cookie Security',
            status: 'WARNING',
            details: `Cookie security: ${securityPercentage.toFixed(1)}% - needs improvement`,
            severity: 'high',
            remediation: 'Set secure, httpOnly, and sameSite flags on session cookies'
          });
        }
      }
    });

    test('should check for information disclosure', async ({ page }) => {
      await page.goto('/admin/ml-training');
      
      const pageSource = await page.content();
      
      // Check for sensitive information in page source
      const sensitivePatterns = [
        { pattern: /api[_-]?key/gi, name: 'API Keys' },
        { pattern: /secret/gi, name: 'Secrets' },
        { pattern: /password/gi, name: 'Passwords' },
        { pattern: /database.*url/gi, name: 'Database URLs' },
        { pattern: /stack trace/gi, name: 'Stack Traces' }
      ];
      
      let disclosureFound = false;
      const disclosures: string[] = [];
      
      for (const { pattern, name } of sensitivePatterns) {
        if (pattern.test(pageSource)) {
          disclosureFound = true;
          disclosures.push(name);
        }
      }
      
      if (!disclosureFound) {
        productionChecks.push({
          category: 'Security',
          name: 'Information Disclosure',
          status: 'PASS',
          details: 'No sensitive information found in page source',
          severity: 'high'
        });
      } else {
        productionChecks.push({
          category: 'Security',
          name: 'Information Disclosure',
          status: 'FAIL',
          details: `Sensitive information detected: ${disclosures.join(', ')}`,
          severity: 'critical',
          remediation: 'Remove sensitive information from client-side code'
        });
      }
    });
  });

  test.describe('Performance & Monitoring', () => {
    test('should validate dashboard load performance', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      if (loadTime < 3000) {
        productionChecks.push({
          category: 'Performance',
          name: 'Dashboard Load Time',
          status: 'PASS',
          details: `Load time: ${loadTime}ms`,
          severity: 'medium'
        });
      } else if (loadTime < 5000) {
        productionChecks.push({
          category: 'Performance',
          name: 'Dashboard Load Time',
          status: 'WARNING',
          details: `Load time: ${loadTime}ms - could be improved`,
          severity: 'medium',
          remediation: 'Optimize dashboard loading performance'
        });
      } else {
        productionChecks.push({
          category: 'Performance',
          name: 'Dashboard Load Time',
          status: 'FAIL',
          details: `Load time: ${loadTime}ms - too slow`,
          severity: 'high',
          remediation: 'Optimize dashboard performance - target <3s load time'
        });
      }
    });

    test('should check error handling and logging', async ({ page }) => {
      // Monitor console errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Try to trigger potential errors
      await page.goto('/admin/nonexistent-page');
      await page.waitForTimeout(2000);
      
      // Navigate back to valid page
      await page.goto('/admin/ml-training');
      await page.waitForTimeout(2000);
      
      if (consoleErrors.length === 0) {
        productionChecks.push({
          category: 'Performance',
          name: 'Error Handling',
          status: 'PASS',
          details: 'No console errors detected during navigation',
          severity: 'medium'
        });
      } else {
        // Filter out common non-critical errors
        const criticalErrors = consoleErrors.filter(error => 
          !error.includes('favicon') && 
          !error.includes('websocket') && 
          !error.toLowerCase().includes('network')
        );
        
        if (criticalErrors.length === 0) {
          productionChecks.push({
            category: 'Performance',
            name: 'Error Handling',
            status: 'WARNING',
            details: `${consoleErrors.length} non-critical console errors`,
            severity: 'low',
            remediation: 'Clean up minor console errors'
          });
        } else {
          productionChecks.push({
            category: 'Performance',
            name: 'Error Handling',
            status: 'FAIL',
            details: `${criticalErrors.length} critical console errors`,
            severity: 'high',
            remediation: 'Fix console errors and implement proper error handling'
          });
        }
      }
    });

    test('should validate memory usage', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Get memory usage if available
      const memoryInfo = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });
      
      if (memoryInfo) {
        const memoryUsageMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
        const memoryLimitMB = memoryInfo.jsHeapSizeLimit / 1024 / 1024;
        const usagePercentage = (memoryUsageMB / memoryLimitMB) * 100;
        
        if (memoryUsageMB < 100) {
          productionChecks.push({
            category: 'Performance',
            name: 'Memory Usage',
            status: 'PASS',
            details: `Memory usage: ${memoryUsageMB.toFixed(2)}MB (${usagePercentage.toFixed(1)}%)`,
            severity: 'low'
          });
        } else if (memoryUsageMB < 200) {
          productionChecks.push({
            category: 'Performance',
            name: 'Memory Usage',
            status: 'WARNING',
            details: `Memory usage: ${memoryUsageMB.toFixed(2)}MB (${usagePercentage.toFixed(1)}%)`,
            severity: 'low',
            remediation: 'Monitor memory usage and optimize if it grows'
          });
        } else {
          productionChecks.push({
            category: 'Performance',
            name: 'Memory Usage',
            status: 'FAIL',
            details: `High memory usage: ${memoryUsageMB.toFixed(2)}MB (${usagePercentage.toFixed(1)}%)`,
            severity: 'medium',
            remediation: 'Optimize memory usage - check for memory leaks'
          });
        }
      } else {
        productionChecks.push({
          category: 'Performance',
          name: 'Memory Usage',
          status: 'SKIP',
          details: 'Memory API not available in this browser',
          severity: 'low'
        });
      }
    });
  });

  test.describe('Data & Database', () => {
    test('should validate data consistency', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Check for consistent data display
      const modelAccuracies = await page.locator('[data-testid="model-accuracy"]').allTextContents();
      
      let allDataValid = true;
      const invalidData: string[] = [];
      
      for (const accuracy of modelAccuracies) {
        if (!accuracy.match(/^\d+\.\d+%$/)) {
          allDataValid = false;
          invalidData.push(accuracy);
        }
      }
      
      if (allDataValid && modelAccuracies.length > 0) {
        productionChecks.push({
          category: 'Data',
          name: 'Data Validation',
          status: 'PASS',
          details: `All ${modelAccuracies.length} accuracy values properly formatted`,
          severity: 'medium'
        });
      } else if (modelAccuracies.length === 0) {
        productionChecks.push({
          category: 'Data',
          name: 'Data Validation',
          status: 'WARNING',
          details: 'No data found to validate',
          severity: 'medium',
          remediation: 'Ensure data is loading properly'
        });
      } else {
        productionChecks.push({
          category: 'Data',
          name: 'Data Validation',
          status: 'FAIL',
          details: `Invalid data formats: ${invalidData.join(', ')}`,
          severity: 'high',
          remediation: 'Fix data validation and formatting'
        });
      }
    });

    test('should check database connection health', async ({ page }) => {
      // This would typically check a database health endpoint
      // For now, we'll infer database health from successful data loading
      
      await page.goto('/admin/ml-training');
      const dataLoaded = await page.waitForSelector('[data-testid="ml-training-overview"]', { timeout: 10000 }).then(() => true).catch(() => false);
      
      if (dataLoaded) {
        // Check if data actually populated
        const hasData = await page.locator('[data-testid="model-accuracy"]').count() > 0;
        
        if (hasData) {
          productionChecks.push({
            category: 'Data',
            name: 'Database Connectivity',
            status: 'PASS',
            details: 'Database connection healthy - data loading successfully',
            severity: 'critical'
          });
        } else {
          productionChecks.push({
            category: 'Data',
            name: 'Database Connectivity',
            status: 'WARNING',
            details: 'Dashboard loads but no data displayed',
            severity: 'high',
            remediation: 'Check database queries and data availability'
          });
        }
      } else {
        productionChecks.push({
          category: 'Data',
          name: 'Database Connectivity',
          status: 'FAIL',
          details: 'Dashboard failed to load - possible database connection issue',
          severity: 'critical',
          remediation: 'Check database connection and health'
        });
      }
    });
  });

  test.describe('User Experience', () => {
    test('should validate responsive design', async ({ page }) => {
      const viewports = [
        { width: 375, height: 812, name: 'Mobile' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 1920, height: 1080, name: 'Desktop' }
      ];
      
      let responsiveIssues = 0;
      
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/admin/ml-training');
        
        try {
          await page.waitForSelector('[data-testid="ml-training-overview"]', { timeout: 5000 });
          
          // Check if content is visible and not cut off
          const isVisible = await page.locator('[data-testid="ml-training-overview"]').isVisible();
          if (!isVisible) {
            responsiveIssues++;
          }
        } catch (error) {
          responsiveIssues++;
        }
      }
      
      if (responsiveIssues === 0) {
        productionChecks.push({
          category: 'User Experience',
          name: 'Responsive Design',
          status: 'PASS',
          details: 'Dashboard works across all tested viewports',
          severity: 'medium'
        });
      } else {
        productionChecks.push({
          category: 'User Experience',
          name: 'Responsive Design',
          status: 'FAIL',
          details: `Responsive issues on ${responsiveIssues} out of ${viewports.length} viewports`,
          severity: 'medium',
          remediation: 'Fix responsive design issues'
        });
      }
      
      // Reset to desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
    });

    test('should validate accessibility basics', async ({ page }) => {
      await page.goto('/admin/ml-training');
      await page.waitForSelector('[data-testid="ml-training-overview"]');
      
      // Basic accessibility checks
      const checks = {
        altTextImages: await page.locator('img:not([alt])').count(),
        missingLabels: await page.locator('input:not([aria-label]):not([aria-labelledby])').count(),
        semanticElements: await page.locator('main, nav, section, article, header, footer').count()
      };
      
      let accessibilityScore = 0;
      let totalChecks = 3;
      
      if (checks.altTextImages === 0) accessibilityScore++;
      if (checks.missingLabels === 0) accessibilityScore++;
      if (checks.semanticElements > 0) accessibilityScore++;
      
      const accessibilityPercentage = (accessibilityScore / totalChecks) * 100;
      
      if (accessibilityPercentage >= 80) {
        productionChecks.push({
          category: 'User Experience',
          name: 'Accessibility',
          status: 'PASS',
          details: `Accessibility score: ${accessibilityPercentage.toFixed(1)}%`,
          severity: 'medium'
        });
      } else {
        productionChecks.push({
          category: 'User Experience',
          name: 'Accessibility',
          status: 'WARNING',
          details: `Accessibility score: ${accessibilityPercentage.toFixed(1)}% - needs improvement`,
          severity: 'medium',
          remediation: 'Improve accessibility with proper ARIA labels and semantic HTML'
        });
      }
    });
  });

  test.afterAll(async () => {
    // Calculate overall status
    const totalChecks = productionChecks.length;
    const passed = productionChecks.filter(c => c.status === 'PASS').length;
    const failed = productionChecks.filter(c => c.status === 'FAIL').length;
    const warnings = productionChecks.filter(c => c.status === 'WARNING').length;
    const skipped = productionChecks.filter(c => c.status === 'SKIP').length;
    
    const criticalFailures = productionChecks.filter(c => c.status === 'FAIL' && c.severity === 'critical').length;
    const highSeverityIssues = productionChecks.filter(c => c.status === 'FAIL' && c.severity === 'high').length;
    
    let overallStatus: 'READY' | 'NOT_READY' | 'CONDITIONAL';
    
    if (criticalFailures > 0) {
      overallStatus = 'NOT_READY';
    } else if (highSeverityIssues > 0 || failed > 0) {
      overallStatus = 'CONDITIONAL';
    } else {
      overallStatus = 'READY';
    }
    
    // Generate comprehensive recommendations
    const recommendations: string[] = [
      // Always include these
      'Implement comprehensive monitoring and alerting',
      'Set up automated backup and disaster recovery procedures',
      'Establish incident response and escalation procedures',
      'Configure log aggregation and analysis',
      'Implement automated deployment and rollback procedures',
      'Set up performance monitoring and user experience tracking',
      'Establish security monitoring and vulnerability scanning',
      'Create operational runbooks and documentation'
    ];
    
    // Add specific recommendations based on failures
    const failedChecks = productionChecks.filter(c => c.status === 'FAIL' && c.remediation);
    for (const check of failedChecks) {
      if (check.remediation && !recommendations.includes(check.remediation)) {
        recommendations.push(check.remediation);
      }
    }
    
    const report: ProductionReadinessReport = {
      timestamp: new Date().toISOString(),
      overallStatus,
      totalChecks,
      passed,
      failed,
      warnings,
      skipped,
      checks: productionChecks.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      recommendations
    };
    
    // Write production readiness report
    const fs = require('fs');
    const path = require('path');
    
    const reportDir = path.join(process.cwd(), 'test-results');
    const reportPath = path.join(reportDir, 'production-readiness-report.json');
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    const htmlReport = generateProductionReadinessHTML(report);
    const htmlPath = path.join(reportDir, 'production-readiness-report.html');
    fs.writeFileSync(htmlPath, htmlReport);
    
    console.log('🚀 Production Readiness Report Generated');
    console.log(`📁 Report saved to: ${reportPath}`);
    console.log(`📊 Overall Status: ${overallStatus}`);
    console.log(`✅ Passed: ${passed}/${totalChecks} (${((passed/totalChecks)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed}/${totalChecks} (${((failed/totalChecks)*100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings: ${warnings}/${totalChecks} (${((warnings/totalChecks)*100).toFixed(1)}%)`);
    
    if (overallStatus === 'NOT_READY') {
      console.log('🚨 CRITICAL: System NOT READY for production deployment');
      console.log(`   ${criticalFailures} critical failure(s) must be resolved`);
    } else if (overallStatus === 'CONDITIONAL') {
      console.log('⚠️  CONDITIONAL: System ready with conditions');
      console.log(`   ${highSeverityIssues} high severity issue(s) should be resolved`);
    } else {
      console.log('✅ READY: System ready for production deployment');
    }
  });

  function generateProductionReadinessHTML(report: ProductionReadinessReport): string {
    const statusColor = {
      'READY': '#10b981',
      'CONDITIONAL': '#f59e0b', 
      'NOT_READY': '#ef4444'
    };
    
    const statusIcon = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARNING': '⚠️',
      'SKIP': '⏭️'
    };
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Production Readiness Report - Fantasy AI Admin Dashboard</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #0f172a; color: #e2e8f0; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; }
        .header h1 { margin: 0; font-size: 3rem; font-weight: 700; }
        .header p { margin: 15px 0 0 0; opacity: 0.9; font-size: 1.2rem; }
        .status-banner { text-align: center; padding: 20px; margin-bottom: 30px; border-radius: 12px; font-size: 1.5rem; font-weight: 700; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .summary-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 25px; text-align: center; }
        .summary-card h3 { margin: 0 0 15px 0; color: #38bdf8; font-size: 1.1rem; }
        .summary-card .value { font-size: 2.5rem; font-weight: 700; margin-bottom: 5px; }
        .checks-section { margin-bottom: 40px; }
        .checks-section h2 { color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 10px; }
        .check-item { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
        .check-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; }
        .check-name { font-weight: 600; font-size: 1.1rem; }
        .check-status { padding: 4px 12px; border-radius: 6px; font-size: 0.9rem; font-weight: 600; }
        .check-details { color: #94a3b8; margin-bottom: 10px; }
        .check-remediation { color: #fbbf24; font-style: italic; }
        .recommendations { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 25px; }
        .recommendations h2 { color: #38bdf8; margin-top: 0; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .recommendations li { margin-bottom: 8px; }
        .footer { text-align: center; margin-top: 40px; padding: 20px; background: #1e293b; border-radius: 8px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Production Readiness Report</h1>
            <p>Fantasy AI Admin Dashboard - ${report.timestamp}</p>
        </div>
        
        <div class="status-banner" style="background-color: ${statusColor[report.overallStatus]};">
            Status: ${report.overallStatus}
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Checks</h3>
                <div class="value">${report.totalChecks}</div>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <div class="value" style="color: #10b981;">${report.passed}</div>
                <div>${((report.passed/report.totalChecks)*100).toFixed(1)}%</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value" style="color: #ef4444;">${report.failed}</div>
                <div>${((report.failed/report.totalChecks)*100).toFixed(1)}%</div>
            </div>
            <div class="summary-card">
                <h3>Warnings</h3>
                <div class="value" style="color: #f59e0b;">${report.warnings}</div>
                <div>${((report.warnings/report.totalChecks)*100).toFixed(1)}%</div>
            </div>
        </div>
        
        <div class="checks-section">
            <h2>Detailed Checks</h2>
            ${report.checks.map(check => `
                <div class="check-item">
                    <div class="check-header">
                        <div class="check-name">${statusIcon[check.status]} ${check.category}: ${check.name}</div>
                        <div class="check-status" style="background-color: ${
                          check.status === 'PASS' ? '#10b981' : 
                          check.status === 'FAIL' ? '#ef4444' : 
                          check.status === 'WARNING' ? '#f59e0b' : '#6b7280'
                        };">${check.status}</div>
                    </div>
                    <div class="check-details">${check.details}</div>
                    ${check.remediation ? `<div class="check-remediation">💡 ${check.remediation}</div>` : ''}
                </div>
            `).join('')}
        </div>
        
        <div class="recommendations">
            <h2>🔧 Recommendations</h2>
            <ul>
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        
        <div class="footer">
            <p>Fantasy AI Admin Dashboard - Production Readiness Assessment</p>
            <p>Generated with comprehensive testing suite</p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }
});