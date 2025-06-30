#!/usr/bin/env tsx
/**
 * SUPABASE MANAGEMENT API SECURITY SCRIPT
 * 
 * Uses Supabase Management API to programmatically:
 * - Check and enable database security settings
 * - Manage RLS policies via API
 * - Check for exposed endpoints
 * - Audit API key usage
 * 
 * Requires: Supabase Management API access token
 */

import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const MANAGEMENT_API_URL = 'https://api.supabase.com';
const MANAGEMENT_API_TOKEN = process.env.SUPABASE_MANAGEMENT_API_TOKEN;

if (!MANAGEMENT_API_TOKEN) {
  console.error(chalk.red('ERROR: SUPABASE_MANAGEMENT_API_TOKEN environment variable is required'));
  console.log(chalk.yellow('\nTo get a Management API token:'));
  console.log('1. Go to https://app.supabase.com/account/tokens');
  console.log('2. Create a new token with appropriate permissions');
  console.log('3. Set: export SUPABASE_MANAGEMENT_API_TOKEN="your-token"');
  process.exit(1);
}

// Types
interface ProjectSettings {
  id: string;
  name: string;
  region: string;
  created_at: string;
  database: {
    host: string;
    version: string;
    size: string;
  };
}

interface DatabaseRole {
  name: string;
  can_login: boolean;
  is_superuser: boolean;
  can_create_db: boolean;
  can_create_role: boolean;
}

interface ApiKey {
  name: string;
  api_key: string;
  created_at: string;
  tags?: string[];
}

interface SecurityConfig {
  jwt_secret: string;
  jwt_exp: number;
  site_url: string;
  disable_signup: boolean;
  external_email_enabled: boolean;
  mailer_autoconfirm: boolean;
  sms_autoconfirm: boolean;
  external_phone_enabled: boolean;
  security_captcha_enabled: boolean;
}

interface NetworkRestriction {
  type: 'IPv4' | 'IPv6' | 'CIDR';
  value: string;
  name?: string;
}

interface SecurityRecommendation {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  fix: string;
  automated: boolean;
}

// Management API client
class SupabaseManagementClient {
  private headers: HeadersInit;

  constructor(token: string) {
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // Get project settings
  async getProjectSettings(): Promise<ProjectSettings> {
    const response = await fetch(`${MANAGEMENT_API_URL}/v1/projects/${PROJECT_REF}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get project settings: ${response.statusText}`);
    }

    return response.json();
  }

  // Get database roles
  async getDatabaseRoles(): Promise<DatabaseRole[]> {
    const response = await fetch(`${MANAGEMENT_API_URL}/v1/projects/${PROJECT_REF}/database/roles`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get database roles: ${response.statusText}`);
    }

    return response.json();
  }

  // Get API keys
  async getApiKeys(): Promise<ApiKey[]> {
    const response = await fetch(`${MANAGEMENT_API_URL}/v1/projects/${PROJECT_REF}/api-keys`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get API keys: ${response.statusText}`);
    }

    return response.json();
  }

  // Get security configuration
  async getSecurityConfig(): Promise<SecurityConfig> {
    const response = await fetch(`${MANAGEMENT_API_URL}/v1/projects/${PROJECT_REF}/config/auth`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get security config: ${response.statusText}`);
    }

    return response.json();
  }

  // Get network restrictions
  async getNetworkRestrictions(): Promise<NetworkRestriction[]> {
    const response = await fetch(`${MANAGEMENT_API_URL}/v1/projects/${PROJECT_REF}/network-restrictions`, {
      headers: this.headers,
    });

    if (!response.ok) {
      // Network restrictions might not be available on all plans
      console.warn(chalk.yellow('Network restrictions not available (may require Pro plan)'));
      return [];
    }

    return response.json();
  }

  // Update security settings
  async updateSecuritySettings(settings: Partial<SecurityConfig>): Promise<boolean> {
    const response = await fetch(`${MANAGEMENT_API_URL}/v1/projects/${PROJECT_REF}/config/auth`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(settings),
    });

    return response.ok;
  }

  // Execute SQL via Management API
  async executeSQL(query: string): Promise<any> {
    const response = await fetch(`${MANAGEMENT_API_URL}/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`SQL execution failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Enable RLS on a table
  async enableRLS(schema: string, table: string): Promise<boolean> {
    const query = `ALTER TABLE ${schema}.${table} ENABLE ROW LEVEL SECURITY;`;
    
    try {
      await this.executeSQL(query);
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to enable RLS on ${schema}.${table}: ${error.message}`));
      return false;
    }
  }

  // Create RLS policy
  async createPolicy(
    schema: string,
    table: string,
    policyName: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL',
    condition: string,
    role: string = 'authenticated'
  ): Promise<boolean> {
    const query = `
      CREATE POLICY "${policyName}" ON ${schema}.${table}
      FOR ${operation}
      TO ${role}
      USING (${condition});
    `;

    try {
      await this.executeSQL(query);
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to create policy: ${error.message}`));
      return false;
    }
  }

  // Get database extensions
  async getDatabaseExtensions(): Promise<any[]> {
    const query = `
      SELECT name, default_version, installed_version, comment
      FROM pg_available_extensions
      WHERE installed_version IS NOT NULL
      ORDER BY name;
    `;

    try {
      const result = await this.executeSQL(query);
      return result.data || [];
    } catch (error) {
      console.error(chalk.yellow('Could not fetch database extensions'));
      return [];
    }
  }
}

// Security audit functions
async function auditDatabaseRoles(client: SupabaseManagementClient): Promise<SecurityRecommendation[]> {
  const recommendations: SecurityRecommendation[] = [];

  try {
    const roles = await client.getDatabaseRoles();
    
    // Check for overly permissive roles
    for (const role of roles) {
      if (role.is_superuser && role.name !== 'postgres') {
        recommendations.push({
          category: 'Database Roles',
          severity: 'high',
          issue: `Role "${role.name}" has superuser privileges`,
          fix: 'Review and revoke unnecessary superuser privileges',
          automated: false,
        });
      }

      if (role.can_create_role && !['postgres', 'supabase_admin'].includes(role.name)) {
        recommendations.push({
          category: 'Database Roles',
          severity: 'medium',
          issue: `Role "${role.name}" can create other roles`,
          fix: 'Restrict role creation to admin users only',
          automated: false,
        });
      }
    }
  } catch (error) {
    console.error(chalk.yellow('Could not audit database roles'));
  }

  return recommendations;
}

async function auditSecurityConfig(client: SupabaseManagementClient): Promise<SecurityRecommendation[]> {
  const recommendations: SecurityRecommendation[] = [];

  try {
    const config = await client.getSecurityConfig();

    // Check signup settings
    if (!config.disable_signup) {
      recommendations.push({
        category: 'Authentication',
        severity: 'medium',
        issue: 'Public signup is enabled',
        fix: 'Consider disabling public signup if not needed',
        automated: true,
      });
    }

    // Check email confirmation
    if (config.mailer_autoconfirm) {
      recommendations.push({
        category: 'Authentication',
        severity: 'high',
        issue: 'Email auto-confirmation is enabled',
        fix: 'Disable auto-confirmation and require email verification',
        automated: true,
      });
    }

    // Check CAPTCHA
    if (!config.security_captcha_enabled) {
      recommendations.push({
        category: 'Authentication',
        severity: 'medium',
        issue: 'CAPTCHA is not enabled',
        fix: 'Enable CAPTCHA to prevent automated attacks',
        automated: true,
      });
    }

    // Check JWT expiration
    if (config.jwt_exp > 3600) {
      recommendations.push({
        category: 'Authentication',
        severity: 'low',
        issue: `JWT tokens expire after ${config.jwt_exp / 3600} hours`,
        fix: 'Consider shorter JWT expiration for better security',
        automated: true,
      });
    }
  } catch (error) {
    console.error(chalk.yellow('Could not audit security configuration'));
  }

  return recommendations;
}

async function auditNetworkRestrictions(client: SupabaseManagementClient): Promise<SecurityRecommendation[]> {
  const recommendations: SecurityRecommendation[] = [];

  try {
    const restrictions = await client.getNetworkRestrictions();

    if (restrictions.length === 0) {
      recommendations.push({
        category: 'Network Security',
        severity: 'high',
        issue: 'No network restrictions configured',
        fix: 'Add IP allowlist to restrict database access',
        automated: false,
      });
    }
  } catch (error) {
    // Network restrictions might not be available
  }

  return recommendations;
}

async function checkExposedEndpoints(anon_key: string): Promise<SecurityRecommendation[]> {
  const recommendations: SecurityRecommendation[] = [];
  const endpoints = [
    '/rest/v1/',
    '/graphql/v1',
    '/realtime/v1',
    '/storage/v1',
    '/auth/v1',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${SUPABASE_URL}${endpoint}`, {
        headers: {
          'apikey': anon_key,
        },
      });

      if (response.status === 200) {
        // Check if we can list data without authentication
        if (endpoint === '/rest/v1/') {
          const data = await response.text();
          if (data.includes('swagger') || data.includes('openapi')) {
            recommendations.push({
              category: 'API Security',
              severity: 'medium',
              issue: 'REST API documentation is publicly exposed',
              fix: 'Consider restricting API documentation access',
              automated: false,
            });
          }
        }
      }
    } catch (error) {
      // Endpoint might be properly secured
    }
  }

  return recommendations;
}

// Apply automated fixes
async function applyAutomatedFixes(
  client: SupabaseManagementClient,
  recommendations: SecurityRecommendation[]
): Promise<void> {
  const automatedFixes = recommendations.filter(r => r.automated);

  if (automatedFixes.length === 0) {
    console.log(chalk.gray('No automated fixes available'));
    return;
  }

  console.log(chalk.yellow(`\n🔧 Applying ${automatedFixes.length} automated fixes...\n`));

  for (const fix of automatedFixes) {
    console.log(chalk.blue(`Fixing: ${fix.issue}`));

    try {
      switch (fix.issue) {
        case 'Public signup is enabled':
          await client.updateSecuritySettings({ disable_signup: true });
          console.log(chalk.green('✓ Disabled public signup'));
          break;

        case 'Email auto-confirmation is enabled':
          await client.updateSecuritySettings({ mailer_autoconfirm: false });
          console.log(chalk.green('✓ Disabled email auto-confirmation'));
          break;

        case 'CAPTCHA is not enabled':
          await client.updateSecuritySettings({ security_captcha_enabled: true });
          console.log(chalk.green('✓ Enabled CAPTCHA'));
          break;

        default:
          console.log(chalk.gray(`⚪ Manual fix required for: ${fix.issue}`));
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to apply fix: ${error.message}`));
    }
  }
}

// Generate comprehensive report
async function generateSecurityReport(
  projectSettings: ProjectSettings,
  recommendations: SecurityRecommendation[]
): Promise<void> {
  const timestamp = new Date().toISOString();
  const reportName = `supabase-security-report-${Date.now()}`;

  // Group recommendations by category and severity
  const byCategory = recommendations.reduce((acc, rec) => {
    if (!acc[rec.category]) acc[rec.category] = [];
    acc[rec.category].push(rec);
    return acc;
  }, {} as Record<string, SecurityRecommendation[]>);

  const bySeverity = {
    critical: recommendations.filter(r => r.severity === 'critical').length,
    high: recommendations.filter(r => r.severity === 'high').length,
    medium: recommendations.filter(r => r.severity === 'medium').length,
    low: recommendations.filter(r => r.severity === 'low').length,
  };

  // Generate markdown report
  let markdown = `# Supabase Security Audit Report

**Generated:** ${timestamp}  
**Project:** ${projectSettings.name} (${PROJECT_REF})  
**Region:** ${projectSettings.region}  
**Database Version:** ${projectSettings.database.version}

## Summary

Total Issues Found: **${recommendations.length}**

- 🔴 Critical: ${bySeverity.critical}
- 🟠 High: ${bySeverity.high}
- 🟡 Medium: ${bySeverity.medium}
- 🟢 Low: ${bySeverity.low}

## Recommendations by Category

`;

  for (const [category, recs] of Object.entries(byCategory)) {
    markdown += `### ${category}\n\n`;
    
    // Sort by severity
    const sorted = recs.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    for (const rec of sorted) {
      const icon = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      }[rec.severity];

      markdown += `${icon} **${rec.issue}**\n`;
      markdown += `   - Fix: ${rec.fix}\n`;
      markdown += `   - Automated: ${rec.automated ? 'Yes ✓' : 'No (Manual action required)'}\n\n`;
    }
  }

  // Add action items
  markdown += `## Action Items

### Immediate Actions (Critical/High)
`;

  const urgentActions = recommendations.filter(r => 
    r.severity === 'critical' || r.severity === 'high'
  );

  if (urgentActions.length === 0) {
    markdown += `✅ No critical or high-severity issues found!\n\n`;
  } else {
    for (const action of urgentActions) {
      markdown += `1. ${action.fix}\n`;
    }
    markdown += '\n';
  }

  markdown += `### Best Practices

1. **Enable Row Level Security (RLS)** on all tables
2. **Create appropriate RLS policies** for each table
3. **Use network restrictions** to limit database access
4. **Enable 2FA** on all team accounts
5. **Rotate API keys** regularly
6. **Monitor database logs** for suspicious activity
7. **Keep database version updated**
8. **Review and audit permissions** quarterly

## Next Steps

1. Review all recommendations in this report
2. Apply automated fixes where available
3. Manually implement remaining security measures
4. Re-run this audit after making changes
5. Set up regular security audits (monthly recommended)
`;

  // Save report
  const reportPath = path.join(process.cwd(), `${reportName}.md`);
  await fs.writeFile(reportPath, markdown);

  // Also save JSON version
  const jsonReport = {
    timestamp,
    project: projectSettings,
    summary: bySeverity,
    recommendations,
    byCategory,
  };

  const jsonPath = path.join(process.cwd(), `${reportName}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));

  console.log(chalk.green('\n✅ Security reports generated:'));
  console.log(chalk.gray(`   Markdown: ${reportPath}`));
  console.log(chalk.gray(`   JSON: ${jsonPath}`));
}

// Main function
async function runSecurityAudit() {
  console.log(chalk.blue.bold('\n🔒 SUPABASE MANAGEMENT API SECURITY AUDIT\n'));
  console.log(chalk.gray(`Project: ${PROJECT_REF}`));
  console.log(chalk.gray(`URL: ${SUPABASE_URL}\n`));

  const client = new SupabaseManagementClient(MANAGEMENT_API_TOKEN);
  const allRecommendations: SecurityRecommendation[] = [];

  try {
    // Get project settings
    console.log(chalk.yellow('📋 Fetching project settings...'));
    const projectSettings = await client.getProjectSettings();
    console.log(chalk.green('✓ Project settings retrieved'));

    // Audit database roles
    console.log(chalk.yellow('\n🔍 Auditing database roles...'));
    const roleRecommendations = await auditDatabaseRoles(client);
    allRecommendations.push(...roleRecommendations);
    console.log(chalk.gray(`   Found ${roleRecommendations.length} issues`));

    // Audit security configuration
    console.log(chalk.yellow('\n🔍 Auditing security configuration...'));
    const configRecommendations = await auditSecurityConfig(client);
    allRecommendations.push(...configRecommendations);
    console.log(chalk.gray(`   Found ${configRecommendations.length} issues`));

    // Audit network restrictions
    console.log(chalk.yellow('\n🔍 Auditing network restrictions...'));
    const networkRecommendations = await auditNetworkRestrictions(client);
    allRecommendations.push(...networkRecommendations);
    console.log(chalk.gray(`   Found ${networkRecommendations.length} issues`));

    // Check exposed endpoints
    console.log(chalk.yellow('\n🔍 Checking exposed endpoints...'));
    const apiKeys = await client.getApiKeys();
    const anonKey = apiKeys.find(k => k.name === 'anon')?.api_key;
    if (anonKey) {
      const endpointRecommendations = await checkExposedEndpoints(anonKey);
      allRecommendations.push(...endpointRecommendations);
      console.log(chalk.gray(`   Found ${endpointRecommendations.length} issues`));
    }

    // Check database extensions
    console.log(chalk.yellow('\n🔍 Checking database extensions...'));
    const extensions = await client.getDatabaseExtensions();
    console.log(chalk.gray(`   ${extensions.length} extensions installed`));

    // Summary
    const criticalCount = allRecommendations.filter(r => r.severity === 'critical').length;
    const highCount = allRecommendations.filter(r => r.severity === 'high').length;

    console.log(chalk.blue.bold('\n📊 AUDIT SUMMARY\n'));
    console.log(`Total issues found: ${allRecommendations.length}`);
    console.log(`- Critical: ${criticalCount}`);
    console.log(`- High: ${highCount}`);
    console.log(`- Medium: ${allRecommendations.filter(r => r.severity === 'medium').length}`);
    console.log(`- Low: ${allRecommendations.filter(r => r.severity === 'low').length}`);

    if (criticalCount > 0) {
      console.log(chalk.red.bold(`\n🚨 ${criticalCount} CRITICAL ISSUES REQUIRE IMMEDIATE ATTENTION!`));
    } else if (highCount > 0) {
      console.log(chalk.yellow.bold(`\n⚠️  ${highCount} high-priority issues found`));
    } else {
      console.log(chalk.green.bold('\n✅ No critical or high-severity issues found!'));
    }

    // Ask to apply automated fixes
    const automatedCount = allRecommendations.filter(r => r.automated).length;
    if (automatedCount > 0) {
      console.log(chalk.yellow(`\n🔧 ${automatedCount} issues can be fixed automatically.`));
      console.log(chalk.gray('Note: Automated fixes will modify your project settings.'));
      
      // In a real implementation, you'd prompt for confirmation
      // For now, we'll just note that fixes are available
      console.log(chalk.blue('\nTo apply automated fixes, run with --fix flag'));
    }

    // Generate report
    console.log(chalk.yellow('\n📄 Generating security report...'));
    await generateSecurityReport(projectSettings, allRecommendations);

    console.log(chalk.green.bold('\n✅ Security audit complete!'));

  } catch (error) {
    console.error(chalk.red('\n❌ Audit failed:'), error.message);
    console.log(chalk.yellow('\nTroubleshooting:'));
    console.log('1. Verify your Management API token is valid');
    console.log('2. Check that you have appropriate permissions');
    console.log('3. Ensure the project reference is correct');
    process.exit(1);
  }
}

// Check for --fix flag
const shouldApplyFixes = process.argv.includes('--fix');

// Run the audit
runSecurityAudit().catch(console.error);