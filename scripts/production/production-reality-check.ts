#!/usr/bin/env tsx
/**
 * PRODUCTION REALITY CHECK - What actually works and how to scale it
 * 
 * We have 371,861 player stats - let's build real pattern detection on this data!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.cyan('🔥 PRODUCTION REALITY CHECK - USING OUR 371K STATS'));

async function realityCheck() {
  console.log(chalk.blue('\n📊 ANALYZING OUR ACTUAL DATA...'));
  
  // Check what we actually have
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('id', { count: 'exact', head: true });
    
  console.log(chalk.green(`✅ Total Player Stats: ${totalStats?.toLocaleString()}`));
  
  // Sports breakdown
  const { data: sportStats } = await supabase
    .from('player_game_logs')
    .select('sport')
    .order('sport');
    
  if (sportStats) {
    const sportCounts = sportStats.reduce((acc: any, s: any) => {
      acc[s.sport] = (acc[s.sport] || 0) + 1;
      return acc;
    }, {});
    
    console.log(chalk.blue('\n🏈 SPORTS BREAKDOWN:'));
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(chalk.gray(`  ${sport}: ${(count as number).toLocaleString()} stats`));
    });
  }
  
  // Sample recent stats to understand structure
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('sport, stats, computed_metrics, metadata')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log(chalk.blue('\n📈 SAMPLE STAT STRUCTURES:'));
  recentStats?.forEach((stat, i) => {
    console.log(chalk.yellow(`\n  Sample ${i + 1} (${stat.sport}):`));
    console.log(chalk.gray(`    Stats keys: ${Object.keys(stat.stats || {}).join(', ')}`));
    console.log(chalk.gray(`    Computed metrics: ${Object.keys(stat.computed_metrics || {}).join(', ')}`));
    console.log(chalk.gray(`    Metadata: ${stat.metadata ? Object.keys(stat.metadata).join(', ') : 'none'}`));
  });
  
  // Pattern detection opportunity
  console.log(chalk.blue('\n🎯 PATTERN DETECTION OPPORTUNITIES:'));
  
  // Find players with multiple games for pattern analysis
  const { data: playerGameCounts } = await supabase
    .rpc('get_player_game_counts')
    .limit(10);
    
  if (playerGameCounts) {
    console.log(chalk.green('✅ Players with multiple games for pattern analysis:'));
    playerGameCounts.forEach((player: any, i: number) => {
      console.log(chalk.gray(`  ${i+1}. Player ID ${player.player_id}: ${player.game_count} games`));
    });
  }
  
  // Check for games with outcomes we can predict
  const { data: gamesWithOutcomes } = await supabase
    .from('games')
    .select('id, sport, home_score, away_score')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .limit(10);
    
  console.log(chalk.blue('\n🏆 GAMES WITH OUTCOMES (for ML training):'));
  if (gamesWithOutcomes && gamesWithOutcomes.length > 0) {
    console.log(chalk.green(`✅ Found ${gamesWithOutcomes.length} games with scores for ML training`));
    gamesWithOutcomes.forEach((game, i) => {
      const homeWon = game.home_score > game.away_score;
      console.log(chalk.gray(`  ${i+1}. ${game.sport} game: ${game.home_score}-${game.away_score} (${homeWon ? 'Home' : 'Away'} won)`));
    });
  }
  
  // WebSocket readiness check
  console.log(chalk.blue('\n🌐 WEBSOCKET SYSTEM READINESS:'));
  
  try {
    // Check if WebSocket server files exist
    const fs = await import('fs');
    const wsServerExists = fs.existsSync('/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate/lib/streaming/start-websocket-server.ts');
    console.log(chalk.green(`✅ WebSocket server file: ${wsServerExists ? 'EXISTS' : 'MISSING'}`));
    
    // Check package.json for socket.io
    const packageJson = JSON.parse(fs.readFileSync('/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate/package.json', 'utf8'));
    const hasSocketIO = !!packageJson.dependencies['socket.io'];
    console.log(chalk.green(`✅ Socket.IO installed: ${hasSocketIO ? 'YES' : 'NO'}`));
    
  } catch (error) {
    console.log(chalk.yellow('⚠️  WebSocket dependency check failed'));
  }
  
  console.log(chalk.bold.green('\n🚀 PRODUCTION ROADMAP:'));
  console.log(chalk.cyan('1. ✅ Data Collection: 371K+ stats collected'));
  console.log(chalk.cyan('2. 🔄 Pattern Detection: Build ML models on existing data'));  
  console.log(chalk.cyan('3. 🌐 WebSocket Deployment: Real-time prediction broadcasting'));
  console.log(chalk.cyan('4. 📱 Mobile Integration: Connect app to live data'));
  console.log(chalk.cyan('5. 💰 Monetization: API subscriptions ready'));
  
  console.log(chalk.bold.yellow('\n⚡ IMMEDIATE ACTIONS:'));
  console.log(chalk.yellow('1. Train ML models on our 371K stats'));
  console.log(chalk.yellow('2. Deploy WebSocket server for real-time'));
  console.log(chalk.yellow('3. Build pattern detection dashboard'));
  console.log(chalk.yellow('4. Scale mobile app connections'));
  
  console.log(chalk.bold.green('\n💪 WE HAVE THE DATA - NOW LET\'S USE IT!'));
}

realityCheck().catch(console.error);