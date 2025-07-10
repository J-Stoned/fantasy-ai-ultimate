import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkPlayersByPort() {
  console.log('🔍 Checking total players in database by sport...\n');

  try {
    // Get total player count
    const { count: totalCount, error: totalError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;
    console.log(`📊 Total players in database: ${totalCount?.toLocaleString()}\n`);

    // Get player count by sport
    const { data: sportCounts, error: sportError } = await supabase
      .from('players')
      .select('sport')
      .order('sport');

    if (sportError) throw sportError;

    // Count players by sport
    const sportDistribution = sportCounts?.reduce((acc: Record<string, number>, player) => {
      const sport = player.sport || 'Unknown';
      acc[sport] = (acc[sport] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Players by sport:');
    console.log('==================');
    Object.entries(sportDistribution || {})
      .sort(([, a], [, b]) => b - a)
      .forEach(([sport, count]) => {
        const percentage = ((count / (totalCount || 1)) * 100).toFixed(1);
        console.log(`${sport.padEnd(10)} ${count.toLocaleString().padStart(8)} (${percentage}%)`);
      });

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
      const { data: player, error } = await supabase
        .from('players')
        .select('*')
        .ilike('name', `%${playerName}%`)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.log(`❌ Error checking ${playerName}: ${error.message}`);
      } else if (player) {
        console.log(`✅ Found: ${player.name} (${player.sport}) - Team: ${player.team_id || 'No team'}`);
      } else {
        console.log(`❌ Not found: ${playerName}`);
      }
    }

    // Get a sample of NFL players
    console.log('\n🏈 Sample of NFL players in database:');
    console.log('====================================');
    const { data: nflPlayers, error: nflError } = await supabase
      .from('players')
      .select('*')
      .eq('sport', 'NFL')
      .limit(10);

    if (nflError) {
      console.log(`❌ Error getting NFL players: ${nflError.message}`);
    } else if (nflPlayers && nflPlayers.length > 0) {
      nflPlayers.forEach(player => {
        console.log(`- ${player.name} (Team ID: ${player.team_id || 'No team'})`);
      });
      console.log(`\n(Showing ${nflPlayers.length} of ${sportDistribution?.['NFL'] || 0} total NFL players)`);
    } else {
      console.log('❌ No NFL players found in database!');
    }

    // Check teams
    console.log('\n🏟️ Checking NFL teams:');
    console.log('=====================');
    const { data: nflTeams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .eq('sport', 'NFL')
      .order('name');

    if (teamsError) {
      console.log(`❌ Error getting NFL teams: ${teamsError.message}`);
    } else if (nflTeams && nflTeams.length > 0) {
      console.log(`Found ${nflTeams.length} NFL teams:`);
      nflTeams.forEach(team => {
        console.log(`- ${team.name} (ID: ${team.id})`);
      });
    } else {
      console.log('❌ No NFL teams found in database!');
    }

    // Check for players without sport
    const { count: noSportCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .is('sport', null);

    if (noSportCount && noSportCount > 0) {
      console.log(`\n⚠️ Found ${noSportCount.toLocaleString()} players without sport assigned`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPlayersByPort();