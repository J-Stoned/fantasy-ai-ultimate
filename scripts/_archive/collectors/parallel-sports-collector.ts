import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { spawn } from 'child_process';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Individual sport collector script
const SPORT_COLLECTOR = `
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import pLimit from 'p-limit';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sport = process.argv[2];
const limit = pLimit(15);
const playerCache = new Map();

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractEspnId(externalId) {
  const patterns = [/espn_\\w+_(\\d+)$/, /\\w+_(\\d+)$/, /^(\\d+)$/];
  for (const pattern of patterns) {
    const match = externalId.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getOrCreatePlayer(espnId, name, teamId, sport) {
  const standardizedId = \`espn_\${sport.toLowerCase()}_\${espnId}\`;
  
  if (playerCache.has(standardizedId)) {
    return playerCache.get(standardizedId);
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
  
  const { data: newPlayer } = await supabase
    .from('players')
    .insert({
      external_id: standardizedId,
      name: name,
      firstname: name.split(' ')[0],
      lastname: name.split(' ').slice(1).join(' '),
      team_id: teamId,
      sport: sport,
      sport_id: sport.toLowerCase(),
      status: 'active'
    })
    .select('id')
    .single();
  
  if (newPlayer) {
    playerCache.set(standardizedId, newPlayer.id);
    return newPlayer.id;
  }
  
  throw new Error('Failed to create player');
}

async function scrapeGame(game, sport) {
  const espnId = extractEspnId(game.external_id);
  if (!espnId) return 0;
  
  try {
    await delay(Math.random() * 200);
    
    const urls = {
      MLB: \`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=\${espnId}\`,
      NBA: \`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=\${espnId}\`,
      NFL: \`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=\${espnId}\`,
      NHL: \`https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=\${espnId}\`
    };
    
    const response = await axios.get(urls[sport], {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000
    });
    
    const stats = [];
    
    if (response.data.boxscore?.players) {
      let teamIndex = 0;
      for (const team of response.data.boxscore.players) {
        const teamId = teamIndex === 0 ? game.away_team_id : game.home_team_id;
        teamIndex++;
        
        if (sport === 'MLB') {
          const batting = team.statistics?.find(s => s.type === 'batting');
          if (batting?.athletes) {
            for (const athlete of batting.athletes) {
              if (!athlete.stats || athlete.stats.length === 0) continue;
              try {
                const playerId = await getOrCreatePlayer(
                  athlete.athlete.id,
                  athlete.athlete.displayName,
                  teamId,
                  sport
                );
                
                const mappings = [
                  { index: 1, type: 'atBats' },
                  { index: 2, type: 'runs' },
                  { index: 3, type: 'hits' },
                  { index: 4, type: 'RBIs' },
                  { index: 5, type: 'homeRuns' }
                ];
                
                mappings.forEach(({ index, type }) => {
                  if (athlete.stats[index] && athlete.stats[index] !== '-') {
                    stats.push({
                      player_id: playerId,
                      game_id: game.id,
                      stat_type: type,
                      stat_value: athlete.stats[index]
                    });
                  }
                });
              } catch (e) {}
            }
          }
        } else if (sport === 'NBA') {
          if (team.statistics?.[0]?.athletes) {
            for (const athlete of team.statistics[0].athletes) {
              if (!athlete.stats || athlete.stats.length === 0) continue;
              try {
                const playerId = await getOrCreatePlayer(
                  athlete.athlete.id,
                  athlete.athlete.displayName,
                  teamId,
                  sport
                );
                
                const mappings = [
                  { index: 0, type: 'minutes' },
                  { index: 6, type: 'rebounds' },
                  { index: 7, type: 'assists' },
                  { index: 13, type: 'points' }
                ];
                
                mappings.forEach(({ index, type }) => {
                  if (athlete.stats[index] && athlete.stats[index] !== '-') {
                    stats.push({
                      player_id: playerId,
                      game_id: game.id,
                      stat_type: type,
                      stat_value: athlete.stats[index]
                    });
                  }
                });
              } catch (e) {}
            }
          }
        } else if (sport === 'NFL') {
          for (const statGroup of team.statistics || []) {
            if (statGroup.name === 'passing' && statGroup.athletes) {
              for (const athlete of statGroup.athletes) {
                if (!athlete.stats || athlete.stats.length === 0) continue;
                try {
                  const playerId = await getOrCreatePlayer(
                    athlete.athlete.id,
                    athlete.athlete.displayName,
                    teamId,
                    sport
                  );
                  
                  if (athlete.stats[1] && athlete.stats[1] !== '-') {
                    stats.push({
                      player_id: playerId,
                      game_id: game.id,
                      stat_type: 'passingYards',
                      stat_value: athlete.stats[1]
                    });
                  }
                } catch (e) {}
              }
            }
          }
        } else if (sport === 'NHL') {
          const skaters = team.statistics?.find(s => s.type === 'skaters' || s.name === 'skaters');
          if (skaters?.athletes) {
            for (const athlete of skaters.athletes) {
              if (!athlete.stats || athlete.stats.length === 0) continue;
              try {
                const playerId = await getOrCreatePlayer(
                  athlete.athlete.id,
                  athlete.athlete.displayName,
                  teamId,
                  sport
                );
                
                const mappings = [
                  { index: 0, type: 'goals' },
                  { index: 1, type: 'assists' },
                  { index: 2, type: 'points' }
                ];
                
                mappings.forEach(({ index, type }) => {
                  if (athlete.stats[index] && athlete.stats[index] !== '-') {
                    stats.push({
                      player_id: playerId,
                      game_id: game.id,
                      stat_type: type,
                      stat_value: athlete.stats[index]
                    });
                  }
                });
              } catch (e) {}
            }
          }
        }
      }
    }
    
    if (stats.length > 0) {
      await supabase.from('player_stats').insert(stats);
      return stats.length;
    }
    
    return 0;
  } catch (error) {
    return 0;
  }
}

async function collectSport() {
  console.log(\`🏆 \${sport} COLLECTOR STARTED\`);
  
  // Find games needing stats
  const gamesNeedingStats = [];
  const { data: gamesData } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id')
    .or(\`sport.eq.\${sport},sport_id.eq.\${sport.toLowerCase()}\`)
    .not('external_id', 'is', null)
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(2000);
  
  if (!gamesData) return;
  
  // Check which need stats
  for (let i = 0; i < gamesData.length; i += 100) {
    const batch = gamesData.slice(i, i + 100);
    const { data: withStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', batch.map(g => g.id));
    
    const hasStatsSet = new Set(withStats?.map(s => s.game_id) || []);
    
    for (const game of batch) {
      if (!hasStatsSet.has(game.id)) {
        gamesNeedingStats.push(game);
      }
    }
  }
  
  console.log(\`\${sport}: Processing \${gamesNeedingStats.length} games\`);
  
  let totalStats = 0;
  let processedGames = 0;
  const startTime = Date.now();
  
  // Process all games
  const promises = gamesNeedingStats.map((game) =>
    limit(async () => {
      const stats = await scrapeGame(game, sport);
      if (stats > 0) {
        totalStats += stats;
        processedGames++;
        
        if (processedGames % 25 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const gamesPerSecond = (processedGames / elapsed).toFixed(1);
          console.log(\`\${sport}: \${processedGames} games | \${totalStats} stats | \${gamesPerSecond} g/s\`);
        }
      }
      return stats;
    })
  );
  
  await Promise.all(promises);
  
  console.log(\`\${sport} COMPLETE: \${processedGames} games, \${totalStats} stats\`);
}

collectSport().catch(console.error);
`;

async function parallelSportsCollector() {
  console.log('🚀 PARALLEL SPORTS COLLECTOR - ALL CORES, ALL SPORTS!');
  console.log('='.repeat(80));
  
  const { count: startingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`Starting total stats: ${startingStats?.toLocaleString()}\n`);
  
  // Create temporary files for each sport
  const fs = require('fs');
  const sports = ['MLB', 'NBA', 'NFL', 'NHL'];
  
  const processes = sports.map(sport => {
    const filename = `/tmp/collect-${sport.toLowerCase()}.js`;
    fs.writeFileSync(filename, SPORT_COLLECTOR);
    
    console.log(`Launching ${sport} collector...`);
    const child = spawn('node', [filename, sport], {
      stdio: 'inherit'
    });
    
    return { sport, child };
  });
  
  // Wait for all to complete
  await Promise.all(processes.map(({ sport, child }) => 
    new Promise((resolve) => {
      child.on('exit', (code) => {
        console.log(`${sport} collector exited with code ${code}`);
        resolve(code);
      });
    })
  ));
  
  const { count: endingStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log('\n🏆 PARALLEL COLLECTION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`Starting stats: ${startingStats?.toLocaleString()}`);
  console.log(`Ending stats: ${endingStats?.toLocaleString()}`);
  console.log(`TOTAL ADDED: +${((endingStats || 0) - (startingStats || 0)).toLocaleString()} stats!`);
  
  // Check final coverage
  await checkFinalCoverage();
}

async function checkFinalCoverage() {
  console.log('\n📊 FINAL COVERAGE CHECK:');
  const sports = ['MLB', 'NBA', 'NFL', 'NHL'];
  
  for (const sport of sports) {
    const { data: allGames } = await supabase
      .from('games')
      .select('id')
      .or(`sport.eq.${sport},sport_id.eq.${sport.toLowerCase()}`)
      .not('home_score', 'is', null);
    
    const totalGames = allGames?.length || 0;
    let coveredGames = 0;
    
    for (let i = 0; i < totalGames; i += 100) {
      const batch = allGames!.slice(i, i + 100);
      const { data: withStats } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', batch.map(g => g.id));
      
      const uniqueGames = new Set(withStats?.map(s => s.game_id) || []);
      coveredGames += uniqueGames.size;
    }
    
    const coverage = (coveredGames / totalGames * 100);
    console.log(`${sport}: ${coverage.toFixed(1)}% coverage ${coverage >= 95 ? '✅' : ''}`);
  }
}

parallelSportsCollector().catch(console.error);