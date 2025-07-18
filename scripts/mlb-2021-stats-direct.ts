#!/usr/bin/env tsx
/**
 * 🚀 MLB 2021 STATS DIRECT COLLECTOR
 * 
 * Collects stats and creates/updates players on the fly
 * Handles ESPN ID mismatches between roster and game APIs
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Performance settings
const CONCURRENT_HTTP = 20;
const BATCH_SIZE = 50;
const DB_BATCH_SIZE = 500;

const httpLimit = pLimit(CONCURRENT_HTTP);

console.log(chalk.cyan('⚾ MLB 2021 STATS DIRECT COLLECTOR'));
console.log(chalk.gray(`   CPU: ${os.cpus().length} cores`));
console.log(chalk.gray(`   RAM: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`));
console.log(chalk.gray(`   Concurrent HTTP: ${CONCURRENT_HTTP}`));

async function collectMLBStats() {
  const startTime = Date.now();
  
  console.log(chalk.blue('\n📊 Loading MLB 2021 games...'));
  
  // Load all MLB 2021 games
  let allGames: any[] = [];
  let offset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id')
      .eq('sport', 'MLB')
      .eq('metadata->>season', '2021')
      .range(offset, offset + 999)
      .order('id');
      
    if (!batch || batch.length === 0) break;
    allGames = allGames.concat(batch);
    offset += batch.length;
    process.stdout.write(`\r  Games loaded: ${allGames.length}`);
    if (batch.length < 1000) break;
  }
  
  console.log(chalk.green(`\n✅ Loaded ${allGames.length} games`));
  
  // Load teams for mapping
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'MLB');
    
  const teamMap = new Map(
    teams?.map(t => [t.external_id.split('_').pop(), t.id]) || []
  );
  
  // Progress tracking
  const multiBar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: ' {bar} | {percentage}% | {value}/{total} | {duration_formatted} | {description}'
  }, cliProgress.Presets.shades_grey);
  
  const mainBar = multiBar.create(allGames.length, 0, { description: 'Total Progress' });
  const httpBar = multiBar.create(allGames.length, 0, { description: 'HTTP Requests' });
  const statsBar = multiBar.create(allGames.length, 0, { description: 'Stats Found  ' });
  
  // Process games in batches
  const allStats: any[] = [];
  const playerCache = new Map<string, number>(); // ESPN ID -> DB ID cache
  let httpCompleted = 0;
  let gamesWithStats = 0;
  
  // MLB stat mappings
  const MLB_STAT_MAP: Record<string, Record<string, string>> = {
    'batting': {
      'AB': 'at_bats',
      'R': 'runs',
      'H': 'hits',
      '2B': 'doubles',
      '3B': 'triples',
      'HR': 'home_runs',
      'RBI': 'rbi',
      'BB': 'walks',
      'K': 'strikeouts',
      'AVG': 'batting_avg',
      'OBP': 'on_base_pct',
      'SLG': 'slugging_pct',
      'OPS': 'ops',
      'SB': 'stolen_bases',
      'CS': 'caught_stealing'
    },
    'pitching': {
      'IP': 'innings_pitched',
      'H': 'hits_allowed',
      'R': 'runs_allowed',
      'ER': 'earned_runs',
      'BB': 'walks_allowed',
      'K': 'strikeouts',
      'HR': 'home_runs_allowed',
      'ERA': 'era',
      'WHIP': 'whip',
      'W': 'wins',
      'L': 'losses',
      'SV': 'saves',
      'BS': 'blown_saves',
      'HLD': 'holds'
    }
  };
  
  // Process in chunks
  for (let i = 0; i < allGames.length; i += BATCH_SIZE) {
    const chunk = allGames.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      chunk.map(game => 
        httpLimit(async () => {
          try {
            const gameId = game.external_id.split('_').pop();
            const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`;
            
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;
            
            if (!data.boxscore?.players) {
              httpCompleted++;
              httpBar.update(httpCompleted);
              return;
            }
            
            let gameStats = 0;
            
            for (const team of data.boxscore.players) {
              const espnTeamId = team.team?.id;
              const teamId = teamMap.get(String(espnTeamId));
              if (!teamId) continue;
              
              const isHome = team.homeAway === 'home';
              const opponentId = isHome ? game.away_team_id : game.home_team_id;
              
              for (const statGroup of team.statistics || []) {
                const groupType = (statGroup.type || '').toLowerCase();
                if (!['batting', 'pitching'].includes(groupType)) continue;
                
                const labels = statGroup.labels || statGroup.names || [];
                const mapping = MLB_STAT_MAP[groupType] || {};
                
                for (const athlete of statGroup.athletes || []) {
                  const espnPlayerId = athlete.athlete?.id;
                  const playerName = athlete.athlete?.displayName;
                  if (!espnPlayerId || !playerName) continue;
                  
                  // Get or create player
                  let dbPlayerId = playerCache.get(espnPlayerId);
                  if (!dbPlayerId) {
                    // Try to find existing player
                    const gameApiExternalId = `espn_mlb_${espnPlayerId}`;
                    const { data: existingPlayer } = await supabase
                      .from('players')
                      .select('id')
                      .eq('external_id', gameApiExternalId)
                      .single();
                      
                    if (existingPlayer) {
                      dbPlayerId = existingPlayer.id;
                    } else {
                      // Create new player with game API ID
                      const newPlayer = {
                        external_id: gameApiExternalId,
                        name: playerName,
                        firstname: athlete.athlete?.firstName || playerName.split(' ')[0],
                        lastname: athlete.athlete?.lastName || playerName.split(' ').slice(1).join(' '),
                        sport: 'MLB',
                        team_id: teamId,
                        position: [athlete.athlete?.position?.abbreviation || 'UNKNOWN'],
                        jersey_number: parseInt(athlete.athlete?.jersey) || null,
                        status: 'active',
                        metadata: {
                          created_from: 'game_api',
                          espn_game_id: espnPlayerId
                        }
                      };
                      
                      const { data: inserted, error } = await supabase
                        .from('players')
                        .insert(newPlayer)
                        .select('id')
                        .single();
                        
                      if (inserted) {
                        dbPlayerId = inserted.id;
                      } else if (error?.code === '23505') {
                        // Duplicate key - try to fetch again
                        const { data: existing } = await supabase
                          .from('players')
                          .select('id')
                          .eq('external_id', gameApiExternalId)
                          .single();
                        if (existing) dbPlayerId = existing.id;
                      }
                    }
                    
                    if (dbPlayerId) {
                      playerCache.set(espnPlayerId, dbPlayerId);
                    }
                  }
                  
                  if (!dbPlayerId) continue;
                  
                  // Parse stats
                  const statValues = athlete.stats || [];
                  const stats: any = {};
                  
                  labels.forEach((label: string, index: number) => {
                    const value = statValues[index];
                    if (value !== undefined && value !== null && value !== '') {
                      const mappedKey = mapping[label] || label.toLowerCase().replace(/\s+/g, '_');
                      stats[mappedKey] = value;
                    }
                  });
                  
                  if (Object.keys(stats).length === 0) continue;
                  
                  allStats.push({
                    player_id: dbPlayerId,
                    game_id: game.id,
                    team_id: teamId,
                    opponent_id: opponentId,
                    game_date: new Date(game.start_time).toISOString().split('T')[0],
                    is_home: isHome,
                    stats: stats,
                    fantasy_points: 0,
                    metadata: {
                      sport: 'MLB',
                      stat_group: groupType,
                      collection_source: 'mlb-2021-direct'
                    }
                  });
                  
                  gameStats++;
                }
              }
            }
            
            if (gameStats > 0) {
              gamesWithStats++;
              statsBar.update(gamesWithStats);
            }
            
            httpCompleted++;
            httpBar.update(httpCompleted);
          } catch (error: any) {
            if (error.response?.status !== 404) {
              if (error.code !== 'ECONNABORTED') {
                console.error(chalk.red(`\nError game ${game.id}:`), error.message);
              }
            }
            httpCompleted++;
            httpBar.update(httpCompleted);
          }
        })
      )
    );
    
    mainBar.update(i + chunk.length);
  }
  
  multiBar.stop();
  
  // Insert all stats in batches
  if (allStats.length > 0) {
    console.log(chalk.yellow(`\n📊 Inserting ${allStats.length} stats...`));
    
    for (let i = 0; i < allStats.length; i += DB_BATCH_SIZE) {
      const batch = allStats.slice(i, i + DB_BATCH_SIZE);
      
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(batch, {
          onConflict: 'player_id,game_id',
          ignoreDuplicates: true
        });
        
      if (error && !error.message.includes('duplicate key')) {
        console.error(chalk.red('DB Error:'), error.message);
      }
      
      process.stdout.write(`\r  Inserted: ${Math.min(i + DB_BATCH_SIZE, allStats.length)}/${allStats.length}`);
    }
  }
  
  // Summary
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(chalk.green(`\n\n✅ MLB 2021 STATS COLLECTION COMPLETE!`));
  console.log(chalk.blue(`📊 Total stats collected: ${allStats.length}`));
  console.log(chalk.blue(`📊 Games with stats: ${gamesWithStats}/${allGames.length}`));
  console.log(chalk.blue(`👥 Unique players: ${playerCache.size}`));
  console.log(chalk.blue(`⏱️  Time: ${Math.round(elapsed)}s`));
  console.log(chalk.blue(`🚀 Speed: ${Math.round(allStats.length / elapsed)} stats/sec`));
}

collectMLBStats().catch(console.error);