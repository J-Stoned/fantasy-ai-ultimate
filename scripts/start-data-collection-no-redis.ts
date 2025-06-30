#!/usr/bin/env tsx
/**
 * START DATA COLLECTION WITHOUT REDIS
 * For development/testing when Redis isn't available
 */

import { cronManager } from '../lib/cron/CronManager';
import { prisma } from '../lib/prisma';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Simple in-memory lock manager (for single instance only)
class SimpleJobManager {
  private runningJobs = new Set<string>();
  
  async acquireLock(jobName: string): Promise<boolean> {
    if (this.runningJobs.has(jobName)) {
      return false;
    }
    this.runningJobs.add(jobName);
    return true;
  }
  
  async releaseLock(jobName: string): Promise<void> {
    this.runningJobs.delete(jobName);
  }
}

const jobManager = new SimpleJobManager();

async function startDataCollection() {
  console.log(chalk.blue.bold(`
🚀 STARTING DATA COLLECTION (NO REDIS MODE)
==========================================
⚠️  Running without Redis - OK for development
`));

  try {
    // Test database connection
    console.log(chalk.yellow('Testing database connection...'));
    const { data, error } = await supabase.from('players').select('count').limit(1);
    
    if (error) {
      console.error(chalk.red('❌ Database connection failed:'), error.message);
      console.log(chalk.yellow('\n⚠️  You may need to:'));
      console.log('1. Check your Supabase credentials in .env.local');
      console.log('2. Run the database migrations in Supabase SQL editor');
      console.log('3. Enable Row Level Security (RLS) on tables');
      return;
    }
    
    console.log(chalk.green('✅ Database connected!'));
    
    // Register simple data collection jobs
    console.log(chalk.blue('\n📊 Registering data collection jobs...'));
    
    // Sports News Collection (every 15 minutes)
    await cronManager.registerJob({
      name: 'collect-sports-news',
      schedule: '*/15 * * * *',
      handler: async () => {
        if (!await jobManager.acquireLock('collect-sports-news')) {
          console.log('News collection already running, skipping...');
          return;
        }
        
        try {
          console.log(chalk.blue('📰 Collecting sports news...'));
          
          // For now, we'll use a simple mock data collector
          const mockNews = [
            {
              title: 'Patrick Mahomes Limited in Practice',
              content: 'Chiefs QB dealing with minor ankle issue',
              source: 'ESPN',
              url: 'https://espn.com/mock',
              sport_id: 'nfl',
              published_at: new Date().toISOString()
            }
          ];
          
          // Insert into database
          for (const article of mockNews) {
            await supabase.from('news_articles').upsert(article, {
              onConflict: 'url'
            });
          }
          
          console.log(chalk.green('✅ News collection complete'));
        } finally {
          await jobManager.releaseLock('collect-sports-news');
        }
      },
      runOnInit: true
    });
    
    // Player Stats Collection (every 5 minutes during development)
    await cronManager.registerJob({
      name: 'collect-player-stats',
      schedule: '*/5 * * * *',
      handler: async () => {
        if (!await jobManager.acquireLock('collect-player-stats')) {
          console.log('Stats collection already running, skipping...');
          return;
        }
        
        try {
          console.log(chalk.blue('📊 Collecting player stats...'));
          
          // Check if we have any players in the database
          const { data: players } = await supabase
            .from('players')
            .select('id, firstName, lastName')
            .limit(10);
          
          if (players && players.length > 0) {
            console.log(`Found ${players.length} players to update`);
            // In production, this would fetch real stats from APIs
          } else {
            console.log('No players found. You may need to import some players first.');
          }
          
          console.log(chalk.green('✅ Stats collection complete'));
        } finally {
          await jobManager.releaseLock('collect-player-stats');
        }
      }
    });
    
    // Simple health check (every minute)
    await cronManager.registerJob({
      name: 'health-check',
      schedule: '* * * * *',
      handler: async () => {
        const uptime = process.uptime();
        const memory = process.memoryUsage();
        console.log(chalk.gray(`⚡ Health: Uptime ${Math.floor(uptime/60)}m, Memory: ${Math.floor(memory.heapUsed/1024/1024)}MB`));
      }
    });
    
    console.log(chalk.green.bold('\n✅ DATA COLLECTION STARTED!\n'));
    console.log(chalk.yellow('Active Jobs:'));
    console.log('  📰 Sports News - Every 15 minutes');
    console.log('  📊 Player Stats - Every 5 minutes');
    console.log('  ⚡ Health Check - Every minute');
    console.log(chalk.gray('\nPress Ctrl+C to stop\n'));
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\nShutting down data collection...'));
      await cronManager.shutdown();
      await prisma.$disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red('Failed to start data collection:'), error);
    process.exit(1);
  }
}

// Start the collection
startDataCollection();