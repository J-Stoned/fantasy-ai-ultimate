#!/usr/bin/env node

/**
 * 🔥 COMPREHENSIVE FEATURE DATABASE VERIFICATION 🔥
 * Checks EVERY SINGLE FEATURE to ensure it's using the 1.3M game logs database
 */

import 'dotenv/config';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';

console.log(chalk.bold.red(`
╔═══════════════════════════════════════════════════════════════╗
║   🔥 VERIFYING ALL FEATURES USE 1.3M GAME LOGS DB! 🔥        ║
╚═══════════════════════════════════════════════════════════════╝
`));

interface FeatureCheck {
  name: string;
  category: string;
  files: string[];
  databaseUsage?: 'local' | 'supabase' | 'unknown' | 'none';
  details?: string;
}

const features: FeatureCheck[] = [
  // Core Features
  {
    name: 'Voice Assistant ("Hey Fantasy")',
    category: 'AI Features',
    files: [
      'apps/web/src/app/api/voice/process/route.ts',
      'apps/web/src/components/voice/VoiceAssistant.tsx',
      'apps/web/src/lib/services/voice-command-processor.ts'
    ]
  },
  {
    name: 'Player Data & Avatars',
    category: 'Core Data',
    files: [
      'apps/web/src/app/api/players/route.ts',
      'apps/web/src/app/api/avatars/route.ts',
      'apps/web/src/lib/database/player-data-service.ts'
    ]
  },
  {
    name: 'Game Statistics',
    category: 'Core Data',
    files: [
      'apps/web/src/lib/database/game-stats-service.ts',
      'apps/web/src/lib/database/game-stats-service-fixed.ts'
    ]
  },
  
  // ML & Predictions
  {
    name: 'ML Predictions',
    category: 'Machine Learning',
    files: [
      'apps/web/src/app/api/ml/predict/route.ts',
      'apps/web/src/app/api/predictions/route.ts',
      'scripts/domains/ml/training/train-production-models.ts'
    ]
  },
  {
    name: 'Oracle AI',
    category: 'AI Features',
    files: [
      'apps/web/src/app/api/oracle/prophecy/route.ts',
      'apps/web/src/components/oracle/OracleInterface.tsx'
    ]
  },
  
  // DFS Features
  {
    name: 'DFS Trading Terminal',
    category: 'Daily Fantasy',
    files: [
      'apps/web/src/components/dfs/TradingTerminal.tsx',
      'apps/web/src/app/api/optimize/lineup/route.ts',
      'apps/web/src/app/api/contests/route.ts'
    ]
  },
  {
    name: 'Lineup Optimizer',
    category: 'Daily Fantasy',
    files: [
      'apps/web/src/app/api/lineup-builder/optimize/route.ts',
      'apps/web/src/lib/services/lineup-optimization-service.ts'
    ]
  },
  {
    name: 'Ownership Projections',
    category: 'Daily Fantasy',
    files: [
      'apps/web/src/app/api/ownership/route.ts',
      'apps/web/src/app/api/ownership/v2/route.ts',
      'apps/web/src/app/api/ownership/leverage/route.ts'
    ]
  },
  {
    name: 'Bankroll Management',
    category: 'Daily Fantasy',
    files: [
      'apps/web/src/app/api/bankroll/kelly/route.ts',
      'apps/web/src/app/api/bankroll/user/route.ts',
      'apps/web/src/app/api/bankroll/history/route.ts'
    ]
  },
  
  // Traditional Fantasy
  {
    name: 'Waiver Wire',
    category: 'Traditional Fantasy',
    files: [
      'apps/web/src/app/api/waivers/submit/route.ts',
      'apps/web/src/app/api/waivers/claims/route.ts'
    ]
  },
  {
    name: 'Trade Analyzer',
    category: 'Traditional Fantasy',
    files: [
      'apps/web/src/app/api/trades/analyze/route.ts',
      'apps/web/src/app/api/trades/recommendations/route.ts'
    ]
  },
  {
    name: 'Draft Assistant',
    category: 'Traditional Fantasy',
    files: [
      'apps/web/src/app/api/draft/analysis/route.ts',
      'apps/web/src/app/draft/page.tsx'
    ]
  },
  {
    name: 'Dynasty Mode',
    category: 'Traditional Fantasy',
    files: [
      'apps/web/src/app/api/dynasty/assets/route.ts',
      'apps/web/src/app/api/dynasty/keeper-recommendations/route.ts'
    ]
  },
  
  // Live Features
  {
    name: 'Live Scores & Updates',
    category: 'Real-Time',
    files: [
      'apps/web/src/app/api/live-scores/games/route.ts',
      'apps/web/src/app/api/live-scores/players/route.ts',
      'apps/web/src/lib/services/websocket-server.ts'
    ]
  },
  {
    name: 'WebSocket Connections',
    category: 'Real-Time',
    files: [
      'apps/web/src/hooks/useWebSocket.ts',
      'apps/web/src/services/websocket-client.ts'
    ]
  },
  
  // Admin & Analytics
  {
    name: 'Admin Dashboards',
    category: 'Admin',
    files: [
      'apps/web/src/app/api/admin/stats/route.ts',
      'apps/web/src/app/api/admin/predict/route.ts',
      'apps/web/src/app/api/admin/trading/orchestrate/route.ts'
    ]
  },
  {
    name: 'Analytics & Monitoring',
    category: 'Analytics',
    files: [
      'apps/web/src/app/api/analytics/voice-query/route.ts',
      'apps/web/src/lib/monitoring/performance-monitor.ts'
    ]
  },
  
  // Mobile App
  {
    name: 'Mobile App API',
    category: 'Mobile',
    files: [
      'apps/mobile/src/services/api.ts',
      'apps/mobile/src/api/supabase.ts',
      'apps/mobile/src/services/player-data-service.ts'
    ]
  }
];

async function checkFile(filePath: string): Promise<{
  exists: boolean;
  databaseUsage?: 'local' | 'supabase' | 'unknown' | 'none';
  details?: string;
}> {
  const fullPath = path.join(process.cwd(), filePath);
  
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Check for database connections
    const hasLocalPool = /new Pool\(|databaseConfig|DATABASE_URL_LOCAL|DATABASE_URL(?!.*SUPABASE)/.test(content);
    const hasSupabaseServer = /createClient.*from.*supabase\/server/.test(content);
    const hasSupabaseCloud = /createClient.*NEXT_PUBLIC_SUPABASE_URL|supabase\.co/.test(content);
    const hasPlayerDataService = /playerDataService|gameStatsService/.test(content);
    const hasDirectImport = /from.*@\/lib\/database/.test(content);
    
    if (hasLocalPool || hasSupabaseServer || hasPlayerDataService || hasDirectImport) {
      return {
        exists: true,
        databaseUsage: 'local',
        details: 'Using local database adapter or services'
      };
    } else if (hasSupabaseCloud) {
      return {
        exists: true,
        databaseUsage: 'supabase',
        details: 'Still using Supabase cloud!'
      };
    } else if (content.includes('database') || content.includes('query')) {
      return {
        exists: true,
        databaseUsage: 'unknown',
        details: 'Uses database but connection unclear'
      };
    } else {
      return {
        exists: true,
        databaseUsage: 'none',
        details: 'No database usage detected'
      };
    }
  } catch (error) {
    return { exists: false };
  }
}

async function verifyFeatures() {
  const results = [];
  
  for (const feature of features) {
    const spinner = ora(`Checking ${feature.name}...`).start();
    
    let overallStatus: 'local' | 'supabase' | 'unknown' | 'none' | 'missing' = 'none';
    let details: string[] = [];
    let fileResults = [];
    
    for (const file of feature.files) {
      const result = await checkFile(file);
      fileResults.push({ file, ...result });
      
      if (!result.exists) {
        details.push(`Missing: ${file}`);
        if (overallStatus === 'none') overallStatus = 'missing';
      } else if (result.databaseUsage === 'supabase') {
        overallStatus = 'supabase';
        details.push(`⚠️ ${file}: ${result.details}`);
      } else if (result.databaseUsage === 'local' && overallStatus !== 'supabase') {
        overallStatus = 'local';
      } else if (result.databaseUsage === 'unknown' && overallStatus === 'none') {
        overallStatus = 'unknown';
      }
    }
    
    if (overallStatus === 'local') {
      spinner.succeed(`${feature.name}: ${chalk.green('✅ Using local DB')}`);
    } else if (overallStatus === 'supabase') {
      spinner.fail(`${feature.name}: ${chalk.red('❌ Still using Supabase!')}`);
    } else if (overallStatus === 'missing') {
      spinner.warn(`${feature.name}: ${chalk.yellow('⚠️ Files missing')}`);
    } else if (overallStatus === 'unknown') {
      spinner.warn(`${feature.name}: ${chalk.yellow('? Database usage unclear')}`);
    } else {
      spinner.info(`${feature.name}: ${chalk.gray('No database usage')}`);
    }
    
    results.push({
      ...feature,
      status: overallStatus,
      details: details.join('\n'),
      fileResults
    });
  }
  
  // Summary
  console.log(chalk.bold.yellow('\n📊 FEATURE DATABASE VERIFICATION SUMMARY:\n'));
  
  const table = new Table({
    head: ['Feature', 'Category', 'Status', 'Details'],
    colWidths: [30, 20, 15, 40],
    style: { head: [], border: ['grey'] }
  });
  
  let stats = {
    local: 0,
    supabase: 0,
    missing: 0,
    unknown: 0,
    none: 0
  };
  
  results.forEach(result => {
    const statusEmoji = {
      local: chalk.green('✅ Local DB'),
      supabase: chalk.red('❌ Supabase'),
      missing: chalk.yellow('⚠️ Missing'),
      unknown: chalk.yellow('? Unknown'),
      none: chalk.gray('No DB')
    }[result.status];
    
    stats[result.status]++;
    
    table.push([
      result.name,
      result.category,
      statusEmoji,
      result.details.substring(0, 35) + (result.details.length > 35 ? '...' : '')
    ]);
  });
  
  console.log(table.toString());
  
  // Final stats
  console.log(chalk.bold(`\n📈 RESULTS:`));
  console.log(chalk.white(`• Total Features Checked: ${results.length}`));
  console.log(chalk.green(`• Using Local DB: ${stats.local}`));
  console.log(chalk.red(`• Still on Supabase: ${stats.supabase}`));
  console.log(chalk.yellow(`• Missing/Unknown: ${stats.missing + stats.unknown}`));
  console.log(chalk.gray(`• No Database: ${stats.none}`));
  
  if (stats.supabase > 0) {
    console.log(chalk.bold.red(`
⚠️  WARNING: ${stats.supabase} features are still using Supabase cloud!
    Check the details above to fix these connections.
    `));
  } else if (stats.local === results.filter(r => r.status !== 'none').length) {
    console.log(chalk.bold.green(`
╔═══════════════════════════════════════════════════════════════╗
║   🎉 ALL DATABASE FEATURES USING LOCAL 1.3M LOGS! 🎉         ║
╚═══════════════════════════════════════════════════════════════╝
    `));
  }
}

// Run verification
verifyFeatures().catch(console.error);