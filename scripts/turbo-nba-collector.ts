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

// Standardized ESPN ID extraction following our schema
function extractStandardizedEspnId(externalId: string): string | null {
  // Handle formats: "espn_nba_401267399", "nba_401267399", "401267399"
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

// Create or get player with standardized external_id
async function ensurePlayerExists(espnPlayerId: string, playerName: string, teamId: number): Promise<number> {
  const standardizedId = `espn_nba_${espnPlayerId}`;
  
  // Check if player exists
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('external_id', standardizedId)
    .single();
  
  if (existing) return existing.id;
  
  // Create new player with standardized ID
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
  
  if (error) {
    console.log(`    ⚠️  Failed to create player ${playerName}: ${error.message}`);
    throw error;
  }
  
  return newPlayer.id;
}

async function scrapeNBAGameStats(gameId: number, espnId: string, homeTeamId: number, awayTeamId: number): Promise<PlayerStat[]> {
  const stats: PlayerStat[] = [];
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`;
    console.log(`  🎯 Scraping game ${gameId} (ESPN: ${espnId})...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });

    const data = response.data;
    
    if (data.boxscore && data.boxscore.players) {
      let teamIndex = 0;
      for (const team of data.boxscore.players) {
        if (!team.statistics || !team.statistics[0] || !team.statistics[0].athletes) continue;
        
        const teamId = teamIndex === 0 ? awayTeamId : homeTeamId;
        teamIndex++;
        
        const athletes = team.statistics[0].athletes;
        for (const athlete of athletes) {
          if (!athlete.stats || athlete.stats.length === 0) continue;
          
          try {
            // Ensure player exists with standardized ID
            const playerId = await ensurePlayerExists(
              athlete.athlete.id,
              athlete.athlete.displayName || athlete.athlete.name || 'Unknown',
              teamId
            );
            
            // Parse stats array
            const statsArray = athlete.stats;
            const statMapping: Record<number, string> = {
              0: 'minutes',
              1: 'fieldGoalsMade',
              2: 'fieldGoalsAttempted',
              3: 'threePtMade',
              4: 'threePtAttempted',
              5: 'freeThrowsMade',
              6: 'freeThrowsAttempted',
              7: 'offensiveRebounds',
              8: 'defensiveRebounds',
              9: 'rebounds',
              10: 'assists',
              11: 'steals',
              12: 'blocks',
              13: 'turnovers',
              14: 'personalFouls',
              15: 'points',
              16: 'plusMinus'
            };
            
            statsArray.forEach((value: string, index: number) => {
              if (statMapping[index] && value && value !== '0') {
                stats.push({
                  player_id: playerId,
                  game_id: gameId,
                  stat_type: statMapping[index],
                  stat_value: value
                });
              }
            });
          } catch (playerError) {
            console.log(`    ⚠️  Skipping player ${athlete.athlete.displayName}`);
          }
        }
      }
    }
    
    console.log(`    ✅ Found ${stats.length} stats`);
    return stats;
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`    ❌ Game not found on ESPN`);
    } else {
      console.log(`    ❌ Error: ${error.message}`);
    }
    return [];
  }
}

async function turboNBACollector() {
  console.log('🚀 TURBO NBA STATS COLLECTOR - STANDARDIZED SCHEMA 🚀\n');
  console.log('='.repeat(80));
  console.log('Using standardized ESPN ID format: espn_nba_{numeric_id}\n');

  // Get starting stats count
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`Starting with ${startingStats?.toLocaleString()} total player stats\n`);

  // Get NBA games without stats (larger batch this time)
  console.log('🎯 Finding NBA games without stats...\n');
  
  const { data: nbaGames, error: gamesError } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id, status, home_score, away_score')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .or('status.eq.completed,status.eq.STATUS_FINAL,status.eq.Final')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .limit(1000);  // Process up to 1000 games

  if (gamesError || !nbaGames) {
    console.error('Error fetching games:', gamesError);
    return;
  }

  // Filter games without stats
  const gamesWithoutStats = [];
  console.log(`Checking ${nbaGames.length} games for existing stats...`);
  
  for (let i = 0; i < nbaGames.length; i += 100) {
    const batch = nbaGames.slice(i, i + 100);
    
    for (const game of batch) {
      const { count } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count === 0) {
        gamesWithoutStats.push(game);
      }
    }
    
    if (i % 200 === 0) {
      console.log(`  Checked ${i + batch.length}/${nbaGames.length} games...`);
    }
  }

  console.log(`\nFound ${gamesWithoutStats.length} games without stats`);
  
  if (gamesWithoutStats.length === 0) {
    console.log('✅ All checked games already have stats!');
    return;
  }

  // Process games in larger batches for speed
  console.log(`\n🚀 Processing ${gamesWithoutStats.length} games in turbo mode...\n`);
  
  let totalStats = 0;
  let successfulGames = 0;
  let failedGames = 0;
  const batchSize = 10; // Larger batches for turbo mode
  
  for (let i = 0; i < gamesWithoutStats.length; i += batchSize) {
    const batch = gamesWithoutStats.slice(i, i + batchSize);
    
    console.log(`\n📦 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(gamesWithoutStats.length/batchSize)}:`);
    
    // Process batch in parallel
    const promises = batch.map(async (game) => {
      const espnId = extractStandardizedEspnId(game.external_id);
      if (!espnId) {
        console.log(`  ⚠️  Game ${game.id}: Invalid ESPN ID format: ${game.external_id}`);
        return { success: false, stats: 0 };
      }
      
      try {
        const stats = await scrapeNBAGameStats(game.id, espnId, game.home_team_id, game.away_team_id);
        
        if (stats.length > 0) {
          // Insert stats in batches
          const insertBatchSize = 200;
          for (let j = 0; j < stats.length; j += insertBatchSize) {
            const insertBatch = stats.slice(j, j + insertBatchSize);
            const { error: insertError } = await supabase
              .from('player_stats')
              .insert(insertBatch);
            
            if (insertError) {
              console.log(`    ❌ Insert error: ${insertError.message}`);
              return { success: false, stats: 0 };
            }
          }
          
          return { success: true, stats: stats.length };
        }
        
        return { success: false, stats: 0 };
      } catch (error) {
        return { success: false, stats: 0 };
      }
    });
    
    const results = await Promise.all(promises);
    const batchStats = results.reduce((sum, r) => sum + r.stats, 0);
    const batchSuccess = results.filter(r => r.success).length;
    const batchFailed = results.filter(r => !r.success).length;
    
    totalStats += batchStats;
    successfulGames += batchSuccess;
    failedGames += batchFailed;
    
    console.log(`  ✅ Success: ${batchSuccess}/${batch.length} games`);
    console.log(`  📊 Stats collected: ${batchStats}`);
    console.log(`  🏃 Total so far: ${successfulGames} games, ${totalStats.toLocaleString()} stats`);
    
    // Rate limiting between batches
    if (i + batchSize < gamesWithoutStats.length) {
      console.log('  ⏱️  Rate limit pause...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Final report
  console.log('\n\n🏆 TURBO COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${gamesWithoutStats.length}`);
  console.log(`Successful games: ${successfulGames}`);
  console.log(`Failed games: ${failedGames}`);
  console.log(`Total stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Average stats per game: ${successfulGames > 0 ? Math.round(totalStats / successfulGames) : 0}`);
  
  // Check new totals
  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`\n📊 DATABASE GROWTH:`);
  console.log(`Starting stats: ${startingStats?.toLocaleString()}`);
  console.log(`Ending stats: ${endingStats?.toLocaleString()}`);
  console.log(`Net gain: ${((endingStats || 0) - (startingStats || 0)).toLocaleString()}`);
  
  // Quick coverage check
  console.log('\n📈 Checking new NBA coverage...');
  await checkQuickCoverage();
}

async function checkQuickCoverage() {
  const { count: totalNBA } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.NBA,sport_id.eq.nba')
    .or('status.eq.completed,status.eq.STATUS_FINAL')
    .not('home_score', 'is', null);
  
  // Sample coverage check
  const { data: sample } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .limit(500);
  
  if (sample) {
    let withStats = 0;
    for (const game of sample) {
      const { count } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1);
      
      if (count && count > 0) withStats++;
    }
    
    const estimatedCoverage = (withStats / sample.length * 100).toFixed(1);
    console.log(`Estimated NBA coverage: ~${estimatedCoverage}% (based on 500 game sample)`);
    console.log(`Total NBA games: ${totalNBA}`);
    
    if (parseFloat(estimatedCoverage) >= 95) {
      console.log('\n🎉 NBA APPEARS TO HAVE REACHED 95% COVERAGE! 🎉');
    }
  }
}

turboNBACollector().catch(console.error);