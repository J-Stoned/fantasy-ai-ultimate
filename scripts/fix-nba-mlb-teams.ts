#!/usr/bin/env tsx
/**
 * 🔧 FIX NBA & MLB TEAMS
 * 
 * Fetches proper teams from ESPN and consolidates duplicates
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNBATeams() {
  console.log(chalk.bold.cyan('\n🏀 FIXING NBA TEAMS'));
  console.log(chalk.gray('='.repeat(50)));
  
  // Get ESPN NBA teams
  const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams');
  
  if (response.data.sports?.[0]?.leagues?.[0]?.teams) {
    const espnTeams = response.data.sports[0].leagues[0].teams;
    console.log(chalk.blue(`Found ${espnTeams.length} NBA teams from ESPN`));
    
    // First, upsert all ESPN teams
    for (const espnTeam of espnTeams) {
      const team = {
        external_id: `espn_nba_${espnTeam.team.id}`,
        name: espnTeam.team.displayName,
        abbreviation: espnTeam.team.abbreviation,
        sport: 'NBA',
        metadata: {
          location: espnTeam.team.location,
          color: espnTeam.team.color,
          logo: espnTeam.team.logos?.[0]?.href
        }
      };
      
      await supabase
        .from('teams')
        .upsert(team, { onConflict: 'external_id' });
    }
    
    // Now consolidate duplicates
    const { data: allNBATeams } = await supabase
      .from('teams')
      .select('id, name, external_id')
      .eq('sport', 'NBA');
      
    // Group by similar names
    const teamMap: Record<string, any[]> = {};
    allNBATeams?.forEach(team => {
      // Normalize name for matching
      const normalizedName = team.name.replace('LA ', 'Los Angeles ');
      if (!teamMap[normalizedName]) teamMap[normalizedName] = [];
      teamMap[normalizedName].push(team);
    });
    
    for (const [name, teams] of Object.entries(teamMap)) {
      if (teams.length > 1) {
        const keeper = teams.find(t => t.external_id);
        const oldTeams = teams.filter(t => !t.external_id);
        
        if (keeper && oldTeams.length > 0) {
          console.log(chalk.yellow(`  Consolidating ${name}...`));
          
          for (const old of oldTeams) {
            // Migrate all references
            await supabase.from('players').update({ team_id: keeper.id }).eq('team_id', old.id);
            await supabase.from('player_game_logs').update({ team_id: keeper.id }).eq('team_id', old.id);
            await supabase.from('games').update({ home_team_id: keeper.id }).eq('home_team_id', old.id);
            await supabase.from('games').update({ away_team_id: keeper.id }).eq('away_team_id', old.id);
            await supabase.from('team_synergy_stats').update({ team_id: keeper.id }).eq('team_id', old.id);
            
            // Delete old team
            await supabase.from('teams').delete().eq('id', old.id);
          }
        }
      }
    }
  }
}

async function fixMLBTeams() {
  console.log(chalk.bold.cyan('\n⚾ FIXING MLB TEAMS'));
  console.log(chalk.gray('='.repeat(50)));
  
  // Get ESPN MLB teams
  const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams');
  
  if (response.data.sports?.[0]?.leagues?.[0]?.teams) {
    const espnTeams = response.data.sports[0].leagues[0].teams;
    console.log(chalk.blue(`Found ${espnTeams.length} MLB teams from ESPN`));
    
    // Map of abbreviations to full names
    const abbrevMap: Record<string, string> = {
      'ATL': 'Atlanta Braves',
      'BOS': 'Boston Red Sox',
      'CHC': 'Chicago Cubs',
      'HOU': 'Houston Astros',
      'LAD': 'Los Angeles Dodgers',
      'NYM': 'New York Mets',
      'NYY': 'New York Yankees',
      'PHI': 'Philadelphia Phillies'
    };
    
    // First, upsert all ESPN teams
    for (const espnTeam of espnTeams) {
      const team = {
        external_id: `espn_mlb_${espnTeam.team.id}`,
        name: espnTeam.team.displayName,
        abbreviation: espnTeam.team.abbreviation,
        sport: 'MLB',
        metadata: {
          location: espnTeam.team.location,
          color: espnTeam.team.color,
          logo: espnTeam.team.logos?.[0]?.href
        }
      };
      
      await supabase
        .from('teams')
        .upsert(team, { onConflict: 'external_id' });
    }
    
    // Delete bad teams
    const badTeams = ['Alcorn State Braves']; // Not an MLB team
    for (const badName of badTeams) {
      await supabase.from('teams').delete().eq('name', badName).eq('sport', 'MLB');
    }
    
    // Fix abbreviated teams
    for (const [abbrev, fullName] of Object.entries(abbrevMap)) {
      const { data: abbrevTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('name', abbrev)
        .eq('sport', 'MLB')
        .single();
        
      const { data: fullTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('name', fullName)
        .eq('sport', 'MLB')
        .not('external_id', 'is', null)
        .single();
        
      if (abbrevTeam && fullTeam) {
        console.log(chalk.yellow(`  Merging ${abbrev} → ${fullName}...`));
        
        // Migrate references
        await supabase.from('players').update({ team_id: fullTeam.id }).eq('team_id', abbrevTeam.id);
        await supabase.from('player_game_logs').update({ team_id: fullTeam.id }).eq('team_id', abbrevTeam.id);
        await supabase.from('games').update({ home_team_id: fullTeam.id }).eq('home_team_id', abbrevTeam.id);
        await supabase.from('games').update({ away_team_id: fullTeam.id }).eq('away_team_id', abbrevTeam.id);
        await supabase.from('team_synergy_stats').update({ team_id: fullTeam.id }).eq('team_id', abbrevTeam.id);
        
        // Delete abbreviated team
        await supabase.from('teams').delete().eq('id', abbrevTeam.id);
      }
    }
    
    // Handle Oakland Athletics (might be listed as Oakland Athletics or Athletics)
    const { data: oaklandTeams } = await supabase
      .from('teams')
      .select('id, name, external_id')
      .eq('sport', 'MLB')
      .or('name.eq.Oakland Athletics,name.eq.Athletics');
      
    if (oaklandTeams && oaklandTeams.length > 1) {
      const keeper = oaklandTeams.find(t => t.external_id);
      const old = oaklandTeams.find(t => !t.external_id);
      
      if (keeper && old) {
        console.log(chalk.yellow(`  Consolidating Oakland Athletics...`));
        await supabase.from('teams').delete().eq('id', old.id);
      }
    }
  }
}

async function fixAllTeams() {
  console.log(chalk.bold.cyan('🔧 FIXING NBA & MLB TEAMS\n'));
  
  await fixNBATeams();
  await fixMLBTeams();
  
  // Final verification
  console.log(chalk.bold.cyan('\n\nFINAL STATUS:'));
  console.log(chalk.gray('='.repeat(50)));
  
  for (const sport of ['NFL', 'NBA', 'MLB', 'NHL']) {
    const { count: total } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: withEspn } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'is', null);
      
    const status = total === withEspn ? '✅' : '❌';
    console.log(chalk.white(`${status} ${sport}: ${total} teams (${withEspn} with ESPN IDs)`));
  }
}

fixAllTeams().catch(console.error);