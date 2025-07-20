#!/usr/bin/env tsx
/**
 * 🏀 FIX NBA COLLEGE TEAMS
 * 
 * Move college basketball teams from NBA to NCAA_BB
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The 30 actual NBA teams
const REAL_NBA_TEAMS = [
  'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
  'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors',
  'Houston Rockets', 'Indiana Pacers', 'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies',
  'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
  'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', '76ers', 'Phoenix Suns',
  'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors',
  'Utah Jazz', 'Washington Wizards'
];

async function fixNBATeams() {
  console.log(chalk.cyan('🏀 FIXING NBA COLLEGE TEAMS\n'));
  
  // 1. Get all current NBA teams
  const { data: nbaTeams, error } = await supabase
    .from('teams')
    .select('id, name, sport')
    .eq('sport', 'NBA');
  
  if (error) {
    console.error(chalk.red('Error fetching teams:'), error);
    return;
  }
  
  console.log(chalk.blue(`Found ${nbaTeams?.length || 0} teams marked as NBA`));
  
  // 2. Separate real NBA from college
  const realNBA = [];
  const collegeTeams = [];
  
  nbaTeams?.forEach(team => {
    // Check if it's a real NBA team
    const isRealNBA = REAL_NBA_TEAMS.some(nbaTeam => 
      team.name.includes(nbaTeam) || nbaTeam.includes(team.name)
    );
    
    if (isRealNBA) {
      realNBA.push(team);
    } else {
      collegeTeams.push(team);
    }
  });
  
  console.log(chalk.green(`✅ ${realNBA.length} real NBA teams`));
  console.log(chalk.yellow(`⚠️  ${collegeTeams.length} college teams to fix`));
  
  // Show some examples
  console.log(chalk.gray('\nCollege teams to move to NCAA_BB:'));
  collegeTeams.slice(0, 10).forEach(team => {
    console.log(chalk.gray(`  - ${team.name}`));
  });
  if (collegeTeams.length > 10) {
    console.log(chalk.gray(`  ... and ${collegeTeams.length - 10} more`));
  }
  
  // 3. Update college teams to NCAA_BB
  if (collegeTeams.length > 0) {
    console.log(chalk.blue('\nUpdating college teams to NCAA_BB...'));
    
    const teamIds = collegeTeams.map(t => t.id);
    
    const { error: updateError } = await supabase
      .from('teams')
      .update({ sport: 'NCAA_BB' })
      .in('id', teamIds);
    
    if (updateError) {
      console.error(chalk.red('Error updating teams:'), updateError);
    } else {
      console.log(chalk.green(`✅ Updated ${collegeTeams.length} teams from NBA to NCAA_BB`));
    }
  }
  
  // 4. Verify the fix
  const { data: verifyNBA } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NBA');
  
  const { data: verifyNCAA } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NCAA_BB');
  
  console.log(chalk.cyan('\n📊 FINAL COUNTS:'));
  console.log(chalk.green(`NBA teams: ${verifyNBA?.length || 0} (should be 30)`));
  console.log(chalk.green(`NCAA_BB teams: ${verifyNCAA?.length || 0}`));
  
  // 5. List remaining NBA teams
  if (verifyNBA?.length === 30) {
    console.log(chalk.green('\n✅ NBA teams fixed! All 30 teams present.'));
  } else {
    const { data: remainingNBA } = await supabase
      .from('teams')
      .select('name, abbreviation')
      .eq('sport', 'NBA')
      .order('name');
    
    console.log(chalk.blue('\nRemaining NBA teams:'));
    remainingNBA?.forEach(team => {
      console.log(chalk.gray(`  ${team.name} (${team.abbreviation})`));
    });
  }
}

fixNBATeams()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });