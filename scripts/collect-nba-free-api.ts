#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Using a free NBA API
const nbaApi = axios.create({
  baseURL: 'https://www.balldontlie.io/api/v1',
  timeout: 15000,
  headers: {
    'Accept': 'application/json'
  }
});

console.log('🏀 NBA DATA COLLECTOR - FREE API');
console.log('📊 Collecting REAL NBA data\n');

const CONFIG = {
  SEASONS: [2023, 2024], // Recent seasons
  CONCURRENT_CALLS: 5, // Be nice to free API
  GAMES_PER_PAGE: 100,
  STATS_PER_PAGE: 100,
  DELAY_MS: 1000, // 1 second between requests
};

// NBA team mappings
const NBA_TEAMS: Record<number, { name: string, abbreviation: string, city: string }> = {
  1: { name: 'Hawks', abbreviation: 'ATL', city: 'Atlanta' },
  2: { name: 'Celtics', abbreviation: 'BOS', city: 'Boston' },
  3: { name: 'Nets', abbreviation: 'BKN', city: 'Brooklyn' },
  4: { name: 'Hornets', abbreviation: 'CHA', city: 'Charlotte' },
  5: { name: 'Bulls', abbreviation: 'CHI', city: 'Chicago' },
  6: { name: 'Cavaliers', abbreviation: 'CLE', city: 'Cleveland' },
  7: { name: 'Mavericks', abbreviation: 'DAL', city: 'Dallas' },
  8: { name: 'Nuggets', abbreviation: 'DEN', city: 'Denver' },
  9: { name: 'Pistons', abbreviation: 'DET', city: 'Detroit' },
  10: { name: 'Warriors', abbreviation: 'GSW', city: 'Golden State' },
  11: { name: 'Rockets', abbreviation: 'HOU', city: 'Houston' },
  12: { name: 'Pacers', abbreviation: 'IND', city: 'Indiana' },
  13: { name: 'Clippers', abbreviation: 'LAC', city: 'LA' },
  14: { name: 'Lakers', abbreviation: 'LAL', city: 'Los Angeles' },
  15: { name: 'Grizzlies', abbreviation: 'MEM', city: 'Memphis' },
  16: { name: 'Heat', abbreviation: 'MIA', city: 'Miami' },
  17: { name: 'Bucks', abbreviation: 'MIL', city: 'Milwaukee' },
  18: { name: 'Timberwolves', abbreviation: 'MIN', city: 'Minnesota' },
  19: { name: 'Pelicans', abbreviation: 'NOP', city: 'New Orleans' },
  20: { name: 'Knicks', abbreviation: 'NYK', city: 'New York' },
  21: { name: 'Thunder', abbreviation: 'OKC', city: 'Oklahoma City' },
  22: { name: 'Magic', abbreviation: 'ORL', city: 'Orlando' },
  23: { name: '76ers', abbreviation: 'PHI', city: 'Philadelphia' },
  24: { name: 'Suns', abbreviation: 'PHX', city: 'Phoenix' },
  25: { name: 'Trail Blazers', abbreviation: 'POR', city: 'Portland' },
  26: { name: 'Kings', abbreviation: 'SAC', city: 'Sacramento' },
  27: { name: 'Spurs', abbreviation: 'SAS', city: 'San Antonio' },
  28: { name: 'Raptors', abbreviation: 'TOR', city: 'Toronto' },
  29: { name: 'Jazz', abbreviation: 'UTA', city: 'Utah' },
  30: { name: 'Wizards', abbreviation: 'WAS', city: 'Washington' }
};

// Tracking
let gamesCollected = 0;
let statsCollected = 0;
let playersCollected = 0;

async function ensureNBATeams() {
  console.log('🏟️  Ensuring NBA teams exist...');
  
  const teamsToInsert = Object.entries(NBA_TEAMS).map(([id, team]) => ({
    id: 9000 + parseInt(id), // Offset to avoid conflicts
    name: `${team.city} ${team.name}`,
    abbreviation: team.abbreviation,
    sport: 'NBA',
    external_id: `nba_${id}`
  }));
  
  const { error } = await supabase
    .from('teams')
    .upsert(teamsToInsert, { onConflict: 'id' });
    
  if (!error) {
    console.log(`✅ ${teamsToInsert.length} NBA teams ready\n`);
  }
}

async function fetchNBAGames(season: number, page: number = 1) {
  try {
    const response = await nbaApi.get('/games', {
      params: {
        seasons: [season],
        per_page: CONFIG.GAMES_PER_PAGE,
        page: page
      }
    });
    
    const games = response.data.data.map((game: any) => ({
      external_id: `balldontlie_${game.id}`,
      sport: 'NBA',
      start_time: game.date,
      status: game.status === 'Final' ? 'final' : game.status.toLowerCase(),
      home_team_id: 9000 + game.home_team.id,
      away_team_id: 9000 + game.visitor_team.id,
      home_score: game.home_team_score,
      away_score: game.visitor_team_score,
      venue: game.home_team.city,
      metadata: {
        season: game.season,
        postseason: game.postseason,
        period: game.period,
        time: game.time
      }
    }));
    
    return {
      games,
      hasMore: response.data.meta.next_page !== null,
      totalPages: response.data.meta.total_pages
    };
  } catch (error: any) {
    console.error('Error fetching games:', error.message);
    return { games: [], hasMore: false, totalPages: 0 };
  }
}

async function fetchNBAStats(gameIds: number[], page: number = 1) {
  try {
    const response = await nbaApi.get('/stats', {
      params: {
        game_ids: gameIds,
        per_page: CONFIG.STATS_PER_PAGE,
        page: page
      }
    });
    
    const stats: any[] = [];
    const players = new Map<number, any>();
    
    response.data.data.forEach((stat: any) => {
      // Player info
      if (!players.has(stat.player.id)) {
        players.set(stat.player.id, {
          id: 10000 + stat.player.id, // Offset for players
          name: `${stat.player.first_name} ${stat.player.last_name}`,
          sport: 'NBA',
          position: stat.player.position,
          external_id: `balldontlie_${stat.player.id}`,
          metadata: {
            height_feet: stat.player.height_feet,
            height_inches: stat.player.height_inches,
            weight_pounds: stat.player.weight_pounds,
            team_id: stat.team.id
          }
        });
      }
      
      // Individual stats
      const statTypes = [
        { type: 'points', value: stat.pts, fantasy: stat.pts },
        { type: 'rebounds', value: stat.reb, fantasy: stat.reb * 1.2 },
        { type: 'assists', value: stat.ast, fantasy: stat.ast * 1.5 },
        { type: 'steals', value: stat.stl, fantasy: stat.stl * 3 },
        { type: 'blocks', value: stat.blk, fantasy: stat.blk * 3 },
        { type: 'turnovers', value: stat.turnover, fantasy: -stat.turnover },
        { type: 'fg_made', value: stat.fgm, fantasy: 0 },
        { type: 'fg_attempted', value: stat.fga, fantasy: 0 },
        { type: 'fg_pct', value: stat.fg_pct, fantasy: 0 },
        { type: '3pt_made', value: stat.fg3m, fantasy: stat.fg3m * 0.5 },
        { type: '3pt_attempted', value: stat.fg3a, fantasy: 0 },
        { type: '3pt_pct', value: stat.fg3_pct, fantasy: 0 },
        { type: 'ft_made', value: stat.ftm, fantasy: 0 },
        { type: 'ft_attempted', value: stat.fta, fantasy: 0 },
        { type: 'ft_pct', value: stat.ft_pct, fantasy: 0 },
        { type: 'offensive_rebounds', value: stat.oreb, fantasy: stat.oreb * 0.5 },
        { type: 'defensive_rebounds', value: stat.dreb, fantasy: stat.dreb * 0.5 },
        { type: 'personal_fouls', value: stat.pf, fantasy: 0 },
        { type: 'minutes', value: parseFloat(stat.min || '0'), fantasy: 0 }
      ];
      
      statTypes.forEach(s => {
        if (s.value !== null && s.value !== undefined && (s.value > 0 || s.type === 'turnovers')) {
          stats.push({
            player_id: 10000 + stat.player.id,
            game_id: stat.game.id, // We'll need to map this
            stat_type: s.type,
            stat_value: s.value,
            fantasy_points: s.fantasy,
            sport: 'NBA'
          });
        }
      });
    });
    
    return {
      stats,
      players: Array.from(players.values()),
      hasMore: response.data.meta.next_page !== null
    };
  } catch (error: any) {
    console.error('Error fetching stats:', error.message);
    return { stats: [], players: [], hasMore: false };
  }
}

async function collectNBAData() {
  const startTime = Date.now();
  
  await ensureNBATeams();
  
  // Collect games for each season
  for (const season of CONFIG.SEASONS) {
    console.log(`\n📅 Collecting ${season} season games...`);
    
    let page = 1;
    let hasMore = true;
    const seasonGames: any[] = [];
    
    while (hasMore && page <= 10) { // Limit pages for demo
      const result = await fetchNBAGames(season, page);
      seasonGames.push(...result.games);
      hasMore = result.hasMore;
      page++;
      
      console.log(`Page ${page - 1}/${result.totalPages} - ${seasonGames.length} games`);
      
      // Rate limit
      await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
    }
    
    // Insert games
    if (seasonGames.length > 0) {
      console.log(`\n💾 Inserting ${seasonGames.length} games...`);
      
      const { data, error } = await supabase
        .from('games')
        .upsert(seasonGames, { onConflict: 'external_id' })
        .select();
        
      if (data) {
        gamesCollected += data.length;
        
        // Now collect stats for these games
        const gameIds = seasonGames.map(g => parseInt(g.external_id.replace('balldontlie_', '')));
        
        console.log(`\n📊 Collecting stats for ${gameIds.length} games...`);
        
        let statsPage = 1;
        let hasMoreStats = true;
        
        while (hasMoreStats && statsPage <= 5) { // Limit for demo
          const statsResult = await fetchNBAStats(gameIds.slice(0, 10), statsPage); // Small batch
          
          // Insert players
          if (statsResult.players.length > 0) {
            const { data: playerData } = await supabase
              .from('players')
              .upsert(statsResult.players, { onConflict: 'id' })
              .select();
              
            if (playerData) playersCollected += playerData.length;
          }
          
          // Map game IDs and insert stats
          if (statsResult.stats.length > 0) {
            // Get our game IDs
            const { data: ourGames } = await supabase
              .from('games')
              .select('id, external_id')
              .in('external_id', gameIds.map(id => `balldontlie_${id}`));
              
            const gameIdMap = new Map(ourGames?.map(g => [
              parseInt(g.external_id.replace('balldontlie_', '')),
              g.id
            ]));
            
            // Update stats with our game IDs
            const mappedStats = statsResult.stats.map(s => ({
              ...s,
              game_id: gameIdMap.get(s.game_id) || s.game_id
            }));
            
            const { data: statsData } = await supabase
              .from('player_stats')
              .insert(mappedStats)
              .select();
              
            if (statsData) statsCollected += statsData.length;
          }
          
          hasMoreStats = statsResult.hasMore;
          statsPage++;
          
          console.log(`Stats page ${statsPage - 1} - ${statsCollected} total stats`);
          
          // Rate limit
          await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
        }
      }
    }
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ NBA DATA COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games collected: ${gamesCollected}`);
  console.log(`📊 Stats collected: ${statsCollected}`);
  console.log(`👥 Players collected: ${playersCollected}`);
  
  // Check totals
  const { count: nbaGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  const { count: nbaStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  console.log('\n📈 NBA Database Totals:');
  console.log(`🏀 Total NBA games: ${nbaGames}`);
  console.log(`📊 Total NBA stats: ${nbaStats}`);
}

// Main
async function main() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
  
  await collectNBAData();
}

main().catch(console.error);