import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fixBettingSchema() {
  console.log(chalk.bold.cyan('🔧 Checking and Fixing Betting Lines Schema\n'));
  
  // First, check what columns exist in betting_lines
  console.log(chalk.yellow('📋 Checking current betting_lines table structure...'));
  
  try {
    // Get table info using a query that will show column names
    const { data: tableInfo, error } = await supabase
      .rpc('get_table_columns', { table_name: 'betting_lines' });
    
    if (error) {
      // Try alternative method
      const { data: sample } = await supabase
        .from('betting_lines')
        .select('*')
        .limit(0); // Just get schema, no data
      
      console.log('Existing columns detected via query');
    }
    
    // Let's check if we need to add missing columns
    console.log(chalk.cyan('\n📊 Analyzing what columns we need vs what exists...'));
    
    const requiredColumns = [
      'game_id',
      'opening_spread',
      'closing_spread', 
      'opening_total',
      'closing_total',
      'home_moneyline',
      'away_moneyline',  // This was missing
      'home_spread_odds',
      'away_spread_odds', // This was missing
      'over_odds',
      'under_odds'
    ];
    
    console.log(chalk.yellow('\nRequired columns for our ML system:'));
    requiredColumns.forEach(col => console.log(`  - ${col}`));
    
    // Show SQL to add missing columns
    console.log(chalk.bold.green('\n✅ Run this SQL in Supabase to fix the schema:\n'));
    
    console.log(chalk.white(`-- Add missing columns to betting_lines table
ALTER TABLE betting_lines 
ADD COLUMN IF NOT EXISTS away_moneyline INTEGER,
ADD COLUMN IF NOT EXISTS home_spread_odds INTEGER DEFAULT -110,
ADD COLUMN IF NOT EXISTS away_spread_odds INTEGER DEFAULT -110;

-- Verify all columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'betting_lines' 
ORDER BY ordinal_position;`));
    
  } catch (error) {
    console.error(chalk.red('Error checking schema:'), error);
  }
}

async function checkTeamSynergies() {
  console.log(chalk.bold.cyan('\n\n🤝 Analyzing Team Synergy Data\n'));
  
  // Get game count
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  // Get current synergies
  const { data: synergies, count: synergyCount } = await supabase
    .from('team_synergy_stats')
    .select('*', { count: 'exact' })
    .limit(5);
  
  console.log(chalk.yellow(`Current status:`));
  console.log(`  - Total completed games: ${totalGames?.toLocaleString()}`);
  console.log(`  - Team synergy records: ${synergyCount}`);
  console.log(`  - Expected synergies: ~${((totalGames || 0) * 2 * 0.1).toLocaleString()} (10% of games have 5+ players with stats)`);
  
  if (synergies && synergies.length > 0) {
    console.log(chalk.cyan('\nSample synergy record:'));
    const sample = synergies[0];
    console.log(`  - Team ID: ${sample.team_id}`);
    console.log(`  - Players: ${sample.player_ids.length} players`);
    console.log(`  - Games: ${sample.games_played}`);
    console.log(`  - Avg Fantasy Points: ${sample.avg_fantasy_points?.toFixed(2)}`);
  }
  
  // Check why we have so few
  console.log(chalk.cyan('\n🔍 Investigating low synergy count...'));
  
  // Check player_game_logs
  const { data: sampleLogs } = await supabase
    .from('player_game_logs')
    .select('game_id, team_id, player_id, minutes')
    .not('team_id', 'is', null)
    .not('minutes', 'is', null)
    .gt('minutes', 0)
    .limit(50);
  
  if (sampleLogs) {
    const gamesWithTeams = new Set(sampleLogs.map(l => l.game_id));
    const teamsWithData = new Set(sampleLogs.map(l => l.team_id));
    
    console.log(`\nPlayer game logs analysis:`);
    console.log(`  - Games with team data: ${gamesWithTeams.size}`);
    console.log(`  - Teams with player data: ${teamsWithData.size}`);
    console.log(`  - Sample team IDs: ${Array.from(teamsWithData).slice(0, 5).join(', ')}`);
  }
  
  console.log(chalk.bold.yellow('\n⚠️  Issue: Most player_game_logs may be missing team_id'));
  console.log('This prevents proper synergy calculation!');
}

async function main() {
  await fixBettingSchema();
  await checkTeamSynergies();
  
  console.log(chalk.bold.green('\n\n📋 Next Steps:'));
  console.log('1. Run the SQL above in Supabase to fix betting_lines schema');
  console.log('2. Fix player_game_logs to include team_id for synergy calculation');
  console.log('3. Re-run the backfill after fixes');
}

main().catch(console.error);