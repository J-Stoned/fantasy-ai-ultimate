import fs from 'fs/promises';
import path from 'path';

interface RouteInfo {
  path: string;
  file: string;
  methods: string[];
  hasValidation: boolean;
  validationType: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const CRITICAL_PATTERNS = [
  'auth', 'login', 'password', 'admin', 'bankroll', 'payment', 'withdraw', 'deposit'
];

const HIGH_PRIORITY_PATTERNS = [
  'create', 'update', 'delete', 'trade', 'contest', 'entry', 'lineup'
];

async function analyzeRoute(filePath: string): Promise<RouteInfo> {
  const content = await fs.readFile(filePath, 'utf-8');
  const relativePath = filePath.replace(/.*\/app\/api/, '/api').replace(/\/route\.ts$/, '');
  
  // Extract HTTP methods
  const methods: string[] = [];
  const methodRegex = /export\s+(?:async\s+)?(?:function\s+)?(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/g;
  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    methods.push(match[1]);
  }
  
  // Check for validation
  const hasValidation = content.includes('withValidation') || 
                       content.includes('validateRequest') ||
                       content.includes('validateQueryParams') ||
                       content.includes('validatePathParams');
  
  // Check validation types
  const validationType: string[] = [];
  if (content.includes('withValidation')) validationType.push('body');
  if (content.includes('validateQueryParams')) validationType.push('query');
  if (content.includes('validatePathParams')) validationType.push('params');
  if (content.includes('z.object') || content.includes('zod')) validationType.push('zod');
  
  // Determine priority
  let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
  const lowerPath = relativePath.toLowerCase();
  
  if (CRITICAL_PATTERNS.some(pattern => lowerPath.includes(pattern))) {
    priority = 'critical';
  } else if (HIGH_PRIORITY_PATTERNS.some(pattern => lowerPath.includes(pattern))) {
    priority = 'high';
  } else if (methods.includes('POST') || methods.includes('PUT') || methods.includes('DELETE')) {
    priority = 'medium';
  }
  
  return {
    path: relativePath,
    file: filePath,
    methods,
    hasValidation,
    validationType,
    priority
  };
}

async function findAllRoutes(dir: string): Promise<string[]> {
  const routes: string[] = [];
  
  async function scan(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.name === 'route.ts') {
        routes.push(fullPath);
      }
    }
  }
  
  await scan(dir);
  return routes;
}

async function generateReport() {
  const apiDir = path.join(process.cwd(), 'src/app/api');
  console.log('🔍 Scanning API routes for validation audit...\n');
  
  const routeFiles = await findAllRoutes(apiDir);
  const routes: RouteInfo[] = [];
  
  for (const file of routeFiles) {
    routes.push(await analyzeRoute(file));
  }
  
  // Sort by priority and validation status
  routes.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (a.hasValidation !== b.hasValidation) {
      return a.hasValidation ? 1 : -1; // Unvalidated first
    }
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  // Generate statistics
  const total = routes.length;
  const validated = routes.filter(r => r.hasValidation).length;
  const unvalidated = total - validated;
  
  const byPriority = {
    critical: routes.filter(r => r.priority === 'critical' && !r.hasValidation).length,
    high: routes.filter(r => r.priority === 'high' && !r.hasValidation).length,
    medium: routes.filter(r => r.priority === 'medium' && !r.hasValidation).length,
    low: routes.filter(r => r.priority === 'low' && !r.hasValidation).length,
  };
  
  // Print report
  console.log('📊 VALIDATION AUDIT REPORT');
  console.log('========================\n');
  
  console.log(`Total Routes: ${total}`);
  console.log(`✅ Validated: ${validated} (${((validated/total)*100).toFixed(1)}%)`);
  console.log(`❌ Unvalidated: ${unvalidated} (${((unvalidated/total)*100).toFixed(1)}%)\n`);
  
  console.log('Unvalidated by Priority:');
  console.log(`🔴 Critical: ${byPriority.critical}`);
  console.log(`🟠 High: ${byPriority.high}`);
  console.log(`🟡 Medium: ${byPriority.medium}`);
  console.log(`🟢 Low: ${byPriority.low}\n`);
  
  // List critical unvalidated routes
  console.log('🚨 CRITICAL ROUTES WITHOUT VALIDATION:');
  console.log('=====================================');
  routes
    .filter(r => r.priority === 'critical' && !r.hasValidation)
    .forEach(r => {
      console.log(`\n${r.path}`);
      console.log(`  Methods: ${r.methods.join(', ')}`);
      console.log(`  File: ${r.file.replace(process.cwd(), '.')}`);
    });
  
  // List high priority unvalidated routes
  console.log('\n\n⚠️  HIGH PRIORITY ROUTES WITHOUT VALIDATION:');
  console.log('==========================================');
  routes
    .filter(r => r.priority === 'high' && !r.hasValidation)
    .forEach(r => {
      console.log(`\n${r.path}`);
      console.log(`  Methods: ${r.methods.join(', ')}`);
    });
  
  // List validated routes summary
  console.log('\n\n✅ VALIDATED ROUTES SUMMARY:');
  console.log('===========================');
  const validatedByType: Record<string, number> = {};
  routes
    .filter(r => r.hasValidation)
    .forEach(r => {
      r.validationType.forEach(type => {
        validatedByType[type] = (validatedByType[type] || 0) + 1;
      });
    });
  
  Object.entries(validatedByType).forEach(([type, count]) => {
    console.log(`${type}: ${count} routes`);
  });
  
  // Generate action items
  console.log('\n\n📋 ACTION ITEMS:');
  console.log('===============');
  console.log('1. Add validation to all CRITICAL routes immediately');
  console.log('2. Add validation to HIGH priority routes within 24 hours');
  console.log('3. Review and add validation to MEDIUM priority routes');
  console.log('4. Consider validation needs for LOW priority routes');
  console.log('\n5. Run tests after adding validation');
  console.log('6. Update API documentation with validation rules');
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      validated,
      unvalidated,
      byPriority
    },
    routes: routes.map(r => ({
      ...r,
      file: r.file.replace(process.cwd(), '.')
    }))
  };
  
  await fs.writeFile(
    path.join(process.cwd(), 'validation-audit-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n\n📄 Detailed report saved to: validation-audit-report.json');
}

generateReport().catch(console.error);