#!/usr/bin/env tsx
/**
 * LIVE SECURITY MONITOR
 * 
 * Continuously monitors your database security status
 */

import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const ANON_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Critical tables to monitor
const CRITICAL_TABLES = [
  'user_profiles',
  'fantasy_teams', 
  'fantasy_leagues',
  'platform_connections',
  'player_contracts',
  'nil_deals'
];

interface SecurityStatus {
  table: string;
  exposed: boolean;
  rowCount: number;
  lastChecked: Date;
}

const statuses: Map<string, SecurityStatus> = new Map();

async function checkTable(tableName: string): Promise<SecurityStatus> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=1`,
      {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
      }
    );

    const exposed = response.status === 200;
    let rowCount = 0;

    if (exposed) {
      const data = await response.json();
      rowCount = Array.isArray(data) ? data.length : 0;
    }

    return {
      table: tableName,
      exposed,
      rowCount,
      lastChecked: new Date()
    };
  } catch (error) {
    return {
      table: tableName,
      exposed: false,
      rowCount: 0,
      lastChecked: new Date()
    };
  }
}

async function checkAllTables() {
  const promises = CRITICAL_TABLES.map(table => checkTable(table));
  const results = await Promise.all(promises);
  
  results.forEach(result => {
    statuses.set(result.table, result);
  });
}

function displayStatus() {
  console.clear();
  console.log(chalk.blue.bold('🔒 LIVE SECURITY MONITOR\n'));
  console.log(chalk.gray(`Monitoring ${CRITICAL_TABLES.length} critical tables...\n`));

  const exposedTables = Array.from(statuses.values()).filter(s => s.exposed);
  
  if (exposedTables.length > 0) {
    console.log(chalk.red.bold(`🚨 ALERT: ${exposedTables.length} TABLES EXPOSED!\n`));
    
    exposedTables.forEach(status => {
      console.log(chalk.red(`❌ ${status.table}: ${status.rowCount} rows accessible`));
    });
    
    console.log(chalk.yellow.bold('\n⚡ QUICK FIX:\n'));
    console.log(chalk.white('1. Open Supabase SQL Editor'));
    console.log(chalk.white('2. Run EMERGENCY_RLS_FIX.sql'));
    console.log(chalk.white('3. This monitor will update automatically\n'));
  } else {
    console.log(chalk.green.bold('✅ ALL CRITICAL TABLES SECURED!\n'));
    
    Array.from(statuses.values()).forEach(status => {
      console.log(chalk.green(`✓ ${status.table}: Protected`));
    });
  }
  
  console.log(chalk.gray(`\nLast checked: ${new Date().toLocaleTimeString()}`));
  console.log(chalk.gray('Press Ctrl+C to exit'));
  
  // Show security score
  const securityScore = statuses.size > 0 
    ? Math.round(((statuses.size - exposedTables.length) / statuses.size) * 100)
    : 0;
  
  const scoreColor = securityScore === 100 ? chalk.green : 
                     securityScore >= 50 ? chalk.yellow : 
                     chalk.red;
  
  console.log(chalk.blue.bold(`\n🛡️  SECURITY SCORE: ${scoreColor(securityScore + '%')}`));
}

async function startMonitoring() {
  console.log(chalk.yellow('Starting security monitor...'));
  
  // Initial check
  await checkAllTables();
  displayStatus();
  
  // Check every 5 seconds
  setInterval(async () => {
    await checkAllTables();
    displayStatus();
  }, 5000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nStopping security monitor...'));
  process.exit(0);
});

// Start monitoring
startMonitoring().catch(console.error);