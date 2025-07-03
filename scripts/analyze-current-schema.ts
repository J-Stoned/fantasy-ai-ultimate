import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.blue('\n🔍 ANALYZING CURRENT DATABASE SCHEMA'));
console.log(chalk.gray('='.repeat(50)));

async function analyzeSchema() {
  // Check players table structure
  console.log(chalk.yellow('\n📊 Checking PLAYERS table...'));
  try {
    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .limit(1)
      .single();
    
    if (player) {
      console.log(chalk.green('✅ Players table structure:'));
      console.log('  Primary key type:', typeof player.id);
      console.log('  Sample ID:', player.id);
      console.log('  Has UUID?', player.id.includes('-'));
      console.log('  Columns:', Object.keys(player).join(', '));
    }
  } catch (error) {
    console.error(chalk.red('❌ Error checking players:'), error);
  }

  // Check games table structure
  console.log(chalk.yellow('\n📊 Checking GAMES table...'));
  try {
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .limit(1)
      .single();
    
    if (game) {
      console.log(chalk.green('✅ Games table structure:'));
      console.log('  Primary key type:', typeof game.id);
      console.log('  Sample ID:', game.id);
      console.log('  Team ID types:', typeof game.home_team_id, typeof game.away_team_id);
      console.log('  Has team names?', 'home_team' in game, 'away_team' in game);
      console.log('  Columns:', Object.keys(game).join(', '));
    }
  } catch (error) {
    console.error(chalk.red('❌ Error checking games:'), error);
  }

  // Check player_stats table structure
  console.log(chalk.yellow('\n📊 Checking PLAYER_STATS table...'));
  try {
    const { data: stats, error } = await supabase
      .from('player_stats')
      .select('*')
      .limit(5);
    
    if (stats && stats.length > 0) {
      console.log(chalk.green('✅ Player_stats table structure:'));
      console.log('  Primary key type:', typeof stats[0].id);
      console.log('  Sample ID:', stats[0].id);
      console.log('  Columns:', Object.keys(stats[0]).join(', '));
      
      // Check if it's the simple schema (stat_type, stat_value)
      if ('stat_type' in stats[0] && 'stat_value' in stats[0]) {
        console.log(chalk.yellow('  ⚠️  Using SIMPLE schema (stat_type/stat_value)'));
        const statTypes = [...new Set(stats.map(s => s.stat_type))];
        console.log('  Stat types:', statTypes.join(', '));
      }
      // Check if it's the complex schema (season, stats JSONB)
      else if ('season' in stats[0] && 'stats' in stats[0]) {
        console.log(chalk.green('  ✅ Using COMPLEX schema (season/JSONB)'));
      }
    }
  } catch (error) {
    console.error(chalk.red('❌ Error checking player_stats:'), error);
  }

  // Check teams table
  console.log(chalk.yellow('\n📊 Checking TEAMS tables...'));
  try {
    // Check if teams_master exists (complex schema)
    const { count: masterCount } = await supabase
      .from('teams_master')
      .select('*', { count: 'exact', head: true });
    
    console.log('  teams_master count:', masterCount);
    
    // Check if simple teams table exists
    const { count: simpleCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });
    
    console.log('  teams count:', simpleCount);
  } catch (error) {
    console.log(chalk.yellow('  Note: Some tables may not exist'));
  }

  // Check for UUID vs Integer foreign keys
  console.log(chalk.yellow('\n📊 Checking foreign key relationships...'));
  try {
    const { data: playerStat } = await supabase
      .from('player_stats')
      .select('*, players(*)')
      .limit(1)
      .single();
    
    if (playerStat) {
      console.log(chalk.green('✅ Foreign key check:'));
      console.log('  Player relationship works:', !!playerStat.players);
    }
  } catch (error) {
    console.log(chalk.red('❌ Foreign key error - likely type mismatch'));
  }

  // Summary of findings
  console.log(chalk.bold.blue('\n📋 SCHEMA ANALYSIS SUMMARY:'));
  
  // Count records
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  const { count: statsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.green('\n📊 Record counts:'));
  console.log(`  Players: ${playerCount}`);
  console.log(`  Games: ${gameCount}`);
  console.log(`  Player Stats: ${statsCount}`);
  
  // Check for required columns added by fix-schema-for-collectors.sql
  console.log(chalk.yellow('\n🔧 Checking for collector compatibility columns...'));
  try {
    const { data: playerWithCollectorCols } = await supabase
      .from('players')
      .select('external_id, sport, team, college')
      .limit(1)
      .single();
    
    if (playerWithCollectorCols) {
      console.log(chalk.green('✅ Collector columns exist on players table'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Missing collector columns on players table'));
  }
  
  try {
    const { data: gameWithCollectorCols } = await supabase
      .from('games')
      .select('external_id, sport, home_team, away_team')
      .limit(1)
      .single();
    
    if (gameWithCollectorCols) {
      console.log(chalk.green('✅ Collector columns exist on games table'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Missing collector columns on games table'));
  }
}

analyzeSchema().then(() => {
  console.log(chalk.bold.green('\n✨ Schema analysis complete!'));
}).catch(console.error);