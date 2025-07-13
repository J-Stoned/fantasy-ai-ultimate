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

async function rapidNFLCollector() {
  console.log('⚡ RAPID NFL COLLECTOR - GET TO 95% FAST! ⚡\n');
  console.log('='.repeat(80));

  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  // Get NFL games
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or('sport.eq.NFL,sport_id.eq.nfl')
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('id', { ascending: false })
    .limit(100); // Start with 100

  if (!games) return;

  console.log(`Processing ${games.length} NFL games...\n`);

  let totalStats = 0;
  let successCount = 0;
  
  for (const game of games) {
    // Extract ESPN ID
    const match = game.external_id.match(/(\d+)/);
    if (!match) continue;
    
    const espnId = match[1];
    
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`;
      const response = await axios.get(url, { timeout: 5000 });
      
      const stats: any[] = [];
      
      if (response.data.boxscore?.players) {
        let teamIndex = 0;
        for (const team of response.data.boxscore.players) {
          const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
          teamIndex++;
          
          // Just get passing stats for QBs as a quick test
          const passing = team.statistics?.find((s: any) => s.name === 'passing');
          if (passing?.athletes) {
            for (const athlete of passing.athletes) {
              if (!athlete.stats || athlete.stats.length === 0) continue;
              
              // Get or create player
              const playerId = await getOrCreatePlayer(
                athlete.athlete.id,
                athlete.athlete.displayName,
                teamId
              );
              
              // Add basic stats
              if (athlete.stats[2]) { // Passing yards
                stats.push({
                  player_id: playerId,
                  game_id: game.id,
                  stat_type: 'passingYards',
                  stat_value: athlete.stats[2]
                });
              }
              if (athlete.stats[4]) { // TDs
                stats.push({
                  player_id: playerId,
                  game_id: game.id,
                  stat_type: 'passingTouchdowns',
                  stat_value: athlete.stats[4]
                });
              }
            }
          }
        }
      }
      
      if (stats.length > 0) {
        await supabase.from('player_stats').insert(stats);
        totalStats += stats.length;
        successCount++;
        console.log(`✅ Game ${game.id}: ${stats.length} stats`);
      }
      
    } catch (error) {
      // Skip
    }
    
    if (successCount % 10 === 0 && successCount > 0) {
      console.log(`Progress: ${successCount} games, ${totalStats} stats`);
    }
  }

  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log('\n✅ COMPLETE!');
  console.log(`Games: ${successCount}/${games.length}`);
  console.log(`Stats: ${totalStats}`);
  console.log(`DB: ${startingStats} → ${endingStats} (+${(endingStats || 0) - (startingStats || 0)})`);
}

async function getOrCreatePlayer(espnId: string, name: string, teamId: number): Promise<number> {
  const externalId = `espn_nfl_${espnId}`;
  
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
      sport: 'NFL',
      sport_id: 'nfl',
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

rapidNFLCollector().catch(console.error);