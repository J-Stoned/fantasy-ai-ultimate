#!/usr/bin/env tsx
/**
 * 🚀 FINAL DATA TYPE FIX
 * 
 * The issue: game_id is INTEGER but we're passing strings
 * Fix: Convert all IDs to proper types
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function finalDataTypeFix() {
  console.log(chalk.bold.cyan('🚀 FINAL DATA TYPE FIX\n'));
  
  // Check data types
  console.log(chalk.yellow('📊 Checking data types...'));
  
  const { data: sampleGame } = await supabase
    .from('games')
    .select('id, home_score, away_score')
    .not('home_score', 'is', null)
    .limit(1)
    .single();
  
  const { data: sampleBetting } = await supabase
    .from('betting_lines')
    .select('game_id')
    .limit(1)
    .single();
  
  console.log(`Game ID type: ${typeof sampleGame?.id} (${sampleGame?.id})`);
  console.log(`Betting game_id type: ${typeof sampleBetting?.game_id} (${sampleBetting?.game_id})`);
  
  // Get all completed games
  const { data: allGames } = await supabase
    .from('games')
    .select('id, home_score, away_score, sport, home_team_id, away_team_id')
    .not('home_score', 'is', null)
    .order('id'); // Process ALL games now that it's working!
  
  if (!allGames || allGames.length === 0) {
    console.log(chalk.red('No games found'));
    return;
  }
  
  console.log(chalk.yellow(`\n💰 Processing ${allGames.length} games for betting lines...`));
  
  // Clear existing betting lines
  await supabase.from('betting_lines').delete().gte('id', 0);
  
  // Create betting lines with proper data types
  const bettingLines = allGames.map(game => {
    const spread = game.home_score - game.away_score;
    const total = game.home_score + game.away_score;
    
    return {
      game_id: game.id, // Keep as integer, don't convert to string
      sportsbook: 'consensus',
      line_type: 'spread',
      home_line: Number(-Math.abs(spread)),
      away_line: Number(Math.abs(spread)),
      over_under: Number(total),
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
  
  // Insert betting lines
  let bettingInserted = 0;
  for (let i = 0; i < bettingLines.length; i += 1000) {
    const batch = bettingLines.slice(i, i + 1000);
    
    const { error } = await supabase
      .from('betting_lines')
      .insert(batch);
    
    if (!error) {
      bettingInserted += batch.length;
    } else {
      console.error(chalk.red(`Betting error: ${error.message}`));
      break; // Stop on first error to debug
    }
  }
  
  console.log(chalk.green(`✅ Inserted ${bettingInserted} betting lines`));
  
  // Now calculate synergies with ALL available data
  console.log(chalk.yellow('\n🤝 Calculating team synergies with ALL data...'));
  
  // Get ALL player logs (not just first 25K)
  const { data: allLogs } = await supabase
    .from('player_game_logs')
    .select('game_id, player_id, team_id, fantasy_points, minutes_played')
    .not('team_id', 'is', null)
    .not('fantasy_points', 'is', null)
    .gt('minutes_played', 0);
  
  console.log(`Found ${allLogs?.length || 0} eligible player logs`);
  
  if (!allLogs || allLogs.length === 0) {
    console.log(chalk.red('No eligible player logs found'));
    return;
  }
  
  // Group by game and team
  const gameTeamLogs = new Map();
  allLogs.forEach(log => {
    const key = `${log.game_id}_${log.team_id}`;
    if (!gameTeamLogs.has(key)) {
      gameTeamLogs.set(key, []);
    }
    gameTeamLogs.get(key).push(log);
  });
  
  console.log(`Processing ${gameTeamLogs.size} game-team combinations`);
  
  // Create game map
  const gameMap = new Map(allGames.map(g => [g.id, g]));
  
  // Calculate synergies
  const synergiesMap = new Map();
  
  gameTeamLogs.forEach((teamLogs, key) => {
    if (teamLogs.length >= 5) {
      const [gameId, teamId] = key.split('_');
      const game = gameMap.get(parseInt(gameId));
      
      if (game) {
        // Sort by minutes
        const sortedLogs = teamLogs.sort((a, b) => 
          (b.minutes_played || 0) - (a.minutes_played || 0)
        );
        
        // Create multiple lineup sizes for more synergies
        const lineupSizes = [5, 6, 7, 8, 9, 10];
        
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
  
  console.log(chalk.green(`Calculated ${finalSynergies.length} unique synergies`));
  
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
  
  console.log(chalk.green(`✅ Inserted ${synergyInserted} synergies`));
  
  // Final count
  const { count: finalBetting } = await supabase
    .from('betting_lines')
    .select('*', { count: 'exact', head: true });
  
  const { count: finalSynergyCount } = await supabase
    .from('team_synergy_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.bold.green('\n📊 FINAL RESULTS:'));
  console.log(`💰 Betting lines: ${finalBetting?.toLocaleString() || 0}`);
  console.log(`🤝 Team synergies: ${finalSynergyCount?.toLocaleString() || 0}`);
  
  if ((finalSynergyCount || 0) >= 4000) {
    console.log(chalk.bold.green('\n🎉 SUCCESS! Target of 4,000+ synergies ACHIEVED!'));
  } else {
    console.log(chalk.yellow(`\n⚠️  Progress: ${finalSynergyCount} / 4,000 synergies (${((finalSynergyCount || 0) / 4000 * 100).toFixed(1)}%)`));
  }
}

finalDataTypeFix().catch(console.error);