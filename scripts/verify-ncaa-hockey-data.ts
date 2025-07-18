import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyNCAAHockeyData() {
  try {
    console.log(chalk.cyan('🏒 Verifying NCAA Hockey data...\n'));

    // 1. Get exact count of NCAA_HKY games
    const { data: hkyGames, count } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .eq('sport', 'NCAA_HKY')
      .limit(20);
    
    console.log(chalk.green(`Total NCAA_HKY games: ${count}`));
    console.log(chalk.yellow('\nSample NCAA_HKY games:'));
    
    hkyGames?.forEach((game, idx) => {
      console.log(`\n${idx + 1}. Game ID: ${game.id}`);
      console.log(`   External ID: ${game.external_id}`);
      console.log(`   Sport: ${game.sport}`);
      console.log(`   Date: ${game.game_date || 'NULL'}`);
      console.log(`   Home Team ID: ${game.home_team_id || 'NULL'}`);
      console.log(`   Away Team ID: ${game.away_team_id || 'NULL'}`);
      console.log(`   Season: ${game.season || 'NULL'}`);
    });

    // 2. Check date range of NCAA_HKY games
    const { data: dateRange } = await supabase
      .from('games')
      .select('game_date')
      .eq('sport', 'NCAA_HKY')
      .not('game_date', 'is', null)
      .order('game_date', { ascending: true })
      .limit(1);
    
    const { data: latestDate } = await supabase
      .from('games')
      .select('game_date')
      .eq('sport', 'NCAA_HKY')
      .not('game_date', 'is', null)
      .order('game_date', { ascending: false })
      .limit(1);

    if (dateRange?.length && latestDate?.length) {
      console.log(chalk.blue(`\nDate range: ${dateRange[0].game_date} to ${latestDate[0].game_date}`));
    }

    // 3. Check teams that should be NCAA_HKY
    const { data: potentialHockeyTeams } = await supabase
      .from('teams')
      .select('*')
      .or('external_id.ilike.%hockey%,name.ilike.%hockey%,external_id.ilike.%ncaa%41%');
    
    console.log(chalk.magenta(`\nPotential hockey teams found: ${potentialHockeyTeams?.length || 0}`));
    if (potentialHockeyTeams && potentialHockeyTeams.length > 0) {
      console.log('Sample teams:');
      potentialHockeyTeams.slice(0, 5).forEach(team => {
        console.log(`  ${team.name} | Sport: ${team.sport} | External: ${team.external_id}`);
      });
    }

    // 4. Check if NCAA_HKY games have valid team references
    const { data: gamesWithTeams } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id')
      .eq('sport', 'NCAA_HKY')
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null)
      .limit(5);
    
    console.log(chalk.cyan(`\nNCAA_HKY games with team IDs: ${gamesWithTeams?.length || 0} (out of 5 checked)`));

    // 5. Check distinct seasons
    const { data: seasons } = await supabase
      .from('games')
      .select('season')
      .eq('sport', 'NCAA_HKY');
    
    const uniqueSeasons = [...new Set(seasons?.map(s => s.season).filter(Boolean))];
    console.log(chalk.green(`\nSeasons found: ${uniqueSeasons.join(', ') || 'None'}`));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

verifyNCAAHockeyData();