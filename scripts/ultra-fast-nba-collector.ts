import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PlayerStat {
  player_id: number;
  game_id: number;
  stat_type: string;
  stat_value: string;
}

const playerCache = new Map<string, number>();

function extractStandardizedEspnId(externalId: string): string | null {
  const patterns = [
    /espn_nba_(\d+)$/,
    /nba_(\d+)$/,
    /^(\d+)$/
  ];
  
  for (const pattern of patterns) {
    const match = externalId.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

async function getOrCreatePlayer(espnPlayerId: string, playerName: string, teamId: number): Promise<number> {
  const standardizedId = `espn_nba_${espnPlayerId}`;
  
  // Check cache first
  if (playerCache.has(standardizedId)) {
    return playerCache.get(standardizedId)!;
  }
  
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('external_id', standardizedId)
    .single();
  
  if (existing) {
    playerCache.set(standardizedId, existing.id);
    return existing.id;
  }
  
  const { data: newPlayer, error } = await supabase
    .from('players')
    .insert({
      external_id: standardizedId,
      name: playerName,
      firstname: playerName.split(' ')[0] || '',
      lastname: playerName.split(' ').slice(1).join(' ') || '',
      team_id: teamId,
      sport: 'NBA',
      sport_id: 'nba',
      status: 'active'
    })
    .select('id')
    .single();
  
  if (error) throw error;
  
  playerCache.set(standardizedId, newPlayer.id);
  return newPlayer.id;
}

async function scrapeGameFast(game: any): Promise<{ success: boolean; stats: number }> {
  const espnId = extractStandardizedEspnId(game.external_id);
  if (!espnId) return { success: false, stats: 0 };
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 8000
    });

    const stats: PlayerStat[] = [];
    const data = response.data;
    
    if (data.boxscore?.players) {
      let teamIndex = 0;
      for (const team of data.boxscore.players) {
        if (!team.statistics?.[0]?.athletes) continue;
        
        const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
        teamIndex++;
        
        for (const athlete of team.statistics[0].athletes) {
          if (!athlete.stats || athlete.stats.length === 0) continue;
          
          try {
            const playerId = await getOrCreatePlayer(
              athlete.athlete.id,
              athlete.athlete.displayName || 'Unknown',
              teamId
            );
            
            const statMapping: Record<number, string> = {
              0: 'minutes', 1: 'fieldGoalsMade', 2: 'fieldGoalsAttempted',
              3: 'threePtMade', 4: 'threePtAttempted', 5: 'freeThrowsMade',
              6: 'freeThrowsAttempted', 7: 'offensiveRebounds', 8: 'defensiveRebounds',
              9: 'rebounds', 10: 'assists', 11: 'steals', 12: 'blocks',
              13: 'turnovers', 14: 'personalFouls', 15: 'points', 16: 'plusMinus'
            };
            
            athlete.stats.forEach((value: string, index: number) => {
              if (statMapping[index] && value && value !== '0') {
                stats.push({
                  player_id: playerId,
                  game_id: game.id,
                  stat_type: statMapping[index],
                  stat_value: value
                });
              }
            });
          } catch (playerError) {
            // Skip player
          }
        }
      }
    }
    
    if (stats.length > 0) {
      // Bulk insert
      const { error } = await supabase
        .from('player_stats')
        .insert(stats);
      
      if (!error) {
        return { success: true, stats: stats.length };
      }
    }
    
    return { success: false, stats: 0 };
    
  } catch (error) {
    return { success: false, stats: 0 };
  }
}

async function ultraFastNBACollector() {
  console.log('⚡ ULTRA FAST NBA COLLECTOR - SKIP CHECKS, JUST COLLECT! ⚡\n');
  console.log('='.repeat(80));

  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`Starting: ${startingStats?.toLocaleString()} stats\n`);

  // Get ALL NBA games with scores, skip checking for existing stats
  console.log('🎯 Getting NBA games to process...\n');
  
  const { data: games, error } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('id', { ascending: false })  // Start with newest games
    .limit(500);  // Process 500 games

  if (error || !games) {
    console.error('Error:', error);
    return;
  }

  console.log(`Processing ${games.length} NBA games...\n`);

  let totalStats = 0;
  let successCount = 0;
  const batchSize = 20;  // Large batches
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    const batchNum = Math.floor(i/batchSize) + 1;
    const totalBatches = Math.ceil(games.length/batchSize);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches}:`);
    
    // Process in parallel
    const startTime = Date.now();
    const results = await Promise.all(batch.map(scrapeGameFast));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    const batchStats = results.reduce((sum, r) => sum + r.stats, 0);
    const batchSuccess = results.filter(r => r.success).length;
    
    totalStats += batchStats;
    successCount += batchSuccess;
    
    console.log(`  ✅ ${batchSuccess}/${batch.length} games | ${batchStats} stats | ${elapsed}s`);
    console.log(`  📊 Total: ${successCount} games, ${totalStats.toLocaleString()} stats`);
    
    // Brief rate limit
    if (i + batchSize < games.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Final stats
  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log('\n🏆 COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Processed: ${games.length} games`);
  console.log(`Successful: ${successCount} games`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`\nDatabase growth: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`Net gain: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats`);
}

ultraFastNBACollector().catch(console.error);