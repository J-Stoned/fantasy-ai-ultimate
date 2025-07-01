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

// BallDontLie API with correct auth
const BALLDONTLIE_API = 'https://api.balldontlie.io/v1';
const BALLDONTLIE_KEY = process.env.BALLDONTLIE_API_KEY;

if (!BALLDONTLIE_KEY) {
  console.error(chalk.red('❌ No BALLDONTLIE_API_KEY found!'));
  process.exit(1);
}

let stats = {
  teams: 0,
  players: 0,
  games: 0,
  errors: 0,
  runtime: Date.now()
};

async function collectNBATeams() {
  try {
    console.log(chalk.yellow('Collecting NBA teams...'));
    const response = await axios.get(`${BALLDONTLIE_API}/teams`, {
      headers: { 'Authorization': BALLDONTLIE_KEY }
    });

    const teams = response.data.data;
    
    for (const team of teams) {
      await supabase.from('teams').upsert({
        id: 1000 + team.id, // Offset to avoid conflicts
        name: `${team.city} ${team.name}`,
        abbreviation: team.abbreviation,
        sport_id: 'nba',
        conference: team.conference,
        division: team.division,
        external_id: `balldontlie_team_${team.id}`
      }, { onConflict: 'external_id' });
      
      stats.teams++;
    }
    
    console.log(chalk.green(`✅ Collected ${teams.length} NBA teams`));
  } catch (error: any) {
    console.error(chalk.red('Teams error:', error.message));
    stats.errors++;
  }
}

async function collectNBAPlayers() {
  try {
    console.log(chalk.yellow('Collecting NBA players...'));
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 5) { // Limit pages for initial test
      const response = await axios.get(`${BALLDONTLIE_API}/players`, {
        headers: { 'Authorization': BALLDONTLIE_KEY },
        params: { page, per_page: 100 }
      });

      const players = response.data.data;
      if (players.length === 0) {
        hasMore = false;
        break;
      }

      for (const player of players) {
        // Skip if no name
        if (!player.first_name || !player.last_name) continue;
        
        await supabase.from('players').upsert({
          id: 100000 + player.id, // Offset to avoid conflicts
          name: `${player.first_name} ${player.last_name}`,
          position: player.position || 'Unknown',
          team_id: player.team ? 1000 + player.team.id : null,
          external_id: `balldontlie_player_${player.id}`,
          is_active: true,
          sport: 'basketball'
        }, { onConflict: 'external_id' });
        
        stats.players++;
      }

      console.log(chalk.gray(`  Page ${page}: ${players.length} players`));
      page++;
      await delay(100); // Rate limit
    }
    
    console.log(chalk.green(`✅ Collected ${stats.players} NBA players`));
  } catch (error: any) {
    console.error(chalk.red('Players error:', error.message));
    stats.errors++;
  }
}

async function collectNBAGames() {
  try {
    console.log(chalk.yellow('Collecting NBA games...'));
    const seasons = [2024, 2023];
    
    for (const season of seasons) {
      const response = await axios.get(`${BALLDONTLIE_API}/games`, {
        headers: { 'Authorization': BALLDONTLIE_KEY },
        params: { 
          'seasons[]': season,
          per_page: 100
        }
      });

      const games = response.data.data;
      
      for (const game of games) {
        await supabase.from('games').upsert({
          id: 1000000 + game.id, // Offset to avoid conflicts
          home_team_id: 1000 + game.home_team.id,
          away_team_id: 1000 + game.visitor_team.id,
          home_score: game.home_team_score || 0,
          away_score: game.visitor_team_score || 0,
          status: game.status,
          date: new Date(game.date).toISOString(),
          season: game.season,
          external_id: `balldontlie_game_${game.id}`,
          sport_id: 'nba'
        }, { onConflict: 'external_id' });
        
        stats.games++;
      }
      
      console.log(chalk.gray(`  Season ${season}: ${games.length} games`));
      await delay(200); // Rate limit
    }
    
    console.log(chalk.green(`✅ Collected ${stats.games} NBA games`));
  } catch (error: any) {
    console.error(chalk.red('Games error:', error.message));
    stats.errors++;
  }
}

async function collectLiveScores() {
  try {
    // Get today's games
    const today = new Date().toISOString().split('T')[0];
    const response = await axios.get(`${BALLDONTLIE_API}/games`, {
      headers: { 'Authorization': BALLDONTLIE_KEY },
      params: { 
        'dates[]': today,
        per_page: 100
      }
    });

    const games = response.data.data;
    
    for (const game of games) {
      // Create news/insights for live games
      if (game.status === 'InProgress' || game.status === 'Final') {
        await supabase.from('news_articles').insert({
          title: `${game.visitor_team.full_name} vs ${game.home_team.full_name} - ${game.status}`,
          content: `Score: ${game.visitor_team.name} ${game.visitor_team_score} - ${game.home_team_score} ${game.home_team.name}`,
          summary: `Live NBA game update`,
          source: 'BallDontLie Live',
          published_at: new Date().toISOString(),
          sentiment_score: 0
        });
      }
    }
  } catch (error: any) {
    // Ignore - not critical
  }
}

async function displayStats() {
  const runtime = Math.floor((Date.now() - stats.runtime) / 1000);
  const minutes = Math.floor(runtime / 60);
  const seconds = runtime % 60;
  
  console.clear();
  console.log(chalk.bold.blue('\n🏀 REAL NBA COLLECTOR'));
  console.log(chalk.gray('=' .repeat(30)));
  console.log(chalk.white(`\n⏱️  Runtime: ${minutes}m ${seconds}s`));
  console.log(chalk.yellow(`⚡ Rate: ${Math.floor((stats.teams + stats.players + stats.games) / (runtime || 1))} records/sec`));
  
  console.log(chalk.white('\n📊 Real NBA Data:'));
  console.log(chalk.green(`  🏀 Teams: ${stats.teams}`));
  console.log(chalk.cyan(`  🏃 Players: ${stats.players}`));
  console.log(chalk.blue(`  🏈 Games: ${stats.games}`));
  console.log(chalk.red(`  ❌ Errors: ${stats.errors}`));
  
  console.log(chalk.yellow(`\n🔥 Total: ${stats.teams + stats.players + stats.games} real records`));
  console.log(chalk.gray('\n✅ Using BallDontLie API...'));
}

async function runContinuousCollection() {
  console.log(chalk.green('🚀 Starting REAL NBA collection...'));
  console.log(chalk.yellow(`🔑 API Key: ${BALLDONTLIE_KEY.substring(0, 8)}...`));
  
  // Initial collection
  await collectNBATeams();
  await collectNBAPlayers();
  await collectNBAGames();
  
  // Monitor and update
  while (true) {
    displayStats();
    
    // Collect live scores every minute
    await collectLiveScores();
    
    await delay(60000); // 1 minute
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down...'));
  displayStats();
  process.exit(0);
});

// Start collection
runContinuousCollection().catch(console.error);