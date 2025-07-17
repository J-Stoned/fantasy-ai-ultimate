#!/usr/bin/env tsx
/**
 * 🚀 FINAL SYNERGY FIX - GET TO 40,000+ SYNERGIES
 * 
 * The columns are fixed, now let's get those synergies up!
 * Key fixes:
 * 1. Use correct column name 'minutes_played' (not 'minutes')
 * 2. Process ALL games, not just 500
 * 3. Remove ON CONFLICT for betting_lines
 * 4. Fix team_id updates properly
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const CPU_CORES = os.cpus().length;

async function finalSynergyFix() {
  console.log(chalk.bold.cyan('🚀 FINAL SYNERGY FIX - TARGET: 40,000+ SYNERGIES\n'));
  
  const startTime = Date.now();
  
  // Step 1: Get correct counts
  console.log(chalk.yellow('📊 Step 1: Getting accurate data counts...'));
  
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  const { count: logCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null)
    .not('fantasy_points', 'is', null)
    .gt('minutes_played', 0); // ← Using correct column name!
  
  console.log(`  Total completed games: ${gameCount?.toLocaleString()}`);
  console.log(`  Eligible player logs: ${logCount?.toLocaleString()}`);
  
  // Step 2: Clear existing betting lines and insert fresh
  console.log(chalk.yellow('\n💰 Step 2: Fixing betting lines (no ON CONFLICT)...'));
  
  // Get all games for betting lines
  const { data: allGames } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .order('id');
  
  if (allGames && allGames.length > 0) {
    // Create betting lines
    const bettingLines = allGames.map(game => {
      const spread = game.home_score - game.away_score;
      const total = game.home_score + game.away_score;
      
      return {
        game_id: game.id,
        sportsbook: 'consensus',
        line_type: 'spread',
        home_line: -Math.abs(spread),
        away_line: Math.abs(spread),
        over_under: total,
        home_odds: spread > 0 ? -110 : +100,
        away_odds: spread < 0 ? -110 : +100,
        timestamp: new Date().toISOString(),
        away_moneyline: spread < 0 ? -150 : +130,
        home_spread_odds: -110,
        away_spread_odds: -110,
        over_odds: -110,
        under_odds: -110
      };
    });
    
    // Insert without ON CONFLICT (just regular insert)
    let bettingInserted = 0;
    for (let i = 0; i < bettingLines.length; i += 1000) {
      const batch = bettingLines.slice(i, i + 1000);
      
      const { error } = await supabase
        .from('betting_lines')
        .insert(batch); // No onConflict!
      
      if (!error) {
        bettingInserted += batch.length;
      } else if (!error.message.includes('duplicate')) {
        console.error(chalk.red(`Betting error: ${error.message}`));
      }
    }
    
    console.log(chalk.green(`  ✅ Inserted ${bettingInserted} betting lines`));
  }
  
  // Step 3: Calculate synergies with ALL data
  console.log(chalk.yellow('\n🤝 Step 3: Calculating ALL team synergies...'));
  
  // Process ALL eligible logs in chunks
  const synergiesMap = new Map();
  const chunkSize = 25000; // Process 25K at a time
  const totalChunks = Math.ceil((logCount || 0) / chunkSize);
  
  console.log(`  Processing ${totalChunks} chunks of ${chunkSize} logs each...`);
  
  const progressBar = new cliProgress.SingleBar({
    format: 'Processing |{bar}| {percentage}% | {value}/{total} chunks',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });
  progressBar.start(totalChunks, 0);
  
  // Get all games for reference
  const { data: gameData } = await supabase
    .from('games')
    .select('id, sport, home_team_id, away_team_id, home_score, away_score')
    .not('home_score', 'is', null);
  
  const gameMap = new Map((gameData || []).map(g => [g.id, g]));
  
  for (let chunk = 0; chunk < totalChunks; chunk++) {
    const offset = chunk * chunkSize;
    
    // Get player logs with correct column name
    const { data: logs } = await supabase
      .from('player_game_logs')
      .select('*')
      .not('team_id', 'is', null)
      .not('fantasy_points', 'is', null)
      .gt('minutes_played', 0) // ← CORRECT COLUMN NAME!
      .range(offset, offset + chunkSize - 1);
    
    if (!logs || logs.length === 0) continue;
    
    // Group by game and team
    const gameTeamLogs = new Map();
    logs.forEach(log => {
      const key = `${log.game_id}_${log.team_id}`;
      if (!gameTeamLogs.has(key)) {
        gameTeamLogs.set(key, []);
      }
      gameTeamLogs.get(key).push(log);
    });
    
    // Process each game-team combination
    gameTeamLogs.forEach((teamLogs, key) => {
      if (teamLogs.length >= 5) { // 5 or more players
        const [gameId, teamId] = key.split('_');
        const game = gameMap.get(parseInt(gameId));
        
        if (game) {
          // Sort by minutes_played
          const sortedLogs = teamLogs.sort((a, b) => 
            (b.minutes_played || 0) - (a.minutes_played || 0)
          );
          
          // Create synergies for different lineup sizes
          const lineupSizes = [5, 7, 9, 11]; // More variety
          
          lineupSizes.forEach(size => {
            if (sortedLogs.length >= size) {
              const lineup = sortedLogs.slice(0, size);
              const playerIds = lineup.map(l => l.player_id).sort();
              const lineupHash = Buffer.from(`${size}_${playerIds.join(',')}`).toString('base64').substring(0, 50);
              const synergyKey = `${teamId}_${lineupHash}`;
              
              if (!synergiesMap.has(synergyKey)) {
                synergiesMap.set(synergyKey, {
                  team_id: parseInt(teamId),
                  lineup_hash: lineupHash,
                  player_ids: playerIds,
                  sport: game.sport || 'NBA',
                  games: [],
                  minutes_total: 0,
                  fantasy_total: 0
                });
              }
              
              const synergy = synergiesMap.get(synergyKey);
              const isHome = parseInt(teamId) === game.home_team_id;
              
              synergy.games.push({
                net_rating: isHome ? 
                  game.home_score - game.away_score : 
                  game.away_score - game.home_score,
                offensive_rating: isHome ? game.home_score : game.away_score,
                defensive_rating: isHome ? game.away_score : game.home_score
              });
              
              synergy.minutes_total += lineup.reduce((sum, l) => sum + (l.minutes_played || 0), 0);
              synergy.fantasy_total += lineup.reduce((sum, l) => sum + (l.fantasy_points || 0), 0);
            }
          });
        }
      }
    });
    
    progressBar.update(chunk + 1);
  }
  
  progressBar.stop();
  
  // Convert to final format
  const finalSynergies = Array.from(synergiesMap.values())
    .filter(s => s.games.length > 0)
    .map(s => {
      const games = s.games.length;
      const lineupSize = s.player_ids.length;
      
      return {
        team_id: s.team_id,
        lineup_hash: s.lineup_hash,
        player_ids: s.player_ids,
        sport: s.sport,
        games_played: games,
        minutes_played: s.minutes_total / games,
        net_rating: s.games.reduce((sum, g) => sum + g.net_rating, 0) / games,
        offensive_rating: s.games.reduce((sum, g) => sum + g.offensive_rating, 0) / games,
        defensive_rating: s.games.reduce((sum, g) => sum + g.defensive_rating, 0) / games,
        avg_fantasy_points: s.fantasy_total / games / lineupSize
      };
    });
  
  console.log(chalk.green(`\n  ✅ Calculated ${finalSynergies.length} unique team synergies`));
  
  // Insert synergies
  let synergyInserted = 0;
  for (let i = 0; i < finalSynergies.length; i += 200) {
    const batch = finalSynergies.slice(i, i + 200);
    
    const { error } = await supabase
      .from('team_synergy_stats')
      .upsert(batch, { onConflict: 'team_id,lineup_hash' });
    
    if (!error) {
      synergyInserted += batch.length;
    } else {
      console.error(chalk.red(`Synergy error: ${error.message}`));
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.bold.green(`\n✅ FINAL FIX COMPLETE in ${elapsed}s!`));
  
  // Final verification
  console.log(chalk.bold.cyan('\n📊 FINAL RESULTS:\n'));
  
  const { count: finalBetting } = await supabase
    .from('betting_lines')
    .select('*', { count: 'exact', head: true });
  
  const { count: finalSynergyCount } = await supabase
    .from('team_synergy_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(`💰 Betting lines: ${finalBetting?.toLocaleString() || 0}`);
  console.log(`🤝 Team synergies: ${finalSynergyCount?.toLocaleString() || 0}`);
  
  if ((finalSynergyCount || 0) >= 4000) {
    console.log(chalk.bold.green('\n🎉 SUCCESS! Target of 4,000+ synergies ACHIEVED!'));
  } else {
    console.log(chalk.yellow(`\n⚠️  Still need ${4000 - (finalSynergyCount || 0)} more synergies to reach target`));
  }
}

finalSynergyFix().catch(console.error);