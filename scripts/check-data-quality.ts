import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkDataQuality() {
  console.log(chalk.bold.cyan('🔍 Checking Data Quality Issues\n'));
  
  // 1. Check player_game_logs team_id coverage
  console.log(chalk.yellow('📊 Player Game Logs Analysis:'));
  
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: logsWithTeam } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null);
  
  const { count: logsWithMinutes } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('minutes', 'is', null)
    .gt('minutes', 0);
  
  console.log(`  Total logs: ${totalLogs?.toLocaleString()}`);
  console.log(`  Logs with team_id: ${logsWithTeam?.toLocaleString()} (${((logsWithTeam || 0) / (totalLogs || 1) * 100).toFixed(1)}%)`);
  console.log(`  Logs with minutes > 0: ${logsWithMinutes?.toLocaleString()}`);
  
  // Sample some logs to see the issue
  const { data: sampleLogs } = await supabase
    .from('player_game_logs')
    .select('id, player_id, game_id, team_id, sport, minutes')
    .limit(10);
  
  console.log(chalk.cyan('\nSample player_game_logs:'));
  sampleLogs?.forEach(log => {
    console.log(`  ID: ${log.id}, Player: ${log.player_id}, Game: ${log.game_id}, Team: ${log.team_id || 'NULL'}, Sport: ${log.sport || 'NULL'}`);
  });
  
  // 2. Check if we can determine team_id from players table
  console.log(chalk.yellow('\n📊 Checking if players have team_id:'));
  
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('id, name, team_id, sport')
    .limit(10);
  
  console.log('Sample players:');
  samplePlayers?.forEach(player => {
    console.log(`  ID: ${player.id}, Name: ${player.name}, Team: ${player.team_id || 'NULL'}, Sport: ${player.sport || 'NULL'}`);
  });
  
  // 3. Check games data quality
  console.log(chalk.yellow('\n📊 Games Data Quality:'));
  
  const { count: gamesWithTeams } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_team_id', 'is', null)
    .not('away_team_id', 'is', null);
  
  const { count: gamesWithScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, sport, home_team_id, away_team_id, home_score, away_score')
    .limit(5);
  
  console.log(`  Games with teams: ${gamesWithTeams?.toLocaleString()}`);
  console.log(`  Games with scores: ${gamesWithScores?.toLocaleString()}`);
  console.log('\nSample games:');
  sampleGames?.forEach(game => {
    console.log(`  ID: ${game.id}, Sport: ${game.sport}, Home: ${game.home_team_id}, Away: ${game.away_team_id}, Score: ${game.home_score}-${game.away_score}`);
  });
  
  // 4. Suggest fix
  console.log(chalk.bold.green('\n\n✅ SOLUTION:'));
  console.log('We need to update player_game_logs with team_id from the players table!');
  console.log('\nSQL to fix this:');
  console.log(chalk.white(`
-- Update player_game_logs with team_id from players table
UPDATE player_game_logs pgl
SET team_id = p.team_id
FROM players p
WHERE pgl.player_id = p.id
AND pgl.team_id IS NULL
AND p.team_id IS NOT NULL;

-- Verify the update
SELECT COUNT(*) as logs_with_team_id
FROM player_game_logs
WHERE team_id IS NOT NULL;
  `));
}

checkDataQuality().catch(console.error);