#!/usr/bin/env tsx
/**
 * 🔍 TEST BASKETBALL STATS SMALL BATCH
 * Test the fixed stats collector with just a few games
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

// Copy the stats functions from the main collector
async function fetchGameStats(gameId: string): Promise<any> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${gameId}`;
    const response = await axios.get(url);
    
    if (response.data?.boxscore?.players) {
      return {
        gameId,
        players: response.data.boxscore.players,
        teams: response.data.boxscore.teams || []
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function calculateBasketballFantasyPoints(stats: any): number {
  let points = 0;
  
  if (stats.points) points += stats.points * 1;
  if (stats.rebounds) points += stats.rebounds * 1.2;
  if (stats.assists) points += stats.assists * 1.5;
  if (stats.steals) points += stats.steals * 3;
  if (stats.blocks) points += stats.blocks * 3;
  if (stats.turnovers) points -= stats.turnovers * 1;
  if (stats.fieldGoalsMade) points += stats.fieldGoalsMade * 0.5;
  if (stats.threePointFieldGoalsMade) points += stats.threePointFieldGoalsMade * 0.5;
  
  return Math.round(points * 100) / 100;
}

async function testSmallBatch() {
  console.log(chalk.bold.blue('🔍 TEST BASKETBALL STATS SMALL BATCH\n'));
  
  // Get just 3 completed games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, metadata')
    .eq('sport', 'NCAA_BB')
    .in('status', ['STATUS_FINAL', 'Final'])
    .limit(3);
  
  console.log(`Testing ${games?.length} games\n`);
  
  // Get ALL players for lookup with pagination
  console.log('Loading all players...');
  const allPlayers = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('id, external_id, name')
      .eq('sport_id', 'NCAA_BB')
      .range(from, from + batchSize - 1);
    
    if (!data || data.length === 0) break;
    
    allPlayers.push(...data);
    from += batchSize;
    
    if (data.length < batchSize) break;
  }
  
  const playerLookup = new Map();
  allPlayers?.forEach(player => {
    const espnId = player.external_id.replace('espn_ncaabb_', '');
    playerLookup.set(espnId, player);
  });
  
  console.log(`Player lookup has ${playerLookup.size} players\n`);
  
  let totalStats = 0;
  
  for (const game of games || []) {
    const espnGameId = game.external_id.replace('espn_ncaabb_', '');
    console.log(`\n📊 Processing: ${game.metadata?.home_team} vs ${game.metadata?.away_team}`);
    
    const gameStats = await fetchGameStats(espnGameId);
    
    if (!gameStats) {
      console.log('❌ No stats found');
      continue;
    }
    
    let gameStatsCount = 0;
    
    gameStats.players.forEach((teamData: any, teamIndex: number) => {
      if (!teamData.statistics || !Array.isArray(teamData.statistics)) return;
      
      const playerStats = teamData.statistics[0];
      if (!playerStats.athletes || !Array.isArray(playerStats.athletes)) return;
      
      playerStats.athletes.forEach((playerStat: any) => {
        if (!playerStat.athlete?.id) return;
        
        const player = playerLookup.get(playerStat.athlete.id);
        if (!player) {
          console.log(`⚠️  Player not found: ${playerStat.athlete.displayName} (${playerStat.athlete.id})`);
          return;
        }
        
        // Extract stats
        const stats: any = {};
        if (playerStat.stats && Array.isArray(playerStat.stats)) {
          const fgParts = playerStat.stats[1]?.split('-') || ['0', '0'];
          const fg3Parts = playerStat.stats[2]?.split('-') || ['0', '0'];
          const ftParts = playerStat.stats[3]?.split('-') || ['0', '0'];
          
          stats.minutes = parseFloat(playerStat.stats[0]) || 0;
          stats.fieldGoalsMade = parseFloat(fgParts[0]) || 0;
          stats.fieldGoalsAttempted = parseFloat(fgParts[1]) || 0;
          stats.threePointFieldGoalsMade = parseFloat(fg3Parts[0]) || 0;
          stats.threePointFieldGoalsAttempted = parseFloat(fg3Parts[1]) || 0;
          stats.freeThrowsMade = parseFloat(ftParts[0]) || 0;
          stats.freeThrowsAttempted = parseFloat(ftParts[1]) || 0;
          stats.offensiveRebounds = parseFloat(playerStat.stats[4]) || 0;
          stats.defensiveRebounds = parseFloat(playerStat.stats[5]) || 0;
          stats.rebounds = parseFloat(playerStat.stats[6]) || 0;
          stats.assists = parseFloat(playerStat.stats[7]) || 0;
          stats.steals = parseFloat(playerStat.stats[8]) || 0;
          stats.blocks = parseFloat(playerStat.stats[9]) || 0;
          stats.turnovers = parseFloat(playerStat.stats[10]) || 0;
          stats.personalFouls = parseFloat(playerStat.stats[11]) || 0;
          stats.points = parseFloat(playerStat.stats[12]) || 0;
        }
        
        const fantasyPoints = calculateBasketballFantasyPoints(stats);
        
        console.log(`✅ ${player.name}: ${stats.points} pts, ${stats.rebounds} reb, ${stats.assists} ast = ${fantasyPoints} fantasy pts`);
        gameStatsCount++;
        totalStats++;
      });
    });
    
    console.log(`Found ${gameStatsCount} player stats for this game`);
  }
  
  console.log(`\n✅ Total stats found: ${totalStats}`);
}

testSmallBatch().catch(console.error);