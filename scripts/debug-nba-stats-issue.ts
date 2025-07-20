#!/usr/bin/env tsx
/**
 * 🔍 DEBUG NBA STATS ISSUE
 * 
 * Figure out why NBA stats aren't being collected
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

async function debugNBAStats() {
  console.log(chalk.bold.cyan('🔍 DEBUG NBA STATS ISSUE\n'));
  
  // Get a sample game without stats
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .eq('metadata->>sport', 'NBA')
    .limit(500);
    
  const gameIdsWithStats = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .eq('sport', 'NBA')
    .eq('status', 'Final')
    .gte('start_time', '2021-10-19')
    .lte('start_time', '2022-06-16')
    .limit(10);
    
  const gameWithoutStats = sampleGames?.find(g => !gameIdsWithStats.has(g.id));
  
  if (!gameWithoutStats) {
    console.log(chalk.red('No games without stats found!'));
    return;
  }
  
  console.log(chalk.yellow(`Testing game: ${gameWithoutStats.external_id}\n`));
  
  // Load players and teams
  const { data: players } = await supabase
    .from('players')
    .select('id, external_id, name')
    .eq('sport', 'NBA')
    .limit(100);
    
  const playerMap = new Map(
    players?.map(p => [p.external_id, p]) || []
  );
  
  console.log(chalk.gray(`Loaded ${playerMap.size} sample players`));
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NBA');
    
  const teamMap = new Map(
    teams?.map(t => [t.external_id.split('_').pop(), t.id]) || []
  );
  
  // Make API call
  const gameId = gameWithoutStats.external_id.split('_').pop();
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
  
  console.log(chalk.gray(`\nFetching: ${url}\n`));
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = response.data;
    
    if (!data.boxscore) {
      console.log(chalk.red('❌ No boxscore in response!'));
      console.log(chalk.gray('Response keys:'), Object.keys(data));
      return;
    }
    
    if (!data.boxscore.players) {
      console.log(chalk.red('❌ No players in boxscore!'));
      console.log(chalk.gray('Boxscore keys:'), Object.keys(data.boxscore));
      return;
    }
    
    console.log(chalk.green(`✅ Found ${data.boxscore.players.length} teams\n`));
    
    // Analyze first team
    const team = data.boxscore.players[0];
    console.log(chalk.cyan(`Team: ${team.team.displayName} (ESPN ID: ${team.team.id})`));
    
    const teamId = teamMap.get(String(team.team.id));
    console.log(chalk.gray(`DB Team ID: ${teamId}`));
    
    if (!team.statistics || team.statistics.length === 0) {
      console.log(chalk.red('❌ No statistics array!'));
      return;
    }
    
    console.log(chalk.green(`✅ Found ${team.statistics.length} stat groups\n`));
    
    // Analyze first stat group
    const statGroup = team.statistics[0];
    console.log(chalk.cyan(`Stat Group: "${statGroup.name}"`));
    console.log(chalk.gray(`Type: ${statGroup.type}`));
    console.log(chalk.gray(`Labels:`, statGroup.labels || 'NO LABELS'));
    console.log(chalk.gray(`Keys:`, statGroup.keys || 'NO KEYS'));
    
    if (!statGroup.athletes || statGroup.athletes.length === 0) {
      console.log(chalk.red('❌ No athletes in stat group!'));
      return;
    }
    
    console.log(chalk.green(`✅ Found ${statGroup.athletes.length} athletes\n`));
    
    // Analyze first athlete
    const athlete = statGroup.athletes[0];
    console.log(chalk.cyan('First Athlete:'));
    console.log(chalk.gray(`  ID: ${athlete.athlete?.id}`));
    console.log(chalk.gray(`  Name: ${athlete.athlete?.displayName}`));
    console.log(chalk.gray(`  Position: ${athlete.athlete?.position?.abbreviation}`));
    
    // Check player mapping
    const playerExternalId = `espn_nba_${athlete.athlete?.id}`;
    const dbPlayer = playerMap.get(playerExternalId);
    
    if (dbPlayer) {
      console.log(chalk.green(`✅ Player found in DB: ${dbPlayer.name} (ID: ${dbPlayer.id})`));
    } else {
      console.log(chalk.red(`❌ Player NOT in map! Looking for: ${playerExternalId}`));
      
      // Check if player exists in DB
      const { data: playerCheck } = await supabase
        .from('players')
        .select('id, name')
        .eq('external_id', playerExternalId)
        .single();
        
      if (playerCheck) {
        console.log(chalk.yellow(`  ⚠️  Player exists in DB but not in our sample: ${playerCheck.name}`));
      } else {
        console.log(chalk.red(`  ❌ Player not in database at all!`));
      }
    }
    
    // Check stats array
    console.log(chalk.cyan('\nStats Array:'));
    if (!athlete.stats) {
      console.log(chalk.red('❌ No stats array!'));
    } else {
      console.log(chalk.green(`✅ Stats array length: ${athlete.stats.length}`));
      console.log(chalk.gray('Stats:', athlete.stats));
      
      if (athlete.stats.length < 15) {
        console.log(chalk.red(`❌ Not enough stats! Expected at least 15, got ${athlete.stats.length}`));
      } else {
        // Try parsing
        console.log(chalk.cyan('\nParsed stats:'));
        console.log(chalk.gray(`  Minutes: ${athlete.stats[0]}`));
        console.log(chalk.gray(`  FGM: ${athlete.stats[1]}`));
        console.log(chalk.gray(`  FGA: ${athlete.stats[2]}`));
        console.log(chalk.gray(`  Points: ${athlete.stats[19]}`));
      }
    }
    
    // Count how many athletes would generate stats
    let statsCount = 0;
    for (const sg of team.statistics) {
      for (const ath of sg.athletes || []) {
        if (ath.stats && ath.stats.length >= 15) {
          const pid = `espn_nba_${ath.athlete?.id}`;
          const { data: pCheck } = await supabase
            .from('players')
            .select('id')
            .eq('external_id', pid)
            .single();
            
          if (pCheck) {
            statsCount++;
          }
        }
      }
    }
    
    console.log(chalk.bold.yellow(`\n📊 This team would generate ${statsCount} stats`));
    
  } catch (error: any) {
    console.error(chalk.red('API Error:'), error.message);
    if (error.response) {
      console.error(chalk.red('Response status:'), error.response.status);
    }
  }
}

debugNBAStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });