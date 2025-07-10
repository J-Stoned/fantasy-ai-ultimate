#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const backupDir = './backups';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

console.log(chalk.bold.blue('\n💾 BACKING UP CURRENT DATA'));
console.log(chalk.gray('='.repeat(50)));

async function ensureBackupDir() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(chalk.green('✅ Created backup directory'));
  }
}

async function backupTable(tableName: string, limit?: number) {
  console.log(chalk.yellow(`\n📊 Backing up ${tableName}...`));
  
  try {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('id', { ascending: true });
      
      if (error) {
        console.error(chalk.red(`❌ Error backing up ${tableName}:`), error);
        break;
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data);
        page++;
        
        if (limit && allData.length >= limit) {
          allData = allData.slice(0, limit);
          hasMore = false;
        } else if (data.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    // Save to file
    const filename = path.join(backupDir, `${tableName}_${timestamp}.json`);
    fs.writeFileSync(filename, JSON.stringify(allData, null, 2));
    
    console.log(chalk.green(`✅ Backed up ${allData.length} records to ${filename}`));
    
    // Also create a summary
    return {
      table: tableName,
      count: allData.length,
      filename: filename,
      sample: allData[0]
    };
  } catch (error) {
    console.error(chalk.red(`❌ Failed to backup ${tableName}:`), error);
    return null;
  }
}

async function createBackupSummary(backups: any[]) {
  const summary = {
    timestamp: new Date().toISOString(),
    tables: backups.filter(b => b !== null),
    totalRecords: backups.filter(b => b !== null).reduce((sum, b) => sum + b.count, 0)
  };
  
  const summaryFile = path.join(backupDir, `backup_summary_${timestamp}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  console.log(chalk.bold.green('\n📋 BACKUP SUMMARY:'));
  console.log(chalk.blue(`Total tables: ${summary.tables.length}`));
  console.log(chalk.blue(`Total records: ${summary.totalRecords.toLocaleString()}`));
  console.log(chalk.blue(`Summary file: ${summaryFile}`));
}

async function main() {
  await ensureBackupDir();
  
  // Backup critical tables
  const backups = await Promise.all([
    backupTable('player_stats'),
    backupTable('players', 10000), // Limit to 10k for manageable size
    backupTable('games', 10000),
    backupTable('teams'),
    backupTable('teams_master'),
    backupTable('player_injuries'),
    backupTable('weather_data')
  ]);
  
  await createBackupSummary(backups);
  
  console.log(chalk.bold.green('\n✨ Backup complete!'));
  console.log(chalk.yellow('\n⚠️  Important: These backups contain the current INTEGER-based schema'));
  console.log(chalk.yellow('They will be used to migrate data to the UUID-based complex schema'));
}

main().catch(console.error);