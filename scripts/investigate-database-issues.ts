import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateDatabaseIssues() {
  console.log('🔍 Investigating Database Issues...\n');

  // 1. Check for duplicate teams
  console.log('📊 Checking for duplicate teams...');
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, abbreviation, sport_id')
    .order('name');

  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    return;
  }

  // Group teams by name to find duplicates
  const teamsByName = new Map<string, any[]>();
  teams?.forEach(team => {
    const existing = teamsByName.get(team.name) || [];
    existing.push(team);
    teamsByName.set(team.name, existing);
  });

  console.log(`\nTotal teams in database: ${teams?.length}`);
  
  // Find duplicates
  const duplicates = Array.from(teamsByName.entries())
    .filter(([_, teams]) => teams.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (duplicates.length > 0) {
    console.log(`\n❌ Found ${duplicates.length} duplicate team names:\n`);
    duplicates.forEach(([name, dupeTeams]) => {
      console.log(`"${name}" appears ${dupeTeams.length} times:`);
      dupeTeams.forEach(team => {
        console.log(`  - ID: ${team.id}, Sport: ${team.sport_id}`);
      });
    });
  } else {
    console.log('✅ No duplicate team names found');
  }

  // 2. Check sport_id distribution
  console.log('\n📊 Checking sport_id distribution...');
  const sportCounts = new Map<string, number>();
  teams?.forEach(team => {
    const count = sportCounts.get(team.sport_id) || 0;
    sportCounts.set(team.sport_id, count + 1);
  });

  console.log('\nTeams by sport_id:');
  Array.from(sportCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} teams`);
    });

  // 3. Check for teams with invalid sport_id
  console.log('\n📊 Checking for invalid sport_ids...');
  const validSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];
  const invalidSportTeams = teams?.filter(team => !validSports.includes(team.sport_id)) || [];
  
  if (invalidSportTeams.length > 0) {
    console.log(`\n❌ Found ${invalidSportTeams.length} teams with invalid sport_id:`);
    invalidSportTeams.forEach(team => {
      console.log(`  - ${team.name} (ID: ${team.id}, Sport: ${team.sport_id})`);
    });
  } else {
    console.log('✅ All teams have valid sport_ids');
  }

  // 4. Check games referencing non-existent teams
  console.log('\n📊 Checking games with invalid team references...');
  const teamIds = new Set(teams?.map(t => t.id));
  
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, espn_id, home_team_id, away_team_id, sport')
    .limit(1000);

  if (gamesError) {
    console.error('Error fetching games:', gamesError);
    return;
  }

  const invalidGames = games?.filter(game => 
    !teamIds.has(game.home_team_id) || !teamIds.has(game.away_team_id)
  ) || [];

  if (invalidGames.length > 0) {
    console.log(`\n❌ Found ${invalidGames.length} games with invalid team references:`);
    invalidGames.slice(0, 10).forEach(game => {
      const homeValid = teamIds.has(game.home_team_id);
      const awayValid = teamIds.has(game.away_team_id);
      console.log(`  - Game ${game.espn_id}: Home=${game.home_team_id} (${homeValid ? 'valid' : 'INVALID'}), Away=${game.away_team_id} (${awayValid ? 'valid' : 'INVALID'})`);
    });
    if (invalidGames.length > 10) {
      console.log(`  ... and ${invalidGames.length - 10} more`);
    }
  } else {
    console.log('✅ All games have valid team references');
  }

  // 5. Check coverage by sport
  console.log('\n📊 Checking stats coverage by sport...');
  
  for (const sport of validSports) {
    const { data: sportGames, error: sportError } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport);

    if (sportError) {
      console.error(`Error fetching ${sport} games:`, sportError);
      continue;
    }

    const gameIds = sportGames?.map(g => g.id) || [];
    
    if (gameIds.length === 0) {
      console.log(`\n${sport}: No games found`);
      continue;
    }

    const { count: statsCount, error: statsError } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .in('game_id', gameIds);

    if (statsError) {
      console.error(`Error counting ${sport} stats:`, statsError);
      continue;
    }

    const { count: gamesWithStats, error: coverageError } = await supabase
      .from('player_stats')
      .select('game_id', { count: 'exact', head: true })
      .in('game_id', gameIds);

    const coverage = gamesWithStats ? (gamesWithStats / gameIds.length * 100).toFixed(1) : 0;
    console.log(`\n${sport}:`);
    console.log(`  - Total games: ${gameIds.length}`);
    console.log(`  - Games with stats: ${gamesWithStats || 0}`);
    console.log(`  - Coverage: ${coverage}%`);
    console.log(`  - Total player stats: ${statsCount || 0}`);
  }

  console.log('\n✅ Investigation complete!');
}

investigateDatabaseIssues().catch(console.error);