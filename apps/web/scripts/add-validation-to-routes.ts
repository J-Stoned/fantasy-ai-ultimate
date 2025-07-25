import fs from 'fs/promises';
import path from 'path';

// Mapping of route patterns to validation schemas
const routeValidationMap = {
  // Admin routes
  '/admin/auth/login': 'adminLoginSchema',
  '/admin/auth/change-password': 'changePasswordSchema',
  '/admin/auth/logout': null, // No body validation needed
  '/admin/sessions': 'sessionManagementSchema',
  '/admin/sessions/revoke-all': null,
  '/admin/sessions/[sessionId]': 'sessionIdParamSchema',
  '/admin/client-info': 'clientInfoSchema',
  '/admin/collect-data': 'dataCollectionSchema',
  '/admin/optimize': 'systemOptimizationSchema',
  '/admin/predict': 'adminPredictionRequestSchema',
  '/admin/stats': 'adminStatsQuerySchema',
  '/admin/trading/orchestrate': 'tradingOrchestrationSchema',
  
  // Auth routes
  '/auth/callback/google': 'oauthCallbackSchema',
  '/auth/callback/yahoo': 'oauthCallbackSchema',
  '/auth/check': 'authCheckSchema',
  '/auth/google/connect': null,
  '/auth/yahoo/connect': null,
  
  // Bankroll routes
  '/bankroll/user': 'bankrollUpdateSchema',
  '/bankroll/history': 'bankrollHistoryQuerySchema',
  '/bankroll/kelly': 'kellyCalculationSchema',
  '/bankroll/recommendations': 'bettingRecommendationSchema',
  
  // Contest routes
  '/contests': 'contestSearchSchema',
  '/contests/optimal': 'optimalLineupRequestSchema',
  
  // Draft routes
  '/draft/analysis': 'leagueStatsQuerySchema',
  '/draft/pick': 'rosterMoveSchema',
  '/draft/recommendations': null, // Custom validation needed
  '/draft/start': 'createLeagueSchema',
  
  // Dynasty routes
  '/dynasty/assets': 'leagueStatsQuerySchema',
  '/dynasty/keeper-recommendations': 'leagueStatsQuerySchema',
  '/dynasty/trade-analysis': 'tradeProposalSchema',
  
  // League routes
  '/leagues': 'paginationSchema',
  '/leagues/create': 'createLeagueSchema',
  '/leagues/templates': 'leagueTemplateSchema',
  '/leagues/validate': 'validateLeagueRulesSchema',
  '/import/[platform]/leagues': 'importLeagueSchema',
  
  // Lineup builder routes
  '/lineup-builder/optimize': 'multiLineupRequestSchema',
  '/lineup-builder/players': 'playerPoolRequestSchema',
  '/lineup-builder/stacks': 'stackValidationSchema',
  
  // Other routes
  '/onboarding/interests': 'safeStringSchema',
  '/trades/analyze': 'tradeProposalSchema',
  '/trades/accept': 'tradeResponseSchema',
  '/user/preferences': null, // Custom validation needed
  '/predictions': 'contestSearchSchema',
  '/ownership/projections': 'ownershipProjectionSchema',
};

// Routes that need query param validation
const queryParamRoutes = {
  '/admin/stats': 'adminStatsQuerySchema',
  '/bankroll/history': 'bankrollHistoryQuerySchema',
  '/contests': 'contestSearchSchema',
  '/leagues': 'paginationSchema',
  '/lineup-builder/players': 'playerPoolRequestSchema',
};

// Routes that need path param validation
const pathParamRoutes = {
  '/admin/sessions/[sessionId]': 'sessionIdParamSchema',
  '/import/[platform]/leagues': 'platformSchema',
};

async function addValidationToRoute(filePath: string) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Skip if already has validation
    if (content.includes('withValidation') || content.includes('validateRequest')) {
      console.log(`✓ ${filePath} - Already has validation`);
      return;
    }
    
    // Extract route path from file path
    const routePath = filePath
      .replace(/.*\/app\/api/, '')
      .replace(/\/route\.ts$/, '')
      .replace(/\[([^\]]+)\]/g, '[param]');
    
    const validationSchema = routeValidationMap[routePath];
    
    if (!validationSchema) {
      console.log(`⚠ ${filePath} - No validation schema mapped`);
      return;
    }
    
    // Add import
    let updatedContent = content;
    const importRegex = /import.*from.*['"].*['"];?\s*$/gm;
    const lastImport = [...content.matchAll(importRegex)].pop();
    
    if (lastImport) {
      const importStatement = `\nimport { withValidation, ${validationSchema} } from '@/lib/validation';`;
      updatedContent = updatedContent.slice(0, lastImport.index! + lastImport[0].length) + 
                      importStatement + 
                      updatedContent.slice(lastImport.index! + lastImport[0].length);
    }
    
    // Wrap handlers with validation
    const handlerRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g;
    updatedContent = updatedContent.replace(handlerRegex, (match, method) => {
      if (method === 'GET' && queryParamRoutes[routePath]) {
        return `export const ${method} = validateQueryParams(${queryParamRoutes[routePath]}, async (`;
      } else if (method !== 'GET') {
        return `export const ${method} = withValidation(${validationSchema}, async (`;
      }
      return match;
    });
    
    // Close the validation wrapper
    updatedContent = updatedContent.replace(/}\s*$/, '});\n');
    
    await fs.writeFile(filePath, updatedContent);
    console.log(`✅ ${filePath} - Validation added`);
    
  } catch (error) {
    console.error(`❌ ${filePath} - Error:`, error);
  }
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

async function main() {
  const apiDir = path.join(process.cwd(), 'src/app/api');
  console.log('🔍 Scanning for API routes...');
  
  const routes = await findAllRoutes(apiDir);
  console.log(`📁 Found ${routes.length} API routes\n`);
  
  console.log('🛡️ Adding validation to routes...\n');
  
  for (const route of routes) {
    await addValidationToRoute(route);
  }
  
  console.log('\n✨ Validation update complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Review the updated routes');
  console.log('2. Test each endpoint');
  console.log('3. Add custom validation for routes marked with ⚠');
}

main().catch(console.error);