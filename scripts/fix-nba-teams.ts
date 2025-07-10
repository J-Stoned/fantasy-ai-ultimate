import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Known NBA team names
const NBA_TEAMS = [
  'Los Angeles Lakers',
  'Boston Celtics',
  'Golden State Warriors',
  'Miami Heat',
  'New York Knicks',
  'Chicago Bulls',
  'Philadelphia 76ers',
  'Houston Rockets',
  'San Antonio Spurs',
  'Milwaukee Bucks',
  'Phoenix Suns',
  'Dallas Mavericks',
  'Denver Nuggets',
  'Los Angeles Clippers',
  'Toronto Raptors',
  'Portland Trail Blazers',
  'Utah Jazz',
  'Oklahoma City Thunder',
  'Indiana Pacers',
  'Atlanta Hawks',
  'Brooklyn Nets',
  'Memphis Grizzlies',
  'Minnesota Timberwolves',
  'Sacramento Kings',
  'New Orleans Pelicans',
  'Washington Wizards',
  'Charlotte Hornets',
  'Detroit Pistons',
  'Orlando Magic',
  'Cleveland Cavaliers'
];

async function fixNBATeams() {
  console.log('🏀 Fixing NBA Teams...\n');
  
  // First, let's find all teams that match NBA team names
  console.log('1. Finding NBA teams in database:');
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, abbreviation, sport')
    .in('name', NBA_TEAMS);
    
  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    return;
  }
  
  console.log(`Found ${teams?.length || 0} NBA teams`);
  
  if (teams && teams.length > 0) {
    // Update all NBA teams to have sport = 'NBA'
    console.log('\n2. Updating NBA teams:');
    for (const team of teams) {
      console.log(`  Updating ${team.name} (${team.abbreviation}) from sport: ${team.sport} to NBA`);
      
      const { error: updateError } = await supabase
        .from('teams')
        .update({ sport: 'NBA' })
        .eq('id', team.id);
        
      if (updateError) {
        console.error(`  Error updating ${team.name}:`, updateError);
      }
    }
    
    // Verify the update
    console.log('\n3. Verifying NBA teams update:');
    const { data: updatedTeams, error: verifyError } = await supabase
      .from('teams')
      .select('id, name, abbreviation, sport')
      .eq('sport', 'NBA')
      .order('name');
      
    if (!verifyError && updatedTeams) {
      console.log(`\nSuccessfully updated ${updatedTeams.length} NBA teams:`);
      updatedTeams.forEach(team => {
        console.log(`  ✓ ${team.name} (${team.abbreviation})`);
      });
    }
  }
  
  // Check if there are NBA games with these teams
  console.log('\n4. Checking NBA games with updated teams:');
  const { data: nbaGames, error: gamesError } = await supabase
    .from('games')
    .select(`
      id,
      external_id,
      home_team_id,
      away_team_id,
      home_team:teams!games_home_team_id_fkey(name, abbreviation),
      away_team:teams!games_away_team_id_fkey(name, abbreviation)
    `)
    .eq('sport', 'NBA')
    .limit(5);
    
  if (!gamesError && nbaGames) {
    console.log(`Found ${nbaGames.length} NBA games`);
    nbaGames.forEach(game => {
      console.log(`  Game ${game.external_id}: ${game.home_team?.name} vs ${game.away_team?.name}`);
    });
  }
  
  process.exit(0);
}

fixNBATeams();