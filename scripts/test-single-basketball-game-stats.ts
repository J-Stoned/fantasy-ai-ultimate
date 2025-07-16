#!/usr/bin/env tsx
/**
 * 🔍 TEST SINGLE BASKETBALL GAME STATS
 * Test stats extraction for one game
 */

import axios from 'axios';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSingleBasketballGameStats() {
  console.log(chalk.bold.blue('🔍 TEST SINGLE BASKETBALL GAME STATS\n'));
  
  // Get one completed game
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, metadata')
    .eq('sport', 'NCAA_BB')
    .in('status', ['STATUS_FINAL', 'Final'])
    .limit(1);
  
  const game = games![0];
  const espnId = game.external_id.replace('espn_ncaabb_', '');
  
  console.log(`Game: ${game.metadata?.home_team} vs ${game.metadata?.away_team}`);
  console.log(`Game ID: ${game.id}`);
  console.log(`ESPN ID: ${espnId}`);
  
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${espnId}`;
  const response = await axios.get(url);
  
  if (!response.data?.boxscore?.players) {
    console.log('❌ No boxscore.players found');
    return;
  }
  
  console.log('\n📊 STATS EXTRACTION:');
  
  let totalStats = 0;
  
  response.data.boxscore.players.forEach((teamData: any, teamIndex: number) => {
    console.log(`\nTeam ${teamIndex + 1}: ${teamData.team.displayName}`);
    
    if (!teamData.statistics || !Array.isArray(teamData.statistics)) {
      console.log('❌ No statistics array');
      return;
    }
    
    // Find the player statistics (usually first element)
    const playerStats = teamData.statistics[0];
    
    if (!playerStats.athletes || !Array.isArray(playerStats.athletes)) {
      console.log('❌ No athletes array');
      return;
    }
    
    console.log(`Found ${playerStats.athletes.length} players`);
    
    // Process first 3 players as sample
    playerStats.athletes.slice(0, 3).forEach((player: any) => {
      if (!player.athlete?.id) return;
      
      console.log(`\nPlayer: ${player.athlete.displayName} (ID: ${player.athlete.id})`);
      console.log(`Stats array: ${player.stats}`);
      
      // Map stats based on the keys array
      const stats: any = {};
      if (player.stats && Array.isArray(player.stats)) {
        playerStats.keys.forEach((key: string, index: number) => {
          const value = player.stats[index];
          console.log(`  ${key}: ${value}`);
          
          // Parse specific stats
          if (key === 'minutes') stats.minutes = parseFloat(value) || 0;
          if (key === 'points') stats.points = parseFloat(value) || 0;
          if (key === 'rebounds') stats.rebounds = parseFloat(value) || 0;
          if (key === 'assists') stats.assists = parseFloat(value) || 0;
          if (key === 'steals') stats.steals = parseFloat(value) || 0;
          if (key === 'blocks') stats.blocks = parseFloat(value) || 0;
          if (key === 'turnovers') stats.turnovers = parseFloat(value) || 0;
        });
      }
      
      console.log('Parsed stats:', stats);
      totalStats++;
    });
  });
  
  console.log(`\n✅ Total stats found: ${totalStats}`);
}

testSingleBasketballGameStats().catch(console.error);