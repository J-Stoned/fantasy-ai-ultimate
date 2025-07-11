#!/usr/bin/env tsx
/**
 * ⚾ ADD MLB 2024 GAMES - Fill the missing 1,758 games!
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

async function addMLB2024Games() {
  console.log(chalk.bold.red('⚾ ADDING MLB 2024 GAMES TO DATABASE\n'));
  
  // MLB 2024 season: March 28 - October 31
  const startDate = new Date('2024-03-28');
  const endDate = new Date('2024-10-31');
  
  console.log(`Fetching games from ${startDate.toDateString()} to ${endDate.toDateString()}\n`);
  
  const teamCache = new Map<string, number>();
  
  // Load MLB teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport_id', 'mlb');
  
  teams?.forEach(team => {
    if (team.external_id) {
      const espnId = team.external_id.replace('espn_mlb_', '');
      teamCache.set(espnId, team.id);
    }
  });
  
  console.log(`Loaded ${teamCache.size} MLB teams\n`);
  
  const gamesToAdd = [];
  let totalGames = 0;
  let skipped = 0;
  
  // Fetch games day by day
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`;
      const response = await axios.get(url);
      
      if (response.data.events) {
        for (const event of response.data.events) {
          totalGames++;
          
          // Check if game already exists
          const { count: existing } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('external_id', `espn_mlb_${event.id}`);
          
          if (existing && existing > 0) {
            skipped++;
            continue;
          }
          
          const homeTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
          const awayTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
          
          const homeTeamId = teamCache.get(homeTeam.team.id);
          const awayTeamId = teamCache.get(awayTeam.team.id);
          
          if (!homeTeamId || !awayTeamId) {
            console.log(`Missing team mapping: ${homeTeam.team.displayName} vs ${awayTeam.team.displayName}`);
            continue;
          }
          
          gamesToAdd.push({
            external_id: `espn_mlb_${event.id}`,
            sport_id: 'mlb',
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_team_score: parseInt(homeTeam.score) || null,
            away_team_score: parseInt(awayTeam.score) || null,
            start_time: event.date,
            status: event.status.type.completed ? 'completed' : 'scheduled'
          });
        }
      }
      
      process.stdout.write(`\r${currentDate.toISOString().split('T')[0]}: ${totalGames} games found, ${gamesToAdd.length} to add, ${skipped} already exist`);
      
    } catch (error) {
      console.error(`\nError fetching ${currentDate.toISOString().split('T')[0]}:`, error.message);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`\n\nTotal games found: ${totalGames}`);
  console.log(`Games to add: ${gamesToAdd.length}`);
  console.log(`Already in database: ${skipped}`);
  
  // Insert games in batches
  if (gamesToAdd.length > 0) {
    console.log('\nInserting games...');
    const batchSize = 100;
    
    for (let i = 0; i < gamesToAdd.length; i += batchSize) {
      const batch = gamesToAdd.slice(i, i + batchSize);
      const { error } = await supabase
        .from('games')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting batch:', error);
      } else {
        console.log(`Inserted ${i + batch.length}/${gamesToAdd.length} games`);
      }
    }
  }
  
  console.log(chalk.green('\n✅ DONE! Now run the stats collector for these games.'));
}

addMLB2024Games().catch(console.error);