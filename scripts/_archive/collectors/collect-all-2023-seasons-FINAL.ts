#!/usr/bin/env tsx
/**
 * 🚀 COLLECT ALL 2023 SEASONS FINAL - Database-matched mega collector
 * Properly configured to match exact database schema:
 * - player_game_logs: player_id, game_id, team_id, game_date, opponent_id, is_home, stats, fantasy_points
 * - games: home_team_id, away_team_id, sport_id, start_time, home_score, away_score, external_id
 * - players: id, name, sport, team_id, external_id
 * - teams: id, name, sport_id, abbreviation, external_id
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';
import axios, { AxiosInstance } from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DatabaseGame {
  id: number;
  home_team_id: number;
  away_team_id: number;
  sport_id: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  external_id: string;
}

interface DatabasePlayerGameLog {
  player_id: number;
  game_id: number;
  team_id: number | null;
  game_date: string;
  opponent_id: number | null;
  is_home: boolean | null;
  minutes_played: number | null;
  stats: any;
  fantasy_points: number;
}

class DatabaseMatchedCollector2023 {
  private espnApi: AxiosInstance;
  private playerCache = new Map<string, Map<string, number>>();
  private teamCache = new Map<string, Map<string, number>>();
  private teamIdMap = new Map<number, { sport: string, abbreviation: string }>();
  
  private stats = {
    gamesInserted: 0,
    gamesUpdated: 0,
    statsInserted: 0,
    errors: 0,
    startTime: new Date()
  };
  
  constructor() {
    this.espnApi = axios.create({
      baseURL: 'https://site.api.espn.com/apis/site/v2/sports',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
  }
  
  async collect2023Seasons() {
    console.log(chalk.bold.cyan('\n🚀 DATABASE-MATCHED 2023 COLLECTOR - FINAL VERSION\n'));
    console.log(chalk.yellow('This collector is properly configured for the exact database schema'));
    console.log(chalk.yellow('Target: ~5,172 games from 2023 seasons\n'));
    
    // Load all data first
    await this.loadDatabaseCaches();
    
    // Collect each sport
    await this.collectSport('nba', '2023-10-24', '2024-06-17');
    await this.collectSport('mlb', '2023-03-30', '2023-11-01');
    await this.collectSport('nhl', '2023-10-10', '2024-06-24');
    
    // Final report
    this.generateReport();
  }
  
  private async loadDatabaseCaches() {
    console.log(chalk.yellow('Loading database caches...'));
    
    // Load all players grouped by sport
    const { data: players } = await supabase
      .from('players')
      .select('id, name, sport, team_id, external_id');
    
    if (players) {
      // Group by sport
      const sportGroups = new Map<string, Map<string, number>>();
      
      players.forEach(player => {
        const sport = player.sport?.toLowerCase() || '';
        if (!sportGroups.has(sport)) {
          sportGroups.set(sport, new Map());
        }
        
        const sportCache = sportGroups.get(sport)!;
        
        // Multiple cache keys
        if (player.name) {
          sportCache.set(player.name.toLowerCase(), player.id);
          sportCache.set(this.normalizePlayerName(player.name), player.id);
          
          // Last name only
          const lastName = player.name.split(' ').slice(-1)[0];
          if (lastName && !sportCache.has(lastName.toLowerCase())) {
            sportCache.set(lastName.toLowerCase(), player.id);
          }
        }
        
        if (player.external_id) {
          sportCache.set(player.external_id, player.id);
        }
      });
      
      this.playerCache = sportGroups;
      
      for (const [sport, cache] of sportGroups) {
        console.log(`  ${sport.toUpperCase()}: ${cache.size} player entries`);
      }
    }
    
    // Load all teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, sport_id, abbreviation, external_id');
    
    if (teams) {
      const sportTeams = new Map<string, Map<string, number>>();
      
      teams.forEach(team => {
        const sport = team.sport_id || '';
        if (!sportTeams.has(sport)) {
          sportTeams.set(sport, new Map());
        }
        
        const sportCache = sportTeams.get(sport)!;
        
        // Cache by multiple keys
        sportCache.set(team.name.toLowerCase(), team.id);
        if (team.abbreviation) {
          sportCache.set(team.abbreviation.toLowerCase(), team.id);
        }
        if (team.external_id) {
          sportCache.set(team.external_id, team.id);
        }
        
        // Also store reverse lookup
        this.teamIdMap.set(team.id, {
          sport: sport,
          abbreviation: team.abbreviation || ''
        });
      });
      
      this.teamCache = sportTeams;
      
      for (const [sport, cache] of sportTeams) {
        console.log(`  ${sport.toUpperCase()}: ${cache.size} team entries`);
      }
    }
    
    console.log(chalk.green('✅ Caches loaded\n'));
  }
  
  private async collectSport(sport: string, startDate: string, endDate: string) {
    console.log(chalk.bold.yellow(`\n📊 COLLECTING ${sport.toUpperCase()} 2023 SEASON`));
    console.log(`Date range: ${startDate} to ${endDate}`);
    
    const sportStats = {
      games: 0,
      stats: 0,
      errors: 0,
      startTime: new Date()
    };
    
    // Step 1: Collect and insert all games
    const games = await this.collectGamesForDateRange(sport, startDate, endDate);
    sportStats.games = games.length;
    
    console.log(chalk.green(`\n✅ Collected ${games.length} ${sport.toUpperCase()} games`));
    
    // Step 2: Collect stats for each game
    console.log(chalk.yellow('Collecting player stats...'));
    
    for (let i = 0; i < games.length; i++) {
      try {
        const statsCount = await this.collectGameStats(sport, games[i]);
        if (statsCount > 0) {
          sportStats.stats++;
          this.stats.statsInserted += statsCount;
        }
      } catch (error) {
        sportStats.errors++;
        this.stats.errors++;
      }
      
      // Progress
      if ((i + 1) % 50 === 0) {
        const pct = (((i + 1) / games.length) * 100).toFixed(1);
        console.log(chalk.gray(`  Progress: ${i + 1}/${games.length} (${pct}%) - ${sportStats.stats} with stats`));
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    const duration = ((new Date().getTime() - sportStats.startTime.getTime()) / 1000 / 60).toFixed(1);
    
    console.log(chalk.bold.cyan(`\n${sport.toUpperCase()} COMPLETE:`));
    console.log(`  Games: ${sportStats.games}`);
    console.log(`  Games with stats: ${sportStats.stats}`);
    console.log(`  Errors: ${sportStats.errors}`);
    console.log(`  Duration: ${duration} minutes`);
  }
  
  private async collectGamesForDateRange(sport: string, startDate: string, endDate: string): Promise<DatabaseGame[]> {
    const games: DatabaseGame[] = [];
    const espnSport = this.getESPNSportPath(sport);
    
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
      
      try {
        const response = await this.espnApi.get(`/${espnSport}/scoreboard`, {
          params: { dates: dateStr }
        });
        
        const events = response.data.events || [];
        
        for (const event of events) {
          const game = await this.processESPNGame(sport, event);
          if (game) {
            games.push(game);
          }
        }
        
        if (events.length > 0) {
          console.log(chalk.gray(`  ${currentDate.toISOString().split('T')[0]}: ${events.length} games`));
        }
        
      } catch (error) {
        console.error(chalk.red(`Failed ${dateStr}: ${error instanceof Error ? error.message : 'Unknown'}`));
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return games;
  }
  
  private async processESPNGame(sport: string, event: any): Promise<DatabaseGame | null> {
    try {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) return null;
      
      // Get team IDs from cache
      const homeTeamId = this.findTeamId(sport, homeTeam.team);
      const awayTeamId = this.findTeamId(sport, awayTeam.team);
      
      if (!homeTeamId || !awayTeamId) {
        console.error(chalk.red(`Missing teams: ${homeTeam.team.displayName} vs ${awayTeam.team.displayName}`));
        return null;
      }
      
      const gameData: Partial<DatabaseGame> = {
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        sport_id: sport,
        start_time: event.date,
        home_score: parseInt(homeTeam.score || '0') || null,
        away_score: parseInt(awayTeam.score || '0') || null,
        status: event.status.type.completed ? 'completed' : event.status.type.name,
        external_id: `espn_${sport}_${event.id}`
      };
      
      // Insert or update game
      const { data, error } = await supabase
        .from('games')
        .upsert(gameData as any, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (error) {
        console.error('Game insert error:', error);
        return null;
      }
      
      if (data) {
        this.stats.gamesInserted++;
        return data as DatabaseGame;
      }
      
      return null;
      
    } catch (error) {
      return null;
    }
  }
  
  private findTeamId(sport: string, espnTeam: any): number | null {
    const cache = this.teamCache.get(sport);
    if (!cache) return null;
    
    // Try various lookups
    return cache.get(espnTeam.displayName?.toLowerCase()) ||
           cache.get(espnTeam.name?.toLowerCase()) ||
           cache.get(espnTeam.abbreviation?.toLowerCase()) ||
           cache.get(`espn_${sport}_${espnTeam.id}`) ||
           null;
  }
  
  private async collectGameStats(sport: string, game: DatabaseGame): Promise<number> {
    try {
      const espnSport = this.getESPNSportPath(sport);
      const espnId = game.external_id.replace(`espn_${sport}_`, '');
      
      const response = await this.espnApi.get(`/${espnSport}/summary`, {
        params: { event: espnId }
      });
      
      const data = response.data;
      
      if (!data.boxscore?.players) {
        return 0;
      }
      
      const playerLogs: DatabasePlayerGameLog[] = [];
      
      // Process both teams
      for (let teamIdx = 0; teamIdx < data.boxscore.players.length; teamIdx++) {
        const teamData = data.boxscore.players[teamIdx];
        const isHomeTeam = teamIdx === 0; // ESPN usually lists home team first
        const teamId = isHomeTeam ? game.home_team_id : game.away_team_id;
        const opponentId = isHomeTeam ? game.away_team_id : game.home_team_id;
        
        const athletes = teamData.statistics?.[0]?.athletes || [];
        
        for (const athlete of athletes) {
          const playerLog = this.parsePlayerStats(
            sport,
            athlete,
            game.id,
            teamId,
            opponentId,
            game.start_time,
            isHomeTeam
          );
          
          if (playerLog) {
            playerLogs.push(playerLog);
          }
        }
      }
      
      // Insert player logs in batches
      if (playerLogs.length > 0) {
        const batchSize = 50;
        
        for (let i = 0; i < playerLogs.length; i += batchSize) {
          const batch = playerLogs.slice(i, i + batchSize);
          
          const { error } = await supabase
            .from('player_game_logs')
            .insert(batch);
          
          if (error) {
            console.error('Stats insert error:', error);
            return 0;
          }
        }
      }
      
      return playerLogs.length;
      
    } catch (error) {
      return 0;
    }
  }
  
  private parsePlayerStats(
    sport: string,
    athleteData: any,
    gameId: number,
    teamId: number,
    opponentId: number,
    gameDate: string,
    isHome: boolean
  ): DatabasePlayerGameLog | null {
    // Find player ID
    const playerId = this.findPlayerId(sport, athleteData.athlete);
    if (!playerId) return null;
    
    // Parse stats based on sport
    const stats = this.parseSportSpecificStats(sport, athleteData.stats);
    if (!stats) return null;
    
    // Calculate fantasy points
    const fantasyPoints = this.calculateFantasyPoints(sport, stats);
    
    // Extract minutes played if available
    let minutesPlayed: number | null = null;
    if (sport === 'nba' && athleteData.stats?.[0]) {
      const minStr = athleteData.stats[0];
      if (minStr && minStr.includes(':')) {
        const [min, sec] = minStr.split(':').map(Number);
        minutesPlayed = min + Math.round(sec / 60);
      }
    }
    
    return {
      player_id: playerId,
      game_id: gameId,
      team_id: teamId,
      game_date: gameDate.split('T')[0], // Just date part
      opponent_id: opponentId,
      is_home: isHome,
      minutes_played: minutesPlayed,
      stats: stats,
      fantasy_points: fantasyPoints
    };
  }
  
  private findPlayerId(sport: string, athlete: any): number | null {
    const cache = this.playerCache.get(sport);
    if (!cache) return null;
    
    const name = athlete.displayName || athlete.fullName || '';
    
    // Try various lookups
    return cache.get(name.toLowerCase()) ||
           cache.get(this.normalizePlayerName(name)) ||
           cache.get(`espn_${sport}_${athlete.id}`) ||
           null;
  }
  
  private normalizePlayerName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s(jr|sr|iii|ii|iv|v)$/i, '')
      .trim();
  }
  
  private parseSportSpecificStats(sport: string, statsArray: string[]): any | null {
    if (!statsArray || statsArray.length === 0) return null;
    
    try {
      switch (sport) {
        case 'nba':
          if (statsArray.length < 14) return null;
          return {
            minutes: statsArray[0] || '0',
            fieldGoalsMade: parseInt(statsArray[1]?.split('-')[0] || '0'),
            fieldGoalsAttempted: parseInt(statsArray[1]?.split('-')[1] || '0'),
            threePointersMade: parseInt(statsArray[2]?.split('-')[0] || '0'),
            threePointersAttempted: parseInt(statsArray[2]?.split('-')[1] || '0'),
            freeThrowsMade: parseInt(statsArray[3]?.split('-')[0] || '0'),
            freeThrowsAttempted: parseInt(statsArray[3]?.split('-')[1] || '0'),
            offensiveRebounds: parseInt(statsArray[4] || '0'),
            defensiveRebounds: parseInt(statsArray[5] || '0'),
            rebounds: parseInt(statsArray[6] || '0'),
            assists: parseInt(statsArray[7] || '0'),
            steals: parseInt(statsArray[8] || '0'),
            blocks: parseInt(statsArray[9] || '0'),
            turnovers: parseInt(statsArray[10] || '0'),
            personalFouls: parseInt(statsArray[11] || '0'),
            plusMinus: parseInt(statsArray[12] || '0'),
            points: parseInt(statsArray[13] || '0')
          };
          
        case 'mlb':
          // Batting stats
          if (statsArray.length >= 15) {
            return {
              atBats: parseInt(statsArray[0] || '0'),
              runs: parseInt(statsArray[1] || '0'),
              hits: parseInt(statsArray[2] || '0'),
              rbi: parseInt(statsArray[3] || '0'),
              doubles: parseInt(statsArray[4] || '0'),
              triples: parseInt(statsArray[5] || '0'),
              homeRuns: parseInt(statsArray[6] || '0'),
              walks: parseInt(statsArray[7] || '0'),
              strikeouts: parseInt(statsArray[8] || '0'),
              avg: statsArray[14] || '.000',
              obp: statsArray[15] || '.000',
              slg: statsArray[16] || '.000'
            };
          }
          // Pitching stats
          else if (statsArray.length >= 10) {
            return {
              inningsPitched: statsArray[0] || '0.0',
              hits: parseInt(statsArray[1] || '0'),
              runs: parseInt(statsArray[2] || '0'),
              earnedRuns: parseInt(statsArray[3] || '0'),
              walks: parseInt(statsArray[4] || '0'),
              strikeouts: parseInt(statsArray[5] || '0'),
              homeRuns: parseInt(statsArray[6] || '0'),
              era: statsArray[9] || '0.00',
              pitches: parseInt(statsArray[10] || '0')
            };
          }
          return null;
          
        case 'nhl':
          if (statsArray.length < 15) return null;
          return {
            goals: parseInt(statsArray[0] || '0'),
            assists: parseInt(statsArray[1] || '0'),
            points: parseInt(statsArray[2] || '0'),
            plusMinus: parseInt(statsArray[3] || '0'),
            penaltyMinutes: parseInt(statsArray[4] || '0'),
            powerPlayGoals: parseInt(statsArray[5] || '0'),
            powerPlayAssists: parseInt(statsArray[6] || '0'),
            shortHandedGoals: parseInt(statsArray[7] || '0'),
            shots: parseInt(statsArray[8] || '0'),
            shotPercentage: parseFloat(statsArray[9] || '0'),
            gameWinningGoals: parseInt(statsArray[10] || '0'),
            overtimeGoals: parseInt(statsArray[11] || '0'),
            hits: parseInt(statsArray[12] || '0'),
            blockedShots: parseInt(statsArray[13] || '0'),
            timeOnIce: statsArray[14] || '0:00'
          };
          
        default:
          return null;
      }
    } catch (error) {
      return null;
    }
  }
  
  private calculateFantasyPoints(sport: string, stats: any): number {
    switch (sport) {
      case 'nba':
        // DraftKings NBA scoring
        let points = 0;
        points += (stats.points || 0) * 1;
        points += (stats.rebounds || 0) * 1.25;
        points += (stats.assists || 0) * 1.5;
        points += (stats.steals || 0) * 2;
        points += (stats.blocks || 0) * 2;
        points -= (stats.turnovers || 0) * 0.5;
        
        // Double-double bonus
        const doubleDouble = [
          stats.points >= 10,
          stats.rebounds >= 10,
          stats.assists >= 10,
          stats.steals >= 10,
          stats.blocks >= 10
        ].filter(Boolean).length >= 2;
        
        if (doubleDouble) points += 1.5;
        
        // Triple-double bonus
        const tripleDouble = [
          stats.points >= 10,
          stats.rebounds >= 10,
          stats.assists >= 10,
          stats.steals >= 10,
          stats.blocks >= 10
        ].filter(Boolean).length >= 3;
        
        if (tripleDouble) points += 1.5; // Total 3 with DD
        
        return Math.round(points * 100) / 100;
        
      case 'mlb':
        // Hitter scoring
        if (stats.atBats !== undefined) {
          return (stats.hits || 0) * 3 +
                 (stats.runs || 0) * 2 +
                 (stats.rbi || 0) * 2 +
                 (stats.homeRuns || 0) * 4 +
                 (stats.walks || 0) * 1 +
                 (stats.doubles || 0) * 1 +
                 (stats.triples || 0) * 2 -
                 (stats.strikeouts || 0) * 0.5;
        }
        // Pitcher scoring
        else {
          const innings = parseFloat(stats.inningsPitched || '0');
          return innings * 3 +
                 (stats.strikeouts || 0) * 1 -
                 (stats.earnedRuns || 0) * 2 -
                 (stats.hits || 0) * 0.5 -
                 (stats.walks || 0) * 0.5;
        }
        
      case 'nhl':
        // DraftKings NHL scoring
        return (stats.goals || 0) * 3 +
               (stats.assists || 0) * 2 +
               (stats.shots || 0) * 0.5 +
               (stats.blockedShots || 0) * 0.5 +
               (stats.shortHandedGoals || 0) * 1 +
               (stats.powerPlayGoals || 0) * 0.5 +
               (stats.powerPlayAssists || 0) * 0.5;
        
      default:
        return 0;
    }
  }
  
  private getESPNSportPath(sport: string): string {
    const mapping: Record<string, string> = {
      'nba': 'basketball/nba',
      'mlb': 'baseball/mlb',
      'nhl': 'hockey/nhl',
      'nfl': 'football/nfl'
    };
    return mapping[sport] || sport;
  }
  
  private generateReport() {
    const duration = ((new Date().getTime() - this.stats.startTime.getTime()) / 1000 / 60).toFixed(1);
    
    console.log(chalk.bold.cyan('\n📊 FINAL COLLECTION REPORT - DATABASE MATCHED\n'));
    console.log(`Games inserted/updated: ${this.stats.gamesInserted}`);
    console.log(`Player stats inserted: ${this.stats.statsInserted}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Total duration: ${duration} minutes`);
    console.log(`Average: ${(parseFloat(duration) / (this.stats.gamesInserted || 1) * 60).toFixed(1)} seconds per game`);
    
    const report = {
      collectionDate: new Date().toISOString(),
      duration: duration + ' minutes',
      results: {
        gamesInserted: this.stats.gamesInserted,
        playerStatsInserted: this.stats.statsInserted,
        errors: this.stats.errors,
        estimatedPlayerLogs: this.stats.statsInserted
      },
      databaseMatched: true,
      schemaVersion: '2025-07-11'
    };
    
    fs.writeFileSync('./2023-collection-final-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.green('\n✅ Report saved to 2023-collection-final-report.json'));
    console.log(chalk.green('✅ Database is now populated with 2023 season data!'));
  }
}

// Run the collector
console.log(chalk.bold.yellow('⚠️  This will collect ~5,000+ games and ~200,000+ player stats'));
console.log(chalk.bold.yellow('⚠️  Estimated time: 2-4 hours'));
console.log(chalk.bold.yellow('⚠️  Make sure to run fix-all-team-mappings-final.ts first!\n'));

const collector = new DatabaseMatchedCollector2023();
collector.collect2023Seasons();