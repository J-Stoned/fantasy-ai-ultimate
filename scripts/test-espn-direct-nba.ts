#!/usr/bin/env tsx
/**
 * Test ESPN API directly and save REAL NBA stats
 */

import axios from 'axios';
import chalk from 'chalk';
import { enhancedDb } from '../lib/services/enhanced-database-service';

async function testAndSaveRealNBAStats() {
  console.log(chalk.bold.cyan('🏀 Testing ESPN NBA API and saving REAL stats...'));

  try {
    // Get today's NBA games
    const scoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
    console.log(chalk.yellow('Fetching NBA scoreboard...'));
    
    const scoreboardRes = await axios.get(scoreboardUrl);
    const events = scoreboardRes.data.events || [];
    
    console.log(chalk.green(`Found ${events.length} NBA games today`));

    // Find a completed game
    const completedGame = events.find((e: any) => e.status.type.completed);
    
    if (!completedGame) {
      console.log(chalk.yellow('No completed games today, fetching recent game...'));
      // Use a known completed game
      const gameId = '401584746'; // Recent game
      await processNBAGame(gameId);
    } else {
      console.log(chalk.green(`Processing completed game: ${completedGame.name}`));
      await processNBAGame(completedGame.id);
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

async function processNBAGame(espnGameId: string) {
  try {
    // Fetch game summary with boxscore
    const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnGameId}`;
    console.log(chalk.cyan(`\nFetching boxscore for game ${espnGameId}...`));
    
    const response = await axios.get(summaryUrl);
    const boxscore = response.data.boxscore;
    
    if (!boxscore?.players) {
      console.log(chalk.red('No boxscore data found'));
      return;
    }

    console.log(chalk.green('✅ Got boxscore data!'));
    
    // First, ensure we have a game record
    const gameInfo = response.data.header;
    const competition = gameInfo.competitions[0];
    
    // Create or update game
    const { data: game } = await enhancedDb.getClient()
      .from('games')
      .upsert({
        external_id: `espn_nba_${espnGameId}`,
        sport: 'NBA',
        home_team_id: parseInt(competition.competitors[0].team.id),
        away_team_id: parseInt(competition.competitors[1].team.id),
        home_score: parseInt(competition.competitors[0].score),
        away_score: parseInt(competition.competitors[1].score),
        status: 'completed',
        start_time: competition.date
      }, { onConflict: 'external_id' })
      .select()
      .single();

    if (!game) {
      console.log(chalk.red('Failed to create game record'));
      return;
    }

    console.log(chalk.green(`Game record created/updated: ${game.id}`));

    // Process each team's players
    let totalPlayersSaved = 0;

    for (const team of boxscore.players) {
      const teamId = parseInt(team.team.id);
      const teamName = team.team.displayName;
      
      console.log(chalk.cyan(`\nProcessing ${teamName}...`));
      
      // Get player statistics
      const athletes = team.statistics?.[0]?.athletes || [];
      
      console.log(chalk.gray(`  Found ${athletes.length} players`));
      
      for (const athlete of athletes) {
        if (!athlete.stats) {
          console.log(chalk.yellow(`  Skipping ${athlete.athlete?.displayName} - no stats`));
          continue;
        }
        if (athlete.stats.length < 14) {
          console.log(chalk.yellow(`  Skipping ${athlete.athlete?.displayName} - only ${athlete.stats.length} stats`));
          continue;
        }
        
        const playerId = parseInt(athlete.athlete.id);
        const playerName = athlete.athlete.displayName;
        
        // Parse stats from array - handle string formats
        const minutesStr = athlete.stats[0] || '0';
        const fgStr = athlete.stats[1] || '0-0';
        const threePtStr = athlete.stats[2] || '0-0';
        const ftStr = athlete.stats[3] || '0-0';
        
        const stats = {
          minutes_played: parseInt(minutesStr) || 0,
          field_goals_made: parseInt(fgStr.split('-')[0]) || 0,
          field_goals_attempted: parseInt(fgStr.split('-')[1]) || 0,
          three_pointers_made: parseInt(threePtStr.split('-')[0]) || 0,
          three_pointers_attempted: parseInt(threePtStr.split('-')[1]) || 0,
          free_throws_made: parseInt(ftStr.split('-')[0]) || 0,
          free_throws_attempted: parseInt(ftStr.split('-')[1]) || 0,
          offensive_rebounds: parseInt(athlete.stats[4]) || 0,
          defensive_rebounds: parseInt(athlete.stats[5]) || 0,
          rebounds: parseInt(athlete.stats[6]) || 0,
          assists: parseInt(athlete.stats[7]) || 0,
          steals: parseInt(athlete.stats[8]) || 0,
          blocks: parseInt(athlete.stats[9]) || 0,
          turnovers: parseInt(athlete.stats[10]) || 0,
          personal_fouls: parseInt(athlete.stats[11]) || 0,
          plus_minus: parseInt(athlete.stats[12]) || 0,
          points: parseInt(athlete.stats[13]) || 0,
          fantasy_points: 0
        };
        
        // Calculate fantasy points (DraftKings scoring)
        stats.fantasy_points = (
          stats.points * 1 +
          stats.rebounds * 1.25 +
          stats.assists * 1.5 +
          stats.steals * 2 +
          stats.blocks * 2 -
          stats.turnovers * 0.5
        );

        // Ensure player exists
        await enhancedDb.getClient()
          .from('players')
          .upsert({
            id: playerId,
            name: playerName,
            team_id: teamId,
            sport: 'basketball'
          }, { onConflict: 'id' });

        // Save player game log with REAL stats
        const { error } = await enhancedDb.getClient()
          .from('player_game_logs')
          .upsert({
            player_id: playerId,
            game_id: game.id,
            team_id: teamId,
            game_date: game.start_time,
            stats: stats,
            fantasy_points: stats.fantasy_points,
            minutes_played: stats.minutes_played,
            is_home: teamId === game.home_team_id
          }, { onConflict: 'player_id,game_id' });

        if (!error) {
          totalPlayersSaved++;
          console.log(chalk.green(`  ✅ ${playerName}: ${stats.points} pts, ${stats.rebounds} reb, ${stats.assists} ast (${stats.fantasy_points.toFixed(1)} FP)`));
        } else {
          console.log(chalk.red(`  ❌ Error saving ${playerName}:`, error.message));
        }
      }
    }

    console.log(chalk.bold.green(`\n🎉 SAVED ${totalPlayersSaved} PLAYERS WITH REAL STATS!`));

    // Verify we actually saved real data
    const { data: savedStats } = await enhancedDb.getClient()
      .from('player_game_logs')
      .select('player_id, stats, fantasy_points')
      .eq('game_id', game.id)
      .limit(3);

    console.log(chalk.cyan('\nVerifying saved data:'));
    savedStats?.forEach(log => {
      const s = log.stats as any;
      console.log(chalk.white(`Player ${log.player_id}: ${s.points} pts, ${s.rebounds} reb, ${s.assists} ast`));
    });

  } catch (error: any) {
    console.error(chalk.red('Error processing game:'), error.message);
  }
}

// Run it!
testAndSaveRealNBAStats().catch(console.error);