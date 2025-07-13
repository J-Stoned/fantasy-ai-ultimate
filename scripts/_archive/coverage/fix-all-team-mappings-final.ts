#!/usr/bin/env tsx
/**
 * 🔧 FIX ALL TEAM MAPPINGS FINAL - The ultimate team fix
 * This will fix ALL sports team mappings once and for all
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TeamMapping {
  oldId: number;
  newId: number;
  oldName: string;
  newName: string;
  sport: string;
}

async function fixAllTeamMappingsFinal() {
  console.log(chalk.bold.cyan('\n🔧 FIXING ALL TEAM MAPPINGS - FINAL SOLUTION\n'));
  
  const fixes: TeamMapping[] = [];
  let totalFixed = 0;
  
  try {
    // 1. Get all sports and their games
    const sports = ['nfl', 'nba', 'mlb', 'nhl'];
    
    for (const sport of sports) {
      console.log(chalk.bold.yellow(`\n📊 Checking ${sport.toUpperCase()} games...`));
      
      // Get all teams for this sport
      const { data: validTeams } = await supabase
        .from('teams')
        .select('*')
        .eq('sport_id', sport);
      
      if (!validTeams) continue;
      
      const validTeamIds = new Set(validTeams.map(t => t.id));
      console.log(`Found ${validTeams.length} valid ${sport.toUpperCase()} teams`);
      
      // Get all games for this sport
      const { data: games } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id')
        .eq('sport_id', sport);
      
      if (!games) continue;
      
      // Find games with invalid team IDs
      const invalidTeamIds = new Set<number>();
      const affectedGames = new Map<number, number[]>();
      
      for (const game of games) {
        const invalidIds = [];
        
        if (!validTeamIds.has(game.home_team_id)) {
          invalidTeamIds.add(game.home_team_id);
          invalidIds.push(game.home_team_id);
        }
        
        if (!validTeamIds.has(game.away_team_id)) {
          invalidTeamIds.add(game.away_team_id);
          invalidIds.push(game.away_team_id);
        }
        
        if (invalidIds.length > 0) {
          affectedGames.set(game.id, invalidIds);
        }
      }
      
      if (invalidTeamIds.size === 0) {
        console.log(chalk.green(`✅ All ${sport.toUpperCase()} games have valid team IDs!`));
        continue;
      }
      
      console.log(chalk.red(`Found ${invalidTeamIds.size} invalid team IDs in ${affectedGames.size} games`));
      
      // Get info about invalid teams
      const { data: invalidTeams } = await supabase
        .from('teams')
        .select('*')
        .in('id', Array.from(invalidTeamIds));
      
      // Create smart mappings
      for (const invalidTeam of invalidTeams || []) {
        // Try to find the correct team by name/city matching
        let bestMatch = null;
        let bestScore = 0;
        
        for (const validTeam of validTeams) {
          const score = calculateMatchScore(invalidTeam, validTeam);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = validTeam;
          }
        }
        
        if (bestMatch && bestScore > 0.5) {
          fixes.push({
            oldId: invalidTeam.id,
            newId: bestMatch.id,
            oldName: invalidTeam.name,
            newName: bestMatch.name,
            sport: sport
          });
          
          console.log(chalk.cyan(`  Mapping: ${invalidTeam.name} (${invalidTeam.id}) → ${bestMatch.name} (${bestMatch.id})`));
        } else {
          console.log(chalk.red(`  No match found for: ${invalidTeam.name} (${invalidTeam.id})`));
        }
      }
    }
    
    // 2. Apply all fixes
    if (fixes.length > 0) {
      console.log(chalk.bold.cyan(`\n🔧 Applying ${fixes.length} team mappings...`));
      
      for (const fix of fixes) {
        // Update home teams
        const { count: homeCount } = await supabase
          .from('games')
          .update({ home_team_id: fix.newId })
          .eq('sport_id', fix.sport)
          .eq('home_team_id', fix.oldId);
        
        if (homeCount) {
          totalFixed += homeCount;
          console.log(`  Fixed ${homeCount} games: ${fix.oldName} → ${fix.newName} (home)`);
        }
        
        // Update away teams
        const { count: awayCount } = await supabase
          .from('games')
          .update({ away_team_id: fix.newId })
          .eq('sport_id', fix.sport)
          .eq('away_team_id', fix.oldId);
        
        if (awayCount) {
          totalFixed += awayCount;
          console.log(`  Fixed ${awayCount} games: ${fix.oldName} → ${fix.newName} (away)`);
        }
      }
    }
    
    // 3. Final verification
    console.log(chalk.bold.yellow('\n📊 FINAL VERIFICATION:'));
    
    for (const sport of sports) {
      const { data: validTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('sport_id', sport);
      
      const validIds = new Set(validTeams?.map(t => t.id) || []);
      
      const { data: games } = await supabase
        .from('games')
        .select('id, home_team_id, away_team_id')
        .eq('sport_id', sport)
        .limit(100);
      
      let invalid = 0;
      for (const game of games || []) {
        if (!validIds.has(game.home_team_id) || !validIds.has(game.away_team_id)) {
          invalid++;
        }
      }
      
      if (invalid === 0) {
        console.log(chalk.green(`${sport.toUpperCase()}: ✅ All games have valid teams!`));
      } else {
        console.log(chalk.red(`${sport.toUpperCase()}: ❌ ${invalid} games still have invalid teams`));
      }
    }
    
    // 4. Save fix report
    const report = {
      timestamp: new Date().toISOString(),
      fixes: fixes,
      totalFixed: totalFixed,
      summary: {
        mappingsCreated: fixes.length,
        gamesUpdated: totalFixed
      }
    };
    
    fs.writeFileSync('./team-mappings-fix-report.json', JSON.stringify(report, null, 2));
    
    console.log(chalk.bold.green(`\n✅ TEAM MAPPINGS FIXED!`));
    console.log(`Total mappings: ${fixes.length}`);
    console.log(`Games updated: ${totalFixed}`);
    console.log(`Report saved to: team-mappings-fix-report.json`);
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Calculate match score between teams
function calculateMatchScore(team1: any, team2: any): number {
  let score = 0;
  
  // Check city match
  if (team1.city && team2.city) {
    if (team1.city.toLowerCase() === team2.city.toLowerCase()) {
      score += 0.5;
    } else if (team1.city.toLowerCase().includes(team2.city.toLowerCase()) ||
               team2.city.toLowerCase().includes(team1.city.toLowerCase())) {
      score += 0.3;
    }
  }
  
  // Check name similarity
  const name1 = team1.name.toLowerCase();
  const name2 = team2.name.toLowerCase();
  
  // Extract team nickname (last word usually)
  const nick1 = name1.split(' ').pop() || '';
  const nick2 = name2.split(' ').pop() || '';
  
  if (nick1 === nick2) {
    score += 0.5;
  } else if (name1.includes(nick2) || name2.includes(nick1)) {
    score += 0.3;
  }
  
  // Check abbreviation
  if (team1.abbreviation && team2.abbreviation &&
      team1.abbreviation === team2.abbreviation) {
    score += 0.2;
  }
  
  return score;
}

// Run the fix
fixAllTeamMappingsFinal();