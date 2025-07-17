#!/usr/bin/env tsx
/**
 * 🔧 CONSOLIDATE ALL TEAMS
 * 
 * Ensures all teams have ESPN IDs and removes duplicates
 * for NBA, MLB, and NHL
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

interface SportConfig {
  sport: string;
  espnPath: string;
  expectedCount: number;
}

const sportConfigs: SportConfig[] = [
  { sport: 'NBA', espnPath: 'basketball/nba', expectedCount: 30 },
  { sport: 'MLB', espnPath: 'baseball/mlb', expectedCount: 30 },
  { sport: 'NHL', espnPath: 'hockey/nhl', expectedCount: 32 }
];

async function consolidateSportTeams(config: SportConfig) {
  console.log(chalk.bold.cyan(`\n🏀 CONSOLIDATING ${config.sport} TEAMS`));
  console.log(chalk.gray('='.repeat(50)));
  
  try {
    // 1. Get ESPN teams
    const response = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/teams`);
    
    if (response.data.sports?.[0]?.leagues?.[0]?.teams) {
      const espnTeams = response.data.sports[0].leagues[0].teams;
      console.log(chalk.blue(`Found ${espnTeams.length} ${config.sport} teams from ESPN`));
      
      // 2. Upsert all ESPN teams
      const teams = espnTeams.map((espnTeam: any) => ({
        external_id: `espn_${config.sport.toLowerCase()}_${espnTeam.team.id}`,
        name: espnTeam.team.displayName,
        abbreviation: espnTeam.team.abbreviation,
        sport: config.sport,
        metadata: {
          location: espnTeam.team.location,
          color: espnTeam.team.color,
          alternateColor: espnTeam.team.alternateColor,
          logo: espnTeam.team.logos?.[0]?.href,
          conference: espnTeam.team.groups?.id,
          division: espnTeam.team.groups?.parent?.id
        }
      }));
      
      const { data, error } = await supabase
        .from('teams')
        .upsert(teams, { onConflict: 'external_id' })
        .select();
        
      if (error) {
        console.error(chalk.red(`Error upserting teams: ${error.message}`));
        return;
      }
      
      console.log(chalk.green(`✅ Upserted ${data?.length || 0} ${config.sport} teams`));
      
      // 3. Find and consolidate duplicates
      const { data: allTeams } = await supabase
        .from('teams')
        .select('id, name, external_id')
        .eq('sport', config.sport)
        .order('name');
        
      // Group by team name
      const teamsByName: Record<string, any[]> = {};
      allTeams?.forEach(team => {
        if (!teamsByName[team.name]) teamsByName[team.name] = [];
        teamsByName[team.name].push(team);
      });
      
      let consolidated = 0;
      
      for (const [name, teamList] of Object.entries(teamsByName)) {
        if (teamList.length > 1) {
          const keeperTeam = teamList.find(t => t.external_id);
          const oldTeams = teamList.filter(t => !t.external_id);
          
          if (keeperTeam && oldTeams.length > 0) {
            console.log(chalk.yellow(`  Consolidating ${name}...`));
            
            for (const oldTeam of oldTeams) {
              // Update all references
              await supabase.from('players').update({ team_id: keeperTeam.id }).eq('team_id', oldTeam.id);
              await supabase.from('player_game_logs').update({ team_id: keeperTeam.id }).eq('team_id', oldTeam.id);
              await supabase.from('games').update({ home_team_id: keeperTeam.id }).eq('home_team_id', oldTeam.id);
              await supabase.from('games').update({ away_team_id: keeperTeam.id }).eq('away_team_id', oldTeam.id);
              await supabase.from('team_synergy_stats').update({ team_id: keeperTeam.id }).eq('team_id', oldTeam.id);
              
              // Delete old team
              await supabase.from('teams').delete().eq('id', oldTeam.id);
              consolidated++;
            }
          }
        }
      }
      
      console.log(chalk.green(`✅ Consolidated ${consolidated} duplicate teams`));
      
      // 4. Final verification
      const { count: finalCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('sport', config.sport);
        
      const { count: withExternal } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('sport', config.sport)
        .not('external_id', 'is', null);
        
      console.log(chalk.cyan('\nFINAL STATUS:'));
      console.log(chalk.white(`  Total teams: ${finalCount}`));
      console.log(chalk.white(`  With ESPN IDs: ${withExternal}`));
      console.log(chalk.white(`  Expected: ${config.expectedCount}`));
      
      if (finalCount === withExternal && finalCount === config.expectedCount) {
        console.log(chalk.green(`  ✅ ${config.sport} teams ready!`));
      } else {
        console.log(chalk.yellow(`  ⚠️  Mismatch detected`));
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error processing ${config.sport}:`, error));
  }
}

async function consolidateAllTeams() {
  console.log(chalk.bold.cyan('🔧 CONSOLIDATING ALL TEAMS\n'));
  
  for (const config of sportConfigs) {
    await consolidateSportTeams(config);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
  
  console.log(chalk.bold.green('\n✅ TEAM CONSOLIDATION COMPLETE!'));
}

consolidateAllTeams().catch(console.error);