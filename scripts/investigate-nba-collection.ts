import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateNBA() {
  console.log('🏀 Investigating NBA Collection Issues...\n');
  
  // 1. Check sample NBA games and their external_id format
  console.log('1. Sample NBA games:');
  const { data: nbaGames, error: gamesError } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id, game_date, status')
    .eq('sport', 'NBA')
    .order('game_date', { ascending: false })
    .limit(5);
    
  if (gamesError) {
    console.error('Error fetching NBA games:', gamesError);
  } else {
    console.log('Found', nbaGames?.length || 0, 'NBA games');
    nbaGames?.forEach(game => {
      console.log(`  Game ID: ${game.id}`);
      console.log(`  External ID: ${game.external_id}`);
      console.log(`  Date: ${game.game_date}`);
      console.log(`  Status: ${game.status}`);
      console.log('  ---');
    });
  }
  
  // 2. Check if there are any NBA players
  console.log('\n2. NBA Players in database:');
  const { data: nbaPlayers, error: playersError } = await supabase
    .from('players')
    .select('id, name, team_id, external_id')
    .eq('sport', 'NBA')
    .limit(10);
    
  if (playersError) {
    console.error('Error fetching NBA players:', playersError);
  } else {
    console.log('Found', nbaPlayers?.length || 0, 'NBA players');
    if (nbaPlayers && nbaPlayers.length > 0) {
      console.log('Sample players:');
      nbaPlayers.slice(0, 5).forEach(player => {
        console.log(`  - ${player.name} (ID: ${player.id}, External: ${player.external_id})`);
      });
    }
  }
  
  // 3. Check NBA teams
  console.log('\n3. NBA Teams in database:');
  const { data: nbaTeams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id')
    .eq('sport', 'NBA')
    .order('name');
    
  if (teamsError) {
    console.error('Error fetching NBA teams:', teamsError);
  } else {
    console.log('Found', nbaTeams?.length || 0, 'NBA teams');
    if (nbaTeams && nbaTeams.length > 0) {
      console.log('Teams:', nbaTeams.map(t => t.name).join(', '));
    }
  }
  
  // 4. Check player_stats for NBA
  console.log('\n4. NBA Player Stats:');
  const { data: nbaStats, error: statsError } = await supabase
    .from('player_stats')
    .select('id, player_id, game_id')
    .eq('sport', 'NBA')
    .limit(5);
    
  if (statsError) {
    console.error('Error fetching NBA stats:', statsError);
  } else {
    console.log('Found', nbaStats?.length || 0, 'NBA player stats records');
  }
  
  process.exit(0);
}

investigateNBA();