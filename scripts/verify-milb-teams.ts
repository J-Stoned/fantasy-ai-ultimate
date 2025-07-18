import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MILB_LEVELS = [
  { name: 'Triple-A', code: 'MILB_AAA', sportId: 11 },
  { name: 'Double-A', code: 'MILB_AA', sportId: 12 },
  { name: 'High-A', code: 'MILB_A+', sportId: 13 },
  { name: 'Single-A', code: 'MILB_A', sportId: 14 },
  { name: 'Rookie', code: 'MILB_ROOKIE', sportId: 16 }
];

async function verifyMiLBTeams() {
  console.log(chalk.cyan('🔍 Verifying MiLB Team Collection\n'));
  
  // Check what we have in the database
  const { data: dbTeams } = await supabase
    .from('teams')
    .select('external_id, name, league_level')
    .eq('sport', 'MILB')
    .order('league_level');
    
  const dbTeamsByLevel = dbTeams?.reduce((acc: any, team: any) => {
    if (!acc[team.league_level]) acc[team.league_level] = [];
    acc[team.league_level].push(team);
    return acc;
  }, {});
  
  console.log(chalk.yellow('Current database totals:'));
  Object.entries(dbTeamsByLevel || {}).forEach(([level, teams]: [string, any]) => {
    console.log(`  ${level}: ${teams.length} teams`);
  });
  
  // Now let's check the API for all available teams
  console.log(chalk.cyan('\n🔄 Checking MLB API for complete team lists...\n'));
  
  for (const level of MILB_LEVELS) {
    console.log(chalk.yellow(`\nChecking ${level.name} (Sport ID: ${level.sportId})...`));
    
    try {
      // Get teams for 2024 season (most current complete season)
      const response = await axios.get(
        `https://statsapi.mlb.com/api/v1/teams?sportId=${level.sportId}&season=2024`
      );
      
      const apiTeams = response.data.teams || [];
      const dbLevelTeams = dbTeamsByLevel?.[level.name] || [];
      
      console.log(chalk.blue(`  API has: ${apiTeams.length} teams`));
      console.log(chalk.green(`  DB has: ${dbLevelTeams.length} teams`));
      
      if (apiTeams.length > dbLevelTeams.length) {
        console.log(chalk.red(`  ⚠️  Missing ${apiTeams.length - dbLevelTeams.length} teams!`));
        
        // Find missing teams
        const dbIds = new Set(dbLevelTeams.map((t: any) => t.external_id.replace('mlb_milb_', '')));
        const missingTeams = apiTeams.filter((t: any) => !dbIds.has(t.id.toString()));
        
        console.log(chalk.yellow('  Missing teams:'));
        missingTeams.forEach((team: any) => {
          console.log(`    - ${team.name} (ID: ${team.id})`);
        });
      } else {
        console.log(chalk.green('  ✅ All teams collected!'));
      }
      
      // Also check historical seasons for team changes
      const historicalYears = [2021, 2022, 2023, 2025];
      for (const year of historicalYears) {
        const histResponse = await axios.get(
          `https://statsapi.mlb.com/api/v1/teams?sportId=${level.sportId}&season=${year}`
        );
        const histTeams = histResponse.data.teams || [];
        if (histTeams.length > 0) {
          console.log(chalk.gray(`    ${year}: ${histTeams.length} teams`));
        }
      }
      
    } catch (error: any) {
      console.error(chalk.red(`  Error checking ${level.name}:`, error.message));
    }
  }
  
  // Summary
  console.log(chalk.cyan('\n\n📊 SUMMARY:'));
  const totalDb = Object.values(dbTeamsByLevel || {}).reduce((sum: number, teams: any) => sum + teams.length, 0);
  console.log(chalk.green(`Total teams in database: ${totalDb}`));
  
  // Typical MiLB structure:
  console.log(chalk.yellow('\nTypical MiLB structure:'));
  console.log('  Triple-A: 30 teams (one per MLB org)');
  console.log('  Double-A: 30 teams');
  console.log('  High-A: 30 teams');
  console.log('  Single-A: 30 teams');
  console.log('  Rookie: 50-100+ teams (complex leagues, DSL, etc.)');
  console.log(chalk.green('\nTotal expected: ~170-220+ teams'));
}

verifyMiLBTeams().catch(console.error);