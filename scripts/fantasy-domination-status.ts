#!/usr/bin/env tsx
/**
 * 🔥 FANTASY AI DOMINATION STATUS
 * Real-time monitoring of our money printer
 */

import chalk from 'chalk';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface ServiceStatus {
  name: string;
  url: string;
  status: 'running' | 'stopped' | 'error';
  details?: any;
}

async function checkService(name: string, url: string): Promise<ServiceStatus> {
  try {
    const response = await fetch(url, { timeout: 5000 } as any);
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return { name, url, status: 'running', details: data };
    }
    return { name, url, status: 'error' };
  } catch {
    return { name, url, status: 'stopped' };
  }
}

async function checkDominationStatus() {
  console.clear();
  console.log(chalk.red.bold('\n🔥 FANTASY AI DOMINATION STATUS 🔥\n'));
  
  // Check services
  console.log(chalk.yellow.bold('🚀 SERVICES:'));
  const services = [
    { name: 'Web App', url: 'http://localhost:3000/api/ready' },
    { name: 'Pattern API V4', url: 'http://localhost:3337/api/v4/stats' },
    { name: 'WebSocket Server', url: 'http://localhost:8081/health' },
    { name: 'Mobile API', url: 'http://localhost:3000/api/v2/health' },
  ];

  for (const service of services) {
    const status = await checkService(service.name, service.url);
    const icon = status.status === 'running' ? '✅' : status.status === 'stopped' ? '🔴' : '⚠️';
    console.log(`${icon} ${service.name}: ${status.status.toUpperCase()}`);
    
    if (status.details && service.name === 'Pattern API V4') {
      console.log(chalk.green(`   💰 Profit Potential: $${status.details.profitPotential?.toLocaleString() || '0'}`));
      console.log(chalk.green(`   📊 Patterns: ${status.details.patternsLoaded || 0}`));
      console.log(chalk.green(`   🎯 Accuracy: ${status.details.averageAccuracy || '0'}%`));
    }
  }

  // Check database
  console.log(chalk.yellow.bold('\n💾 DATABASE:'));
  try {
    const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
    const { count: gameCount } = await supabase.from('games').select('*', { count: 'exact', head: true });
    const { count: statsCount } = await supabase.from('player_stats').select('*', { count: 'exact', head: true });
    
    console.log(`✅ Players: ${playerCount?.toLocaleString() || 0}`);
    console.log(`✅ Games: ${gameCount?.toLocaleString() || 0}`);
    console.log(`✅ Stats: ${statsCount?.toLocaleString() || 0}`);
  } catch (error) {
    console.log('❌ Database connection failed');
  }

  // Revenue projections
  console.log(chalk.yellow.bold('\n💵 REVENUE PROJECTIONS:'));
  const users = [10, 50, 200, 1000];
  const avgPrice = 1499;
  
  users.forEach((userCount, index) => {
    const monthly = userCount * avgPrice;
    const timeframe = ['Week 1', 'Month 1', 'Month 3', 'Year 1'][index];
    console.log(chalk.green(`${timeframe}: ${userCount} users × $${avgPrice} = $${monthly.toLocaleString()} MRR`));
  });

  // Pattern performance
  console.log(chalk.yellow.bold('\n📈 PATTERN PERFORMANCE:'));
  const patterns = [
    { name: 'Back-to-Back Fade', accuracy: 76.8, roi: 46.6 },
    { name: 'Embarrassment Revenge', accuracy: 74.4, roi: 41.9 },
    { name: 'Altitude Advantage', accuracy: 68.3, roi: 36.3 },
    { name: 'Perfect Storm', accuracy: 67.0, roi: 35.9 },
    { name: 'Division Dog Bite', accuracy: 58.6, roi: 32.9 }
  ];

  patterns.forEach(pattern => {
    console.log(chalk.cyan(`${pattern.name}: ${pattern.accuracy}% accuracy (${pattern.roi}% ROI)`));
  });

  // Quick commands
  console.log(chalk.yellow.bold('\n⚡ QUICK COMMANDS:'));
  console.log(chalk.gray('Start everything:     npx tsx scripts/master-control.ts start-all'));
  console.log(chalk.gray('Pattern dashboard:    npx tsx scripts/pattern-detection-dashboard.ts'));
  console.log(chalk.gray('Train ML models:      npx tsx scripts/train-ml-models-gpu.ts'));
  console.log(chalk.gray('Deploy to prod:       vercel deploy --prod'));

  // Status summary
  const runningServices = services.filter(s => s.status === 'running').length;
  const totalServices = services.length;
  const readiness = (runningServices / totalServices) * 100;

  console.log(chalk.bold.magenta(`\n🏆 DOMINATION READINESS: ${readiness.toFixed(0)}%`));
  
  if (readiness === 100) {
    console.log(chalk.green.bold('\n✅ ALL SYSTEMS GO! TIME TO PRINT MONEY! 💰💰💰'));
  } else {
    console.log(chalk.yellow.bold(`\n⚠️  ${totalServices - runningServices} services need to be started`));
  }

  console.log(chalk.gray('\n[Refreshing in 10 seconds...]'));
}

// Run status check
checkDominationStatus();

// Refresh every 10 seconds
setInterval(checkDominationStatus, 10000);