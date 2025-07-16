#!/usr/bin/env tsx
/**
 * Find where athletes are in NBA API
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findAthletes() {
  console.log(chalk.bold.red('🔍 FINDING ATHLETES IN NBA API\n'));
  
  // Get one game
  const { data: game } = await supabase
    .from('games')
    .select('external_id')
    .or('sport_id.eq.nba,sport_id.eq.NBA')
    .eq('status', 'completed')
    .limit(1)
    .single();
    
  if (!game || !game.external_id?.startsWith('espn_nba_')) return;
  
  const gameId = game.external_id.replace('espn_nba_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
  
  const response = await axios.get(url);
  
  if (response.data.boxscore?.teams?.[0]?.statistics) {
    const stats = response.data.boxscore.teams[0].statistics;
    
    console.log('Checking all statistics groups:\n');
    
    stats.forEach((group: any, index: number) => {
      console.log(`Group ${index}: ${group.name}`);
      console.log(`  - Has athletes: ${!!group.athletes}`);
      console.log(`  - Athletes count: ${group.athletes?.length || 0}`);
      
      if (group.athletes?.length > 0) {
        console.log(`  - First athlete: ${group.athletes[0].athlete?.displayName}`);
      }
      console.log('');
    });
  }
  
  // Also check boxscore.players structure
  console.log('\nChecking boxscore.players:');
  if (response.data.boxscore?.players) {
    console.log('- Has players:', true);
    console.log('- Players length:', response.data.boxscore.players.length);
    
    if (response.data.boxscore.players[0]) {
      const teamData = response.data.boxscore.players[0];
      console.log('\nFirst team in players:');
      console.log('- Team name:', teamData.team?.displayName);
      console.log('- Has statistics:', !!teamData.statistics);
      
      if (teamData.statistics?.[0]) {
        console.log('- First stat group:', teamData.statistics[0].name);
        console.log('- Has athletes:', !!teamData.statistics[0].athletes);
        console.log('- Athletes count:', teamData.statistics[0].athletes?.length || 0);
      }
    }
  }
}

findAthletes().catch(console.error);