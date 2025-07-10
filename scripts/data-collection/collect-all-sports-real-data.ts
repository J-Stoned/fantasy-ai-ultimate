#!/usr/bin/env tsx
/**
 * 🏆 COLLECT ALL SPORTS REAL DATA
 * Collects REAL data for NFL, NBA, MLB, NHL, and NCAA
 * Uses legitimate ESPN APIs for actual games and stats
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

// Rate limiting for API calls
const limit = pLimit(5);

// ESPN API endpoints for each sport
const ESPN_ENDPOINTS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl',
  ncaaf: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football',
  ncaab: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'
};

// Current season years
const SEASONS = {
  nfl: { current: 2024, type: 2 }, // Regular season
  nba: { current: 2025, type: 2 },
  mlb: { current: 2025, type: 2 },
  nhl: { current: 2025, type: 2 },
  ncaaf: { current: 2024, type: 2 },
  ncaab: { current: 2025, type: 2 }
};

interface CollectionStats {
  teams: number;
  games: number;
  players: number;
  stats: number;
}

class AllSportsCollector {
  private stats: Record<string, CollectionStats> = {
    nfl: { teams: 0, games: 0, players: 0, stats: 0 },
    nba: { teams: 0, games: 0, players: 0, stats: 0 },
    mlb: { teams: 0, games: 0, players: 0, stats: 0 },
    nhl: { teams: 0, games: 0, players: 0, stats: 0 },
    ncaaf: { teams: 0, games: 0, players: 0, stats: 0 },
    ncaab: { teams: 0, games: 0, players: 0, stats: 0 }
  };
  
  async collectAll() {
    console.log(chalk.blue.bold('🏆 COLLECTING ALL SPORTS REAL DATA\n'));
    console.log(chalk.yellow('This will collect REAL data from ESPN for:'));
    console.log('  • NFL (National Football League)');
    console.log('  • NBA (National Basketball Association)');
    console.log('  • MLB (Major League Baseball)');
    console.log('  • NHL (National Hockey League)');
    console.log('  • NCAA Football');
    console.log('  • NCAA Basketball\n');
    
    // Collect each sport
    for (const sport of ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'ncaab']) {
      console.log(chalk.cyan(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
      console.log(chalk.cyan.bold(`  Collecting ${sport.toUpperCase()} Data`));
      console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
      
      await this.collectSport(sport);
    }
    
    // Summary
    console.log(chalk.green.bold('\n\n✅ COLLECTION COMPLETE!\n'));
    console.log(chalk.white('Summary by Sport:'));
    
    Object.entries(this.stats).forEach(([sport, stats]) => {
      if (stats.teams > 0) {
        console.log(chalk.cyan(`\n${sport.toUpperCase()}:`));
        console.log(`  Teams: ${stats.teams}`);
        console.log(`  Games: ${stats.games}`);
        console.log(`  Players: ${stats.players}`);
        console.log(`  Stats: ${stats.stats}`);
      }
    });
  }
  
  private async collectSport(sport: string) {
    try {
      // 1. Collect teams
      await this.collectTeams(sport);
      
      // 2. Collect games
      await this.collectGames(sport);
      
      // 3. Collect player stats for completed games
      await this.collectPlayerStats(sport);
      
    } catch (error) {
      console.error(chalk.red(`Error collecting ${sport}:`), error);
    }
  }
  
  private async collectTeams(sport: string) {
    console.log(chalk.yellow(`\n1. Collecting ${sport.toUpperCase()} teams...`));
    
    try {
      const endpoint = ESPN_ENDPOINTS[sport as keyof typeof ESPN_ENDPOINTS];
      const response = await axios.get(`${endpoint}/teams`);
      
      const leagues = response.data.sports?.[0]?.leagues || [];
      
      for (const league of leagues) {
        for (const team of league.teams || []) {
          const teamData = {
            id: `${sport}_${team.team.id}`,
            name: team.team.displayName,
            abbreviation: team.team.abbreviation,
            sport: sport,
            location: team.team.location,
            nickname: team.team.nickname,
            logo_url: team.team.logos?.[0]?.href || null,
            primary_color: team.team.color || null,
            alternate_color: team.team.alternateColor || null,
            conference: team.team.groups?.[0]?.name || null,
            division: team.team.groups?.[1]?.name || null
          };
          
          const { error } = await supabase
            .from('teams')
            .upsert(teamData, { onConflict: 'id' });
            
          if (!error) {
            this.stats[sport].teams++;
          }
        }
      }
      
      console.log(chalk.green(`   ✓ Collected ${this.stats[sport].teams} teams`));
    } catch (error) {
      console.error(chalk.red(`Failed to collect ${sport} teams:`), error.message);
    }
  }
  
  private async collectGames(sport: string) {
    console.log(chalk.yellow(`\n2. Collecting ${sport.toUpperCase()} games...`));
    
    const endpoint = ESPN_ENDPOINTS[sport as keyof typeof ESPN_ENDPOINTS];
    const season = SEASONS[sport as keyof typeof SEASONS];
    
    if (!season) return;
    
    try {
      // For NFL and NCAAF, collect by week
      if (sport === 'nfl' || sport === 'ncaaf') {
        const weeks = sport === 'nfl' ? 18 : 15; // Regular season weeks
        
        for (let week = 1; week <= weeks; week++) {
          await limit(async () => {
            const response = await axios.get(
              `${endpoint}/scoreboard?seasontype=${season.type}&week=${week}&dates=${season.current}`
            );
            
            await this.processGames(sport, response.data.events || []);
          });
          
          // Small delay between weeks
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } else {
        // For other sports, collect by date range
        const startDate = sport === 'mlb' ? '20250401' : '20241001';
        const endDate = '20250731';
        
        const response = await axios.get(
          `${endpoint}/scoreboard?dates=${startDate}-${endDate}&limit=1000`
        );
        
        await this.processGames(sport, response.data.events || []);
      }
      
      console.log(chalk.green(`   ✓ Collected ${this.stats[sport].games} games`));
    } catch (error) {
      console.error(chalk.red(`Failed to collect ${sport} games:`), error.message);
    }
  }
  
  private async processGames(sport: string, events: any[]) {
    for (const event of events) {
      try {
        const competition = event.competitions?.[0];
        if (!competition) continue;
        
        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');
        
        if (!homeTeam || !awayTeam) continue;
        
        const gameData = {
          id: `${sport}_${event.id}`,
          sport: sport,
          season: event.season?.year || new Date(event.date).getFullYear(),
          season_type: event.season?.type || 2,
          week: event.week?.number || null,
          start_time: event.date,
          status: event.status?.type?.name || 'scheduled',
          home_team_id: `${sport}_${homeTeam.team.id}`,
          away_team_id: `${sport}_${awayTeam.team.id}`,
          home_score: event.status?.type?.completed ? parseInt(homeTeam.score || 0) : null,
          away_score: event.status?.type?.completed ? parseInt(awayTeam.score || 0) : null,
          venue: competition.venue?.fullName || null,
          venue_id: competition.venue?.id || null,
          attendance: competition.attendance || null,
          broadcast: competition.broadcasts?.[0]?.names?.[0] || null,
          weather: competition.weather || null,
          odds: competition.odds?.[0] || null
        };
        
        const { error } = await supabase
          .from('games')
          .upsert(gameData, { onConflict: 'id' });
          
        if (!error) {
          this.stats[sport].games++;
          
          // If game is completed, collect stats
          if (event.status?.type?.completed) {
            await this.collectGameStats(sport, event.id);
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error processing game ${event.id}:`), error.message);
      }
    }
  }
  
  private async collectGameStats(sport: string, gameId: string) {
    try {
      const endpoint = ESPN_ENDPOINTS[sport as keyof typeof ESPN_ENDPOINTS];
      const response = await axios.get(`${endpoint}/summary?event=${gameId}`);
      
      const boxscore = response.data.boxscore;
      if (!boxscore?.players) return;
      
      // Process each team's players
      for (const teamPlayers of boxscore.players) {
        const teamId = `${sport}_${teamPlayers.team.id}`;
        
        for (const statCategory of teamPlayers.statistics || []) {
          for (const athlete of statCategory.athletes || []) {
            // Create/update player
            const playerData = {
              id: `${sport}_${athlete.athlete.id}`,
              name: athlete.athlete.displayName,
              first_name: athlete.athlete.firstName || null,
              last_name: athlete.athlete.lastName || null,
              position: athlete.athlete.position?.abbreviation || null,
              jersey_number: athlete.athlete.jersey || null,
              team_id: teamId,
              sport: sport,
              height: athlete.athlete.displayHeight || null,
              weight: athlete.athlete.displayWeight || null,
              birth_date: athlete.athlete.birthDate || null,
              headshot_url: athlete.athlete.headshot?.href || null
            };
            
            const { error: playerError } = await supabase
              .from('players')
              .upsert(playerData, { onConflict: 'id' });
              
            if (!playerError) {
              this.stats[sport].players++;
            }
            
            // Process stats based on sport
            await this.processPlayerStats(
              sport,
              `${sport}_${gameId}`,
              playerData.id,
              statCategory.name,
              athlete.stats
            );
          }
        }
      }
    } catch (error) {
      // Game stats might not be available for all games
      // This is normal, so we don't log as error
    }
  }
  
  private async processPlayerStats(
    sport: string,
    gameId: string,
    playerId: string,
    category: string,
    stats: string[]
  ) {
    // Sport-specific stat mappings
    const statMappings = this.getStatMappings(sport, category);
    if (!statMappings) return;
    
    for (let i = 0; i < stats.length && i < statMappings.length; i++) {
      const statType = statMappings[i];
      const statValue = stats[i];
      
      if (!statType || !statValue || statValue === '--') continue;
      
      // Handle special cases like "20/30" for completions/attempts
      if (statValue.includes('/')) {
        const [made, attempts] = statValue.split('/');
        
        await supabase.from('player_stats').upsert({
          game_id: gameId,
          player_id: playerId,
          stat_type: statType.replace('_made', '_made'),
          stat_value: parseFloat(made) || 0
        });
        
        await supabase.from('player_stats').upsert({
          game_id: gameId,
          player_id: playerId,
          stat_type: statType.replace('_made', '_attempts'),
          stat_value: parseFloat(attempts) || 0
        });
        
        this.stats[sport].stats += 2;
      } else {
        await supabase.from('player_stats').upsert({
          game_id: gameId,
          player_id: playerId,
          stat_type: statType,
          stat_value: parseFloat(statValue) || 0
        });
        
        this.stats[sport].stats++;
      }
    }
  }
  
  private getStatMappings(sport: string, category: string): string[] {
    const mappings: Record<string, Record<string, string[]>> = {
      nfl: {
        passing: ['completions_attempts', 'passing_yards', 'passing_touchdowns', 'interceptions', 'sacks', 'qb_rating'],
        rushing: ['rushing_attempts', 'rushing_yards', 'rushing_avg', 'rushing_touchdowns', 'rushing_long'],
        receiving: ['receptions', 'receiving_yards', 'receiving_avg', 'receiving_touchdowns', 'receiving_long', 'targets']
      },
      nba: {
        offensive: ['minutes', 'field_goals_made', 'field_goal_attempts', 'three_pointers_made', 'three_point_attempts', 
                   'free_throws_made', 'free_throw_attempts', 'offensive_rebounds', 'defensive_rebounds', 'rebounds', 
                   'assists', 'steals', 'blocks', 'turnovers', 'personal_fouls', 'points'],
      },
      mlb: {
        batting: ['at_bats', 'runs', 'hits', 'doubles', 'triples', 'home_runs', 'rbis', 'walks', 'strikeouts', 'batting_avg'],
        pitching: ['innings_pitched', 'hits_allowed', 'runs_allowed', 'earned_runs', 'walks_allowed', 'strikeouts', 'home_runs_allowed', 'era']
      },
      nhl: {
        skater: ['goals', 'assists', 'points', 'plus_minus', 'penalty_minutes', 'shots', 'hits', 'blocks', 'takeaways', 'giveaways'],
        goalie: ['saves', 'shots_against', 'goals_against', 'save_percentage']
      }
    };
    
    return mappings[sport]?.[category.toLowerCase()] || [];
  }
}

// Run the collector
const collector = new AllSportsCollector();
collector.collectAll().catch(console.error);