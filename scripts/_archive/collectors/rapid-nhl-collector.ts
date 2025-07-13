import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const playerCache = new Map<string, number>();

async function getOrCreatePlayer(espnId: string, name: string, teamId: number): Promise<number> {
  const externalId = `espn_nhl_${espnId}`;
  
  if (playerCache.has(externalId)) {
    return playerCache.get(externalId)!;
  }
  
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('external_id', externalId)
    .single();
  
  if (existing) {
    playerCache.set(externalId, existing.id);
    return existing.id;
  }
  
  const { data: newPlayer } = await supabase
    .from('players')
    .insert({
      external_id: externalId,
      name: name,
      firstname: name.split(' ')[0],
      lastname: name.split(' ').slice(1).join(' '),
      team_id: teamId,
      sport: 'NHL',
      sport_id: 'nhl',
      status: 'active'
    })
    .select('id')
    .single();
  
  if (newPlayer) {
    playerCache.set(externalId, newPlayer.id);
    return newPlayer.id;
  }
  
  throw new Error('Failed to create player');
}

async function rapidNHLCollector() {
  console.log('🏒 RAPID NHL COLLECTOR - 3,181 GAMES NEEDED! 🏒\n');
  console.log('='.repeat(80));

  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`Starting: ${startingStats?.toLocaleString()} stats\n`);

  // Get NHL games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or('sport.eq.NHL,sport_id.eq.nhl')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('id', { ascending: false })
    .limit(200); // Process 200 NHL games

  if (!games) return;

  console.log(`Processing ${games.length} NHL games...\n`);

  let totalStats = 0;
  let successCount = 0;
  let batchStats: any[] = [];
  
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    
    // Extract ESPN ID
    const match = game.external_id.match(/(\d+)/);
    if (!match) continue;
    
    const espnId = match[1];
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${espnId}`;
      const response = await axios.get(url, { 
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 5000 
      });
      
      if (response.data.boxscore?.players) {
        let teamIndex = 0;
        for (const team of response.data.boxscore.players) {
          const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
          teamIndex++;
          
          // NHL has skaters and goalies
          const categories = ['skaters', 'goalies'];
          
          for (const category of categories) {
            const categoryData = team.statistics?.find((s: any) => 
              s.name?.toLowerCase() === category || s.type === category
            );
            
            if (!categoryData?.athletes) continue;
            
            for (const athlete of categoryData.athletes) {
              if (!athlete.stats || athlete.stats.length === 0) continue;
              
              try {
                const playerId = await getOrCreatePlayer(
                  athlete.athlete.id,
                  athlete.athlete.displayName || 'Unknown',
                  teamId
                );
                
                // NHL stat mappings
                if (category === 'skaters') {
                  // Skater stats: G, A, PTS, +/-, PIM, SOG, HITS, BLK
                  const statMap = ['goals', 'assists', 'points', 'plusMinus', 
                                   'penaltyMinutes', 'shots', 'hits', 'blockedShots'];
                  
                  athlete.stats.forEach((value: string, index: number) => {
                    if (statMap[index] && value && value !== '0' && value !== '-') {
                      batchStats.push({
                        player_id: playerId,
                        game_id: game.id,
                        stat_type: statMap[index],
                        stat_value: value
                      });
                    }
                  });
                } else if (category === 'goalies') {
                  // Goalie stats: SA, SV, GA, SV%, MIN
                  const goalieMap = ['shotsAgainst', 'saves', 'goalsAgainst', 
                                     'savePercentage', 'timeOnIce'];
                  
                  athlete.stats.forEach((value: string, index: number) => {
                    if (goalieMap[index] && value && value !== '0' && value !== '-') {
                      batchStats.push({
                        player_id: playerId,
                        game_id: game.id,
                        stat_type: goalieMap[index],
                        stat_value: value
                      });
                    }
                  });
                }
              } catch (playerError) {
                // Skip player
              }
            }
          }
        }
      }
      
      successCount++;
      
      // Insert batch every 10 games
      if (batchStats.length > 500 || (i + 1) % 10 === 0) {
        if (batchStats.length > 0) {
          await supabase.from('player_stats').insert(batchStats);
          totalStats += batchStats.length;
          console.log(`✅ Batch inserted: ${batchStats.length} stats from ${successCount} games`);
          batchStats = [];
        }
      }
      
    } catch (error) {
      // Skip game
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${i + 1}/${games.length} games processed...`);
    }
  }
  
  // Insert final batch
  if (batchStats.length > 0) {
    await supabase.from('player_stats').insert(batchStats);
    totalStats += batchStats.length;
  }

  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log('\n🏒 NHL COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Games processed: ${successCount}/${games.length}`);
  console.log(`Stats collected: ${totalStats.toLocaleString()}`);
  console.log(`\nDatabase: ${startingStats?.toLocaleString()} → ${endingStats?.toLocaleString()}`);
  console.log(`Net gain: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats`);
}

rapidNHLCollector().catch(console.error);