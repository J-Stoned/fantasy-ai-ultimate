#!/usr/bin/env tsx
/**
 * 🧹 UI FILES CLEANUP
 * 
 * Removes unnecessary UI files based on our analysis
 */

import { unlink, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import chalk from 'chalk';
import path from 'path';

// Files to definitely remove
const FILES_TO_REMOVE = [
  // Test files (we'll keep minimal testing)
  'apps/web/jest.config.ts',
  
  // Static webpack artifacts (.next is regenerated on build)
  'apps/web/.next/static/development/_buildManifest.js',
  'apps/web/.next/static/development/_ssgManifest.js',
  
  // Old webpack hot updates
  'apps/web/.next/static/webpack/app/layout.c7a096e84288f3c2.hot-update.js',
  'apps/web/.next/static/webpack/webpack.007fdee009487291.hot-update.js',
  'apps/web/.next/static/webpack/webpack.8d37f2db93de362d.hot-update.js',
  'apps/web/.next/static/webpack/webpack.c719f26ab3d51bea.hot-update.js',
  'apps/web/.next/static/webpack/webpack.c7a096e84288f3c2.hot-update.js',
  'apps/web/.next/static/webpack/webpack.dfc2241d45e511d4.hot-update.js',
  'apps/web/.next/static/webpack/webpack.e3f392d1b1bbd17b.hot-update.js',
];

// Files to review manually (might be needed)
const FILES_TO_REVIEW = [
  'apps/web/src/app/pricing/page.tsx', // Might need for monetization
  'apps/web/src/app/ai-assistant/page.tsx', // Could be repurposed
  'apps/web/jest.setup.ts', // Might want minimal tests
];

async function removeFile(filePath: string): Promise<boolean> {
  try {
    if (existsSync(filePath)) {
      await unlink(filePath);
      console.log(chalk.green(`✅ Removed: ${filePath}`));
      return true;
    } else {
      console.log(chalk.gray(`⏭️  Skipped (not found): ${filePath}`));
      return false;
    }
  } catch (error) {
    console.error(chalk.red(`❌ Error removing ${filePath}:`, error));
    return false;
  }
}

async function main() {
  console.log(chalk.bold.cyan('🧹 UI FILES CLEANUP\n'));
  
  console.log(chalk.yellow('Removing unnecessary files...\n'));
  
  let removed = 0;
  let skipped = 0;
  let errors = 0;
  
  // Remove files
  for (const file of FILES_TO_REMOVE) {
    const result = await removeFile(file);
    if (result) {
      removed++;
    } else {
      skipped++;
    }
  }
  
  console.log(chalk.bold.yellow('\n📋 Files to review manually:\n'));
  for (const file of FILES_TO_REVIEW) {
    if (existsSync(file)) {
      console.log(chalk.yellow(`⚠️  ${file}`));
    }
  }
  
  // Summary
  console.log(chalk.bold.cyan('\n✨ CLEANUP COMPLETE!\n'));
  console.log(chalk.green(`✅ Removed: ${removed} files`));
  console.log(chalk.gray(`⏭️  Skipped: ${skipped} files`));
  if (errors > 0) {
    console.log(chalk.red(`❌ Errors: ${errors}`));
  }
  
  console.log(chalk.bold.yellow('\n🎯 Next Steps:'));
  console.log(chalk.gray('1. Review the files listed above'));
  console.log(chalk.gray('2. Delete .next folder and rebuild: rm -rf apps/web/.next && npm run build'));
  console.log(chalk.gray('3. Update any broken imports'));
  console.log(chalk.gray('4. Test the application'));
  
  console.log(chalk.bold.green('\n✨ Your UI is now focused on the AI-driven fantasy sports platform!'));
}

main().catch(console.error);