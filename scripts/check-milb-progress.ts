import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMiLBProgress() {
  console.log(chalk.cyan('⚾ MiLB Collection Progress Check\n'));
  
  // Check teams
  const { data: milbTeams, count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact' })
    .eq('sport', 'MILB');
    
  console.log(chalk.green(`✅ MiLB Teams collected: ${teamCount || 0}`));
  
  // Check by league level
  const { data: levels } = await supabase
    .from('teams')
    .select('league_level')
    .eq('sport', 'MILB')
    .not('league_level', 'is', null);
    
  const levelCounts = levels?.reduce((acc: any, team: any) => {
    acc[team.league_level] = (acc[team.league_level] || 0) + 1;
    return acc;
  }, {});
  
  if (levelCounts) {
    console.log(chalk.yellow('\nTeams by level:'));
    Object.entries(levelCounts).forEach(([level, count]) => {
      console.log(`  ${level}: ${count}`);
    });
  }
  
  // Check games
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.green(`\n✅ MiLB Games collected: ${gameCount || 0}`));
  
  // Check players
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.green(`✅ MiLB Players collected: ${playerCount || 0}`));
  
  // Check stats
  const { count: statsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.green(`✅ MiLB Stats collected: ${statsCount || 0}`));
  
  // Check affiliations
  const { count: affiliationCount } = await supabase
    .from('milb_affiliations')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.green(`✅ MiLB Affiliations: ${affiliationCount || 0}`));
  
  // Show recent games
  const { data: recentGames } = await supabase
    .from('games')
    .select('start_time, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
    .eq('sport', 'MILB')
    .order('start_time', { ascending: false })
    .limit(5);
    
  if (recentGames && recentGames.length > 0) {
    console.log(chalk.yellow('\n📅 Recent MiLB games:'));
    recentGames.forEach((game: any) => {
      const date = new Date(game.start_time).toLocaleDateString();
      console.log(`  ${date}: ${game.away_team?.name} @ ${game.home_team?.name}`);
    });
  }
  
  console.log(chalk.cyan('\n🎯 Next step: Continue collection or check specific issues'));
}

checkMiLBProgress().catch(console.error);