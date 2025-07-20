#!/usr/bin/env tsx
/**
 * 🏈 FIX NFL COLLEGE TEAMS
 * 
 * Remove college football teams from NFL
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The 32 actual NFL teams
const REAL_NFL_TEAMS = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
  'Washington Football Team', 'Washington' // Include old names
];

async function fixNFLTeams() {
  console.log(chalk.cyan('🏈 FIXING NFL COLLEGE TEAMS\n'));
  
  // 1. Get all current NFL teams
  const { data: nflTeams, error } = await supabase
    .from('teams')
    .select('id, name, sport')
    .eq('sport', 'NFL');
  
  if (error) {
    console.error(chalk.red('Error fetching teams:'), error);
    return;
  }
  
  console.log(chalk.blue(`Found ${nflTeams?.length || 0} teams marked as NFL`));
  
  // 2. Separate real NFL from college
  const realNFL = [];
  const collegeTeams = [];
  
  nflTeams?.forEach(team => {
    // Check if it's a real NFL team
    const isRealNFL = REAL_NFL_TEAMS.some(nflTeam => 
      team.name.includes(nflTeam) || nflTeam.includes(team.name) ||
      team.name === nflTeam
    );
    
    if (isRealNFL) {
      realNFL.push(team);
    } else {
      // College teams often have these keywords
      if (team.name.includes('Lions') || team.name.includes('Eagles') || 
          team.name.includes('Panthers') || team.name.includes('Bears') ||
          team.name.includes('Cardinals') || team.name.includes('Raiders') ||
          team.name.includes('Cowboys') || team.name.includes('Falcons')) {
        // Check if it's NOT an NFL team
        const isCollegeTeam = team.name.includes('State') || 
                              team.name.includes('University') ||
                              team.name.includes('College') ||
                              team.name.includes('Tech') ||
                              team.name.includes('A&M') ||
                              team.name.includes('Central') ||
                              team.name.includes('Southern') ||
                              team.name.includes('Northern') ||
                              team.name.includes('Eastern') ||
                              team.name.includes('Western') ||
                              team.name.includes('Air Force') ||
                              team.name.includes('Army') ||
                              team.name.includes('Navy');
        
        if (isCollegeTeam || !REAL_NFL_TEAMS.some(nfl => team.name === nfl)) {
          collegeTeams.push(team);
        } else {
          realNFL.push(team);
        }
      } else {
        collegeTeams.push(team);
      }
    }
  });
  
  console.log(chalk.green(`✅ ${realNFL.length} real NFL teams`));
  console.log(chalk.yellow(`⚠️  ${collegeTeams.length} college teams to fix`));
  
  // Show some examples
  console.log(chalk.gray('\nCollege teams to move to NCAA_FB:'));
  collegeTeams.slice(0, 10).forEach(team => {
    console.log(chalk.gray(`  - ${team.name}`));
  });
  if (collegeTeams.length > 10) {
    console.log(chalk.gray(`  ... and ${collegeTeams.length - 10} more`));
  }
  
  // 3. Update college teams to NCAA_FB
  if (collegeTeams.length > 0) {
    console.log(chalk.blue('\nUpdating college teams to NCAA_FB...'));
    
    const teamIds = collegeTeams.map(t => t.id);
    
    const { error: updateError } = await supabase
      .from('teams')
      .update({ sport: 'NCAA_FB' })
      .in('id', teamIds);
    
    if (updateError) {
      console.error(chalk.red('Error updating teams:'), updateError);
    } else {
      console.log(chalk.green(`✅ Updated ${collegeTeams.length} teams from NFL to NCAA_FB`));
    }
  }
  
  // 4. Verify the fix
  const { data: verifyNFL } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NFL');
  
  const { data: verifyNCAA } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NCAA_FB');
  
  console.log(chalk.cyan('\n📊 FINAL COUNTS:'));
  console.log(chalk.green(`NFL teams: ${verifyNFL?.length || 0} (should be 32)`));
  console.log(chalk.green(`NCAA_FB teams: ${verifyNCAA?.length || 0}`));
  
  // 5. List remaining NFL teams
  if (verifyNFL?.length === 32) {
    console.log(chalk.green('\n✅ NFL teams fixed! All 32 teams present.'));
  } else {
    const { data: remainingNFL } = await supabase
      .from('teams')
      .select('name, abbreviation')
      .eq('sport', 'NFL')
      .order('name');
    
    console.log(chalk.blue('\nRemaining NFL teams:'));
    remainingNFL?.forEach(team => {
      console.log(chalk.gray(`  ${team.name} (${team.abbreviation})`));
    });
  }
}

fixNFLTeams()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });