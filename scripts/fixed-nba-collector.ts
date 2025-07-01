import chalk from 'chalk';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// BallDontLie API configuration - CORRECT VERSION
const BALLDONTLIE_API = 'https://api.balldontlie.io/v1';
const BALLDONTLIE_KEY = process.env.BALLDONTLIE_API_KEY;

if (!BALLDONTLIE_KEY) {
  console.error(chalk.red('❌ BALLDONTLIE_API_KEY not found in environment!'));
  process.exit(1);
}

let stats = {
  players: 0,
  teams: 0,
  games: 0,
  playerStats: 0,
  errors: 0,
  runtime: Date.now()
};

async function collectNBAPlayers() {
  try {
    let cursor = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await axios.get(`${BALLDONTLIE_API}/players`, {
        headers: { 'Authorization': BALLDONTLIE_KEY },
        params: { 
          per_page: 100,
          cursor: cursor > 0 ? cursor : undefined
        }
      });

      const { data, meta } = response.data;
      
      if (data.length === 0) {
        hasMore = false;
        break;
      }

      const players = data.map((player: any) => ({
        external_id: `balldontlie_${player.id}`,
        name: `${player.first_name} ${player.last_name}`,
        position: player.position || 'Unknown',
        team: player.team?.full_name || 'Free Agent',
        height: player.height || null,
        weight: player.weight || null,
        jersey_number: player.jersey_number || null,
        country: player.country || 'USA',
        draft_year: player.draft_year,
        draft_round: player.draft_round,
        draft_number: player.draft_number,
        college: player.college,
        is_active: true,
        sport: 'basketball',
        metadata: {
          team_id: player.team?.id,
          team_abbreviation: player.team?.abbreviation,
          conference: player.team?.conference,
          division: player.team?.division
        }
      }));

      const { error } = await supabase
        .from('players')
        .upsert(players, { onConflict: 'external_id' });
      
      if (error) throw error;
      
      stats.players += players.length;
      cursor = meta.next_cursor;
      
      if (!cursor) hasMore = false;
      
      await delay(100); // Rate limiting
    }
  } catch (error: any) {
    console.error(chalk.red('Players error:', error.message));
    stats.errors++;
  }
}

async function collectNBAGames() {
  try {
    // Get current season games
    const seasons = [2024, 2023, 2022];
    
    for (const season of seasons) {
      let cursor = 0;
      let hasMore = true;
      
      while (hasMore) {
        const response = await axios.get(`${BALLDONTLIE_API}/games`, {
          headers: { 'Authorization': BALLDONTLIE_KEY },
          params: {
            'seasons[]': season,
            per_page: 100,
            cursor: cursor > 0 ? cursor : undefined
          }
        });

        const { data, meta } = response.data;
        
        if (data.length === 0) {
          hasMore = false;
          break;
        }

        const games = data.map((game: any) => ({
          external_id: `balldontlie_game_${game.id}`,
          sport: 'basketball',
          home_team: game.home_team.full_name,
          away_team: game.visitor_team.full_name,
          home_score: game.home_team_score || 0,
          away_score: game.visitor_team_score || 0,
          status: game.status,
          game_date: game.date,
          season: game.season,
          postseason: game.postseason || false,
          period: game.period || 0,
          time: game.time || null,
          metadata: {
            home_team_id: game.home_team.id,
            away_team_id: game.visitor_team.id,
            home_abbreviation: game.home_team.abbreviation,
            away_abbreviation: game.visitor_team.abbreviation
          }
        }));

        const { error } = await supabase
          .from('games')
          .upsert(games, { onConflict: 'external_id' });
        
        if (error) throw error;
        
        stats.games += games.length;
        cursor = meta.next_cursor;
        
        if (!cursor) hasMore = false;
        
        await delay(100); // Rate limiting
      }
    }
  } catch (error: any) {
    console.error(chalk.red('Games error:', error.message));
    stats.errors++;
  }
}

async function collectPlayerStats() {
  try {
    // Get stats for recent games
    const response = await axios.get(`${BALLDONTLIE_API}/stats`, {
      headers: { 'Authorization': BALLDONTLIE_KEY },
      params: {
        'seasons[]': 2024,
        per_page: 100
      }
    });

    const { data } = response.data;
    
    const playerStats = data.map((stat: any) => ({
      external_id: `balldontlie_stat_${stat.id}`,
      player_id: stat.player.id,
      player_name: `${stat.player.first_name} ${stat.player.last_name}`,
      game_id: stat.game.id,
      team: stat.team.full_name,
      min: stat.min || '0:00',
      pts: stat.pts || 0,
      ast: stat.ast || 0,
      reb: stat.reb || 0,
      stl: stat.stl || 0,
      blk: stat.blk || 0,
      fg_pct: stat.fg_pct || 0,
      fg3_pct: stat.fg3_pct || 0,
      ft_pct: stat.ft_pct || 0,
      game_date: stat.game.date,
      metadata: {
        fgm: stat.fgm,
        fga: stat.fga,
        fg3m: stat.fg3m,
        fg3a: stat.fg3a,
        ftm: stat.ftm,
        fta: stat.fta,
        oreb: stat.oreb,
        dreb: stat.dreb,
        pf: stat.pf,
        turnover: stat.turnover
      }
    }));

    const { error } = await supabase
      .from('player_stats')
      .upsert(playerStats, { onConflict: 'external_id' });
    
    if (error) throw error;
    
    stats.playerStats += playerStats.length;
  } catch (error: any) {
    console.error(chalk.red('Stats error:', error.message));
    stats.errors++;
  }
}

async function displayStats() {
  const runtime = Math.floor((Date.now() - stats.runtime) / 1000);
  const minutes = Math.floor(runtime / 60);
  const seconds = runtime % 60;
  
  console.clear();
  console.log(chalk.bold.blue('\n🏀 FIXED NBA COLLECTOR - REAL DATA'));
  console.log(chalk.gray('=' .repeat(40)));
  console.log(chalk.white(`\n⏱️  Runtime: ${minutes}m ${seconds}s`));
  console.log(chalk.yellow(`⚡ Rate: ${Math.floor((stats.players + stats.games) / (runtime || 1))} records/sec`));
  
  console.log(chalk.white('\n📊 Collection Progress:'));
  console.log(chalk.green(`  🏃 Players: ${stats.players.toLocaleString()}`));
  console.log(chalk.cyan(`  🏀 Teams: ${stats.teams.toLocaleString()}`));
  console.log(chalk.blue(`  🏈 Games: ${stats.games.toLocaleString()}`));
  console.log(chalk.magenta(`  📈 Stats: ${stats.playerStats.toLocaleString()}`));
  console.log(chalk.red(`  ❌ Errors: ${stats.errors}`));
  
  console.log(chalk.yellow(`\n🔥 Total Records: ${(stats.players + stats.games + stats.playerStats).toLocaleString()}`));
  
  console.log(chalk.gray('\n✅ Collecting REAL NBA data from BallDontLie API...'));
}

async function runContinuousCollection() {
  console.log(chalk.green('🚀 Starting REAL NBA data collection...'));
  console.log(chalk.yellow(`🔑 Using API key: ${BALLDONTLIE_KEY.substring(0, 8)}...`));
  
  // Initial collection
  await collectNBAPlayers();
  await collectNBAGames();
  await collectPlayerStats();
  
  // Continuous updates
  while (true) {
    displayStats();
    
    // Collect new stats every 5 minutes
    await delay(300000); // 5 minutes
    
    await collectPlayerStats();
    await collectNBAGames();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down NBA collector...'));
  displayStats();
  process.exit(0);
});

// Start collection
runContinuousCollection().catch(console.error);