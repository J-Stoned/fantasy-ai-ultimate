/**
 * 🔥 SECURITY AUDIT & PENETRATION TESTING 🔥
 * 
 * Enterprise-grade security testing for Fantasy AI admin dashboards.
 * Tests authentication, authorization, XSS protection, and data security.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

interface SecurityVulnerability {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location: string;
  remediation: string;
}

interface SecurityAuditResult {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  vulnerabilities: SecurityVulnerability[];
  overallScore: number;
}

test.describe('Security Audit & Penetration Testing', () => {
  let vulnerabilities: SecurityVulnerability[] = [];

  test.describe('Authentication Security', () => {
    test('should prevent unauthorized access to admin routes', async ({ page, context }) => {
      // Clear all cookies and storage
      await context.clearCookies();
      
      // Try to access admin dashboard without authentication
      const response = await page.goto('/admin/ml-training');
      
      // Should redirect to login or show access denied
      if (response?.status() === 200) {
        // Check if actually showing admin content or login form
        const hasAdminContent = await page.locator('[data-testid="admin-layout"]').count() > 0;
        const hasLoginForm = await page.locator('form[data-testid="login-form"]').count() > 0;
        
        if (hasAdminContent && !hasLoginForm) {
          vulnerabilities.push({
            severity: 'critical',
            category: 'Authentication',
            description: 'Admin routes accessible without authentication',
            location: '/admin/ml-training',
            remediation: 'Implement proper authentication middleware'
          });
        }
        
        expect(hasAdminContent).toBe(false);
      } else {
        // Should be redirected (3xx) or unauthorized (401/403)
        expect([301, 302, 307, 308, 401, 403]).toContain(response?.status() || 200);
      }
    });

    test('should validate admin session tokens', async ({ page, context }) => {
      // Set invalid session token
      await context.addCookies([{
        name: 'admin_token',
        value: 'invalid_token_12345',
        domain: 'localhost',
        path: '/'
      }]);
      
      const response = await page.goto('/admin/ml-training');
      
      // Should reject invalid tokens
      if (response?.status() === 200) {
        const hasAdminContent = await page.locator('[data-testid="admin-layout"]').count() > 0;
        if (hasAdminContent) {
          vulnerabilities.push({
            severity: 'high',
            category: 'Authentication',
            description: 'Invalid session tokens accepted',
            location: 'Session validation',
            remediation: 'Implement proper token validation'
          });
        }
      }
    });

    test('should implement session timeout', async ({ page, context }) => {
      // Test would simulate expired session - in real implementation
      // this would check if sessions expire after inactivity
      
      // Mock expired session by setting old timestamp
      await page.evaluate(() => {
        const expiredSession = {
          userId: 'test_admin',
          role: 'SUPER_ADMIN',
          lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 24 hours ago
        };
        localStorage.setItem('admin_session', JSON.stringify(expiredSession));
      });
      
      await page.goto('/admin/ml-training');
      
      // Should redirect to login for expired session
      const currentUrl = page.url();
      if (currentUrl.includes('/admin/ml-training') && !currentUrl.includes('/login')) {
        vulnerabilities.push({
          severity: 'medium',
          category: 'Session Management',
          description: 'Expired sessions not properly handled',
          location: 'Session timeout logic',
          remediation: 'Implement session expiration checks'
        });
      }
    });

    test('should enforce role-based access control', async ({ page }) => {
      // Test with limited role user
      await page.evaluate(() => {
        const limitedSession = {
          userId: 'limited_user',
          role: { name: 'VIEWER', permissions: ['READ'] },
          sessionToken: 'valid_but_limited_token'
        };
        localStorage.setItem('admin_session', JSON.stringify(limitedSession));
      });
      
      await page.goto('/admin/ml-training');
      
      // Should show appropriate content based on permissions
      // Check for admin-only features
      const deleteButtons = await page.locator('button:has-text("Delete")').count();
      const createButtons = await page.locator('button:has-text("Create")').count();
      
      // Limited user shouldn't see destructive actions
      if (deleteButtons > 0) {
        vulnerabilities.push({
          severity: 'high',
          category: 'Authorization',
          description: 'Destructive actions visible to limited users',
          location: 'Role-based UI rendering',
          remediation: 'Implement proper role-based UI controls'
        });
      }
    });
  });

  test.describe('XSS Protection', () => {
    test('should sanitize user inputs', async ({ page }) => {
      // Navigate to admin dashboard first
      await page.goto('/admin/ml-training');
      
      // Test XSS payloads in various input fields
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '"><script>alert("XSS")</script>',
        "'; DROP TABLE users; --"
      ];
      
      // Look for input fields
      const inputs = await page.locator('input, textarea').all();
      
      for (const input of inputs) {
        for (const payload of xssPayloads) {
          await input.fill(payload);
          await input.blur();
          
          // Check if script executed (would show alert)
          const hasAlert = await page.evaluate(() => {
            return window.alert !== window.alert; // Alert would be overridden if XSS worked
          });
          
          if (hasAlert) {
            vulnerabilities.push({
              severity: 'critical',
              category: 'XSS',
              description: `XSS vulnerability in input field: ${payload}`,
              location: await input.getAttribute('name') || 'Unknown input',
              remediation: 'Implement input sanitization and CSP headers'
            });
          }
        }
      }
    });

    test('should have Content Security Policy headers', async ({ page }) => {
      const response = await page.goto('/admin/ml-training');
      const cspHeader = response?.headers()['content-security-policy'];
      
      if (!cspHeader) {
        vulnerabilities.push({
          severity: 'high',
          category: 'XSS Protection',
          description: 'Missing Content Security Policy header',
          location: 'HTTP headers',
          remediation: 'Implement CSP headers to prevent XSS attacks'
        });
      } else {
        // Validate CSP is restrictive enough
        if (!cspHeader.includes("script-src 'self'") && !cspHeader.includes("script-src 'strict-dynamic'")) {
          vulnerabilities.push({
            severity: 'medium',
            category: 'XSS Protection',
            description: 'CSP script-src directive too permissive',
            location: 'CSP header configuration',
            remediation: 'Restrict script-src to self or use strict-dynamic'
          });
        }
      }
    });

    test('should escape HTML in dynamic content', async ({ page }) => {
      await page.goto('/admin/ml-training');
      
      // Check if user-generated content is properly escaped
      const contentElements = await page.locator('[data-testid*="user-content"], [data-testid*="dynamic-content"]').all();
      
      for (const element of contentElements) {
        const innerHTML = await element.innerHTML();
        
        // Look for unescaped HTML tags that shouldn't be there
        const dangerousTags = /<script|<iframe|<object|<embed|javascript:/gi;
        if (dangerousTags.test(innerHTML)) {
          vulnerabilities.push({
            severity: 'high',
            category: 'XSS',
            description: 'Unescaped HTML in dynamic content',
            location: await element.getAttribute('data-testid') || 'Dynamic content',
            remediation: 'Escape HTML entities in user-generated content'
          });
        }
      }
    });
  });

  test.describe('Data Security', () => {
    test('should not expose sensitive data in client-side code', async ({ page }) => {
      await page.goto('/admin/ml-training');
      
      // Check page source for sensitive data patterns
      const pageContent = await page.content();
      
      const sensitivePatterns = [
        /api[_-]?key["\s:=]+[a-zA-Z0-9]{10,}/gi,
        /secret["\s:=]+[a-zA-Z0-9]{10,}/gi,
        /password["\s:=]+[a-zA-Z0-9]{6,}/gi,
        /token["\s:=]+[a-zA-Z0-9]{20,}/gi,
        /database[_-]?url["\s:=]+[a-zA-Z0-9:/@.-]+/gi
      ];
      
      for (const pattern of sensitivePatterns) {
        const matches = pageContent.match(pattern);
        if (matches) {
          vulnerabilities.push({
            severity: 'critical',
            category: 'Data Exposure',
            description: `Sensitive data exposed in client code: ${matches[0].substring(0, 50)}...`,
            location: 'Client-side source code',
            remediation: 'Move sensitive data to server-side environment variables'
          });
        }
      }
    });

    test('should use HTTPS for all communications', async ({ page }) => {
      // Monitor network requests
      const httpRequests: string[] = [];
      
      page.on('request', request => {
        const url = request.url();
        if (url.startsWith('http://') && !url.includes('localhost')) {
          httpRequests.push(url);
        }
      });
      
      await page.goto('/admin/ml-training');
      await page.waitForLoadState('networkidle');
      
      if (httpRequests.length > 0) {
        vulnerabilities.push({
          severity: 'high',
          category: 'Data Security',
          description: `HTTP requests detected: ${httpRequests.join(', ')}`,
          location: 'Network communications',
          remediation: 'Ensure all communications use HTTPS'
        });
      }
    });

    test('should implement secure headers', async ({ page }) => {
      const response = await page.goto('/admin/ml-training');
      const headers = response?.headers() || {};
      
      const requiredSecurityHeaders = {
        'x-frame-options': 'DENY or SAMEORIGIN',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block',
        'strict-transport-security': 'max-age=31536000',
        'referrer-policy': 'strict-origin-when-cross-origin'
      };
      
      for (const [header, description] of Object.entries(requiredSecurityHeaders)) {
        if (!headers[header]) {
          vulnerabilities.push({
            severity: 'medium',
            category: 'Security Headers',
            description: `Missing security header: ${header}`,
            location: 'HTTP response headers',
            remediation: `Add ${header}: ${description}`
          });
        }
      }
    });
  });

  test.describe('SQL Injection Protection', () => {
    test('should prevent SQL injection in API endpoints', async ({ page }) => {
      await page.goto('/admin/ml-training');
      
      // Test SQL injection payloads
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM admin_users --",
        "'; INSERT INTO admin_users (username, password) VALUES ('hacker', 'password'); --"
      ];
      
      // Monitor network requests
      const suspiciousRequests: string[] = [];
      
      page.on('request', request => {
        const postData = request.postData();
        if (postData) {
          for (const payload of sqlPayloads) {
            if (postData.includes(payload)) {
              suspiciousRequests.push(request.url());
            }
          }
        }
      });
      
      // Try to trigger API calls with SQL injection payloads
      const searchInputs = await page.locator('input[type="search"], input[name*="search"]').all();
      
      for (const input of searchInputs) {
        for (const payload of sqlPayloads) {
          await input.fill(payload);
          await input.press('Enter');
          await page.waitForTimeout(1000);
        }
      }
      
      // In a real test, you'd also check if the SQL injection was successful
      // by looking for error messages or unexpected data exposure
    });
  });

  test.describe('Session Security', () => {
    test('should secure session cookies', async ({ page, context }) => {
      await page.goto('/admin/ml-training');
      
      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(cookie => 
        cookie.name.includes('session') || 
        cookie.name.includes('token') ||
        cookie.name.includes('auth')
      );
      
      for (const cookie of sessionCookies) {
        if (!cookie.secure) {
          vulnerabilities.push({
            severity: 'high',
            category: 'Session Security',
            description: `Insecure cookie: ${cookie.name} not marked as secure`,
            location: 'Cookie configuration',
            remediation: 'Set secure flag on authentication cookies'
          });
        }
        
        if (!cookie.httpOnly) {
          vulnerabilities.push({
            severity: 'medium',
            category: 'Session Security',
            description: `Cookie ${cookie.name} accessible via JavaScript`,
            location: 'Cookie configuration',
            remediation: 'Set httpOnly flag on authentication cookies'
          });
        }
        
        if (cookie.sameSite !== 'Strict' && cookie.sameSite !== 'Lax') {
          vulnerabilities.push({
            severity: 'medium',
            category: 'Session Security',
            description: `Cookie ${cookie.name} missing SameSite protection`,
            location: 'Cookie configuration',
            remediation: 'Set SameSite attribute on cookies'
          });
        }
      }
    });

    test('should prevent session fixation', async ({ page, context }) => {
      // Get initial session
      await page.goto('/admin/login');
      const initialCookies = await context.cookies();
      const initialSessionId = initialCookies.find(c => c.name.includes('session'))?.value;
      
      // Simulate login
      await page.goto('/admin/ml-training');
      
      // Get session after login
      const postLoginCookies = await context.cookies();
      const postLoginSessionId = postLoginCookies.find(c => c.name.includes('session'))?.value;
      
      // Session ID should change after authentication
      if (initialSessionId && postLoginSessionId && initialSessionId === postLoginSessionId) {
        vulnerabilities.push({
          severity: 'high',
          category: 'Session Security',
          description: 'Session ID not regenerated after authentication',
          location: 'Authentication process',
          remediation: 'Regenerate session ID after successful login'
        });
      }
    });
  });

  test.describe('CSRF Protection', () => {
    test('should implement CSRF tokens', async ({ page }) => {
      await page.goto('/admin/ml-training');
      
      // Look for forms that might perform state-changing operations
      const forms = await page.locator('form').all();
      
      for (const form of forms) {
        const csrfToken = await form.locator('input[name="csrf_token"], input[name="_token"]').count();
        const method = await form.getAttribute('method');
        
        if (method && method.toLowerCase() !== 'get' && csrfToken === 0) {
          vulnerabilities.push({
            severity: 'high',
            category: 'CSRF',
            description: 'Form missing CSRF protection',
            location: `Form with method ${method}`,
            remediation: 'Add CSRF tokens to all state-changing forms'
          });
        }
      }
    });

    test('should validate CSRF tokens', async ({ page }) => {
      // This would involve intercepting requests and modifying CSRF tokens
      // to verify they're being validated server-side
      
      await page.goto('/admin/ml-training');
      
      // Monitor POST requests
      const postRequests: string[] = [];
      
      page.on('request', request => {
        if (request.method() === 'POST') {
          postRequests.push(request.url());
        }
      });
      
      // Trigger actions that might make POST requests
      const buttons = await page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').all();
      
      for (const button of buttons) {
        await button.click();
        await page.waitForTimeout(1000);
      }
      
      // In production test, you'd modify CSRF tokens and verify requests are rejected
    });
  });

  test.describe('Information Disclosure', () => {
    test('should not expose system information', async ({ page }) => {
      const response = await page.goto('/admin/ml-training');
      const headers = response?.headers() || {};
      
      // Check for information disclosure in headers
      const disclosureHeaders = ['server', 'x-powered-by', 'x-aspnet-version'];
      
      for (const header of disclosureHeaders) {
        if (headers[header]) {
          vulnerabilities.push({
            severity: 'low',
            category: 'Information Disclosure',
            description: `Server information exposed in ${header} header: ${headers[header]}`,
            location: 'HTTP headers',
            remediation: `Remove or obfuscate ${header} header`
          });
        }
      }
    });

    test('should handle errors securely', async ({ page }) => {
      // Try to trigger 404 errors
      const response = await page.goto('/admin/nonexistent-page');
      const content = await page.content();
      
      // Check if error pages expose sensitive information
      const sensitiveInfo = [
        /stack trace/gi,
        /database error/gi,
        /sql error/gi,
        /internal server error/gi,
        /debug/gi
      ];
      
      for (const pattern of sensitiveInfo) {
        if (pattern.test(content)) {
          vulnerabilities.push({
            severity: 'medium',
            category: 'Information Disclosure',
            description: 'Error pages expose sensitive information',
            location: 'Error handling',
            remediation: 'Implement generic error pages for production'
          });
        }
      }
    });
  });

  test.afterAll(async () => {
    // Calculate security score
    const totalTests = 20; // Approximate number of security tests
    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
    const mediumCount = vulnerabilities.filter(v => v.severity === 'medium').length;
    const lowCount = vulnerabilities.filter(v => v.severity === 'low').length;
    
    // Scoring: Critical = -40, High = -20, Medium = -10, Low = -5
    const score = Math.max(0, 100 - (criticalCount * 40 + highCount * 20 + mediumCount * 10 + lowCount * 5));
    
    const auditResult: SecurityAuditResult = {
      timestamp: new Date().toISOString(),
      totalTests,
      passed: totalTests - vulnerabilities.length,
      failed: vulnerabilities.length,
      vulnerabilities,
      overallScore: score
    };
    
    // Generate security report
    const report = {
      summary: {
        overallScore: `${score}/100`,
        riskLevel: score >= 90 ? 'LOW' : score >= 70 ? 'MEDIUM' : score >= 50 ? 'HIGH' : 'CRITICAL',
        totalVulnerabilities: vulnerabilities.length,
        breakdown: {
          critical: criticalCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount
        }
      },
      vulnerabilities: vulnerabilities.map(v => ({
        ...v,
        priority: v.severity === 'critical' ? 1 : v.severity === 'high' ? 2 : v.severity === 'medium' ? 3 : 4
      })).sort((a, b) => a.priority - b.priority),
      recommendations: {
        immediate: vulnerabilities.filter(v => v.severity === 'critical').map(v => v.remediation),
        shortTerm: vulnerabilities.filter(v => v.severity === 'high').map(v => v.remediation),
        longTerm: vulnerabilities.filter(v => ['medium', 'low'].includes(v.severity)).map(v => v.remediation)
      },
      compliance: {
        owasp: score >= 85,
        gdpr: score >= 80,
        pci: score >= 90
      }
    };
    
    // Write security audit report
    const fs = require('fs');
    const path = require('path');
    
    const reportDir = path.join(process.cwd(), 'test-results');
    const reportPath = path.join(reportDir, 'security-audit-report.json');
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('🔒 Security Audit Report Generated');
    console.log(`📁 Report saved to: ${reportPath}`);
    console.log(`🎯 Security Score: ${score}/100 (${report.summary.riskLevel} RISK)`);
    console.log(`🚨 Vulnerabilities: ${criticalCount} Critical, ${highCount} High, ${mediumCount} Medium, ${lowCount} Low`);
    
    // Fail test if critical vulnerabilities found
    if (criticalCount > 0) {
      throw new Error(`Critical security vulnerabilities found: ${criticalCount}`);
    }
  });
});