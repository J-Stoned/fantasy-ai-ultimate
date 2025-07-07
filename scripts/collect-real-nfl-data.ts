#!/usr/bin/env tsx
/**
 * 🏈 REAL NFL DATA COLLECTOR
 * Actually collects NFL data from legitimate sources
 * No fake data, no basketball stats, real NFL only!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import { config } from 'dotenv';
import pLimit from 'p-limit';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiting
const limit = pLimit(5);

// ESPN endpoints that actually work
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

// Stats we actually need for NFL
const NFL_STAT_TYPES = {
  // Passing
  passing_attempts: 'passing_attempts',
  passing_completions: 'passing_completions', 
  passing_yards: 'passing_yards',
  passing_touchdowns: 'passing_touchdowns',
  interceptions: 'interceptions',
  
  // Rushing
  rushing_attempts: 'rushing_attempts',
  rushing_yards: 'rushing_yards',
  rushing_touchdowns: 'rushing_touchdowns',
  
  // Receiving  
  receptions: 'receptions',
  receiving_yards: 'receiving_yards',
  receiving_touchdowns: 'receiving_touchdowns',
  targets: 'targets',
  
  // Defense
  tackles: 'tackles',
  sacks: 'sacks',
  interceptions_def: 'interceptions_def',
  forced_fumbles: 'forced_fumbles',
  
  // Kicking
  field_goals_made: 'field_goals_made',
  field_goals_attempted: 'field_goals_attempted',
  extra_points_made: 'extra_points_made',
  
  // Fantasy
  fantasy_points: 'fantasy_points'
};

class RealNFLCollector {
  private stats = {
    games: 0,
    players: 0,
    playerStats: 0,
    teams: 0,
    errors: 0
  };
  
  async collect() {
    console.log(chalk.blue.bold('🏈 Starting REAL NFL Data Collection\n'));
    
    try {
      // 1. Get NFL teams first
      await this.collectNFLTeams();
      
      // 2. Get current season games
      await this.collectNFLGames();
      
      // 3. Get player stats for completed games
      await this.collectPlayerStats();
      
      console.log(chalk.green.bold('\n✅ Collection Complete!'));
      console.log(chalk.cyan('Stats:'), this.stats);
      
    } catch (error) {
      console.error(chalk.red('Collection failed:'), error);
    }
  }
  
  private async collectNFLTeams() {
    console.log(chalk.yellow('📍 Collecting NFL Teams...'));
    
    try {
      const response = await axios.get(`${ESPN_BASE}/teams`);
      const teams = response.data.sports[0].leagues[0].teams;
      
      for (const team of teams) {
        const teamData = {
          id: `nfl_${team.team.id}`,
          name: team.team.displayName,
          abbreviation: team.team.abbreviation,
          sport: 'nfl',
          conference: team.team.groups?.name || null,
          division: team.team.parent?.name || null,
          logo_url: team.team.logos?.[0]?.href || null,
          primary_color: team.team.color || null
        };
        
        await supabase
          .from('teams')
          .upsert(teamData, { onConflict: 'id' });
          
        this.stats.teams++;
      }
      
      console.log(chalk.green(`✓ Collected ${this.stats.teams} NFL teams`));
    } catch (error) {
      console.error(chalk.red('Failed to collect teams:'), error);
      this.stats.errors++;
    }
  }
  
  private async collectNFLGames() {
    console.log(chalk.yellow('\n📍 Collecting NFL Games...'));
    
    // Get games from current and last season
    const seasons = [2023, 2024];
    
    for (const season of seasons) {
      try {
        // Regular season weeks 1-18
        for (let week = 1; week <= 18; week++) {
          await limit(async () => {
            try {
              const response = await axios.get(
                `${ESPN_BASE}/scoreboard?seasontype=2&week=${week}&dates=${season}`
              );
              
              const events = response.data.events || [];
              
              for (const event of events) {
                const competition = event.competitions[0];
                const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
                const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
                
                const gameData = {
                  id: event.id,
                  sport: 'nfl',
                  season: season,
                  week: week,
                  start_time: event.date,
                  status: event.status.type.name,
                  home_team_id: `nfl_${homeTeam.team.id}`,
                  away_team_id: `nfl_${awayTeam.team.id}`,
                  home_score: homeTeam.score ? parseInt(homeTeam.score) : null,
                  away_score: awayTeam.score ? parseInt(awayTeam.score) : null,
                  venue: competition.venue?.fullName || null,
                  attendance: competition.attendance || null
                };
                
                await supabase
                  .from('games')
                  .upsert(gameData, { onConflict: 'id' });
                  
                this.stats.games++;
                
                // If game is completed, get stats
                if (event.status.type.completed) {
                  await this.collectGameStats(event.id);
                }
              }
              
              console.log(chalk.gray(`  Week ${week}: ${events.length} games`));
            } catch (error) {
              console.error(chalk.red(`Failed week ${week}:`), error.message);
            }
          });
        }
      } catch (error) {
        console.error(chalk.red(`Failed season ${season}:`), error);
        this.stats.errors++;
      }
    }
    
    console.log(chalk.green(`✓ Collected ${this.stats.games} NFL games`));
  }
  
  private async collectGameStats(gameId: string) {
    try {
      // Get boxscore for the game
      const response = await axios.get(
        `${ESPN_BASE}/summary?event=${gameId}`
      );
      
      const boxscore = response.data.boxscore;
      if (!boxscore || !boxscore.players) return;
      
      // Process each team's players
      for (const teamPlayers of boxscore.players) {
        const teamId = `nfl_${teamPlayers.team.id}`;
        
        // Process statistics by category
        for (const statCategory of teamPlayers.statistics || []) {
          for (const player of statCategory.athletes || []) {
            // Ensure player exists
            const playerData = {
              id: player.athlete.id,
              name: player.athlete.displayName,
              position: player.athlete.position?.abbreviation || 'UNK',
              team_id: teamId,
              sport: 'nfl',
              jersey_number: player.athlete.jersey || null,
              height: player.athlete.height || null,
              weight: player.athlete.weight || null
            };
            
            await supabase
              .from('players')
              .upsert(playerData, { onConflict: 'id' });
              
            this.stats.players++;
            
            // Process player stats based on category
            await this.processPlayerStats(
              gameId,
              player.athlete.id,
              statCategory.name,
              player.stats
            );
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Failed to get stats for game ${gameId}:`), error.message);
      this.stats.errors++;
    }
  }
  
  private async processPlayerStats(
    gameId: string,
    playerId: string,
    category: string,
    stats: string[]
  ) {
    // Map ESPN stat positions to our stat types
    const statMappings: Record<string, Record<number, string>> = {
      passing: {
        0: 'passing_completions', // C/ATT format "20/30"
        1: 'passing_yards',
        2: 'passing_touchdowns',
        3: 'interceptions'
      },
      rushing: {
        0: 'rushing_attempts',
        1: 'rushing_yards',
        2: 'rushing_touchdowns'
      },
      receiving: {
        0: 'receptions',
        1: 'receiving_yards',
        2: 'receiving_touchdowns',
        3: 'targets'
      },
      defensive: {
        0: 'tackles',
        1: 'sacks',
        2: 'interceptions_def'
      }
    };
    
    const categoryMap = statMappings[category.toLowerCase()];
    if (!categoryMap) return;
    
    // Parse and store stats
    for (let i = 0; i < stats.length; i++) {
      const statType = categoryMap[i];
      if (!statType || !stats[i] || stats[i] === '--') continue;
      
      let statValue = 0;
      
      // Handle completions/attempts format
      if (statType === 'passing_completions' && stats[i].includes('/')) {
        const [completions, attempts] = stats[i].split('/');
        statValue = parseFloat(completions) || 0;
        
        // Also store attempts
        await supabase
          .from('player_stats')
          .upsert({
            game_id: gameId,
            player_id: playerId,
            stat_type: 'passing_attempts',
            stat_value: parseFloat(attempts) || 0
          });
      } else {
        statValue = parseFloat(stats[i]) || 0;
      }
      
      await supabase
        .from('player_stats')
        .upsert({
          game_id: gameId,
          player_id: playerId,
          stat_type: statType,
          stat_value: statValue
        });
        
      this.stats.playerStats++;
    }
  }
  
  private async collectPlayerStats() {
    console.log(chalk.yellow('\n📍 Processing Player Stats...'));
    console.log(chalk.green(`✓ Collected ${this.stats.playerStats} player stats`));
  }
}

// Run the collector
const collector = new RealNFLCollector();
collector.collect().catch(console.error);