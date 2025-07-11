#!/usr/bin/env tsx
/**
 * 🔧 FIX NBA TEAM MAPPINGS - Correct team IDs in NBA games
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Correct NBA team mappings (old_id -> correct_id)
const teamMappings: Record<number, number> = {
  // These will be populated after analysis
};

async function fixNBATeamMappings() {
  console.log(chalk.bold.cyan('\n🔧 FIXING NBA TEAM MAPPINGS\n'));
  
  try {
    // 1. Get all NBA teams with sport_id='nba'
    const { data: nbaTeams } = await supabase
      .from('teams')
      .select('*')
      .eq('sport_id', 'nba')
      .order('name');
    
    if (!nbaTeams) {
      console.error('Failed to fetch NBA teams');
      return;
    }
    
    console.log(chalk.green(`Found ${nbaTeams.length} NBA teams`));
    
    // 2. Find duplicate Thunder teams specifically
    const thunderTeams = nbaTeams.filter(t => 
      t.name.includes('Thunder') || t.name === 'Thunder'
    );
    
    console.log(chalk.yellow('\nThunder teams:'));
    thunderTeams.forEach(team => {
      console.log(`  ID: ${team.id}, Name: "${team.name}", External: ${team.external_id}`);
    });
    
    // The correct Thunder team should be the one with external_id
    const correctThunder = thunderTeams.find(t => t.external_id === 'espn_nba_25') || 
                          thunderTeams.find(t => t.name === 'Thunder');
    
    if (correctThunder) {
      console.log(chalk.green(`\nCorrect Thunder team: ID ${correctThunder.id}`));
      
      // Map incorrect to correct
      thunderTeams.forEach(team => {
        if (team.id !== correctThunder.id) {
          teamMappings[team.id] = correctThunder.id;
        }
      });
    }
    
    // 3. Check NBA games with wrong team IDs
    console.log(chalk.yellow('\nChecking NBA games...'));
    
    const { data: nbaGames } = await supabase
      .from('games')
      .select('*')
      .eq('sport_id', 'nba')
      .limit(100);
    
    if (!nbaGames) {
      console.error('Failed to fetch NBA games');
      return;
    }
    
    // Get all team IDs used in NBA games
    const teamIdsInGames = new Set<number>();
    nbaGames.forEach(game => {
      teamIdsInGames.add(game.home_team_id);
      teamIdsInGames.add(game.away_team_id);
    });
    
    // Check which team IDs are not NBA teams
    const nonNBATeamIds: number[] = [];
    const nbaTeamIds = new Set(nbaTeams.map(t => t.id));
    
    for (const teamId of teamIdsInGames) {
      if (!nbaTeamIds.has(teamId)) {
        nonNBATeamIds.push(teamId);
      }
    }
    
    console.log(chalk.red(`\nFound ${nonNBATeamIds.length} non-NBA team IDs in NBA games`));
    
    if (nonNBATeamIds.length > 0) {
      // Get info about these wrong teams
      const { data: wrongTeams } = await supabase
        .from('teams')
        .select('*')
        .in('id', nonNBATeamIds);
      
      console.log(chalk.red('\nWrong teams in NBA games:'));
      wrongTeams?.forEach(team => {
        console.log(`  ID: ${team.id}, Name: "${team.name}", Sport: ${team.sport_id}`);
      });
    }
    
    // 4. Count affected games
    let affectedGames = 0;
    for (const [oldId, newId] of Object.entries(teamMappings)) {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', 'nba')
        .or(`home_team_id.eq.${oldId},away_team_id.eq.${oldId}`);
      
      if (count) {
        affectedGames += count;
        console.log(`  Team ${oldId} -> ${newId}: ${count} games affected`);
      }
    }
    
    console.log(chalk.yellow(`\nTotal NBA games to fix: ${affectedGames}`));
    
    // 5. Fix the games
    if (affectedGames > 0) {
      console.log(chalk.cyan('\nFixing games...'));
      
      let fixed = 0;
      for (const [oldId, newId] of Object.entries(teamMappings)) {
        // Fix home team
        const { error: homeError, count: homeCount } = await supabase
          .from('games')
          .update({ home_team_id: parseInt(newId) })
          .eq('sport_id', 'nba')
          .eq('home_team_id', parseInt(oldId));
        
        if (!homeError && homeCount) {
          fixed += homeCount;
          console.log(`  Fixed ${homeCount} games with home_team_id ${oldId} -> ${newId}`);
        }
        
        // Fix away team
        const { error: awayError, count: awayCount } = await supabase
          .from('games')
          .update({ away_team_id: parseInt(newId) })
          .eq('sport_id', 'nba')
          .eq('away_team_id', parseInt(oldId));
        
        if (!awayError && awayCount) {
          fixed += awayCount;
          console.log(`  Fixed ${awayCount} games with away_team_id ${oldId} -> ${newId}`);
        }
      }
      
      console.log(chalk.green(`\n✅ Fixed ${fixed} game team references`));
    }
    
    // 6. Verify fix
    console.log(chalk.yellow('\nVerifying fix...'));
    
    const { data: verifyGames } = await supabase
      .from('games')
      .select('*')
      .eq('sport_id', 'nba')
      .limit(10);
    
    let allGood = true;
    for (const game of verifyGames || []) {
      if (!nbaTeamIds.has(game.home_team_id) || !nbaTeamIds.has(game.away_team_id)) {
        allGood = false;
        console.log(chalk.red(`Game ${game.id} still has wrong team IDs`));
      }
    }
    
    if (allGood) {
      console.log(chalk.green('✅ All checked NBA games now have correct team IDs!'));
    }
    
    // 7. Final check
    const { count: totalNBAGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nba')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null);
    
    console.log(chalk.bold.cyan(`\n📊 NBA 2024 Season: ${totalNBAGames} games total`));
    console.log(chalk.yellow('Ready to collect stats for the missing games!'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

fixNBATeamMappings();