import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAAHockeyGames() {
  try {
    console.log('Checking for NCAA Hockey games in database...\n');

    // 1. Count games where sport = 'NCAA_HKY'
    const { count: hkyCount, error: hkyError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_HKY');
    
    console.log(`Games with sport = 'NCAA_HKY': ${hkyCount || 0}`);

    // 2. Check for variations
    const { data: variations } = await supabase
      .from('games')
      .select('sport')
      .or('sport.ilike.%hockey%,sport.ilike.%hky%,sport.ilike.%ncaa%hk%');
    
    const sportCounts = variations?.reduce((acc: any, row: any) => {
      acc[row.sport] = (acc[row.sport] || 0) + 1;
      return acc;
    }, {}) || {};
    
    console.log('\nVariations found:');
    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} games`);
    });

    // 3. Check external_id patterns for hockey
    const { data: hockeyPatterns } = await supabase
      .from('games')
      .select('external_id, game_date, home_team_id, away_team_id, sport')
      .or('external_id.like.%hockey%,external_id.like.%hky%,and(external_id.like.espn_ncaa%,external_id.like.%41%)')
      .limit(10);
    
    console.log('\nSample NCAA Hockey game external IDs:');
    hockeyPatterns?.forEach(row => {
      console.log(`  ${row.external_id} | ${row.sport} | ${row.game_date}`);
    });

    // 4. Check all unique sport codes
    const { data: allGames } = await supabase
      .from('games')
      .select('sport');
    
    const allSportCounts = allGames?.reduce((acc: any, row: any) => {
      acc[row.sport] = (acc[row.sport] || 0) + 1;
      return acc;
    }, {}) || {};
    
    console.log('\nAll sport codes in database:');
    Object.entries(allSportCounts).sort().forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} games`);
    });

    // 5. Check for NCAA sports specifically
    const { data: ncaaGames } = await supabase
      .from('games')
      .select('sport')
      .like('sport', 'NCAA%');
    
    const ncaaSportCounts = ncaaGames?.reduce((acc: any, row: any) => {
      acc[row.sport] = (acc[row.sport] || 0) + 1;
      return acc;
    }, {}) || {};
    
    console.log('\nNCAA sports found:');
    Object.entries(ncaaSportCounts).sort((a: any, b: any) => b[1] - a[1]).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} games`);
    });

    // 6. Check teams table for hockey teams
    const { count: hockeyTeamsCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .or('sport.eq.NCAA_HKY,external_id.like.%ncaa%hky%');
    
    console.log(`\nNCAA Hockey teams in database: ${hockeyTeamsCount || 0}`);

    // 7. Check specific NCAA_HKY games
    const { data: ncaaHkyGames } = await supabase
      .from('games')
      .select('external_id, game_date, sport')
      .eq('sport', 'NCAA_HKY')
      .limit(10);
    
    console.log('\nSpecific NCAA_HKY games:');
    ncaaHkyGames?.forEach(game => {
      console.log(`  ${game.external_id} | ${game.sport} | ${game.game_date}`);
    });

  } catch (error) {
    console.error('Error checking NCAA Hockey games:', error);
  }
}

checkNCAAHockeyGames();