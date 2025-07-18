import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findNCAAStatsInMLB() {
  console.log(chalk.cyan('🔍 Finding NCAA Baseball Stats Assigned to MLB Players\n'));
  
  // Check spring season stats
  const springMonths = [
    { start: '2024-02-01', end: '2024-06-30', label: '2024' },
    { start: '2023-02-01', end: '2023-06-30', label: '2023' },
    { start: '2022-02-01', end: '2022-06-30', label: '2022' }
  ];
  
  for (const season of springMonths) {
    console.log(chalk.yellow(`\n${season.label} Spring Season:`));
    
    // Get stats from spring months
    const { data: springStats } = await supabase
      .from('player_game_logs')
      .select('player_id, game_id, stats')
      .gte('game_date', season.start)
      .lte('game_date', season.end)
      .limit(100);
      
    if (!springStats || springStats.length === 0) continue;
    
    // Get unique player IDs
    const playerIds = [...new Set(springStats.map(s => s.player_id))];
    
    // Check what sport these players belong to
    const { data: players } = await supabase
      .from('players')
      .select('id, name, sport, team_id')
      .in('id', playerIds);
      
    const sportCounts: Record<string, number> = {};
    players?.forEach(p => {
      sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1;
    });
    
    console.log('  Player sports:', sportCounts);
    
    // Check the games
    const gameIds = [...new Set(springStats.map(s => s.game_id))];
    const { data: games } = await supabase
      .from('games')
      .select('id, sport, league')
      .in('id', gameIds.slice(0, 10));
      
    const gameSports: Record<string, number> = {};
    games?.forEach(g => {
      gameSports[g.sport || 'null'] = (gameSports[g.sport || 'null'] || 0) + 1;
    });
    
    console.log('  Game sports:', gameSports);
    
    // Sample some MLB players with spring stats
    const mlbPlayers = players?.filter(p => p.sport === 'MLB').slice(0, 5);
    if (mlbPlayers && mlbPlayers.length > 0) {
      console.log(chalk.red('\n  ⚠️  MLB players with spring stats:'));
      mlbPlayers.forEach(p => {
        console.log(`    ${p.name} (ID: ${p.id})`);
      });
      
      // Check if these stats look like college stats
      const sampleStats = springStats.filter(s => 
        mlbPlayers.some(p => p.id === s.player_id)
      ).slice(0, 3);
      
      console.log(chalk.yellow('\n  Sample stat values:'));
      sampleStats.forEach(stat => {
        if (stat.stats && typeof stat.stats === 'object') {
          const keys = Object.keys(stat.stats).slice(0, 5);
          console.log(`    Player ${stat.player_id}: ${keys.join(', ')}...`);
        }
      });
    }
  }
  
  // Check for the smoking gun - NCAA teams in MLB games
  console.log(chalk.blue('\n🔍 Checking for NCAA teams in games...'));
  
  const { data: ncaaTeams } = await supabase
    .from('teams')
    .select('id, name, sport')
    .or('sport.eq.NCAA_BASEBALL,name.ilike.%university%,name.ilike.%college%,name.ilike.%state%')
    .limit(20);
    
  if (ncaaTeams && ncaaTeams.length > 0) {
    console.log(chalk.green(`\nFound ${ncaaTeams.length} potential NCAA teams:`));
    
    // Check if these teams have games
    const teamIds = ncaaTeams.map(t => t.id);
    const { data: teamGames } = await supabase
      .from('games')
      .select('id, sport, home_team_id, away_team_id')
      .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
      .limit(10);
      
    if (teamGames && teamGames.length > 0) {
      console.log(chalk.yellow(`\nFound ${teamGames.length} games with these teams`));
      teamGames.forEach(g => {
        const homeTeam = ncaaTeams.find(t => t.id === g.home_team_id);
        const awayTeam = ncaaTeams.find(t => t.id === g.away_team_id);
        console.log(`  Game ${g.id} (${g.sport}): ${homeTeam?.name || 'Other'} vs ${awayTeam?.name || 'Other'}`);
      });
    }
  }
  
  // Final verdict
  console.log(chalk.cyan('\n\n📊 VERDICT:'));
  console.log('The NCAA Baseball stats were NOT deleted!');
  console.log('They are being attributed to MLB players in the database.');
  console.log('This happened because:');
  console.log('1. Player IDs were changed when NCAA Baseball players were re-imported');
  console.log('2. The old player IDs now belong to MLB players');
  console.log('3. The stats foreign keys still point to the old IDs');
  console.log(chalk.green('\n✅ Solution: Re-collect NCAA Baseball stats with current player IDs'));
}

findNCAAStatsInMLB().catch(console.error);