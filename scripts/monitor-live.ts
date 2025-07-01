#!/usr/bin/env tsx
/**
 * 📊 LIVE DATABASE MONITOR
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let previousTotal = 0;
let startTime = Date.now();

async function checkStatus() {
  const tables = [
    { name: 'players', icon: '🏃' },
    { name: 'teams', icon: '🏟️' },
    { name: 'games', icon: '🏈' },
    { name: 'news_articles', icon: '📰' },
    { name: 'sentiment', icon: '💬' }
  ];
  
  console.clear();
  console.log('🔴 LIVE DATABASE MONITOR');
  console.log('========================');
  console.log(`Time: ${new Date().toLocaleTimeString()}`);
  console.log('');
  
  let total = 0;
  
  for (const table of tables) {
    const { count } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });
    
    const tableCount = count || 0;
    total += tableCount;
    
    console.log(`${table.icon} ${table.name}: ${tableCount.toLocaleString()}`);
  }
  
  console.log('────────────────────────');
  console.log(`📊 TOTAL: ${total.toLocaleString()}`);
  
  // Calculate growth rate
  const growth = total - previousTotal;
  const runtime = (Date.now() - startTime) / 1000 / 60; // minutes
  const rate = Math.round(growth / runtime);
  
  if (previousTotal > 0) {
    const growthSign = growth >= 0 ? '+' : '';
    console.log(`📈 Growth: ${growthSign}${growth.toLocaleString()} records`);
    console.log(`⚡ Rate: ${rate.toLocaleString()} records/minute`);
  }
  
  if (total >= 1000000) {
    console.log('\n💥 1 MILLION+ RECORDS! 💥');
  }
  
  console.log('\nPress Ctrl+C to exit');
  
  previousTotal = total;
}

// Run every 5 seconds
checkStatus();
setInterval(checkStatus, 5000);

process.on('SIGINT', () => {
  console.log('\n\n👋 Monitor stopped');
  process.exit(0);
});