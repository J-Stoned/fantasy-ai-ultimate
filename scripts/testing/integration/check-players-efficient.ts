import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkPlayersEfficiently() {
  console.log('🔍 Checking total players in database by sport...\n');

  try {
    // Get total player count
    const { count: totalCount, error: totalError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;
    console.log(`📊 Total players in database: ${totalCount?.toLocaleString()}\n`);

    // Get unique sports
    const { data: sports, error: sportsError } = await supabase
      .from('players')
      .select('sport')
      .not('sport', 'is', null)
      .limit(1000);

    if (sportsError) throw sportsError;

    // Get unique sport values
    const uniqueSports = [...new Set(sports?.map(p => p.sport))].sort();
    console.log(`Found ${uniqueSports.length} different sports\n`);

    // Count players by sport more efficiently
    console.log('📊 Players by sport:');
    console.log('==================');
    const sportCounts: Record<string, number> = {};
    
    for (const sport of uniqueSports) {
      const { count, error } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport);
      
      if (!error && count !== null) {
        sportCounts[sport] = count;
        const percentage = ((count / (totalCount || 1)) * 100).toFixed(1);
        console.log(`${sport.padEnd(10)} ${count.toLocaleString().padStart(8)} (${percentage}%)`);
      }
    }

    // Count players without sport
    const { count: noSportCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .is('sport', null);

    if (noSportCount && noSportCount > 0) {
      const percentage = ((noSportCount / (totalCount || 1)) * 100).toFixed(1);
      console.log(`${'No sport'.padEnd(10)} ${noSportCount.toLocaleString().padStart(8)} (${percentage}%)`);
    }

    // Check for specific NFL players
    console.log('\n🏈 Checking for specific NFL players:');
    console.log('=====================================');
    
    const nflPlayersToCheck = [
      'Justin Fields',
      'Patrick Mahomes', 
      'Josh Allen',
      'Jalen Hurts',
      'Lamar Jackson'
    ];

    for (const playerName of nflPlayersToCheck) {
      const { data: players, error } = await supabase
        .from('players')
        .select('id, name, sport, team_id')
        .ilike('name', `%${playerName}%`);

      if (error) {
        console.log(`❌ Error checking ${playerName}: ${error.message}`);
      } else if (players && players.length > 0) {
        players.forEach(player => {
          console.log(`✅ Found: ${player.name} (${player.sport || 'No sport'}) - Team: ${player.team_id || 'No team'}`);
        });
      } else {
        console.log(`❌ Not found: ${playerName}`);
      }
    }

    // Get a sample of NFL players
    if (sportCounts['NFL'] && sportCounts['NFL'] > 0) {
      console.log('\n🏈 Sample of NFL players in database:');
      console.log('====================================');
      const { data: nflPlayers, error: nflError } = await supabase
        .from('players')
        .select('id, name, team_id')
        .eq('sport', 'NFL')
        .limit(10);

      if (nflError) {
        console.log(`❌ Error getting NFL players: ${nflError.message}`);
      } else if (nflPlayers && nflPlayers.length > 0) {
        nflPlayers.forEach(player => {
          console.log(`- ${player.name} (Team ID: ${player.team_id || 'No team'})`);
        });
        console.log(`\n(Showing ${nflPlayers.length} of ${sportCounts['NFL']} total NFL players)`);
      }
    } else {
      console.log('\n❌ No NFL players found with sport = "NFL"');
      
      // Check if there are players that might be NFL but not tagged
      console.log('\n🔍 Searching for players that might be NFL...');
      const { data: potentialNFL, error } = await supabase
        .from('players')
        .select('id, name, sport, team_id')
        .in('name', nflPlayersToCheck)
        .limit(10);
      
      if (!error && potentialNFL && potentialNFL.length > 0) {
        console.log('Found these players (might be NFL but not tagged):');
        potentialNFL.forEach(player => {
          console.log(`- ${player.name} (sport: ${player.sport || 'NULL'})`);
        });
      }
    }

    // Check NFL teams
    console.log('\n🏟️ Checking NFL teams:');
    console.log('=====================');
    const { data: nflTeams, count: nflTeamCount, error: teamsError } = await supabase
      .from('teams')
      .select('*', { count: 'exact' })
      .eq('sport', 'NFL')
      .order('name');

    if (teamsError) {
      console.log(`❌ Error getting NFL teams: ${teamsError.message}`);
    } else {
      console.log(`Found ${nflTeamCount} NFL teams`);
      if (nflTeams && nflTeams.length > 0) {
        console.log('\nFirst 5 NFL teams:');
        nflTeams.slice(0, 5).forEach(team => {
          console.log(`- ${team.name} (ID: ${team.id})`);
        });
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('==========');
    console.log(`Total players: ${totalCount?.toLocaleString()}`);
    console.log(`Sports found: ${uniqueSports.length}`);
    console.log(`Players with no sport: ${noSportCount?.toLocaleString() || 0}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPlayersEfficiently();