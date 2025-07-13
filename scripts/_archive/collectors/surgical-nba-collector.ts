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

async function extractEspnId(externalId: string): Promise<string | null> {
  // Extract ESPN ID from formats like "nba_401267399" or "espn_nba_401267399"
  const match = externalId.match(/(\d+)$/);
  return match ? match[1] : null;
}

async function scrapeNBAGameStats(gameId: number, espnId: string): Promise<PlayerStat[]> {
  const stats: PlayerStat[] = [];
  
  try {
    // ESPN API endpoint for NBA game stats
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
    
    // Extract player stats from boxscore
    if (data.boxscore && data.boxscore.players) {
      for (const team of data.boxscore.players) {
        if (!team.statistics || !team.statistics[0] || !team.statistics[0].athletes) continue;
        
        const athletes = team.statistics[0].athletes;
        for (const athlete of athletes) {
          if (!athlete.stats || athlete.stats.length === 0) continue;
          
          // Parse stats array - ESPN typically sends stats in a specific order
          const statsArray = athlete.stats;
          const playerId = parseInt(athlete.athlete.id);
          
          // Common NBA stat mapping
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
          
          // Add each stat
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

async function surgicalNBACollector() {
  console.log('🔥 SURGICAL NBA STATS COLLECTOR 🔥\n');
  console.log('='.repeat(80));

  // Get NBA games without stats
  console.log('🎯 Finding NBA games without stats...\n');
  
  const { data: nbaGames, error: gamesError } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id, status')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .eq('status', 'completed')
    .not('external_id', 'is', null)
    .limit(100);  // Start with 100 games

  if (gamesError || !nbaGames) {
    console.error('Error fetching games:', gamesError);
    return;
  }

  // Filter games without stats
  const gamesWithoutStats = [];
  for (const game of nbaGames) {
    const { count } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', game.id);
    
    if (count === 0) {
      gamesWithoutStats.push(game);
    }
  }

  console.log(`Found ${gamesWithoutStats.length} games without stats`);
  
  if (gamesWithoutStats.length === 0) {
    console.log('✅ All checked games already have stats!');
    return;
  }

  // Process games
  console.log(`\n🚀 Processing ${gamesWithoutStats.length} games...\n`);
  
  let totalStats = 0;
  let successfulGames = 0;
  const batchSize = 5;
  
  for (let i = 0; i < gamesWithoutStats.length; i += batchSize) {
    const batch = gamesWithoutStats.slice(i, i + batchSize);
    
    // Process batch in parallel
    const promises = batch.map(async (game) => {
      const espnId = await extractEspnId(game.external_id);
      if (!espnId) {
        console.log(`  ⚠️  Game ${game.id}: Invalid ESPN ID format: ${game.external_id}`);
        return 0;
      }
      
      const stats = await scrapeNBAGameStats(game.id, espnId);
      
      if (stats.length > 0) {
        // Insert stats in batches
        const insertBatchSize = 100;
        for (let j = 0; j < stats.length; j += insertBatchSize) {
          const insertBatch = stats.slice(j, j + insertBatchSize);
          const { error: insertError } = await supabase
            .from('player_stats')
            .insert(insertBatch);
          
          if (insertError) {
            console.log(`    ❌ Insert error: ${insertError.message}`);
            return 0;
          }
        }
        
        return stats.length;
      }
      
      return 0;
    });
    
    const results = await Promise.all(promises);
    const batchStats = results.reduce((sum, count) => sum + count, 0);
    const batchSuccess = results.filter(r => r > 0).length;
    
    totalStats += batchStats;
    successfulGames += batchSuccess;
    
    console.log(`\nBatch ${Math.floor(i/batchSize) + 1}: ${batchSuccess}/${batch.length} games, ${batchStats} stats`);
    
    // Rate limiting
    if (i + batchSize < gamesWithoutStats.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Final report
  console.log('\n\n🏆 SURGICAL COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${gamesWithoutStats.length}`);
  console.log(`Successful games: ${successfulGames}`);
  console.log(`Total stats collected: ${totalStats.toLocaleString()}`);
  console.log(`Average stats per game: ${successfulGames > 0 ? Math.round(totalStats / successfulGames) : 0}`);
  
  // Check new coverage
  const { count: totalNBA } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.NBA,sport_id.eq.nba')
    .eq('status', 'completed');
  
  const { data: gamesWithStatsNow } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.NBA,sport_id.eq.nba')
    .eq('status', 'completed');
  
  if (gamesWithStatsNow) {
    let newCoverage = 0;
    for (const game of gamesWithStatsNow) {
      const { count } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) newCoverage++;
    }
    
    const coveragePercent = totalNBA ? (newCoverage / totalNBA * 100).toFixed(1) : 0;
    console.log(`\n📊 NEW NBA COVERAGE: ${newCoverage}/${totalNBA} games (${coveragePercent}%)`);
  }
}

surgicalNBACollector().catch(console.error);