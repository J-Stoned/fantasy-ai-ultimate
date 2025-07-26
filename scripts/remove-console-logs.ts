#!/usr/bin/env tsx

/**
 * 🧹 Remove Console Logs Script
 * Removes all console.* statements from production code
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

// Patterns to match console statements
const CONSOLE_PATTERNS = [
  /console\.(log|error|warn|info|debug|trace|dir|table|time|timeEnd|group|groupEnd)\s*\(/g,
  /console\.\w+\s*\(/g, // Catch any console.* method
];

// Files to exclude from processing
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/*.test.{ts,tsx,js,jsx}',
  '**/*.spec.{ts,tsx,js,jsx}',
  '**/test/**',
  '**/__tests__/**',
  '**/scripts/**', // Don't remove from scripts
  '**/logger.ts', // Keep in logger files
  '**/logger.service.ts',
  '**/logging/**',
];

interface FileResult {
  path: string;
  removedCount: number;
  removedLines: string[];
}

async function removeConsoleFromFile(filePath: string): Promise<FileResult | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const removedLines: string[] = [];
    let modifiedContent = content;
    let removedCount = 0;

    // Track which lines have console statements
    lines.forEach((line, index) => {
      CONSOLE_PATTERNS.forEach(pattern => {
        if (pattern.test(line)) {
          removedLines.push(`Line ${index + 1}: ${line.trim()}`);
        }
      });
    });

    // Remove console statements
    CONSOLE_PATTERNS.forEach(pattern => {
      const matches = modifiedContent.match(pattern) || [];
      removedCount += matches.length;
      
      // Replace console.* statements with empty string
      // Handle multi-line console statements
      modifiedContent = modifiedContent.replace(
        /console\.\w+\s*\([^)]*\);?\s*(\r?\n)?/g,
        ''
      );
      
      // Handle console statements that span multiple lines
      modifiedContent = modifiedContent.replace(
        /console\.\w+\s*\([^)]*\)[^;]*;?\s*(\r?\n)?/gs,
        ''
      );
    });

    // Clean up empty lines left behind
    modifiedContent = modifiedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

    if (removedCount > 0) {
      await fs.writeFile(filePath, modifiedContent, 'utf-8');
      return {
        path: filePath,
        removedCount,
        removedLines,
      };
    }

    return null;
  } catch (error) {
    console.error(chalk.red(`Error processing ${filePath}:`), error);
    return null;
  }
}

async function main() {
  console.log(chalk.bold.blue('🧹 Removing console.* statements from production code...\n'));

  // Find all TypeScript and JavaScript files
  const patterns = [
    'apps/web/src/**/*.{ts,tsx,js,jsx}',
    'apps/mobile/src/**/*.{ts,tsx,js,jsx}',
  ];

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { 
      ignore: EXCLUDE_PATTERNS,
      absolute: true,
    });
    files.push(...matches);
  }

  console.log(chalk.cyan(`Found ${files.length} files to process\n`));

  // Process files
  const results: FileResult[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await removeConsoleFromFile(file);
    if (result) {
      results.push(result);
    }
  }

  // Display results
  if (results.length === 0) {
    console.log(chalk.green('✅ No console statements found in production code!'));
  } else {
    console.log(chalk.yellow(`\n📊 Removed console statements from ${results.length} files:\n`));
    
    let totalRemoved = 0;
    results.forEach(result => {
      console.log(chalk.gray(`  ${result.path}`));
      console.log(chalk.red(`    Removed ${result.removedCount} console statement(s)`));
      if (result.removedLines.length <= 3) {
        result.removedLines.forEach(line => {
          console.log(chalk.gray(`    - ${line}`));
        });
      } else {
        console.log(chalk.gray(`    - ${result.removedLines[0]}`));
        console.log(chalk.gray(`    - ${result.removedLines[1]}`));
        console.log(chalk.gray(`    - ... and ${result.removedLines.length - 2} more`));
      }
      totalRemoved += result.removedCount;
    });

    console.log(chalk.green(`\n✅ Total console statements removed: ${totalRemoved}`));
  }

  // Create a report
  const report = {
    timestamp: new Date().toISOString(),
    filesProcessed: files.length,
    filesModified: results.length,
    totalStatementsRemoved: results.reduce((sum, r) => sum + r.removedCount, 0),
    modifiedFiles: results.map(r => ({
      path: r.path.replace(process.cwd(), '.'),
      removedCount: r.removedCount,
    })),
  };

  const reportPath = path.join(process.cwd(), 'console-removal-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(chalk.blue(`\n📄 Report saved to: ${reportPath}`));

  if (errors.length > 0) {
    console.log(chalk.red('\n❌ Errors encountered:'));
    errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}