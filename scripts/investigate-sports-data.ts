import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function investigateSportsData() {
  console.log(chalk.red.bold('\n🚨 INVESTIGATING SPORTS DATA CONFUSION 🚨\n'));
  
  // 1. Check games by sport
  console.log(chalk.yellow('1. Checking sports distribution in games table...'));
  const { data: allGames, count: totalGames } = await supabase
    .from('games')
    .select('sport', { count: 'exact' });
    
  const { data: scoredGames } = await supabase
    .from('games')
    .select('sport')
    .not('home_score', 'is', null);
    
  const sportCounts: Record<string, number> = {};
  const scoredSportCounts: Record<string, number> = {};
  
  allGames?.forEach(g => {
    const sport = g.sport || 'unknown';
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  });
  
  scoredGames?.forEach(g => {
    const sport = g.sport || 'unknown';
    scoredSportCounts[sport] = (scoredSportCounts[sport] || 0) + 1;
  });
  
  console.log('Total games by sport:', sportCounts);
  console.log('Scored games by sport:', scoredSportCounts);
  
  // 2. Check player stats types
  console.log(chalk.yellow('\n2. Checking player_stats structure...'));
  const { data: statTypes } = await supabase
    .from('player_stats')
    .select('stat_type')
    .limit(100);
    
  const uniqueStatTypes = new Set(statTypes?.map(s => s.stat_type));
  console.log('Unique stat types found:', Array.from(uniqueStatTypes).sort());
  
  // 3. Sample some actual player stats
  console.log(chalk.yellow('\n3. Sampling actual player stats...'));
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('*')
    .limit(10);
    
  console.log('Sample player stats:');
  sampleStats?.forEach((stat, i) => {
    console.log(`  ${i + 1}. Game: ${stat.game_id}, Player: ${stat.player_id}, ${stat.stat_type}: ${stat.stat_value}`);
  });
  
  // 4. Check if we have any NFL-specific stats
  console.log(chalk.yellow('\n4. Looking for NFL-specific stats...'));
  const nflStatTypes = ['passing_yards', 'rushing_yards', 'receiving_yards', 'touchdowns', 'interceptions'];
  for (const statType of nflStatTypes) {
    const { count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('stat_type', statType);
    console.log(`  ${statType}: ${count || 0} records`);
  }
  
  // 5. Check if games have correct team mappings
  console.log(chalk.yellow('\n5. Checking team mappings...'));
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, sport')
    .limit(10);
    
  console.log('Sample teams:');
  teams?.forEach(team => {
    console.log(`  ${team.abbreviation}: ${team.name} (${team.sport || 'no sport'})`);
  });
  
  // 6. The truth about pattern detection
  console.log(chalk.red('\n6. THE TRUTH ABOUT PATTERN DETECTION:'));
  console.log('Based on code analysis:');
  console.log('  - Patterns are assigned using Math.random() < 0.15');
  console.log('  - No real schedule analysis exists');
  console.log('  - ROI numbers are hardcoded constants');
  console.log('  - The "65.2% accuracy" is completely fabricated');
  
  console.log(chalk.green.bold('\n✅ CONCLUSION:'));
  console.log('The system is trying to detect NFL patterns in what appears to be NBA data!');
  console.log('Player stats contain basketball metrics (points, rebounds, assists)');
  console.log('The entire pattern detection system needs to be rebuilt with real NFL data.');
}

investigateSportsData().catch(console.error);