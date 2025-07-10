#!/usr/bin/env tsx
/**
 * DATA COLLECTION MONITOR - Marcus "The Fixer" Rodriguez
 * Real-time monitoring of all data collection activities
 */

import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function monitorDataCollection() {
  console.clear();
  console.log(chalk.blue.bold(`
📊 FANTASY AI ULTIMATE - DATA COLLECTION MONITOR
==============================================
`));

  // Check Redis connection
  try {
    await redis.ping();
    console.log(chalk.green('✅ Redis: Connected'));
  } catch (error) {
    console.log(chalk.red('❌ Redis: Not connected'));
  }

  // Check recent cron job runs
  console.log(chalk.blue.bold('\n📅 Recent Job Runs:'));
  
  const { data: jobs, error } = await supabase
    .from('cron_job_logs')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log(chalk.red('❌ Cannot fetch job logs:', error.message));
  } else if (jobs && jobs.length > 0) {
    jobs.forEach(job => {
      const status = job.status === 'success' ? chalk.green('✅') : chalk.red('❌');
      const time = new Date(job.executed_at).toLocaleTimeString();
      console.log(`${status} ${job.job_name} - ${time}`);
      if (job.error_message) {
        console.log(chalk.red(`   Error: ${job.error_message}`));
      }
    });
  } else {
    console.log(chalk.yellow('No job runs found yet'));
  }

  // Check data counts
  console.log(chalk.blue.bold('\n📈 Data Statistics:'));
  
  const tables = [
    { name: 'players', label: 'Players' },
    { name: 'player_stats', label: 'Player Stats' },
    { name: 'games', label: 'Games' },
    { name: 'news_articles', label: 'News Articles' },
    { name: 'social_mentions', label: 'Social Mentions' },
    { name: 'player_injuries', label: 'Injury Reports' }
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });
    
    if (!error && count !== null) {
      console.log(`${table.label}: ${chalk.green(count.toLocaleString())}`);
    }
  }

  // Check active locks
  console.log(chalk.blue.bold('\n🔒 Active Job Locks:'));
  
  const keys = await redis.keys('cron:lock:*');
  if (keys.length > 0) {
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      const jobName = key.replace('cron:lock:', '');
      console.log(`${chalk.yellow('🔒')} ${jobName} (TTL: ${ttl}s)`);
    }
  } else {
    console.log('No active locks');
  }

  // Recent data additions
  console.log(chalk.blue.bold('\n🆕 Recent Data:'));
  
  const { data: recentPlayers } = await supabase
    .from('players')
    .select('firstName, lastName, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentPlayers && recentPlayers.length > 0) {
    console.log('\nLatest Players:');
    recentPlayers.forEach(p => {
      const time = new Date(p.created_at).toLocaleTimeString();
      console.log(`  ${p.firstName} ${p.lastName} - ${time}`);
    });
  }

  const { data: recentNews } = await supabase
    .from('news_articles')
    .select('title, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (recentNews && recentNews.length > 0) {
    console.log('\nLatest News:');
    recentNews.forEach(n => {
      const time = new Date(n.created_at).toLocaleTimeString();
      console.log(`  "${n.title.substring(0, 50)}..." - ${time}`);
    });
  }

  console.log(chalk.gray('\n\nRefreshing in 10 seconds... (Ctrl+C to exit)'));
}

// Run monitor
async function startMonitoring() {
  while (true) {
    await monitorDataCollection();
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.clear();
  }
}

// Handle cleanup
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\nShutting down monitor...'));
  await redis.quit();
  process.exit(0);
});

startMonitoring().catch(console.error);