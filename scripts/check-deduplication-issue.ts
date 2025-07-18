#!/usr/bin/env tsx
/**
 * 🔍 CHECK DEDUPLICATION ISSUE
 * We're getting 80 raw stats but only 63 after deduplication
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

async function checkDeduplication() {
  console.log(chalk.bold.cyan('🔍 CHECKING DEDUPLICATION LOGIC\n'));

  // Get a sample game
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .limit(1)
    .single();

  if (!sampleGame) return;

  const espnGameId = sampleGame.external_id?.split('_').pop();
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
  
  const response = await axios.get(url);
  const gameData = response.data;

  // Track all stat entries BEFORE deduplication
  const allEntries: any[] = [];
  const playerStatGroups = new Map<string, Set<string>>();

  if (gameData.boxscore?.players) {
    for (const team of gameData.boxscore.players) {
      for (const statGroup of team.statistics || []) {
        const groupName = statGroup.name;
        
        for (const athlete of statGroup.athletes || []) {
          const playerId = `espn_nfl_${athlete.athlete?.id}`;
          const playerName = athlete.athlete?.displayName;
          
          // Track which groups each player appears in
          if (!playerStatGroups.has(playerId)) {
            playerStatGroups.set(playerId, new Set());
          }
          playerStatGroups.get(playerId)!.add(groupName);
          
          allEntries.push({
            playerId,
            playerName,
            statGroup: groupName,
            hasStats: athlete.stats && athlete.stats.length > 0
          });
        }
      }
    }
  }

  console.log(chalk.yellow(`Total raw entries: ${allEntries.length}`));
  console.log(chalk.yellow(`Unique players: ${playerStatGroups.size}\n`));

  // Show players in multiple groups
  console.log(chalk.cyan('Players in multiple stat groups:'));
  let multiGroupCount = 0;
  
  playerStatGroups.forEach((groups, playerId) => {
    if (groups.size > 1) {
      multiGroupCount++;
      const player = allEntries.find(e => e.playerId === playerId);
      console.log(chalk.gray(`  ${player?.playerName}: ${Array.from(groups).join(', ')}`));
    }
  });

  console.log(chalk.yellow(`\n${multiGroupCount} players appear in multiple groups`));

  // Calculate what we SHOULD have
  console.log(chalk.bold.cyan('\n📊 CALCULATION:'));
  console.log(`Raw entries: ${allEntries.length}`);
  console.log(`After deduplication: ${playerStatGroups.size} unique player/game combos`);
  console.log(`Current in DB: 63 stats/game`);
  console.log(`Target: 78 stats/game`);
  
  // The issue might be that we need to count each stat group appearance separately!
  console.log(chalk.bold.red('\n⚠️  INSIGHT:'));
  console.log('We might be over-deduplicating!');
  console.log('ESPN counts each stat group appearance as a separate "stat"');
  console.log('Example: A player who rushes AND receives = 2 stats, not 1');
  
  // Check our current deduplication
  const { data: currentStats } = await supabase
    .from('player_game_logs')
    .select('player_id, stats, metadata')
    .eq('game_id', sampleGame.id);

  console.log(chalk.yellow(`\n📊 Current DB stats for this game: ${currentStats?.length}`));
  
  // Count how many stat categories each player has
  let totalStatCategories = 0;
  currentStats?.forEach(stat => {
    const statKeys = Object.keys(stat.stats || {});
    // Group stat keys by category
    const categories = new Set<string>();
    statKeys.forEach(key => {
      if (key.includes('passing')) categories.add('passing');
      else if (key.includes('rushing')) categories.add('rushing');
      else if (key.includes('receiving')) categories.add('receiving');
      else if (key.includes('defensive') || key.includes('tackles') || key.includes('sacks')) categories.add('defensive');
      // ... etc
    });
    totalStatCategories += categories.size;
  });

  console.log(chalk.cyan(`\nIf we count by stat categories: ~${totalStatCategories} entries`));
  console.log(chalk.green(`\n✅ SOLUTION: We need to count players multiple times if they have stats in multiple categories!`));
}

checkDeduplication().catch(console.error);