#!/usr/bin/env tsx
/**
 * 🧹 CLEAN DUPLICATE TEAMS - Fix the team mapping chaos
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TeamIssue {
  id: number;
  name: string;
  sport_id: string;
  issue: string;
  action: string;
}

async function cleanDuplicateTeams() {
  console.log(chalk.bold.cyan('\n🧹 CLEANING DUPLICATE TEAMS\n'));
  
  try {
    // 1. Find all duplicate team names
    console.log(chalk.yellow('Finding duplicate teams...'));
    
    const { data: allTeams } = await supabase
      .from('teams')
      .select('*')
      .order('name');
    
    if (!allTeams) {
      console.error('Failed to fetch teams');
      return;
    }
    
    // Group by name to find duplicates
    const teamsByName = new Map<string, any[]>();
    
    allTeams.forEach(team => {
      const key = team.name.toLowerCase().trim();
      if (!teamsByName.has(key)) {
        teamsByName.set(key, []);
      }
      teamsByName.get(key)!.push(team);
    });
    
    // Find problematic teams
    const issues: TeamIssue[] = [];
    const duplicates: any[] = [];
    
    teamsByName.forEach((teams, name) => {
      if (teams.length > 1) {
        // Multiple teams with same name
        duplicates.push(...teams);
        
        // Find the correct one (usually the one with matching sport_id)
        teams.forEach(team => {
          // Check if sport matches the name
          const isNBATeam = name.includes('lakers') || name.includes('celtics') || 
                           name.includes('warriors') || name.includes('thunder') ||
                           name.includes('heat') || name.includes('knicks') ||
                           name.includes('bulls') || name.includes('spurs');
          
          const isNFLTeam = name.includes('seahawks') || name.includes('cowboys') ||
                           name.includes('patriots') || name.includes('packers') ||
                           name.includes('steelers') || name.includes('49ers');
          
          if ((isNBATeam && team.sport_id !== 'nba') || 
              (isNFLTeam && team.sport_id !== 'nfl')) {
            issues.push({
              id: team.id,
              name: team.name,
              sport_id: team.sport_id,
              issue: `Wrong sport: ${team.name} marked as ${team.sport_id}`,
              action: 'update_sport'
            });
          }
        });
      }
    });
    
    console.log(chalk.red(`\nFound ${duplicates.length} duplicate team entries`));
    console.log(chalk.yellow(`Found ${issues.length} teams with wrong sport_id\n`));
    
    // 2. Show some examples
    console.log(chalk.cyan('Sample issues:'));
    issues.slice(0, 10).forEach(issue => {
      console.log(`  ${issue.id}: ${issue.name} (${issue.sport_id}) - ${issue.issue}`);
    });
    
    // 3. Check games affected
    console.log(chalk.yellow('\nChecking affected games...'));
    
    let affectedGames = 0;
    for (const issue of issues.slice(0, 5)) {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .or(`home_team_id.eq.${issue.id},away_team_id.eq.${issue.id}`);
      
      if (count && count > 0) {
        console.log(`  Team ${issue.id} (${issue.name}) used in ${count} games`);
        affectedGames += count;
      }
    }
    
    console.log(chalk.red(`\nTotal affected games (sample): ${affectedGames}+`));
    
    // 4. Analyze specific case: Thunder
    console.log(chalk.cyan('\n🔍 Case Study: Oklahoma City Thunder'));
    
    const thunderTeams = allTeams.filter(t => 
      t.name.toLowerCase().includes('thunder') || 
      t.name.toLowerCase().includes('oklahoma')
    );
    
    thunderTeams.forEach(team => {
      console.log(`  ID: ${team.id}, Name: ${team.name}, Sport: ${team.sport_id}, External: ${team.external_id}`);
    });
    
    // 5. Find the correct mappings
    console.log(chalk.yellow('\n📊 Correct Team Mappings:'));
    
    // NBA teams that should exist
    const nbaTeamNames = [
      'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets',
      'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
      'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
      'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat',
      'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
      'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns',
      'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors',
      'Utah Jazz', 'Washington Wizards'
    ];
    
    const correctNBATeams = allTeams.filter(team => 
      team.sport_id === 'nba' && 
      nbaTeamNames.some(name => team.name.toLowerCase().includes(name.toLowerCase()))
    );
    
    console.log(`Found ${correctNBATeams.length}/30 correct NBA teams`);
    
    // 6. Create fix plan
    console.log(chalk.bold.green('\n✅ FIX PLAN:'));
    console.log('1. Update games to use correct team IDs');
    console.log('2. Delete duplicate team entries');
    console.log('3. Ensure each NBA team has sport_id="nba"');
    console.log('4. Verify all 2024 NBA games have correct team references');
    
    // 7. Save analysis
    const report = {
      timestamp: new Date().toISOString(),
      totalTeams: allTeams.length,
      duplicateCount: duplicates.length,
      wrongSportCount: issues.length,
      nbaTeamsFound: correctNBATeams.length,
      issues: issues.slice(0, 50), // First 50 issues
      thunderTeams,
      recommendation: 'Run fix-team-mappings.ts to correct all issues'
    };
    
    require('fs').writeFileSync(
      './team-cleanup-analysis.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log(chalk.green('\n✅ Analysis saved to team-cleanup-analysis.json'));
    console.log(chalk.yellow('\nNext step: Create and run fix-team-mappings.ts'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

cleanDuplicateTeams();