#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// ESPN API endpoints (publicly accessible)
const espnApi = axios.create({
  baseURL: 'https://site.api.espn.com/apis/site/v2/sports',
  timeout: 10000
});

console.log('🏀 NBA DATA COLLECTOR - ESPN API');
console.log('📊 Collecting REAL NBA data from ESPN\n');

const CONFIG = {
  START_DATE: '20231024', // NBA 2023-24 season start
  END_DATE: '20240630',   // Including playoffs
  CONCURRENT_CALLS: 8,
  BATCH_SIZE: 100
};

// ESPN NBA team IDs
const NBA_TEAMS: Record<string, { name: string, id: number }> = {
  'ATL': { name: 'Atlanta Hawks', id: 1 },
  'BOS': { name: 'Boston Celtics', id: 2 },
  'BKN': { name: 'Brooklyn Nets', id: 17 },
  'CHA': { name: 'Charlotte Hornets', id: 30 },
  'CHI': { name: 'Chicago Bulls', id: 4 },
  'CLE': { name: 'Cleveland Cavaliers', id: 5 },
  'DAL': { name: 'Dallas Mavericks', id: 6 },
  'DEN': { name: 'Denver Nuggets', id: 7 },
  'DET': { name: 'Detroit Pistons', id: 8 },
  'GS': { name: 'Golden State Warriors', id: 9 },
  'HOU': { name: 'Houston Rockets', id: 10 },
  'IND': { name: 'Indiana Pacers', id: 11 },
  'LAC': { name: 'LA Clippers', id: 12 },
  'LAL': { name: 'Los Angeles Lakers', id: 13 },
  'MEM': { name: 'Memphis Grizzlies', id: 29 },
  'MIA': { name: 'Miami Heat', id: 14 },
  'MIL': { name: 'Milwaukee Bucks', id: 15 },
  'MIN': { name: 'Minnesota Timberwolves', id: 16 },
  'NO': { name: 'New Orleans Pelicans', id: 3 },
  'NY': { name: 'New York Knicks', id: 18 },
  'OKC': { name: 'Oklahoma City Thunder', id: 25 },
  'ORL': { name: 'Orlando Magic', id: 19 },
  'PHI': { name: 'Philadelphia 76ers', id: 20 },
  'PHX': { name: 'Phoenix Suns', id: 21 },
  'POR': { name: 'Portland Trail Blazers', id: 22 },
  'SAC': { name: 'Sacramento Kings', id: 23 },
  'SA': { name: 'San Antonio Spurs', id: 24 },
  'TOR': { name: 'Toronto Raptors', id: 28 },
  'UTAH': { name: 'Utah Jazz', id: 26 },
  'WSH': { name: 'Washington Wizards', id: 27 }
};

let gamesCollected = 0;
let statsCollected = 0;

async function ensureNBATeamsExist() {
  console.log('🏟️  Ensuring NBA teams exist...');
  
  const teamsToInsert = Object.entries(NBA_TEAMS).map(([abbr, team]) => ({
    id: 8000 + team.id,
    name: team.name,
    abbreviation: abbr,
    sport: 'NBA',
    external_id: `espn_nba_${team.id}`
  }));
  
  const { error } = await supabase
    .from('teams')
    .upsert(teamsToInsert, { onConflict: 'id' });
    
  if (!error) {
    console.log(`✅ ${teamsToInsert.length} NBA teams ready\n`);
  }
}

async function fetchNBAScoreboard(date: string) {
  try {
    const response = await espnApi.get(`/basketball/nba/scoreboard`, {
      params: { dates: date }
    });
    
    const games: any[] = [];
    
    response.data.events?.forEach((event: any) => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
      
      if (competition.status.type.completed) {
        games.push({
          external_id: `espn_nba_${event.id}`,
          sport: 'NBA',
          start_time: event.date,
          status: 'final',
          home_team_id: 8000 + parseInt(homeTeam.team.id),
          away_team_id: 8000 + parseInt(awayTeam.team.id),
          home_score: parseInt(homeTeam.score),
          away_score: parseInt(awayTeam.score),
          venue: competition.venue?.fullName || 'Unknown',
          metadata: {
            attendance: competition.attendance,
            game_type: event.season?.type,
            headlines: event.competitions[0].headlines
          }
        });
      }
    });
    
    return games;
  } catch (error: any) {
    return [];
  }
}

async function fetchGameStats(gameId: string) {
  try {
    const response = await espnApi.get(`/basketball/nba/summary`, {
      params: { event: gameId }
    });
    
    const stats: any[] = [];
    const players: any[] = [];
    
    // Process boxscore
    const boxscore = response.data.boxscore;
    if (!boxscore) return { stats: [], players: [] };
    
    boxscore.teams?.forEach((team: any) => {
      const teamId = 8000 + parseInt(team.team.id);
      
      team.statistics?.forEach((playerStats: any) => {
        const athlete = playerStats.athlete;
        if (!athlete) return;
        
        const playerId = 20000 + parseInt(athlete.id);
        
        // Add player
        players.push({
          id: playerId,
          name: athlete.displayName,
          sport: 'NBA',
          position: athlete.position?.abbreviation || 'N/A',
          external_id: `espn_nba_${athlete.id}`,
          metadata: {
            jersey: athlete.jersey,
            team_id: teamId
          }
        });
        
        // Parse stats
        const statValues = playerStats.stats || [];
        if (statValues.length >= 15) {
          // ESPN NBA stats order: MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS
          const minutes = parseFloat(statValues[0] || '0');
          const points = parseInt(statValues[13] || '0');
          const rebounds = parseInt(statValues[6] || '0');
          const assists = parseInt(statValues[7] || '0');
          const steals = parseInt(statValues[8] || '0');
          const blocks = parseInt(statValues[9] || '0');
          const turnovers = parseInt(statValues[10] || '0');
          
          if (minutes > 0) {
            const gameStats = [
              { type: 'minutes', value: minutes, fantasy: 0 },
              { type: 'points', value: points, fantasy: points },
              { type: 'rebounds', value: rebounds, fantasy: rebounds * 1.2 },
              { type: 'assists', value: assists, fantasy: assists * 1.5 },
              { type: 'steals', value: steals, fantasy: steals * 3 },
              { type: 'blocks', value: blocks, fantasy: blocks * 3 },
              { type: 'turnovers', value: turnovers, fantasy: -turnovers }
            ];
            
            gameStats.forEach(stat => {
              if (stat.value > 0 || stat.type === 'turnovers') {
                stats.push({
                  player_id: playerId,
                  game_id: gameId, // Will be mapped later
                  stat_type: stat.type,
                  stat_value: stat.value,
                  fantasy_points: stat.fantasy,
                  sport: 'NBA'
                });
              }
            });
          }
        }
      });
    });
    
    return { stats, players };
  } catch (error: any) {
    return { stats: [], players: [] };
  }
}

async function collectNBAData() {
  const startTime = Date.now();
  
  await ensureNBATeamsExist();
  
  // Generate dates
  const dates: string[] = [];
  const current = new Date(CONFIG.START_DATE.slice(0,4) + '-' + CONFIG.START_DATE.slice(4,6) + '-' + CONFIG.START_DATE.slice(6));
  const end = new Date(CONFIG.END_DATE.slice(0,4) + '-' + CONFIG.END_DATE.slice(4,6) + '-' + CONFIG.END_DATE.slice(6));
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0].replace(/-/g, ''));
    current.setDate(current.getDate() + 1);
  }
  
  console.log(`📅 Collecting games from ${dates.length} days\n`);
  
  // Collect games
  const limit = pLimit(CONFIG.CONCURRENT_CALLS);
  const allGames: any[] = [];
  
  const gamePromises = dates.map((date, index) => 
    limit(async () => {
      const games = await fetchNBAScoreboard(date);
      allGames.push(...games);
      
      if (index % 10 === 0) {
        process.stdout.write(`\r📊 Progress: ${index}/${dates.length} days - ${allGames.length} games found`);
      }
      
      await new Promise(r => setTimeout(r, 200)); // Rate limit
    })
  );
  
  await Promise.all(gamePromises);
  console.log(`\n\n💾 Found ${allGames.length} NBA games`);
  
  // Insert games
  if (allGames.length > 0) {
    for (let i = 0; i < allGames.length; i += CONFIG.BATCH_SIZE) {
      const batch = allGames.slice(i, i + CONFIG.BATCH_SIZE);
      const { data } = await supabase
        .from('games')
        .upsert(batch, { onConflict: 'external_id' })
        .select();
        
      if (data) gamesCollected += data.length;
    }
    
    console.log(`✅ Inserted ${gamesCollected} games`);
    
    // Collect stats for first 50 games
    console.log('\n📊 Collecting stats for games...');
    const gamesToProcess = allGames.slice(0, 50);
    
    for (const game of gamesToProcess) {
      const espnGameId = game.external_id.replace('espn_nba_', '');
      const result = await fetchGameStats(espnGameId);
      
      // Insert players
      if (result.players.length > 0) {
        await supabase
          .from('players')
          .upsert(result.players, { onConflict: 'id' });
      }
      
      // Map game ID and insert stats
      if (result.stats.length > 0) {
        const { data: ourGame } = await supabase
          .from('games')
          .select('id')
          .eq('external_id', game.external_id)
          .single();
          
        if (ourGame) {
          const mappedStats = result.stats.map(s => ({
            ...s,
            game_id: ourGame.id
          }));
          
          const { data: statsData } = await supabase
            .from('player_stats')
            .insert(mappedStats)
            .select();
            
          if (statsData) statsCollected += statsData.length;
        }
      }
      
      process.stdout.write(`\r📊 Processed ${gamesToProcess.indexOf(game) + 1}/${gamesToProcess.length} games - ${statsCollected} stats`);
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ NBA DATA COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games collected: ${gamesCollected}`);
  console.log(`📊 Stats collected: ${statsCollected}`);
  
  // Check totals
  const { count: totalNBA } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  console.log(`\n📈 Total NBA games in database: ${totalNBA}`);
}

// Main
async function main() {
  try {
    require('p-limit');
  } catch {
    console.log('📦 Installing packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit', { stdio: 'inherit' });
  }
  
  await collectNBAData();
}

main().catch(console.error);