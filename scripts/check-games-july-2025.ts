#!/usr/bin/env tsx
/**
 * Check if games are real - with correct July 2025 context
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGamesJuly2025() {
  console.log(chalk.blue.bold('🏈 Checking Games - Current Date: July 3, 2025\n'));
  
  // 1. Check NFL 2024-25 season (completed)
  console.log(chalk.yellow('1. NFL 2024-25 Season (Sept 2024 - Feb 2025):'));
  const { data: lastSeasonGames, count: lastSeasonCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .eq('sport', 'nfl')
    .gte('start_time', '2024-09-01')
    .lte('start_time', '2025-02-15')
    .not('home_score', 'is', null);
    
  console.log(`   Games from last season: ${lastSeasonCount || 0}`);
  
  if (lastSeasonGames && lastSeasonGames.length > 0) {
    console.log(`   Sample game: Teams ${lastSeasonGames[0].home_team_id} vs ${lastSeasonGames[0].away_team_id}`);
    console.log(`   Date: ${new Date(lastSeasonGames[0].start_time).toLocaleDateString()}`);
    console.log(`   Score: ${lastSeasonGames[0].home_score}-${lastSeasonGames[0].away_score}`);
  }
  
  // 2. Check for future games (upcoming 2025-26 season)
  console.log(chalk.yellow('\n2. Upcoming NFL 2025-26 Season (starts Sept 2025):'));
  const { data: futureGames, count: futureCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .eq('sport', 'nfl')
    .gte('start_time', '2025-09-01')
    .is('home_score', null);
    
  console.log(`   Scheduled future games: ${futureCount || 0}`);
  
  // 3. Check team data quality
  console.log(chalk.yellow('\n3. Team Data Quality:'));
  
  // Get unique team IDs from games
  const { data: teamIds } = await supabase
    .from('games')
    .select('home_team_id, away_team_id')
    .eq('sport', 'nfl')
    .limit(20);
    
  const uniqueTeamIds = new Set<string>();
  teamIds?.forEach(game => {
    uniqueTeamIds.add(game.home_team_id);
    uniqueTeamIds.add(game.away_team_id);
  });
  
  console.log(`   Unique team IDs found: ${Array.from(uniqueTeamIds).slice(0, 10).join(', ')}`);
  
  // Check if these are real team IDs
  const sampleIds = Array.from(uniqueTeamIds).slice(0, 5);
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation')
    .in('id', sampleIds);
    
  if (teams && teams.length > 0) {
    console.log('\n   Team mappings found:');
    teams.forEach(t => console.log(`     ${t.id}: ${t.name} (${t.abbreviation})`));
  } else {
    console.log(chalk.red('   ❌ No team names found for these IDs!'));
  }
  
  // 4. Check for known NFL matchups
  console.log(chalk.yellow('\n4. Checking for real NFL patterns:'));
  
  // NFL games should be mostly on Sunday, Monday, Thursday
  const { data: gameDays } = await supabase
    .from('games')
    .select('start_time')
    .eq('sport', 'nfl')
    .not('home_score', 'is', null)
    .limit(100);
    
  const dayOfWeek: Record<string, number> = {};
  gameDays?.forEach(game => {
    const day = new Date(game.start_time).getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
    dayOfWeek[dayName] = (dayOfWeek[dayName] || 0) + 1;
  });
  
  console.log('   Games by day of week:');
  Object.entries(dayOfWeek)
    .sort((a, b) => b[1] - a[1])
    .forEach(([day, count]) => console.log(`     ${day}: ${count}`));
    
  // 5. Final verdict
  console.log(chalk.blue.bold('\n📊 VERDICT:\n'));
  
  const isReal = 
    (lastSeasonCount || 0) > 100 && // Should have 200+ games per season
    (dayOfWeek['Sunday'] || 0) > (dayOfWeek['Wednesday'] || 0) && // Most games on Sunday
    teams && teams.length > 0; // Have actual team names
    
  if (isReal) {
    console.log(chalk.green('✅ Games appear to be REAL NFL data'));
  } else {
    console.log(chalk.red('❌ Games appear to be FAKE/SYNTHETIC data'));
    console.log(chalk.yellow('\nReasons:'));
    if ((lastSeasonCount || 0) < 100) console.log('  - Too few games for a full season');
    if (!teams || teams.length === 0) console.log('  - No real team names mapped to IDs');
    if ((dayOfWeek['Sunday'] || 0) <= (dayOfWeek['Wednesday'] || 0)) console.log('  - Game schedule doesnt match NFL pattern');
  }
}

checkGamesJuly2025().catch(console.error);