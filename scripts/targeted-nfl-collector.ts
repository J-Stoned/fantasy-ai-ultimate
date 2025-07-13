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

function extractEspnId(externalId: string): string | null {
  const patterns = [
    /espn_nfl_(\d+)$/,
    /nfl_(\d+)$/,
    /espn_(\d+)(?:_alt)?$/,
    /^(\d+)$/
  ];
  
  for (const pattern of patterns) {
    const match = externalId.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

async function getOrCreatePlayer(espnPlayerId: string, playerName: string, teamId: number): Promise<number> {
  const standardizedId = `espn_nfl_${espnPlayerId}`;
  
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
      sport: 'NFL',
      sport_id: 'nfl',
      status: 'active'
    })
    .select('id')
    .single();
  
  if (error) throw error;
  
  playerCache.set(standardizedId, newPlayer.id);
  return newPlayer.id;
}

async function scrapeNFLGame(game: any): Promise<{ success: boolean; stats: number }> {
  const espnId = extractEspnId(game.external_id);
  if (!espnId) return { success: false, stats: 0 };
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`;
    
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
        const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
        teamIndex++;
        
        // NFL has different stat categories
        const categories = ['passing', 'rushing', 'receiving', 'defensive', 'kicking'];
        
        for (const category of categories) {
          const categoryData = team.statistics?.find((s: any) => s.name?.toLowerCase() === category);
          if (!categoryData?.athletes) continue;
          
          for (const athlete of categoryData.athletes) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            try {
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName || 'Unknown',
                teamId
              );
              
              // Map stats based on category
              const statMappings: Record<string, Record<number, string>> = {
                passing: {
                  0: 'completions', 1: 'attempts', 2: 'passingYards',
                  3: 'yardsPerAttempt', 4: 'passingTouchdowns', 5: 'interceptions',
                  6: 'sacks', 7: 'QBRating', 8: 'passerRating'
                },
                rushing: {
                  0: 'rushingAttempts', 1: 'rushingYards', 2: 'yardsPerCarry',
                  3: 'rushingTouchdowns', 4: 'longRush'
                },
                receiving: {
                  0: 'receptions', 1: 'receivingYards', 2: 'yardsPerReception',
                  3: 'receivingTouchdowns', 4: 'longReception', 5: 'targets'
                },
                defensive: {
                  0: 'totalTackles', 1: 'soloTackles', 2: 'sacks',
                  3: 'tacklesForLoss', 4: 'passesDefended', 5: 'QBHits',
                  6: 'interceptions', 7: 'forcedFumbles', 8: 'fumbleRecoveries'
                },
                kicking: {
                  0: 'fieldGoalsMade', 1: 'fieldGoalsAttempted', 2: 'fieldGoalPct',
                  3: 'longFieldGoal', 4: 'extraPointsMade', 5: 'extraPointsAttempted'
                }
              };
              
              const mapping = statMappings[category] || {};
              
              athlete.stats.forEach((value: string, index: number) => {
                if (mapping[index] && value && value !== '0' && value !== '-' && value !== '--') {
                  stats.push({
                    player_id: playerId,
                    game_id: game.id,
                    stat_type: mapping[index],
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
    }
    
    if (stats.length > 0) {
      const { error } = await supabase
        .from('player_stats')
        .insert(stats);
      
      if (!error) {
        return { success: true, stats: stats.length };
      }
    }
    
    return { success: false, stats: 0 };
    
  } catch (error: any) {
    return { success: false, stats: 0 };
  }
}

async function targetedNFLCollector() {
  console.log('🏈 TARGETED NFL STATS COLLECTOR 🏈\n');
  console.log('='.repeat(80));
  console.log('NFL needs 1,212 more games for 95% coverage\n');

  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`Starting: ${startingStats?.toLocaleString()} stats\n`);

  // Get NFL games without stats
  const { data: games, error } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or('sport.eq.NFL,sport_id.eq.nfl')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('id', { ascending: false })
    .limit(300); // Process 300 games

  if (error || !games) {
    console.error('Error:', error);
    return;
  }

  console.log(`Processing ${games.length} NFL games...\n`);

  let totalStats = 0;
  let successCount = 0;
  const batchSize = 10;
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    const batchNum = Math.floor(i/batchSize) + 1;
    const totalBatches = Math.ceil(games.length/batchSize);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches}:`);
    
    const startTime = Date.now();
    const results = await Promise.all(batch.map(scrapeNFLGame));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    const batchStats = results.reduce((sum, r) => sum + r.stats, 0);
    const batchSuccess = results.filter(r => r.success).length;
    
    totalStats += batchStats;
    successCount += batchSuccess;
    
    console.log(`  ✅ ${batchSuccess}/${batch.length} games | ${batchStats} stats | ${elapsed}s`);
    console.log(`  📊 Total: ${successCount} games, ${totalStats.toLocaleString()} stats`);
    
    if (i + batchSize < games.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log('\n🏆 NFL COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Processed: ${games.length} games`);
  console.log(`Successful: ${successCount} games`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`\nDatabase growth: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`Net gain: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats`);
}

targetedNFLCollector().catch(console.error);