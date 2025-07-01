#!/usr/bin/env tsx
/**
 * 🏀 TURBO NBA COLLECTOR - Maximum NBA data collection
 * Uses correct BallDontLie v1 endpoints
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stats = {
  players: 0,
  games: 0,
  stats: 0,
  teams: 0,
  errors: 0,
  startTime: Date.now()
};

// BallDontLie v1 API (no auth needed)
const API_BASE = 'https://api.balldontlie.io/v1';

async function collectAllPlayers() {
  console.log(chalk.blue('📥 Collecting ALL NBA players...'));
  
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const response = await axios.get(`${API_BASE}/players`, {
        params: { page, per_page: 100 }
      });
      
      const { data, meta } = response.data;
      
      for (const player of data) {
        if (player.first_name && player.last_name) {
          await supabase.from('players').upsert({
            firstname: player.first_name,
            lastname: player.last_name,
            position: player.position || 'G',
            team_id: player.team?.id || null,
            sport_id: 'nba',
            status: 'active',
            heightinches: player.height_feet ? (player.height_feet * 12 + (player.height_inches || 0)) : null,
            weightlbs: player.weight_pounds || null,
            external_id: `balldontlie_${player.id}`
          }, { onConflict: 'external_id' });
          
          stats.players++;
        }
      }
      
      console.log(chalk.gray(`  Page ${page}/${meta.total_pages} - ${stats.players} players collected`));
      
      hasMore = page < meta.total_pages;
      page++;
      
      // Rate limit: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(chalk.red(`Error on page ${page}:`, error.message));
      stats.errors++;
      hasMore = false;
    }
  }
}

async function collectAllTeams() {
  console.log(chalk.blue('📥 Collecting all NBA teams...'));
  
  try {
    const response = await axios.get(`${API_BASE}/teams`);
    const teams = response.data.data;
    
    for (const team of teams) {
      await supabase.from('teams').upsert({
        id: team.id,
        name: `${team.city} ${team.name}`,
        abbreviation: team.abbreviation,
        sport_id: 'nba',
        conference: team.conference,
        division: team.division,
        external_id: `balldontlie_team_${team.id}`
      }, { onConflict: 'external_id' });
      
      stats.teams++;
    }
    
    console.log(chalk.green(`✅ Collected ${stats.teams} NBA teams`));
  } catch (error: any) {
    console.error(chalk.red('Team collection error:', error.message));
    stats.errors++;
  }
}

async function collectSeasonGames(season: number) {
  console.log(chalk.blue(`📥 Collecting ${season} season games...`));
  
  let page = 1;
  let hasMore = true;
  let seasonGames = 0;
  
  while (hasMore) {
    try {
      const response = await axios.get(`${API_BASE}/games`, {
        params: { 
          seasons: [season],
          page,
          per_page: 100
        }
      });
      
      const { data, meta } = response.data;
      
      for (const game of data) {
        await supabase.from('games').upsert({
          home_team_id: game.home_team.id,
          away_team_id: game.visitor_team.id,
          home_score: game.home_team_score,
          away_score: game.visitor_team_score,
          start_time: game.date,
          status: game.status,
          sport_id: 'nba',
          season: game.season,
          external_id: `balldontlie_game_${game.id}`
        }, { onConflict: 'external_id' });
        
        stats.games++;
        seasonGames++;
      }
      
      console.log(chalk.gray(`  Season ${season}, Page ${page}/${meta.total_pages} - ${seasonGames} games`));
      
      hasMore = page < meta.total_pages;
      page++;
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(chalk.red(`Error collecting ${season} games:`, error.message));
      stats.errors++;
      hasMore = false;
    }
  }
}

async function collectPlayerStats(season: number) {
  console.log(chalk.blue(`📥 Collecting ${season} player stats...`));
  
  let page = 1;
  let hasMore = true;
  let seasonStats = 0;
  
  while (hasMore && page <= 50) { // Limit to first 50 pages for speed
    try {
      const response = await axios.get(`${API_BASE}/stats`, {
        params: {
          seasons: [season],
          page,
          per_page: 100
        }
      });
      
      const { data, meta } = response.data;
      
      for (const stat of data) {
        if (stat.player && stat.game && stat.min) {
          await supabase.from('player_stats').upsert({
            player_id: stat.player.id,
            game_id: stat.game.id,
            season: stat.game.season,
            points: stat.pts || 0,
            assists: stat.ast || 0,
            rebounds: stat.reb || 0,
            steals: stat.stl || 0,
            blocks: stat.blk || 0,
            turnovers: stat.turnover || 0,
            field_goals_made: stat.fgm || 0,
            field_goals_attempted: stat.fga || 0,
            three_pointers_made: stat.fg3m || 0,
            three_pointers_attempted: stat.fg3a || 0,
            free_throws_made: stat.ftm || 0,
            free_throws_attempted: stat.fta || 0,
            minutes: stat.min || '0:00',
            fantasy_points: calculateFantasyPoints(stat),
            external_id: `balldontlie_stat_${stat.id}`
          }, { onConflict: 'external_id' });
          
          stats.stats++;
          seasonStats++;
        }
      }
      
      console.log(chalk.gray(`  Season ${season}, Page ${page} - ${seasonStats} stats`));
      
      hasMore = page < meta.total_pages;
      page++;
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(chalk.red(`Error collecting ${season} stats:`, error.message));
      stats.errors++;
      hasMore = false;
    }
  }
}

function calculateFantasyPoints(stat: any): number {
  // Standard fantasy scoring
  return (stat.pts || 0) * 1 +
         (stat.reb || 0) * 1.2 +
         (stat.ast || 0) * 1.5 +
         (stat.stl || 0) * 3 +
         (stat.blk || 0) * 3 +
         (stat.turnover || 0) * -1;
}

function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  
  console.clear();
  console.log(chalk.blue('🏀 TURBO NBA COLLECTOR'));
  console.log(chalk.blue('=====================\n'));
  
  console.log(chalk.gray(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.gray(`⚡ Rate: ${Math.floor((stats.players + stats.games + stats.stats) / (runtime || 1))} records/sec\n`));
  
  console.log('📊 Collection Progress:');
  console.log(`  🏃 Players: ${stats.players.toLocaleString()}`);
  console.log(`  🏀 Teams: ${stats.teams}`);
  console.log(`  🏈 Games: ${stats.games.toLocaleString()}`);
  console.log(`  📈 Stats: ${stats.stats.toLocaleString()}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  
  const total = stats.players + stats.games + stats.stats + stats.teams;
  console.log(chalk.green(`\n🔥 Total Records: ${total.toLocaleString()}`));
}

async function main() {
  console.log(chalk.blue('🚀 TURBO NBA COLLECTOR - MAXIMUM SPEED\n'));
  
  // Test database
  const { error } = await supabase.from('players').select('count').limit(1);
  if (error) {
    console.error(chalk.red('Database error:'), error.message);
    return;
  }
  
  console.log(chalk.green('✅ Database connected!\n'));
  
  // Collect all data
  await collectAllTeams();
  await collectAllPlayers();
  
  // Collect multiple seasons in parallel
  const currentYear = new Date().getFullYear();
  const seasons = [
    currentYear - 1,  // Last season
    currentYear - 2,  // 2 seasons ago
    currentYear - 3   // 3 seasons ago
  ];
  
  // Collect games for each season
  for (const season of seasons) {
    await collectSeasonGames(season);
  }
  
  // Collect stats for recent seasons
  for (const season of seasons.slice(0, 2)) { // Just last 2 seasons for stats
    await collectPlayerStats(season);
  }
  
  // Show final stats
  showStats();
  
  // Continue collecting latest data
  console.log(chalk.blue('\n📡 Monitoring for new data...'));
  
  setInterval(async () => {
    await collectSeasonGames(currentYear - 1);
    await collectPlayerStats(currentYear - 1);
    showStats();
  }, 300000); // Every 5 minutes
}

main().catch(console.error);