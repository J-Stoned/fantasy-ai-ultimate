import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkSportsData() {
  console.log('🏈 Checking Sports Data in Database...\n');

  // 1. Check games by sport_id
  console.log('📊 Games by Sport:');
  const { data: gamesBySport, error: gamesError } = await supabase
    .from('games')
    .select('sport_id')
    .not('sport_id', 'is', null);

  if (gamesError) {
    console.error('Error fetching games:', gamesError);
  } else {
    const sportCounts: Record<string, number> = {};
    gamesBySport.forEach((game: any) => {
      sportCounts[game.sport_id] = (sportCounts[game.sport_id] || 0) + 1;
    });
    
    console.log('Sport ID -> Game Count:');
    Object.entries(sportCounts).forEach(([sportId, count]) => {
      console.log(`  Sport ${sportId}: ${count} games`);
    });
  }

  // 2. Check teams by sport
  console.log('\n🏀 Teams by Sport:');
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('sport_id, abbreviation, name')
    .order('sport_id');

  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
  } else {
    const teamsBySport: Record<string, any[]> = {};
    teams.forEach((team: any) => {
      if (!teamsBySport[team.sport_id]) {
        teamsBySport[team.sport_id] = [];
      }
      teamsBySport[team.sport_id].push(team);
    });

    Object.entries(teamsBySport).forEach(([sportId, teams]) => {
      console.log(`\nSport ID ${sportId}: ${teams.length} teams`);
      console.log(`  Sample teams: ${teams.slice(0, 5).map((t: any) => t.abbreviation).join(', ')}`);
    });
  }

  // 3. Check games with scores
  console.log('\n⚾ Games with Scores by Sport:');
  const { data: gamesWithScores, error: scoresError } = await supabase
    .from('games')
    .select('sport_id, home_score, away_score')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);

  if (scoresError) {
    console.error('Error fetching scores:', scoresError);
  } else {
    const scoresCount: Record<string, number> = {};
    gamesWithScores.forEach((game: any) => {
      scoresCount[game.sport_id] = (scoresCount[game.sport_id] || 0) + 1;
    });

    Object.entries(scoresCount).forEach(([sportId, count]) => {
      console.log(`  Sport ${sportId}: ${count} games with scores`);
    });
  }

  // 4. Check player stats by sport
  console.log('\n🏈 Player Stats by Sport:');
  const { data: playerStats, error: statsError } = await supabase
    .from('player_stats')
    .select('sport_id')
    .not('sport_id', 'is', null);

  if (statsError) {
    console.error('Error fetching player stats:', statsError);
  } else {
    const statsCounts: Record<string, number> = {};
    playerStats.forEach((stat: any) => {
      statsCounts[stat.sport_id] = (statsCounts[stat.sport_id] || 0) + 1;
    });

    console.log('Sport ID -> Player Stats Count:');
    Object.entries(statsCounts).forEach(([sportId, count]) => {
      console.log(`  Sport ${sportId}: ${count} player stats`);
    });
  }

  // 5. Get sport names from teams (infer sport names)
  console.log('\n🏀 Sport ID Mapping (based on team names):');
  
  // Let's check a few specific teams to confirm
  const { data: sampleTeams } = await supabase
    .from('teams')
    .select('sport_id, name, abbreviation')
    .in('abbreviation', ['LAL', 'NYY', 'NE', 'TB', 'ALA', 'DUKE', 'NYR', 'TOR', 'DAL', 'MIA']);

  if (sampleTeams) {
    console.log('\nSample teams to identify sports:');
    sampleTeams.forEach((team: any) => {
      console.log(`  ${team.abbreviation} (${team.name}) - Sport ID: ${team.sport_id}`);
    });
  }

  // 6. Check recent games to see date ranges
  console.log('\n📅 Recent Games by Sport:');
  for (const sportId of ['1', '2', '3', '4', '5', '6']) {
    const { data: recentGames } = await supabase
      .from('games')
      .select('game_date, home_team, away_team')
      .eq('sport_id', sportId)
      .order('game_date', { ascending: false })
      .limit(3);

    if (recentGames && recentGames.length > 0) {
      console.log(`\nSport ${sportId} - Most recent games:`);
      recentGames.forEach((game: any) => {
        console.log(`  ${game.game_date}: ${game.home_team} vs ${game.away_team}`);
      });
    }
  }

  // 7. Summary statistics
  console.log('\n📈 Summary Statistics:');
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  const { count: totalTeams } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true });

  console.log(`  Total games: ${totalGames}`);
  console.log(`  Total players: ${totalPlayers}`);
  console.log(`  Total teams: ${totalTeams}`);

  // 8. Check if we have player names for different sports
  console.log('\n🏃 Sample Players by Sport:');
  for (const sportId of ['1', '2', '3', '4']) {
    const { data: players } = await supabase
      .from('players')
      .select('name, team_id')
      .eq('sport_id', sportId)
      .limit(3);

    if (players && players.length > 0) {
      console.log(`\nSport ${sportId} players:`);
      players.forEach((player: any) => {
        console.log(`  ${player.name} (Team ID: ${player.team_id})`);
      });
    }
  }
}

checkSportsData().catch(console.error);