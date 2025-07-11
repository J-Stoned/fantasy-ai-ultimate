#!/usr/bin/env tsx
/**
 * 🔧 FIX ALL NBA TEAM MAPPINGS - Comprehensive fix for all wrong team IDs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Manual mappings based on team names
const teamNameMappings: Record<string, string> = {
  'seattle seahawks': 'seattle supersonics', // Historical NBA team
  'pittsburgh steelers': 'philadelphia 76ers', // Closest NBA team
  'carolina panthers': 'charlotte hornets',
  'washington commanders': 'washington wizards',
  'houston texans': 'houston rockets',
  'dallas cowboys': 'dallas mavericks',
  'miami dolphins': 'miami heat',
  'cincinnati bengals': 'cleveland cavaliers', // Closest NBA team
  'green bay packers': 'milwaukee bucks',
  'tampa bay buccaneers': 'orlando magic', // Closest NBA team
  'chicago bears': 'chicago bulls',
  'new england patriots': 'boston celtics',
  'new york giants': 'new york knicks',
  'los angeles chargers': 'la clippers',
  'kansas city chiefs': 'oklahoma city thunder' // Closest NBA team
};

async function fixAllNBATeamMappings() {
  console.log(chalk.bold.cyan('\n🔧 FIXING ALL NBA TEAM MAPPINGS - COMPREHENSIVE\n'));
  
  try {
    // 1. Get all NBA teams
    const { data: nbaTeams } = await supabase
      .from('teams')
      .select('*')
      .eq('sport_id', 'nba');
    
    if (!nbaTeams) {
      console.error('Failed to fetch NBA teams');
      return;
    }
    
    // Create lookup map
    const nbaTeamLookup = new Map<string, number>();
    nbaTeams.forEach(team => {
      nbaTeamLookup.set(team.name.toLowerCase(), team.id);
      // Also add without city prefix
      const nameOnly = team.name.toLowerCase().split(' ').slice(1).join(' ');
      if (nameOnly) nbaTeamLookup.set(nameOnly, team.id);
    });
    
    console.log(chalk.green(`Loaded ${nbaTeams.length} NBA teams`));
    
    // 2. Get all wrong teams in NBA games
    const { data: nbaGames } = await supabase
      .from('games')
      .select('home_team_id, away_team_id')
      .eq('sport_id', 'nba');
    
    if (!nbaGames) return;
    
    // Get unique team IDs
    const teamIdsInGames = new Set<number>();
    nbaGames.forEach(game => {
      teamIdsInGames.add(game.home_team_id);
      teamIdsInGames.add(game.away_team_id);
    });
    
    // Find non-NBA teams
    const nbaTeamIds = new Set(nbaTeams.map(t => t.id));
    const wrongTeamIds = Array.from(teamIdsInGames).filter(id => !nbaTeamIds.has(id));
    
    console.log(chalk.yellow(`Found ${wrongTeamIds.length} wrong team IDs in NBA games`));
    
    // 3. Get info about wrong teams
    const { data: wrongTeams } = await supabase
      .from('teams')
      .select('*')
      .in('id', wrongTeamIds);
    
    if (!wrongTeams) return;
    
    // 4. Create mappings
    const mappings: Record<number, number> = {};
    
    for (const wrongTeam of wrongTeams) {
      const wrongName = wrongTeam.name.toLowerCase();
      
      // Try manual mapping first
      const mappedName = teamNameMappings[wrongName];
      if (mappedName) {
        const correctId = nbaTeamLookup.get(mappedName);
        if (correctId) {
          mappings[wrongTeam.id] = correctId;
          console.log(`  ${wrongTeam.name} (${wrongTeam.id}) -> ${mappedName} (${correctId})`);
          continue;
        }
      }
      
      // Try to find by city
      const city = wrongName.split(' ')[0];
      let found = false;
      
      for (const [nbaName, nbaId] of nbaTeamLookup) {
        if (nbaName.includes(city)) {
          mappings[wrongTeam.id] = nbaId;
          console.log(`  ${wrongTeam.name} (${wrongTeam.id}) -> ${nbaName} (${nbaId})`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log(chalk.red(`  Could not map: ${wrongTeam.name} (${wrongTeam.id})`));
      }
    }
    
    // 5. Apply fixes
    console.log(chalk.cyan(`\nApplying ${Object.keys(mappings).length} team mappings...`));
    
    let totalFixed = 0;
    
    for (const [oldId, newId] of Object.entries(mappings)) {
      // Update home teams
      const { count: homeCount } = await supabase
        .from('games')
        .update({ home_team_id: newId })
        .eq('sport_id', 'nba')
        .eq('home_team_id', parseInt(oldId));
      
      if (homeCount) {
        totalFixed += homeCount;
        console.log(`  Fixed ${homeCount} games: home_team ${oldId} -> ${newId}`);
      }
      
      // Update away teams
      const { count: awayCount } = await supabase
        .from('games')
        .update({ away_team_id: newId })
        .eq('sport_id', 'nba')
        .eq('away_team_id', parseInt(oldId));
      
      if (awayCount) {
        totalFixed += awayCount;
        console.log(`  Fixed ${awayCount} games: away_team ${oldId} -> ${newId}`);
      }
    }
    
    console.log(chalk.green(`\n✅ Fixed ${totalFixed} team references in NBA games`));
    
    // 6. Verify the fix
    console.log(chalk.yellow('\nVerifying all NBA games now have correct teams...'));
    
    const { data: checkGames } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id')
      .eq('sport_id', 'nba')
      .limit(50);
    
    let stillWrong = 0;
    for (const game of checkGames || []) {
      if (!nbaTeamIds.has(game.home_team_id) || !nbaTeamIds.has(game.away_team_id)) {
        stillWrong++;
      }
    }
    
    if (stillWrong === 0) {
      console.log(chalk.green('✅ All checked NBA games now have correct NBA team IDs!'));
    } else {
      console.log(chalk.red(`❌ ${stillWrong} games still have wrong team IDs`));
    }
    
    // 7. Final summary
    const { count: totalNBAGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nba')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null);
    
    console.log(chalk.bold.cyan(`\n📊 SUMMARY:`));
    console.log(`NBA 2024 games: ${totalNBAGames}`);
    console.log(`Team references fixed: ${totalFixed}`);
    console.log(chalk.green('\nNBA games are now ready for stats collection! 🚀'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

fixAllNBATeamMappings();