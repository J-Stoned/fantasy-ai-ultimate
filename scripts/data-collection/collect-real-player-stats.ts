#!/usr/bin/env tsx
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

let stats = {
  gamesProcessed: 0,
  playerStatsCreated: 0,
  playersCreated: 0,
  errors: 0,
  runtime: Date.now()
};

// Use ESPN's hidden API endpoints that don't require authentication
async function collectNFLWeekData() {
  console.log(chalk.blue('🏈 Collecting NFL data from ESPN...'));
  
  try {
    // Get current NFL week
    const scoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
    const scoreboardResponse = await axios.get(scoreboardUrl);
    const events = scoreboardResponse.data.events || [];
    
    console.log(chalk.yellow(`Found ${events.length} NFL games`));
    
    for (const event of events) {
      const gameId = event.id;
      const homeTeam = event.competitions[0].competitors.find((t: any) => t.homeAway === 'home');
      const awayTeam = event.competitions[0].competitors.find((t: any) => t.homeAway === 'away');
      
      // Insert or update game
      const gameData = {
        external_id: `espn_${gameId}`,
        sport_id: 'nfl',
        home_team_id: parseInt(homeTeam.id),
        away_team_id: parseInt(awayTeam.id),
        home_score: parseInt(homeTeam.score) || 0,
        away_score: parseInt(awayTeam.score) || 0,
        status: event.status.type.name,
        start_time: event.date,
        venue: event.competitions[0].venue?.fullName || null
      };
      
      const { data: game, error: gameError } = await supabase
        .from('games')
        .upsert(gameData, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (gameError) {
        console.error(chalk.red('Game insert error:'), gameError);
        continue;
      }
      
      stats.gamesProcessed++;
      
      // Get boxscore data if game is completed
      if (event.status.type.completed) {
        await collectGameBoxscore(gameId, game.id, homeTeam.team.displayName, awayTeam.team.displayName);
      }
      
      await delay(1000); // Rate limiting
    }
  } catch (error: any) {
    console.error(chalk.red('NFL collection error:'), error.message);
    stats.errors++;
  }
}

// Collect detailed player stats from boxscore
async function collectGameBoxscore(espnGameId: string, dbGameId: number, homeTeam: string, awayTeam: string) {
  try {
    const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
    const response = await axios.get(boxscoreUrl);
    const data = response.data;
    
    if (!data.boxscore?.players) {
      return;
    }
    
    console.log(chalk.gray(`  Processing ${homeTeam} vs ${awayTeam}...`));
    
    // Process each team's players
    for (const teamData of data.boxscore.players) {
      const teamName = teamData.team.displayName;
      
      // Process each stat category
      for (const statGroup of teamData.statistics || []) {
        const category = statGroup.name.toLowerCase();
        
        for (const athleteData of statGroup.athletes || []) {
          const athlete = athleteData.athlete;
          
          // Ensure player exists
          const playerData = {
            external_id: `espn_player_${athlete.id}`,
            name: athlete.displayName,
            position: athlete.position?.abbreviation || 'Unknown',
            team: teamName,
            jersey_number: athlete.jersey || null,
            sport: 'football'
          };
          
          const { data: player, error: playerError } = await supabase
            .from('players')
            .upsert(playerData, { onConflict: 'external_id' })
            .select()
            .single();
          
          if (!playerError && player) {
            stats.playersCreated++;
          }
          
          // Create player stats entry
          const statsData: any = {
            external_id: `espn_stats_${dbGameId}_${athlete.id}_${category}`,
            player_id: player?.id || null,
            player_name: athlete.displayName,
            game_id: dbGameId,
            team: teamName,
            stat_category: category,
            game_date: new Date().toISOString(),
            metadata: {
              espn_player_id: athlete.id,
              position: athlete.position?.abbreviation,
              stats_array: athleteData.stats
            }
          };
          
          // Parse category-specific stats
          if (category === 'passing' && athleteData.stats.length >= 9) {
            statsData.pts = 0; // Will calculate fantasy points
            statsData.metadata.completions = parseInt(athleteData.stats[0]) || 0;
            statsData.metadata.attempts = parseInt(athleteData.stats[1]) || 0;
            statsData.metadata.passing_yards = parseInt(athleteData.stats[2]) || 0;
            statsData.metadata.passing_tds = parseInt(athleteData.stats[3]) || 0;
            statsData.metadata.interceptions = parseInt(athleteData.stats[4]) || 0;
            statsData.metadata.sacks = parseInt(athleteData.stats[5]) || 0;
            statsData.metadata.qbr = parseFloat(athleteData.stats[8]) || 0;
            
            // Calculate fantasy points (standard scoring)
            statsData.pts = Math.round((
              (statsData.metadata.passing_yards / 25) +
              (statsData.metadata.passing_tds * 4) -
              (statsData.metadata.interceptions * 2)
            ) * 10) / 10;
          } else if (category === 'rushing' && athleteData.stats.length >= 5) {
            statsData.metadata.carries = parseInt(athleteData.stats[0]) || 0;
            statsData.metadata.rushing_yards = parseInt(athleteData.stats[1]) || 0;
            statsData.metadata.rushing_avg = parseFloat(athleteData.stats[2]) || 0;
            statsData.metadata.rushing_tds = parseInt(athleteData.stats[3]) || 0;
            statsData.metadata.long = parseInt(athleteData.stats[4]) || 0;
            
            statsData.pts = Math.round((
              (statsData.metadata.rushing_yards / 10) +
              (statsData.metadata.rushing_tds * 6)
            ) * 10) / 10;
          } else if (category === 'receiving' && athleteData.stats.length >= 6) {
            statsData.metadata.receptions = parseInt(athleteData.stats[0]) || 0;
            statsData.metadata.targets = parseInt(athleteData.stats[1]) || 0;
            statsData.metadata.receiving_yards = parseInt(athleteData.stats[2]) || 0;
            statsData.metadata.receiving_avg = parseFloat(athleteData.stats[3]) || 0;
            statsData.metadata.receiving_tds = parseInt(athleteData.stats[4]) || 0;
            statsData.metadata.long = parseInt(athleteData.stats[5]) || 0;
            
            statsData.pts = Math.round((
              statsData.metadata.receptions +
              (statsData.metadata.receiving_yards / 10) +
              (statsData.metadata.receiving_tds * 6)
            ) * 10) / 10;
          }
          
          // Insert player stats
          const { error: statsError } = await supabase
            .from('player_stats')
            .upsert(statsData, { onConflict: 'external_id' });
          
          if (!statsError) {
            stats.playerStatsCreated++;
          } else {
            console.error(chalk.red('Stats error:'), statsError);
          }
        }
      }
    }
    
    console.log(chalk.green(`    ✅ Collected stats for ${homeTeam} vs ${awayTeam}`));
    
  } catch (error: any) {
    console.error(chalk.red(`  Error processing boxscore:`, error.message));
    stats.errors++;
  }
}

// Collect NBA data
async function collectNBAData() {
  console.log(chalk.blue('\n🏀 Collecting NBA data from ESPN...'));
  
  try {
    const scoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
    const response = await axios.get(scoreboardUrl);
    const events = response.data.events || [];
    
    console.log(chalk.yellow(`Found ${events.length} NBA games`));
    
    for (const event of events.slice(0, 5)) { // Limit to 5 games for testing
      if (!event.status.type.completed) continue;
      
      const gameId = event.id;
      const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
      const boxResponse = await axios.get(boxscoreUrl);
      const boxData = boxResponse.data;
      
      if (!boxData.boxscore?.players) continue;
      
      // Process each team
      for (const teamData of boxData.boxscore.players) {
        const teamName = teamData.team.displayName;
        const athletes = teamData.statistics?.[0]?.athletes || [];
        
        for (const athleteData of athletes) {
          const athlete = athleteData.athlete;
          const playerStats = athleteData.stats || [];
          
          if (playerStats.length < 15) continue; // Need full stats
          
          // Create comprehensive NBA stats
          const statsData = {
            external_id: `espn_nba_${gameId}_${athlete.id}`,
            player_name: athlete.displayName,
            team: teamName,
            stat_category: 'box_score',
            pts: parseInt(playerStats[14]) || 0, // Points
            ast: parseInt(playerStats[2]) || 0,  // Assists
            reb: parseInt(playerStats[1]) || 0,  // Rebounds
            stl: parseInt(playerStats[3]) || 0,  // Steals
            blk: parseInt(playerStats[4]) || 0,  // Blocks
            min: playerStats[0] || '0',          // Minutes
            metadata: {
              espn_player_id: athlete.id,
              position: athlete.position?.abbreviation,
              fg: playerStats[5],    // Field goals made-attempted
              three_pt: playerStats[6], // 3-pointers made-attempted
              ft: playerStats[7],    // Free throws made-attempted
              oreb: parseInt(playerStats[8]) || 0,  // Offensive rebounds
              dreb: parseInt(playerStats[9]) || 0,  // Defensive rebounds
              pf: parseInt(playerStats[10]) || 0,   // Personal fouls
              plusminus: playerStats[13] || '+0',    // Plus/minus
              fantasy_points: 0
            }
          };
          
          // Calculate DFS fantasy points
          statsData.metadata.fantasy_points = Math.round((
            statsData.pts +
            (statsData.reb * 1.2) +
            (statsData.ast * 1.5) +
            (statsData.stl * 3) +
            (statsData.blk * 3)
          ) * 10) / 10;
          
          const { error } = await supabase
            .from('player_stats')
            .upsert(statsData, { onConflict: 'external_id' });
          
          if (!error) {
            stats.playerStatsCreated++;
          }
        }
      }
      
      stats.gamesProcessed++;
      await delay(1000); // Rate limiting
    }
  } catch (error: any) {
    console.error(chalk.red('NBA collection error:'), error.message);
    stats.errors++;
  }
}

// Display final statistics
function displayStats() {
  const runtime = Math.floor((Date.now() - stats.runtime) / 1000);
  const minutes = Math.floor(runtime / 60);
  const seconds = runtime % 60;
  
  console.log(chalk.bold.yellow('\n📊 REAL PLAYER STATS COLLECTION COMPLETE'));
  console.log(chalk.gray('=' .repeat(50)));
  console.log(chalk.white(`⏱️  Runtime: ${minutes}m ${seconds}s`));
  console.log(chalk.blue(`🏈 Games Processed: ${stats.gamesProcessed}`));
  console.log(chalk.green(`📈 Player Stats Created: ${stats.playerStatsCreated}`));
  console.log(chalk.cyan(`🏃 Players Created: ${stats.playersCreated}`));
  console.log(chalk.red(`❌ Errors: ${stats.errors}`));
}

// Main execution
async function main() {
  console.log(chalk.bold.green('🚀 STARTING REAL PLAYER STATS COLLECTION'));
  console.log(chalk.yellow('Using ESPN public API (no authentication required)\n'));
  
  // Collect NFL data
  await collectNFLWeekData();
  
  // Collect NBA data
  await collectNBAData();
  
  // Display results
  displayStats();
  
  console.log(chalk.green('\n✨ Collection complete!'));
  console.log(chalk.blue('\nNext steps:'));
  console.log('1. Verify player_stats table has new records');
  console.log('2. Update ML feature engineering to include player performance');
  console.log('3. Retrain models targeting 55-60% accuracy');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down...'));
  displayStats();
  process.exit(0);
});

// Run the collector
main().catch(console.error);