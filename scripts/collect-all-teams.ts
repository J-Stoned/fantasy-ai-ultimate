#!/usr/bin/env tsx
/**
 * Collect ALL sports teams from ESPN
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ESPN_ENDPOINTS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams',
  ncaaf: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams',
  ncaab: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams'
};

async function collectAllTeams() {
  console.log(chalk.blue.bold('🏆 COLLECTING ALL SPORTS TEAMS\n'));
  
  const totals = {
    nfl: 0,
    nba: 0,
    mlb: 0,
    nhl: 0,
    ncaaf: 0,
    ncaab: 0
  };
  
  for (const [sport, endpoint] of Object.entries(ESPN_ENDPOINTS)) {
    console.log(chalk.yellow(`\nCollecting ${sport.toUpperCase()} teams...`));
    
    try {
      const response = await axios.get(endpoint);
      const leagues = response.data.sports?.[0]?.leagues || [];
      
      for (const league of leagues) {
        for (const team of league.teams || []) {
          const teamData = {
            id: team.team.id,
            name: team.team.displayName,
            city: team.team.location || team.team.displayName.split(' ')[0],
            abbreviation: team.team.abbreviation,
            sport_id: sport,
            league_id: sport.toUpperCase(),
            logo_url: team.team.logos?.[0]?.href || null,
            metadata: {
              nickname: team.team.nickname,
              color: team.team.color,
              alternateColor: team.team.alternateColor,
              conference: league.name,
              division: team.team.groups?.[0]?.name || null
            }
          };
          
          const { error } = await supabase
            .from('teams')
            .upsert(teamData, { onConflict: 'id' });
            
          if (!error) {
            totals[sport as keyof typeof totals]++;
          } else {
            console.error(`Error inserting ${team.team.displayName}:`, error.message);
          }
        }
      }
      
      console.log(chalk.green(`   ✓ Added ${totals[sport as keyof typeof totals]} ${sport.toUpperCase()} teams`));
      
      // Small delay between sports
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      console.error(chalk.red(`Error collecting ${sport}:`), error.message);
    }
  }
  
  // Summary
  console.log(chalk.green.bold('\n✅ COLLECTION COMPLETE!\n'));
  console.log(chalk.white('Teams collected by sport:'));
  
  Object.entries(totals).forEach(([sport, count]) => {
    if (count > 0) {
      console.log(`  ${sport.toUpperCase()}: ${count} teams`);
    }
  });
  
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(chalk.cyan(`\nTOTAL: ${grandTotal} teams across all sports`));
}

collectAllTeams().catch(console.error);