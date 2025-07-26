#!/usr/bin/env tsx

/**
 * 🔧 Database Connection Migration Script
 * Helps identify and migrate files using direct Pool/Client connections
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

interface FileInfo {
  path: string;
  type: 'pool' | 'client';
  lineNumbers: number[];
  priority: 'high' | 'medium' | 'low';
}

async function findFilesWithConnections(): Promise<FileInfo[]> {
  console.log(chalk.blue('🔍 Scanning for files with database connections...'));
  
  const files: FileInfo[] = [];
  const patterns = ['**/*.ts', '**/*.js'];
  const ignore = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'];
  
  for (const pattern of patterns) {
    const matches = await glob(pattern, { ignore });
    
    for (const file of matches) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      const poolLines: number[] = [];
      const clientLines: number[] = [];
      
      lines.forEach((line, index) => {
        if (line.includes('new Pool(') && !line.includes('connection-manager')) {
          poolLines.push(index + 1);
        }
        if (line.includes('new Client(') && !line.includes('connection-manager')) {
          clientLines.push(index + 1);
        }
      });
      
      if (poolLines.length > 0) {
        files.push({
          path: file,
          type: 'pool',
          lineNumbers: poolLines,
          priority: getPriority(file),
        });
      }
      
      if (clientLines.length > 0) {
        files.push({
          path: file,
          type: 'client',
          lineNumbers: clientLines,
          priority: getPriority(file),
        });
      }
    }
  }
  
  return files;
}

function getPriority(filePath: string): 'high' | 'medium' | 'low' {
  if (filePath.includes('/ml/') || filePath.includes('/api/') || filePath.includes('/workers/')) {
    return 'high';
  }
  if (filePath.includes('/scripts/') || filePath.includes('/test')) {
    return 'medium';
  }
  return 'low';
}

async function generateMigrationReport(files: FileInfo[]): Promise<void> {
  console.log(chalk.green(`\n📊 Found ${files.length} files with direct database connections\n`));
  
  const byPriority = {
    high: files.filter(f => f.priority === 'high'),
    medium: files.filter(f => f.priority === 'medium'),
    low: files.filter(f => f.priority === 'low'),
  };
  
  console.log(chalk.red(`🔴 High Priority (${byPriority.high.length} files):`));
  byPriority.high.forEach(file => {
    console.log(`  ${file.path} (${file.type} at lines: ${file.lineNumbers.join(', ')})`);
  });
  
  console.log(chalk.yellow(`\n🟡 Medium Priority (${byPriority.medium.length} files):`));
  byPriority.medium.slice(0, 10).forEach(file => {
    console.log(`  ${file.path} (${file.type} at lines: ${file.lineNumbers.join(', ')})`);
  });
  if (byPriority.medium.length > 10) {
    console.log(`  ... and ${byPriority.medium.length - 10} more`);
  }
  
  console.log(chalk.gray(`\n⚪ Low Priority (${byPriority.low.length} files):`));
  console.log(`  ${byPriority.low.length} files in archive/test directories`);
  
  // Generate migration checklist
  const checklistPath = path.join(process.cwd(), 'migration-checklist.md');
  const checklist = generateChecklist(files);
  await fs.writeFile(checklistPath, checklist);
  console.log(chalk.green(`\n✅ Migration checklist saved to: ${checklistPath}`));
}

function generateChecklist(files: FileInfo[]): string {
  const byPriority = {
    high: files.filter(f => f.priority === 'high'),
    medium: files.filter(f => f.priority === 'medium'),
    low: files.filter(f => f.priority === 'low'),
  };
  
  let content = '# Database Connection Migration Checklist\n\n';
  content += `Generated: ${new Date().toISOString()}\n`;
  content += `Total files to migrate: ${files.length}\n\n`;
  
  content += '## High Priority Files\n\n';
  content += 'These files are in critical paths and should be migrated first:\n\n';
  byPriority.high.forEach(file => {
    content += `- [ ] \`${file.path}\` (${file.type} at lines: ${file.lineNumbers.join(', ')})\n`;
  });
  
  content += '\n## Medium Priority Files\n\n';
  content += 'Scripts and test files:\n\n';
  byPriority.medium.forEach(file => {
    content += `- [ ] \`${file.path}\` (${file.type} at lines: ${file.lineNumbers.join(', ')})\n`;
  });
  
  content += '\n## Low Priority Files\n\n';
  content += 'Archive and deprecated files (migrate if still in use):\n\n';
  byPriority.low.forEach(file => {
    content += `- [ ] \`${file.path}\` (${file.type} at lines: ${file.lineNumbers.join(', ')})\n`;
  });
  
  content += '\n## Migration Instructions\n\n';
  content += '1. Import the centralized connection manager:\n';
  content += '   ```typescript\n';
  content += '   import { db } from \'../apps/web/src/lib/database/connection-manager\';\n';
  content += '   ```\n\n';
  content += '2. Replace Pool/Client instantiation with db methods:\n';
  content += '   - `pool.query()` → `db.query()`\n';
  content += '   - `pool.connect()` → `db.getClient()`\n';
  content += '   - `client.query()` → `db.query()`\n\n';
  content += '3. Remove connection cleanup code (handled automatically)\n\n';
  content += '4. Test the migrated code\n\n';
  content += '5. Check this item when complete\n';
  
  return content;
}

async function showMigrationExample(): Promise<void> {
  console.log(chalk.blue('\n📝 Migration Example:\n'));
  
  console.log(chalk.gray('// Before:'));
  console.log(`import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres',
});

const players = await pool.query('SELECT * FROM players');`);
  
  console.log(chalk.gray('\n// After:'));
  console.log(`import { db } from '../apps/web/src/lib/database/connection-manager';

const players = await db.query('SELECT * FROM players');`);
}

async function main() {
  console.log(chalk.bold.blue('🚀 Database Connection Migration Helper\n'));
  
  try {
    const files = await findFilesWithConnections();
    await generateMigrationReport(files);
    await showMigrationExample();
    
    console.log(chalk.green('\n✨ Migration helper completed!'));
    console.log(chalk.yellow('📌 Next steps:'));
    console.log('  1. Review the migration checklist');
    console.log('  2. Start with high priority files');
    console.log('  3. Test each migration thoroughly');
    console.log('  4. Monitor connection pool stats after migration');
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}