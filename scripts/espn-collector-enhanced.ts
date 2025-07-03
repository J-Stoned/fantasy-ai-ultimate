#!/usr/bin/env tsx
/**
 * Enhanced ESPN Data Collector
 * Uses the schema adapter to work with both simple and complex schemas
 */

import chalk from 'chalk';
import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

import { schemaAdapter } from '../lib/db/schema-adapter';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ESPN doesn't require API key for public data
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports';

let stats = {
  gamesProcessed: 0,
  playersCreated: 0,
  playerStatsCreated: 0,
  errors: 0,
  runtime: Date.now()
};

async function collectNFLWeekData() {
  console.log(chalk.blue('🏈 Collecting NFL data from ESPN...'));
  
  try {
    // Get current NFL scoreboard
    const scoreboardUrl = `${ESPN_API}/football/nfl/scoreboard`;
    const scoreboardResponse = await axios.get(scoreboardUrl);
    const events = scoreboardResponse.data.events || [];
    
    console.log(chalk.yellow(`Found ${events.length} NFL games`));
    
    for (const event of events) {
      await processGame(event, 'nfl');
      await delay(1000); // Rate limiting
    }
  } catch (error: any) {
    console.error(chalk.red('NFL collection error:'), error.message);
    stats.errors++;
  }
}

async function collectNBAData() {
  console.log(chalk.blue('\n🏀 Collecting NBA data from ESPN...'));
  
  try {
    const scoreboardUrl = `${ESPN_API}/basketball/nba/scoreboard`;
    const response = await axios.get(scoreboardUrl);
    const events = response.data.events || [];
    
    console.log(chalk.yellow(`Found ${events.length} NBA games`));
    
    for (const event of events.slice(0, 5)) { // Limit for testing
      await processGame(event, 'nba');
      await delay(1000);
    }
  } catch (error: any) {
    console.error(chalk.red('NBA collection error:'), error.message);
    stats.errors++;
  }
}

async function processGame(event: any, sport: string) {
  try {
    const gameId = event.id;
    const competition = event.competitions[0];
    const homeTeam = competition.competitors.find((t: any) => t.homeAway === 'home');
    const awayTeam = competition.competitors.find((t: any) => t.homeAway === 'away');
    
    // Insert or update game using adapter
    const dbGameId = await schemaAdapter.upsertGame({
      external_id: `espn_${gameId}`,
      home_team: homeTeam.team.displayName,
      away_team: awayTeam.team.displayName,
      home_score: parseInt(homeTeam.score) || 0,
      away_score: parseInt(awayTeam.score) || 0,
      status: event.status.type.name,
      game_date: event.date,
      sport: sport
    });
    
    if (!dbGameId) {
      console.error(chalk.red('Failed to create game'));
      return;
    }
    
    stats.gamesProcessed++;
    
    // Get boxscore data if game is completed
    if (event.status.type.completed) {
      await collectGameBoxscore(gameId, dbGameId, sport);
    }
    
    console.log(chalk.green(`✅ Processed ${homeTeam.team.displayName} vs ${awayTeam.team.displayName}`));
    
  } catch (error: any) {
    console.error(chalk.red('Game processing error:'), error.message);
    stats.errors++;
  }
}

async function collectGameBoxscore(espnGameId: string, dbGameId: number, sport: string) {
  try {
    const boxscoreUrl = `${ESPN_API}/${sport === 'nba' ? 'basketball/nba' : 'football/nfl'}/summary?event=${espnGameId}`;
    const response = await axios.get(boxscoreUrl);
    const data = response.data;
    
    if (!data.boxscore?.players) {
      return;
    }
    
    // Process NFL boxscore
    if (sport === 'nfl') {
      await processNFLBoxscore(data.boxscore, dbGameId);
    } 
    // Process NBA boxscore
    else if (sport === 'nba') {
      await processNBABoxscore(data.boxscore, dbGameId);
    }
    
  } catch (error: any) {
    console.error(chalk.red(`Boxscore error:`, error.message));
    stats.errors++;
  }
}

async function processNFLBoxscore(boxscore: any, gameId: number) {
  for (const teamData of boxscore.players) {
    const teamName = teamData.team.displayName;
    
    // Process each stat category
    for (const statGroup of teamData.statistics || []) {
      const category = statGroup.name.toLowerCase();
      
      for (const athleteData of statGroup.athletes || []) {
        const athlete = athleteData.athlete;
        
        // Create/update player using adapter
        const playerId = await schemaAdapter.upsertPlayer({
          external_id: `espn_player_${athlete.id}`,
          name: athlete.displayName,
          position: athlete.position?.abbreviation || 'Unknown',
          team: teamName,
          sport: 'football',
          metadata: {
            espn_id: athlete.id,
            jersey: athlete.jersey
          }
        }, 'espn');
        
        if (!playerId) continue;
        
        // Parse stats based on category
        const stats: Record<string, number> = {};
        let fantasyPoints = 0;
        
        if (category === 'passing' && athleteData.stats.length >= 9) {
          stats.completions = parseInt(athleteData.stats[0]) || 0;
          stats.attempts = parseInt(athleteData.stats[1]) || 0;
          stats.passing_yards = parseInt(athleteData.stats[2]) || 0;
          stats.passing_tds = parseInt(athleteData.stats[3]) || 0;
          stats.interceptions = parseInt(athleteData.stats[4]) || 0;
          stats.sacks = parseInt(athleteData.stats[5]) || 0;
          stats.qbr = parseFloat(athleteData.stats[8]) || 0;
          
          // Calculate fantasy points (standard scoring)
          fantasyPoints = (stats.passing_yards / 25) + (stats.passing_tds * 4) - (stats.interceptions * 2);
        } else if (category === 'rushing' && athleteData.stats.length >= 5) {
          stats.carries = parseInt(athleteData.stats[0]) || 0;
          stats.rushing_yards = parseInt(athleteData.stats[1]) || 0;
          stats.rushing_avg = parseFloat(athleteData.stats[2]) || 0;
          stats.rushing_tds = parseInt(athleteData.stats[3]) || 0;
          stats.long = parseInt(athleteData.stats[4]) || 0;
          
          fantasyPoints = (stats.rushing_yards / 10) + (stats.rushing_tds * 6);
        } else if (category === 'receiving' && athleteData.stats.length >= 6) {
          stats.receptions = parseInt(athleteData.stats[0]) || 0;
          stats.targets = parseInt(athleteData.stats[1]) || 0;
          stats.receiving_yards = parseInt(athleteData.stats[2]) || 0;
          stats.receiving_avg = parseFloat(athleteData.stats[3]) || 0;
          stats.receiving_tds = parseInt(athleteData.stats[4]) || 0;
          stats.long = parseInt(athleteData.stats[5]) || 0;
          
          fantasyPoints = stats.receptions + (stats.receiving_yards / 10) + (stats.receiving_tds * 6);
        }
        
        // Store stats using adapter
        if (Object.keys(stats).length > 0) {
          const success = await schemaAdapter.upsertPlayerStats({
            player_id: playerId,
            game_id: gameId,
            stats: stats,
            fantasy_points: Math.round(fantasyPoints * 10) / 10,
            game_date: new Date().toISOString()
          });
          
          if (success) {
            stats.playerStatsCreated++;
          }
        }
        
        stats.playersCreated++;
      }
    }
  }
}

async function processNBABoxscore(boxscore: any, gameId: number) {
  for (const teamData of boxscore.players) {
    const teamName = teamData.team.displayName;
    const athletes = teamData.statistics?.[0]?.athletes || [];
    
    for (const athleteData of athletes) {
      const athlete = athleteData.athlete;
      const playerStats = athleteData.stats || [];
      
      if (playerStats.length < 15) continue; // Need full stats
      
      // Create/update player
      const playerId = await schemaAdapter.upsertPlayer({
        external_id: `espn_player_${athlete.id}`,
        name: athlete.displayName,
        position: athlete.position?.abbreviation || 'Unknown',
        team: teamName,
        sport: 'basketball',
        metadata: {
          espn_id: athlete.id,
          jersey: athlete.jersey
        }
      }, 'espn');
      
      if (!playerId) continue;
      
      // Parse NBA stats
      const stats: Record<string, number> = {
        minutes: parseInt(playerStats[0]?.replace(':', '')) || 0,
        points: parseInt(playerStats[14]) || 0,
        rebounds: parseInt(playerStats[1]) || 0,
        assists: parseInt(playerStats[2]) || 0,
        steals: parseInt(playerStats[3]) || 0,
        blocks: parseInt(playerStats[4]) || 0,
        fg_made: parseInt(playerStats[5]?.split('-')[0]) || 0,
        fg_att: parseInt(playerStats[5]?.split('-')[1]) || 0,
        three_made: parseInt(playerStats[6]?.split('-')[0]) || 0,
        three_att: parseInt(playerStats[6]?.split('-')[1]) || 0,
        ft_made: parseInt(playerStats[7]?.split('-')[0]) || 0,
        ft_att: parseInt(playerStats[7]?.split('-')[1]) || 0,
        oreb: parseInt(playerStats[8]) || 0,
        dreb: parseInt(playerStats[9]) || 0,
        fouls: parseInt(playerStats[10]) || 0,
        plus_minus: parseInt(playerStats[13]?.replace('+', '')) || 0
      };
      
      // Calculate DFS fantasy points
      const fantasyPoints = stats.points + (stats.rebounds * 1.2) + (stats.assists * 1.5) + 
                          (stats.steals * 3) + (stats.blocks * 3) - (stats.turnovers || 0);
      
      // Store stats
      const success = await schemaAdapter.upsertPlayerStats({
        player_id: playerId,
        game_id: gameId,
        stats: stats,
        fantasy_points: Math.round(fantasyPoints * 10) / 10,
        game_date: new Date().toISOString()
      });
      
      if (success) {
        stats.playerStatsCreated++;
      }
      
      stats.playersCreated++;
    }
  }
}

function displayStats() {
  const runtime = Math.floor((Date.now() - stats.runtime) / 1000);
  const minutes = Math.floor(runtime / 60);
  const seconds = runtime % 60;
  
  console.log(chalk.bold.yellow('\n📊 ESPN ENHANCED COLLECTOR STATS'));
  console.log(chalk.gray('=' .repeat(50)));
  console.log(chalk.white(`⏱️  Runtime: ${minutes}m ${seconds}s`));
  console.log(chalk.blue(`🏈 Games Processed: ${stats.gamesProcessed}`));
  console.log(chalk.cyan(`🏃 Players Created/Updated: ${stats.playersCreated}`));
  console.log(chalk.green(`📈 Player Stats Created: ${stats.playerStatsCreated}`));
  console.log(chalk.red(`❌ Errors: ${stats.errors}`));
}

async function main() {
  console.log(chalk.bold.green('🚀 ESPN ENHANCED DATA COLLECTOR'));
  console.log(chalk.yellow('Using schema adapter for compatibility\n'));
  
  // Collect NFL data
  await collectNFLWeekData();
  
  // Collect NBA data
  await collectNBAData();
  
  // Display results
  displayStats();
  
  console.log(chalk.green('\n✨ Collection complete!'));
  console.log(chalk.blue('\nNext steps:'));
  console.log('1. Run schema verification: npx tsx scripts/verify-enhancements.ts');
  console.log('2. Check player_stats and player_game_logs tables');
  console.log('3. Update ML training to use new data');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down...'));
  displayStats();
  process.exit(0);
});

// Run the collector
main().catch(console.error);