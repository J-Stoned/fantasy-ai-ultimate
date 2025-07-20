#!/usr/bin/env tsx
/**
 * 🧹 UI CLEANUP ANALYZER
 * 
 * Identifies UI/UX components that don't align with our new multi-platform fantasy sports vision
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

// Components and patterns we want to KEEP
const KEEP_PATTERNS = [
  // League management
  'league', 'League', 'import', 'Import', 'platform', 'Platform',
  'roster', 'Roster', 'lineup', 'Lineup', 'optimizer', 'Optimizer',
  
  // AI/ML features
  'pattern', 'Pattern', 'ai', 'AI', 'ml', 'ML', 'predict', 'Predict',
  'insight', 'Insight', 'alert', 'Alert', 'confidence', 'Confidence',
  
  // Core fantasy features
  'draft', 'Draft', 'trade', 'Trade', 'waiver', 'Waiver',
  'score', 'Score', 'player', 'Player', 'team', 'Team',
  
  // Real features
  'auth', 'Auth', 'login', 'Login', 'dashboard', 'Dashboard',
  'websocket', 'WebSocket', 'realtime', 'RealTime'
];

// Patterns that indicate OLD or FAKE components to remove
const REMOVE_PATTERNS = [
  // Fake/mock data
  'mock', 'Mock', 'fake', 'Fake', 'demo', 'Demo', 'sample', 'Sample',
  'test', 'Test', 'example', 'Example', 'placeholder', 'Placeholder',
  
  // Old static components
  'static', 'Static', 'hardcoded', 'Hardcoded', 'dummy', 'Dummy',
  
  // Vague marketing pages
  'landing', 'Landing', 'hero', 'Hero', 'marketing', 'Marketing',
  'pricing', 'Pricing', 'about', 'About', 'contact', 'Contact',
  
  // Non-existent features
  'blockchain', 'Blockchain', 'crypto', 'Crypto', 'nft', 'NFT',
  'metaverse', 'Metaverse', 'web3', 'Web3', 'AR', 'VR'
];

async function analyzeDirectory(dir: string, basePath: string = ''): Promise<void> {
  const files = await readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = join(dir, file.name);
    const relativePath = join(basePath, file.name);
    
    if (file.isDirectory()) {
      // Skip node_modules and .git
      if (file.name === 'node_modules' || file.name === '.git') continue;
      
      await analyzeDirectory(fullPath, relativePath);
    } else if (file.name.endsWith('.tsx') || file.name.endsWith('.ts') || file.name.endsWith('.jsx') || file.name.endsWith('.js')) {
      await analyzeFile(fullPath, relativePath);
    }
  }
}

async function analyzeFile(filePath: string, relativePath: string): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf-8');
    
    // Check if file should be kept
    const hasKeepPattern = KEEP_PATTERNS.some(pattern => 
      relativePath.toLowerCase().includes(pattern.toLowerCase()) ||
      content.includes(pattern)
    );
    
    // Check if file should be removed
    const hasRemovePattern = REMOVE_PATTERNS.some(pattern => 
      relativePath.toLowerCase().includes(pattern.toLowerCase()) ||
      content.includes(pattern)
    );
    
    // Categorize the file
    if (hasRemovePattern && !hasKeepPattern) {
      console.log(chalk.red(`❌ REMOVE: ${relativePath}`));
      
      // Find which patterns matched
      const matchedPatterns = REMOVE_PATTERNS.filter(pattern => 
        relativePath.toLowerCase().includes(pattern.toLowerCase()) ||
        content.includes(pattern)
      );
      console.log(chalk.gray(`   Reasons: ${matchedPatterns.join(', ')}`));
    } else if (hasKeepPattern && !hasRemovePattern) {
      console.log(chalk.green(`✅ KEEP: ${relativePath}`));
    } else if (hasKeepPattern && hasRemovePattern) {
      console.log(chalk.yellow(`⚠️  REVIEW: ${relativePath}`));
      console.log(chalk.gray(`   Has both keep and remove patterns`));
    } else {
      // No clear pattern - needs manual review
      console.log(chalk.blue(`🔍 CHECK: ${relativePath}`));
      console.log(chalk.gray(`   No clear patterns found - manual review needed`));
    }
  } catch (error) {
    console.error(chalk.red(`Error reading ${relativePath}:`, error));
  }
}

async function main() {
  console.log(chalk.bold.cyan('🧹 UI CLEANUP ANALYZER\n'));
  console.log(chalk.yellow('Analyzing UI components for cleanup...\n'));
  
  // Analyze apps/web directory
  console.log(chalk.bold.yellow('📁 Analyzing /apps/web directory:\n'));
  await analyzeDirectory('./apps/web', 'apps/web');
  
  console.log(chalk.bold.yellow('\n📁 Analyzing /components directory:\n'));
  await analyzeDirectory('./components', 'components');
  
  console.log(chalk.bold.yellow('\n📁 Analyzing /lib directory:\n'));
  await analyzeDirectory('./lib', 'lib');
  
  console.log(chalk.bold.yellow('\n📁 Analyzing /web directory:\n'));
  await analyzeDirectory('./web', 'web');
  
  console.log(chalk.bold.cyan('\n✨ ANALYSIS COMPLETE!\n'));
  console.log(chalk.gray('Legend:'));
  console.log(chalk.red('❌ REMOVE - Contains fake/mock/old patterns'));
  console.log(chalk.green('✅ KEEP - Aligns with new fantasy sports vision'));
  console.log(chalk.yellow('⚠️  REVIEW - Has conflicting patterns'));
  console.log(chalk.blue('🔍 CHECK - Needs manual review'));
  
  console.log(chalk.bold.yellow('\n🎯 Next Steps:'));
  console.log(chalk.gray('1. Review all ❌ REMOVE files and delete them'));
  console.log(chalk.gray('2. Check ⚠️  REVIEW files for specific content'));
  console.log(chalk.gray('3. Manually inspect 🔍 CHECK files'));
  console.log(chalk.gray('4. Update routes to point to new league components'));
}

main().catch(console.error);