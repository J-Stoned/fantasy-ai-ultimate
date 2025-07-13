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

interface SportConfig {
  sport: string;
  espnSport: string;
  statMapping: Record<number, string>;
}

const SPORT_CONFIGS: Record<string, SportConfig> = {
  NBA: {
    sport: 'NBA',
    espnSport: 'basketball/nba',
    statMapping: {
      0: 'minutes', 1: 'fieldGoalsMade', 2: 'fieldGoalsAttempted',
      3: 'threePtMade', 4: 'threePtAttempted', 5: 'freeThrowsMade',
      6: 'freeThrowsAttempted', 7: 'offensiveRebounds', 8: 'defensiveRebounds',
      9: 'rebounds', 10: 'assists', 11: 'steals', 12: 'blocks',
      13: 'turnovers', 14: 'personalFouls', 15: 'points', 16: 'plusMinus'
    }
  },
  NFL: {
    sport: 'NFL',
    espnSport: 'football/nfl',
    statMapping: {
      // Passing stats
      0: 'completions', 1: 'attempts', 2: 'passingYards', 3: 'passingTDs', 4: 'interceptions',
      // Rushing stats
      5: 'rushingAttempts', 6: 'rushingYards', 7: 'rushingTDs',
      // Receiving stats
      8: 'receptions', 9: 'receivingYards', 10: 'receivingTDs',
      // Defense
      11: 'tackles', 12: 'sacks', 13: 'forcedFumbles'
    }
  },
  NHL: {
    sport: 'NHL',
    espnSport: 'hockey/nhl',
    statMapping: {
      0: 'goals', 1: 'assists', 2: 'points', 3: 'plusMinus',
      4: 'penaltyMinutes', 5: 'shots', 6: 'hits', 7: 'blockedShots',
      8: 'powerPlayGoals', 9: 'powerPlayAssists', 10: 'shortHandedGoals',
      11: 'gameWinningGoals', 12: 'overtimeGoals', 13: 'faceoffsWon', 14: 'faceoffsLost'
    }
  },
  MLB: {
    sport: 'MLB',
    espnSport: 'baseball/mlb',
    statMapping: {
      // Batting
      0: 'atBats', 1: 'runs', 2: 'hits', 3: 'doubles', 4: 'triples',
      5: 'homeRuns', 6: 'RBIs', 7: 'walks', 8: 'strikeouts', 9: 'stolenBases',
      // Pitching
      10: 'inningsPitched', 11: 'earnedRuns', 12: 'strikeoutsPitching',
      13: 'walksPitching', 14: 'hitsPitching', 15: 'homeRunsPitching'
    }
  }
};

const playerCache = new Map<string, number>();

function extractStandardizedEspnId(externalId: string): string | null {
  const patterns = [
    /espn_[a-z]+_(\d+)$/,
    /[a-z]+_(\d+)$/,
    /^(\d+)$/
  ];
  
  for (const pattern of patterns) {
    const match = externalId.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

async function getOrCreatePlayer(
  espnPlayerId: string, 
  playerName: string, 
  teamId: number, 
  sport: string
): Promise<number> {
  const standardizedId = `espn_${sport.toLowerCase()}_${espnPlayerId}`;
  
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
      sport: sport,
      sport_id: sport.toLowerCase(),
      status: 'active'
    })
    .select('id')
    .single();
  
  if (error) throw error;
  
  playerCache.set(standardizedId, newPlayer.id);
  return newPlayer.id;
}

async function scrapeGameStats(
  game: any, 
  config: SportConfig
): Promise<{ success: boolean; stats: number }> {
  const espnId = extractStandardizedEspnId(game.external_id);
  if (!espnId) return { success: false, stats: 0 };
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${config.espnSport}/summary?event=${espnId}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 8000
    });

    const stats: PlayerStat[] = [];
    const data = response.data;
    
    // Handle different sport structures
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
              teamId,
              config.sport
            );
            
            athlete.stats.forEach((value: string, index: number) => {
              if (config.statMapping[index] && value && value !== '0' && value !== '-') {
                stats.push({
                  player_id: playerId,
                  game_id: game.id,
                  stat_type: config.statMapping[index],
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

async function collectSportStats(sport: string) {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    console.error(`No configuration for sport: ${sport}`);
    return;
  }

  console.log(`\n🏆 ${sport} STATS COLLECTION`);
  console.log('='.repeat(50));

  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  // Get games for this sport
  const { data: games, error } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or(`sport.eq.${sport},sport_id.eq.${sport.toLowerCase()}`)
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('id', { ascending: false })
    .limit(200); // Process 200 games per sport

  if (error || !games) {
    console.error('Error fetching games:', error);
    return;
  }

  console.log(`Found ${games.length} ${sport} games to process`);

  let totalStats = 0;
  let successCount = 0;
  const batchSize = 10;
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    const batchNum = Math.floor(i/batchSize) + 1;
    
    process.stdout.write(`\rBatch ${batchNum}: Processing...`);
    
    const results = await Promise.all(
      batch.map(game => scrapeGameStats(game, config))
    );
    
    const batchStats = results.reduce((sum, r) => sum + r.stats, 0);
    const batchSuccess = results.filter(r => r.success).length;
    
    totalStats += batchStats;
    successCount += batchSuccess;
    
    process.stdout.write(`\rBatch ${batchNum}: ${batchSuccess}/${batch.length} games, ${batchStats} stats`);
    
    if (i + batchSize < games.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`\n\n✅ ${sport} Collection Complete:`);
  console.log(`   Games processed: ${successCount}/${games.length}`);
  console.log(`   Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`   Database growth: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()}`);
}

async function universalSportsCollector() {
  console.log('🚀 UNIVERSAL SPORTS STATS COLLECTOR 🚀');
  console.log('Applying our proven collection system to all sports!\n');

  const { count: initialStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`Starting with ${initialStats?.toLocaleString()} total stats`);

  // Collect for each sport
  for (const sport of ['NBA', 'NFL', 'NHL', 'MLB']) {
    await collectSportStats(sport);
  }

  // Final report
  const { count: finalStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log('\n\n🏆 COLLECTION SUMMARY:');
  console.log('='.repeat(80));
  console.log(`Initial stats: ${initialStats?.toLocaleString()}`);
  console.log(`Final stats: ${finalStats?.toLocaleString()}`);
  console.log(`TOTAL ADDED: ${((finalStats || 0) - (initialStats || 0)).toLocaleString()}`);
  console.log('='.repeat(80));
}

universalSportsCollector().catch(console.error);