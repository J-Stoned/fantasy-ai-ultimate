import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNBASchema() {
  console.log('🏀 Checking NBA-related tables and data...\n');
  
  // 1. Check games table structure and NBA games
  console.log('1. Games table - NBA games:');
  const { data: nbaGames, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .ilike('sport', 'NBA')
    .limit(3);
    
  if (gamesError) {
    console.error('Error fetching NBA games:', gamesError);
    // Try without sport filter
    console.log('\nTrying to fetch any games to check structure:');
    const { data: anyGames, error: anyGamesError } = await supabase
      .from('games')
      .select('*')
      .limit(1);
      
    if (!anyGamesError && anyGames && anyGames.length > 0) {
      console.log('Sample game columns:', Object.keys(anyGames[0]));
      console.log('Sample game:', JSON.stringify(anyGames[0], null, 2));
    }
  } else {
    console.log('Found', nbaGames?.length || 0, 'NBA games');
    if (nbaGames && nbaGames.length > 0) {
      console.log('Sample NBA game:', JSON.stringify(nbaGames[0], null, 2));
    }
  }
  
  // 2. Check players table for NBA
  console.log('\n2. Players table - NBA players:');
  const { data: nbaPlayers, error: playersError } = await supabase
    .from('players')
    .select('*')
    .ilike('sport', 'NBA')
    .limit(5);
    
  if (playersError) {
    console.error('Error fetching NBA players:', playersError);
    // Check any player to see structure
    console.log('\nChecking player table structure:');
    const { data: anyPlayer, error: anyPlayerError } = await supabase
      .from('players')
      .select('*')
      .limit(1);
      
    if (!anyPlayerError && anyPlayer && anyPlayer.length > 0) {
      console.log('Player columns:', Object.keys(anyPlayer[0]));
    }
  } else {
    console.log('Found', nbaPlayers?.length || 0, 'NBA players');
  }
  
  // 3. Check teams table for NBA
  console.log('\n3. Teams table - NBA teams:');
  const { data: nbaTeams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .ilike('sport', 'NBA')
    .order('name');
    
  if (teamsError) {
    console.error('Error fetching NBA teams:', teamsError);
  } else {
    console.log('Found', nbaTeams?.length || 0, 'NBA teams');
    if (nbaTeams && nbaTeams.length > 0) {
      console.log('NBA teams:', nbaTeams.map(t => `${t.name} (${t.abbreviation})`).join(', '));
    }
  }
  
  // 4. Check player_stats structure
  console.log('\n4. Player stats table structure:');
  const { data: anyStats, error: statsError } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1);
    
  if (!statsError && anyStats && anyStats.length > 0) {
    console.log('Player stats columns:', Object.keys(anyStats[0]));
  }
  
  // 5. Look for games that might be NBA based on team names
  console.log('\n5. Looking for potential NBA games by team names:');
  const { data: teams, error: teamsListError } = await supabase
    .from('teams')
    .select('id, name, abbreviation, sport')
    .in('abbreviation', ['LAL', 'BOS', 'GSW', 'MIA', 'NYK', 'CHI', 'PHI', 'HOU']);
    
  if (!teamsListError && teams && teams.length > 0) {
    console.log('Found teams with NBA abbreviations:', teams.length);
    teams.forEach(team => {
      console.log(`  - ${team.name} (${team.abbreviation}) - Sport: ${team.sport}`);
    });
  }
  
  process.exit(0);
}

checkNBASchema();