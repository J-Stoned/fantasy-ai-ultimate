import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAAHockeyGames() {
  try {
    console.log(chalk.cyan('🏒 Checking for NCAA Hockey games in database...\n'));

    // 1. Count games where sport = 'NCAA_HKY'
    const { count: hkyCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_HKY');
    
    console.log(chalk.yellow(`Games with sport = 'NCAA_HKY': ${hkyCount || 0}`));

    // 2. Get actual counts by sport
    const { data: allGames } = await supabase
      .from('games')
      .select('sport, external_id');
    
    // Count games by sport
    const sportCounts = new Map<string, number>();
    allGames?.forEach(game => {
      const count = sportCounts.get(game.sport) || 0;
      sportCounts.set(game.sport, count + 1);
    });

    console.log(chalk.green('\nAll sports in database:'));
    const sortedSports = Array.from(sportCounts.entries()).sort((a, b) => b[1] - a[1]);
    sortedSports.forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} games`);
    });

    // 3. Look for hockey in external IDs
    console.log(chalk.cyan('\nChecking for hockey in external IDs...'));
    const hockeyInExternalId = allGames?.filter(game => 
      game.external_id?.toLowerCase().includes('hockey') || 
      game.external_id?.toLowerCase().includes('hky')
    ) || [];
    
    console.log(`Found ${hockeyInExternalId.length} games with 'hockey' or 'hky' in external_id`);
    
    // Show sample
    console.log('\nSample hockey external IDs:');
    hockeyInExternalId.slice(0, 5).forEach(game => {
      console.log(`  ${game.external_id} | sport: ${game.sport}`);
    });

    // 4. Check NCAA sports
    const ncaaSports = Array.from(sportCounts.entries()).filter(([sport]) => sport?.startsWith('NCAA'));
    console.log(chalk.magenta('\nNCAA sports breakdown:'));
    ncaaSports.forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} games`);
    });

    // 5. Check teams
    const { data: allTeams } = await supabase
      .from('teams')
      .select('sport, external_id');
    
    const teamSportCounts = new Map<string, number>();
    allTeams?.forEach(team => {
      const count = teamSportCounts.get(team.sport) || 0;
      teamSportCounts.set(team.sport, count + 1);
    });

    console.log(chalk.blue('\nTeams by sport:'));
    const sortedTeamSports = Array.from(teamSportCounts.entries()).sort((a, b) => b[1] - a[1]);
    sortedTeamSports.forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} teams`);
    });

    // 6. Check for NCAA_HKY teams specifically
    const ncaaHkyTeams = allTeams?.filter(team => team.sport === 'NCAA_HKY') || [];
    console.log(chalk.yellow(`\nNCAA_HKY teams found: ${ncaaHkyTeams.length}`));
    if (ncaaHkyTeams.length > 0) {
      console.log('Sample NCAA Hockey teams:');
      ncaaHkyTeams.slice(0, 5).forEach(team => {
        console.log(`  ${team.external_id}`);
      });
    }

    // 7. Look for any game with NCAA_HKY
    const { data: sampleHkyGames } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NCAA_HKY')
      .limit(5);
    
    if (sampleHkyGames && sampleHkyGames.length > 0) {
      console.log(chalk.green('\nSample NCAA_HKY games:'));
      sampleHkyGames.forEach(game => {
        console.log(`  ID: ${game.id} | External: ${game.external_id} | Date: ${game.game_date}`);
      });
    }

    // 8. Check if there are any NULL sports
    const { count: nullSportCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('sport', null);
    
    console.log(chalk.red(`\nGames with NULL sport: ${nullSportCount || 0}`));

  } catch (error) {
    console.error(chalk.red('Error checking NCAA Hockey games:'), error);
  }
}

checkNCAAHockeyGames();