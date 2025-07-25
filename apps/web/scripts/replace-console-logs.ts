#!/usr/bin/env ts-node

/**
 * Script to replace console.log statements with structured logging
 * Systematically converts all console.log calls to use the centralized logger
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface ReplacementRule {
  pattern: RegExp;
  replacement: string;
  context?: string;
}

// Define replacement rules for different console.log patterns
const replacementRules: ReplacementRule[] = [
  // Basic console.log with simple string
  {
    pattern: /console\.log\((['"`])([^'"`]+)\1\)/g,
    replacement: "logger.info('$2')",
    context: 'simple string'
  },
  
  // console.log with template literals
  {
    pattern: /console\.log\((`[^`]+`)\)/g,
    replacement: "logger.info($1)",
    context: 'template literal'
  },
  
  // console.log with multiple arguments
  {
    pattern: /console\.log\((['"`])([^'"`]+)\1,\s*([^)]+)\)/g,
    replacement: "logger.info('$2', { data: $3 })",
    context: 'string with data'
  },
  
  // console.error patterns
  {
    pattern: /console\.error\((['"`])([^'"`]+)\1,\s*([^)]+)\)/g,
    replacement: "logger.error('$2', { error: $3 })",
    context: 'error with data'
  },
  
  // console.warn patterns
  {
    pattern: /console\.warn\((['"`])([^'"`]+)\1,?\s*([^)]*)\)/g,
    replacement: "logger.warn('$2'$3)",
    context: 'warning'
  },
  
  // Debug patterns
  {
    pattern: /console\.log\((['"`])\[DEBUG\][^'"`]*\1,?\s*([^)]*)\)/g,
    replacement: "logger.debug('$2')",
    context: 'debug'
  },
  
  // Info patterns with brackets
  {
    pattern: /console\.log\((['"`])\[[A-Z\s]+\][^'"`]*\1,?\s*([^)]*)\)/g,
    replacement: "logger.info('$2')",
    context: 'bracketed info'
  }
];

interface FileStats {
  totalFiles: number;
  modifiedFiles: number;
  totalReplacements: number;
  errors: string[];
}

class ConsoleLogReplacer {
  private stats: FileStats = {
    totalFiles: 0,
    modifiedFiles: 0,
    totalReplacements: 0,
    errors: []
  };

  async replaceInFile(filePath: string): Promise<boolean> {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      let fileModified = false;
      let fileReplacements = 0;

      // Check if file already imports logger
      const hasLoggerImport = content.includes("from '@/lib/logging/logger'") ||
                            content.includes("from '../logging/logger'") ||
                            content.includes("from '../../logging/logger'") ||
                            content.includes("from '../../../logging/logger'");

      // Apply replacement rules
      for (const rule of replacementRules) {
        const matches = content.match(rule.pattern);
        if (matches) {
          content = content.replace(rule.pattern, rule.replacement);
          fileReplacements += matches.length;
          fileModified = true;
        }
      }

      // Add logger import if file was modified and doesn't have it
      if (fileModified && !hasLoggerImport) {
        // Determine relative path to logger
        const relativePath = this.getLoggerImportPath(filePath);
        
        // Find the last import statement
        const importLines = content.split('\n');
        let lastImportIndex = -1;
        
        for (let i = 0; i < importLines.length; i++) {
          if (importLines[i].startsWith('import ')) {
            lastImportIndex = i;
          }
        }

        // Add logger import after last import
        if (lastImportIndex >= 0) {
          importLines.splice(lastImportIndex + 1, 0, `import { logger } from '${relativePath}';`);
          content = importLines.join('\n');
        } else {
          // No imports found, add at the top
          content = `import { logger } from '${relativePath}';\n\n${content}`;
        }
      }

      // Write back only if content changed
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        this.stats.modifiedFiles++;
        this.stats.totalReplacements += fileReplacements;
        console.log(`✅ Modified ${filePath} (${fileReplacements} replacements)`);
        return true;
      }

      return false;
    } catch (error) {
      const errorMsg = `❌ Error processing ${filePath}: ${error}`;
      this.stats.errors.push(errorMsg);
      console.error(errorMsg);
      return false;
    }
  }

  private getLoggerImportPath(filePath: string): string {
    // Calculate relative path from file to logger
    const fileDir = path.dirname(filePath);
    const loggerPath = path.resolve(process.cwd(), 'src/lib/logging/logger');
    let relativePath = path.relative(fileDir, loggerPath);
    
    // Ensure it starts with ./ or ../
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }
    
    // Remove .ts extension and ensure forward slashes
    relativePath = relativePath.replace(/\.ts$/, '').replace(/\\/g, '/');
    
    return relativePath;
  }

  async processFiles(pattern: string): Promise<void> {
    console.log('🔍 Finding TypeScript and JavaScript files...');
    
    const files = await glob(pattern, {
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
        '**/scripts/replace-console-logs.ts', // Don't modify this script itself
        '**/src/lib/logging/**', // Don't modify logger files
        '**/src/lib/errors/**' // Don't modify error handling files
      ]
    });

    this.stats.totalFiles = files.length;
    console.log(`📁 Found ${files.length} files to process`);

    // Process files in batches
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const promises = batch.map(file => this.replaceInFile(file));
      await Promise.all(promises);
      
      console.log(`📊 Processed ${Math.min(i + batchSize, files.length)}/${files.length} files`);
    }
  }

  printSummary(): void {
    console.log('\n📋 REPLACEMENT SUMMARY');
    console.log('='.repeat(50));
    console.log(`📁 Total files scanned: ${this.stats.totalFiles}`);
    console.log(`✅ Files modified: ${this.stats.modifiedFiles}`);
    console.log(`🔄 Total replacements: ${this.stats.totalReplacements}`);
    console.log(`❌ Errors: ${this.stats.errors.length}`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.stats.errors.forEach(error => console.log(`  ${error}`));
    }
    
    console.log('\n🎉 Console.log replacement complete!');
    console.log('📝 Remember to test your application thoroughly');
  }
}

// Main execution
async function main() {
  const replacer = new ConsoleLogReplacer();
  
  console.log('🚀 Starting console.log replacement process...');
  console.log('📂 Working directory:', process.cwd());
  
  try {
    // Process TypeScript and JavaScript files
    await replacer.processFiles('src/**/*.{ts,tsx,js,jsx}');
    
    replacer.printSummary();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { ConsoleLogReplacer };