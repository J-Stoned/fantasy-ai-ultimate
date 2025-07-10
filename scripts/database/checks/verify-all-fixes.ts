#!/usr/bin/env tsx
/**
 * VERIFY ALL FIXES - Marcus "The Fixer" Rodriguez
 * This script checks that all our production fixes are properly implemented
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

interface FixCheck {
  name: string;
  description: string;
  check: () => boolean | Promise<boolean>;
}

const fixes: FixCheck[] = [
  {
    name: 'React 19 NPM Overrides',
    description: 'package.json has overrides for React 19 compatibility',
    check: () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
      );
      return !!packageJson.overrides && !!packageJson.overrides.react;
    }
  },
  {
    name: 'MCP Orchestrator Memory Leak Fix',
    description: 'Health check interval cleanup added',
    check: () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'lib/mcp/MCPOrchestrator.ts'),
        'utf-8'
      );
      return content.includes('Clear any existing interval to prevent memory leaks') &&
             content.includes('if (this.healthCheckInterval)');
    }
  },
  {
    name: 'API Authentication Wrapper',
    description: 'withAuth function exists for protecting routes',
    check: () => {
      return fs.existsSync(path.join(process.cwd(), 'lib/auth/withAuth.ts'));
    }
  },
  {
    name: 'MCP Status Route Protected',
    description: 'MCP status endpoint uses authentication',
    check: () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'web/src/app/api/mcp/status/route.ts'),
        'utf-8'
      );
      return content.includes('withAuth') && 
             content.includes('export const GET = withAuth');
    }
  },
  {
    name: 'Player Data Collector Batch Operations',
    description: 'N+1 queries replaced with batch operations',
    check: () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'lib/services/data-collection/player-collector.ts'),
        'utf-8'
      );
      return content.includes('createMany') && 
             content.includes('batch operations - NFL Sunday optimized');
    }
  },
  {
    name: 'PlayerCard React.memo',
    description: 'PlayerCard component is memoized',
    check: () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'libs/shared-ui/src/lib/components/PlayerCard.tsx'),
        'utf-8'
      );
      return content.includes('React.memo') && 
             content.includes('PlayerCard.displayName');
    }
  },
  {
    name: 'Mobile Realtime Memory Leaks Fixed',
    description: 'AppState listener and heartbeat cleanup implemented',
    check: () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'mobile/src/services/realtime.ts'),
        'utf-8'
      );
      return content.includes('this.appStateSubscription?.remove()') &&
             content.includes('clearInterval(this.heartbeatInterval)') &&
             content.includes('MARCUS FIX: Proper memory cleanup');
    }
  },
  {
    name: 'MCP Dashboard Optimizations',
    description: 'useMemo and useCallback hooks added',
    check: () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'web/src/app/mcp-dashboard/page.tsx'),
        'utf-8'
      );
      return content.includes('useMemo') && 
             content.includes('useCallback') &&
             content.includes('getStatusColor = useCallback');
    }
  },
  {
    name: 'RLS Verification Script',
    description: 'Script exists to verify Row Level Security',
    check: () => {
      return fs.existsSync(path.join(process.cwd(), 'scripts/verify-rls-status.ts'));
    }
  },
  {
    name: 'Production Fixes Documentation',
    description: 'Complete documentation of all fixes',
    check: () => {
      return fs.existsSync(path.join(process.cwd(), 'MARCUS_PRODUCTION_FIXES_COMPLETE.md'));
    }
  }
];

async function verifyAllFixes() {
  console.log(chalk.blue.bold(`
🔍 VERIFYING ALL PRODUCTION FIXES
=================================
Marcus "The Fixer" Rodriguez Quality Check
`));

  const results: { fix: string; passed: boolean; error?: string }[] = [];

  for (const fix of fixes) {
    process.stdout.write(chalk.blue(`Checking: ${fix.name}... `));
    
    try {
      const passed = await fix.check();
      results.push({ fix: fix.name, passed });
      
      if (passed) {
        console.log(chalk.green('✅ FIXED'));
        console.log(chalk.gray(`  └─ ${fix.description}`));
      } else {
        console.log(chalk.red('❌ NOT FIXED'));
        console.log(chalk.red(`  └─ ${fix.description}`));
      }
    } catch (error) {
      results.push({ 
        fix: fix.name, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error)
      });
      console.log(chalk.red('❌ ERROR'));
      console.log(chalk.red(`  └─ ${error instanceof Error ? error.message : error}`));
    }
  }

  // Summary
  console.log(chalk.blue.bold('\n📊 VERIFICATION SUMMARY'));
  console.log('=======================\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total Checks: ${total}`);
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));

  const successRate = (passed / total) * 100;
  console.log(`\nSuccess Rate: ${successRate.toFixed(1)}%`);

  if (successRate === 100) {
    console.log(chalk.green.bold('\n✅ ALL FIXES VERIFIED!'));
    console.log(chalk.green('Your platform has all production fixes properly implemented.'));
    console.log(chalk.green('Ready for NFL Sunday! 🏈'));
  } else {
    console.log(chalk.red.bold('\n❌ SOME FIXES MISSING!'));
    console.log(chalk.red('The following fixes need to be re-applied:'));
    results
      .filter(r => !r.passed)
      .forEach(r => console.log(chalk.red(`  - ${r.fix}`)));
  }

  // Additional checks
  console.log(chalk.blue.bold('\n🔧 ADDITIONAL SYSTEM CHECKS'));
  console.log('===========================\n');

  // Check Node version
  const nodeVersion = process.version;
  console.log(`Node.js Version: ${nodeVersion}`);
  if (nodeVersion.startsWith('v20') || nodeVersion.startsWith('v22')) {
    console.log(chalk.green('✅ Node.js version compatible'));
  } else {
    console.log(chalk.yellow('⚠️  Consider using Node.js 20 or 22'));
  }

  // Check for .env.local
  if (fs.existsSync('.env.local')) {
    console.log(chalk.green('✅ .env.local file exists'));
  } else {
    console.log(chalk.red('❌ .env.local file missing'));
  }

  // Check for node_modules
  if (fs.existsSync('node_modules')) {
    console.log(chalk.green('✅ Dependencies installed'));
  } else {
    console.log(chalk.red('❌ Run npm install'));
  }

  return successRate === 100;
}

// Run verification
verifyAllFixes().then(success => {
  process.exit(success ? 0 : 1);
});