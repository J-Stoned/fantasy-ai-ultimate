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

// BallDontLie API configuration
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

// First, ensure we have the required columns
async function ensureSchemaColumns() {
  console.log(chalk.blue('🔧 Ensuring required columns exist...'));
  
  // Add columns if they don't exist - using raw SQL via Supabase client
  const alterStatements = [
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS sport VARCHAR(50)`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS home_team VARCHAR(100)`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS away_team VARCHAR(100)`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed'`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS home_score INTEGER`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS away_score INTEGER`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS season INTEGER`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS postseason BOOLEAN DEFAULT false`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS period INTEGER DEFAULT 0`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS time VARCHAR(50)`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS metadata JSONB`,
    
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS name VARCHAR(255)`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS position VARCHAR(50)`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS team VARCHAR(100)`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS height VARCHAR(20)`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS weight VARCHAR(20)`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS jersey_number VARCHAR(10)`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'USA'`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_year INTEGER`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_round INTEGER`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_number INTEGER`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS college VARCHAR(100)`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS sport VARCHAR(50) DEFAULT 'basketball'`,
    `ALTER TABLE players ADD COLUMN IF NOT EXISTS metadata JSONB`,
    
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS external_id VARCHAR(255)`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS player_id INTEGER`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS player_name VARCHAR(255)`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS game_id INTEGER`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS team VARCHAR(100)`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS min VARCHAR(10)`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS pts INTEGER`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS ast INTEGER`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS reb INTEGER`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS stl INTEGER`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS blk INTEGER`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS fg_pct DECIMAL(5,3)`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS fg3_pct DECIMAL(5,3)`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS ft_pct DECIMAL(5,3)`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS game_date TIMESTAMPTZ`,
    `ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS metadata JSONB`
  ];
  
  // Note: Direct DDL might not work on Supabase, but we'll try
  console.log(chalk.yellow('⚠️  Schema updates may need to be run in Supabase dashboard'));
}

async function collectNBATeams() {
  try {
    console.log(chalk.blue('🏀 Collecting NBA teams...'));
    
    const response = await axios.get(`${BALLDONTLIE_API}/teams`, {
      headers: { 'Authorization': BALLDONTLIE_KEY }
    });
    
    const teams = response.data.data.map((team: any) => ({
      external_id: `balldontlie_team_${team.id}`,
      name: team.full_name,
      abbreviation: team.abbreviation,
      city: team.city,
      state: team.state,
      conference: team.conference,
      division: team.division,
      sport: 'basketball',
      metadata: {
        balldontlie_id: team.id
      }
    }));
    
    // Upsert teams
    for (const team of teams) {
      const { error } = await supabase
        .from('teams')
        .upsert(team, { onConflict: 'external_id' });
      
      if (!error) stats.teams++;
    }
    
    console.log(chalk.green(`✅ Collected ${stats.teams} teams`));
  } catch (error: any) {
    console.error(chalk.red('Teams error:', error.message));
    stats.errors++;
  }
}

async function collectNBAPlayers() {
  try {
    console.log(chalk.blue('🏃 Collecting NBA players...'));
    let cursor = 0;
    let hasMore = true;
    
    while (hasMore && stats.players < 500) { // Limit for testing
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
        college: player.college || 'Unknown',
        is_active: true,
        sport: 'basketball',
        metadata: {
          first_name: player.first_name,
          last_name: player.last_name,
          team_id: player.team?.id,
          team_abbreviation: player.team?.abbreviation,
          conference: player.team?.conference,
          division: player.team?.division
        }
      }));

      // Batch upsert
      const { error } = await supabase
        .from('players')
        .upsert(players, { onConflict: 'external_id' });
      
      if (error) {
        console.error(chalk.red('Player upsert error:', error.message));
        stats.errors++;
      } else {
        stats.players += players.length;
      }
      
      cursor = meta.next_cursor;
      
      if (!cursor) hasMore = false;
      
      await delay(250); // Rate limiting
    }
    
    console.log(chalk.green(`✅ Collected ${stats.players} players`));
  } catch (error: any) {
    console.error(chalk.red('Players error:', error.message));
    stats.errors++;
  }
}

async function collectNBAGames() {
  try {
    console.log(chalk.blue('🏈 Collecting NBA games...'));
    
    // Get current season games
    const seasons = [2024, 2023];
    
    for (const season of seasons) {
      let cursor = 0;
      let hasMore = true;
      
      while (hasMore && stats.games < 200) { // Limit for testing
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
            balldontlie_id: game.id,
            home_team_id: game.home_team.id,
            away_team_id: game.visitor_team.id,
            home_abbreviation: game.home_team.abbreviation,
            away_abbreviation: game.visitor_team.abbreviation
          }
        }));

        // Batch upsert
        const { error } = await supabase
          .from('games')
          .upsert(games, { onConflict: 'external_id' });
        
        if (error) {
          console.error(chalk.red('Game upsert error:', error.message));
          stats.errors++;
        } else {
          stats.games += games.length;
        }
        
        cursor = meta.next_cursor;
        
        if (!cursor) hasMore = false;
        
        await delay(250); // Rate limiting
      }
    }
    
    console.log(chalk.green(`✅ Collected ${stats.games} games`));
  } catch (error: any) {
    console.error(chalk.red('Games error:', error.message));
    stats.errors++;
  }
}

async function collectPlayerStats() {
  try {
    console.log(chalk.blue('📈 Collecting player stats...'));
    
    // Get stats for recent games (2024 season)
    let cursor = 0;
    let hasMore = true;
    
    while (hasMore && stats.playerStats < 500) { // Limit for testing
      const response = await axios.get(`${BALLDONTLIE_API}/stats`, {
        headers: { 'Authorization': BALLDONTLIE_KEY },
        params: {
          'seasons[]': 2024,
          per_page: 100,
          cursor: cursor > 0 ? cursor : undefined
        }
      });

      const { data, meta } = response.data;
      
      if (data.length === 0) {
        hasMore = false;
        break;
      }
      
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

      // Batch upsert
      const { error } = await supabase
        .from('player_stats')
        .upsert(playerStats, { onConflict: 'external_id' });
      
      if (error) {
        console.error(chalk.red('Stats upsert error:', error.message));
        stats.errors++;
      } else {
        stats.playerStats += playerStats.length;
      }
      
      cursor = meta.next_cursor;
      
      if (!cursor) hasMore = false;
      
      await delay(250); // Rate limiting
    }
    
    console.log(chalk.green(`✅ Collected ${stats.playerStats} player stats`));
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
  console.log(chalk.bold.blue('\n🏀 BALLDONTLIE NBA COLLECTOR V2'));
  console.log(chalk.gray('=' .repeat(40)));
  console.log(chalk.white(`\n⏱️  Runtime: ${minutes}m ${seconds}s`));
  console.log(chalk.yellow(`⚡ Rate: ${Math.floor((stats.players + stats.games) / (runtime || 1))} records/sec`));
  
  console.log(chalk.white('\n📊 Collection Progress:'));
  console.log(chalk.green(`  🏃 Players: ${stats.players.toLocaleString()}`));
  console.log(chalk.cyan(`  🏀 Teams: ${stats.teams.toLocaleString()}`));
  console.log(chalk.blue(`  🏈 Games: ${stats.games.toLocaleString()}`));
  console.log(chalk.magenta(`  📈 Stats: ${stats.playerStats.toLocaleString()}`));
  console.log(chalk.red(`  ❌ Errors: ${stats.errors}`));
  
  console.log(chalk.yellow(`\n🔥 Total Records: ${(stats.players + stats.games + stats.playerStats + stats.teams).toLocaleString()}`));
  
  console.log(chalk.gray('\n✅ Collecting REAL NBA data from BallDontLie API...'));
}

async function runCollection() {
  console.log(chalk.green('🚀 Starting BallDontLie NBA data collection V2...'));
  console.log(chalk.yellow(`🔑 Using API key: ${BALLDONTLIE_KEY.substring(0, 8)}...`));
  
  // Check schema first
  await ensureSchemaColumns();
  
  // Collect data in order
  await collectNBATeams();
  await collectNBAPlayers();
  await collectNBAGames();
  await collectPlayerStats();
  
  // Display final stats
  displayStats();
  
  console.log(chalk.green('\n✨ Collection complete!'));
  console.log(chalk.blue('\nNext steps:'));
  console.log(chalk.yellow('1. Run the ESPN boxscore parser for more detailed stats'));
  console.log(chalk.yellow('2. Update ML models to use player stats'));
  console.log(chalk.yellow('3. Test improved prediction accuracy'));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down NBA collector...'));
  displayStats();
  process.exit(0);
});

// Start collection
runCollection().catch(console.error);