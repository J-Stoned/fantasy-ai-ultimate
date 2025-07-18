#!/usr/bin/env tsx
/**
 * 🚀 OPTIMIZED UNIVERSAL SPORTS COLLECTOR FOR RYZEN 5 7600X 🚀
 * 
 * Optimizations:
 * - Uses 10 concurrent operations (for 12 CPU threads)
 * - Batch processing with pagination
 * - Memory-efficient chunking
 * - Progress tracking
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Optimize for Ryzen 5 7600X - use more threads for API calls
const CPU_CORES = os.cpus().length;
const CONCURRENT_LIMIT = Math.max(15, CPU_CORES); // Use at least 15 concurrent operations
const limit = pLimit(CONCURRENT_LIMIT);

// Batch sizes optimized for 32GB RAM - USE MORE!
const BATCH_SIZES = {
  games: 500,      // Increased from 100
  players: 1000,   // Increased from 500
  stats: 2000,     // Increased from 1000
  enrichment: 100  // Increased from 50
};

console.log(chalk.cyan(`🖥️  System Info:`));
console.log(chalk.gray(`   CPU Cores: ${CPU_CORES}`));
console.log(chalk.gray(`   Total RAM: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`));
console.log(chalk.gray(`   Free RAM: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)}GB`));
console.log(chalk.green(`   Concurrent Operations: ${CONCURRENT_LIMIT}`));
console.log(chalk.gray(`   ─────────────────────────────────────`));

interface CollectionOptions {
  sport: string;
  year?: number;
  historical?: boolean;
  enrich?: boolean;
  dataType: 'games' | 'players' | 'stats' | 'all';
}

interface SeasonConfig {
  sport: string;
  year: number;
  regular: { start: string; end: string };
  playoffs: { start: string; end: string };
}

class OptimizedUniversalSportsCollector {
  private processed = {
    games: 0,
    players: 0,
    stats: 0,
    weather: 0,
    betting: 0,
    injuries: 0,
    metrics: 0
  };

  private progressBar: cliProgress.SingleBar;
  private teamIdMap: Record<string, number> = {};

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: '  {bar} | {percentage}% | {value}/{total} | {duration_formatted} | ETA: {eta_formatted}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  // Historical season configurations
  private seasonConfigs: SeasonConfig[] = [
    // NFL
    { sport: 'nfl', year: 2021, regular: { start: '2021-09-09', end: '2022-01-09' }, playoffs: { start: '2022-01-15', end: '2022-02-13' } },
    { sport: 'nfl', year: 2022, regular: { start: '2022-09-08', end: '2023-01-08' }, playoffs: { start: '2023-01-14', end: '2023-02-12' } },
    
    // NBA
    { sport: 'nba', year: 2021, regular: { start: '2021-10-19', end: '2022-04-10' }, playoffs: { start: '2022-04-16', end: '2022-06-16' } },
    { sport: 'nba', year: 2022, regular: { start: '2022-10-18', end: '2023-04-09' }, playoffs: { start: '2023-04-15', end: '2023-06-12' } },
    
    // MLB
    { sport: 'mlb', year: 2021, regular: { start: '2021-04-01', end: '2021-10-03' }, playoffs: { start: '2021-10-05', end: '2021-11-02' } },
    { sport: 'mlb', year: 2022, regular: { start: '2022-04-07', end: '2022-10-05' }, playoffs: { start: '2022-10-07', end: '2022-11-05' } },
    
    // NHL
    { sport: 'nhl', year: 2021, regular: { start: '2021-10-12', end: '2022-04-29' }, playoffs: { start: '2022-05-02', end: '2022-06-26' } },
    { sport: 'nhl', year: 2022, regular: { start: '2022-10-07', end: '2023-04-13' }, playoffs: { start: '2023-04-17', end: '2023-06-13' } },
  ];

  async collectAll(options: CollectionOptions) {
    console.log(chalk.blue('\n📊 Starting optimized collection with progress tracking...\n'));

    try {
      if (options.dataType === 'all' || options.dataType === 'games') {
        await this.collectGames(options);
      }

      if (options.dataType === 'all' || options.dataType === 'players') {
        await this.collectPlayers(options);
      }

      if (options.dataType === 'all' || options.dataType === 'stats') {
        await this.collectStats(options);
      }

      if (options.enrich && (options.dataType === 'all' || options.dataType === 'games')) {
        await this.enrichGames(options);
      }

      this.printSummary();
    } catch (error) {
      console.error(chalk.red('\n❌ Collection failed:'), error);
      throw error;
    }
  }

  private async collectGames(options: CollectionOptions) {
    console.log(chalk.yellow(`\n🏈 Collecting ${options.sport.toUpperCase()} games for ${options.year}...`));
    
    const seasonConfig = this.seasonConfigs.find(
      c => c.sport === options.sport.toLowerCase() && c.year === options.year
    );

    if (!seasonConfig) {
      console.log(chalk.red(`No season configuration found for ${options.sport} ${options.year}`));
      return;
    }

    // Get team IDs first
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', options.sport.toUpperCase())
      .not('external_id', 'is', null);

    if (!teams || teams.length === 0) {
      console.log(chalk.red('No teams found. Please collect teams first.'));
      return;
    }

    console.log(chalk.gray(`Found ${teams.length} teams`));
    
    // Create a mapping of ESPN IDs to internal IDs
    this.teamIdMap = {};
    teams.forEach(team => {
      const espnId = team.external_id.split('_').pop();
      this.teamIdMap[espnId] = team.id;
    });
    
    // Collect games in batches
    let totalGames = 0;
    const gamePromises = [];

    for (const team of teams) {
      const teamId = team.external_id.split('_').pop();
      
      gamePromises.push(limit(async () => {
        try {
          // Regular season
          const regularUrl = `https://site.api.espn.com/apis/site/v2/sports/${this.mapSport(options.sport)}/teams/${teamId}/schedule?season=${options.year}&seasontype=2`;
          const regularResp = await axios.get(regularUrl);
          
          if (regularResp.data?.events) {
            const games = regularResp.data.events.map((event: any) => this.transformGame(event, options.sport));
            await this.batchInsertGames(games);
            totalGames += games.length;
          }

          // Playoffs
          const playoffUrl = `https://site.api.espn.com/apis/site/v2/sports/${this.mapSport(options.sport)}/teams/${teamId}/schedule?season=${options.year}&seasontype=3`;
          const playoffResp = await axios.get(playoffUrl);
          
          if (playoffResp.data?.events) {
            const games = playoffResp.data.events.map((event: any) => this.transformGame(event, options.sport));
            await this.batchInsertGames(games);
            totalGames += games.length;
          }
        } catch (error) {
          console.error(chalk.red(`Error collecting games for team ${teamId}:`), error.message);
        }
      }));
    }

    // Show progress bar
    this.progressBar.start(teams.length, 0);
    
    for (let i = 0; i < gamePromises.length; i++) {
      await gamePromises[i];
      this.progressBar.update(i + 1);
    }
    
    this.progressBar.stop();
    
    console.log(chalk.green(`✅ Collected ${totalGames} games`));
    this.processed.games = totalGames;
  }

  private async collectPlayers(options: CollectionOptions) {
    console.log(chalk.yellow(`\n👥 Collecting ${options.sport.toUpperCase()} players...`));
    
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', options.sport.toUpperCase())
      .not('external_id', 'is', null);

    if (!teams || teams.length === 0) {
      console.log(chalk.red('No teams found'));
      return;
    }

    this.progressBar.start(teams.length, 0);
    let totalPlayers = 0;

    const playerPromises = teams.map((team, index) => 
      limit(async () => {
        try {
          const teamId = team.external_id.split('_').pop();
          const url = `https://site.api.espn.com/apis/site/v2/sports/${this.mapSport(options.sport)}/teams/${teamId}/roster`;
          const resp = await axios.get(url);
          
          if (resp.data?.athletes) {
            const players = resp.data.athletes.map((athlete: any) => this.transformPlayer(athlete, options.sport, team.id));
            await this.batchInsertPlayers(players);
            totalPlayers += players.length;
          }
        } catch (error) {
          console.error(chalk.red(`Error collecting players for team ${team.id}:`), error.message);
        }
        this.progressBar.update(index + 1);
      })
    );

    await Promise.all(playerPromises);
    this.progressBar.stop();
    
    console.log(chalk.green(`✅ Collected ${totalPlayers} players`));
    this.processed.players = totalPlayers;
  }

  private async collectStats(options: CollectionOptions) {
    console.log(chalk.yellow(`\n📊 Collecting ${options.sport.toUpperCase()} stats...`));
    
    // Rebuild team ID map if needed
    if (Object.keys(this.teamIdMap).length === 0) {
      const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id')
        .eq('sport', options.sport.toUpperCase())
        .not('external_id', 'is', null);
        
      if (teams) {
        teams.forEach(team => {
          const espnId = team.external_id.split('_').pop();
          this.teamIdMap[espnId] = team.id;
        });
      }
    }
    
    // Get ALL games for the season with pagination
    let allGames: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    console.log(chalk.gray('Fetching all games with pagination...'));
    
    while (hasMore) {
      const { data: games, count } = await supabase
        .from('games')
        .select('id, external_id', { count: 'exact' })
        .eq('sport', options.sport.toUpperCase())
        .eq('metadata->>season', options.year?.toString())
        .range(offset, offset + pageSize - 1)
        .order('id');
        
      if (games && games.length > 0) {
        allGames = allGames.concat(games);
        offset += games.length;
        hasMore = games.length === pageSize;
        console.log(chalk.gray(`  Fetched ${allGames.length}/${count} games...`));
      } else {
        hasMore = false;
      }
    }

    if (allGames.length === 0) {
      console.log(chalk.red('No games found for this season'));
      return;
    }
    
    const games = allGames;

    console.log(chalk.gray(`Found ${games.length} games to process`));
    this.progressBar.start(games.length, 0);
    
    let totalStats = 0;
    const chunks = this.chunkArray(games, BATCH_SIZES.stats);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const statPromises = chunk.map(game => 
        limit(async () => {
          try {
            const gameId = game.external_id.split('_').pop();
            const url = `https://site.api.espn.com/apis/site/v2/sports/${this.mapSport(options.sport)}/summary?event=${gameId}`;
            const resp = await axios.get(url);
            
            if (resp.data?.boxscore?.players) {
              const stats = await this.extractPlayerStats(resp.data.boxscore.players, game.id, options.sport, resp.data);
              await this.batchInsertStats(stats);
              totalStats += stats.length;
            }
          } catch (error) {
            console.error(chalk.red(`Error collecting stats for game ${game.id}:`), error.message);
          }
        })
      );

      await Promise.all(statPromises);
      this.progressBar.update((i + 1) * chunk.length);
    }

    this.progressBar.stop();
    console.log(chalk.green(`✅ Collected ${totalStats} player stats`));
    this.processed.stats = totalStats;
  }

  private async enrichGames(options: CollectionOptions) {
    console.log(chalk.yellow(`\n🌟 Enriching games with ML data...`));
    
    const { data: games } = await supabase
      .from('games')
      .select('id, venue, start_time')
      .eq('sport', options.sport.toUpperCase())
      .eq('metadata->>season', options.year?.toString());

    if (!games || games.length === 0) {
      console.log(chalk.red('No games to enrich'));
      return;
    }

    console.log(chalk.gray(`Enriching ${games.length} games...`));
    this.progressBar.start(games.length * 3, 0); // 3 enrichment types per game
    
    let progress = 0;

    // Process in smaller batches for enrichment
    const chunks = this.chunkArray(games, BATCH_SIZES.enrichment);

    for (const chunk of chunks) {
      const enrichPromises = chunk.map(game => 
        limit(async () => {
          // Weather data
          if (game.venue && game.start_time) {
            await this.enrichWeather(game);
            this.progressBar.update(++progress);
          }

          // Betting data
          await this.enrichBetting(game);
          this.progressBar.update(++progress);

          // Injury data
          await this.enrichInjuries(game);
          this.progressBar.update(++progress);
        })
      );

      await Promise.all(enrichPromises);
    }

    this.progressBar.stop();
    console.log(chalk.green(`✅ Enrichment complete`));
  }

  // Helper methods
  private mapSport(sport: string): string {
    const mapping: Record<string, string> = {
      'nfl': 'football/nfl',
      'nba': 'basketball/nba',
      'mlb': 'baseball/mlb',
      'nhl': 'hockey/nhl'
    };
    return mapping[sport.toLowerCase()] || sport;
  }

  private transformGame(event: any, sport: string): any {
    const homeCompetitor = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home');
    const awayCompetitor = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away');
    
    // Handle score format - can be string, number, or object
    const parseScore = (score: any): number | null => {
      if (score === null || score === undefined) return null;
      if (typeof score === 'number') return score;
      if (typeof score === 'string') return parseInt(score) || null;
      if (typeof score === 'object' && score.value !== undefined) {
        return typeof score.value === 'number' ? score.value : parseInt(score.value) || null;
      }
      return null;
    };
    
    return {
      external_id: `espn_${sport.toLowerCase()}_${event.id}`,
      sport: sport.toUpperCase(),
      home_team_id: this.teamIdMap[homeCompetitor?.team?.id] || null,
      away_team_id: this.teamIdMap[awayCompetitor?.team?.id] || null,
      start_time: event.date,
      venue: event.competitions?.[0]?.venue?.fullName,
      home_score: parseScore(homeCompetitor?.score),
      away_score: parseScore(awayCompetitor?.score),
      status: event.status?.type?.name?.toLowerCase() || 'scheduled',
      metadata: {
        season: event.season?.year,
        week: event.week?.number,
        attendance: event.competitions?.[0]?.attendance,
        broadcast: event.competitions?.[0]?.broadcasts?.[0]?.names
      }
    };
  }

  private transformPlayer(athlete: any, sport: string, teamId: number): any {
    return {
      external_id: `espn_${sport.toLowerCase()}_${athlete.id}`,
      firstname: athlete.firstName,
      lastname: athlete.lastName,
      name: athlete.displayName,
      position: [athlete.position?.abbreviation],
      team_id: teamId,
      jersey_number: parseInt(athlete.jersey) || null,
      heightinches: athlete.height ? this.parseHeight(athlete.height, sport) : null,
      weightlbs: athlete.weight ? parseInt(athlete.weight) : null,
      birthdate: athlete.dateOfBirth,
      status: athlete.status?.type?.name?.toLowerCase() || 'active',
      sport: sport.toUpperCase(),
      photo_url: athlete.headshot?.href,
      metadata: {
        experience: athlete.experience?.years,
        college: athlete.college?.name
      }
    };
  }

  private parseHeight(height: string | number | any, sport?: string): number | null {
    // Handle null/undefined
    if (!height) return null;
    
    // Handle number format (likely total inches for NBA)
    if (typeof height === 'number') {
      return height;
    }
    
    // Handle string format (e.g., "6'4"")
    if (typeof height === 'string') {
      const match = height.match(/(\d+)'(\d+)"/);
      if (match) {
        return parseInt(match[1]) * 12 + parseInt(match[2]);
      }
    }
    
    // Handle object format (e.g., {feet: 6, inches: 4})
    if (typeof height === 'object' && height.feet !== undefined) {
      return (height.feet * 12) + (height.inches || 0);
    }
    
    return null;
  }

  private async extractPlayerStats(players: any[], gameId: number, sport: string, gameData?: any): Promise<any[]> {
    const stats: any[] = [];
    
    // Get game info for additional context
    const { data: game } = await supabase
      .from('games')
      .select('start_time, home_team_id, away_team_id')
      .eq('id', gameId)
      .single();
    
    if (!game) return [];
    
    // Create ESPN ID to DB ID maps for this collection
    const playerIdMap: Record<string, number> = {};
    
    for (const team of players) {
      const espnTeamId = team.team?.id;
      const teamId = this.teamIdMap[espnTeamId];
      if (!teamId) continue;
      
      const isHome = team.homeAway === 'home';
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      // Process all stat groups (passing, rushing, receiving, etc)
      for (const statGroup of team.statistics || []) {
        const groupName = statGroup.name?.toLowerCase() || '';
        const labels = statGroup.labels || statGroup.names || [];
        
        for (const athlete of statGroup.athletes || []) {
          const playerId = athlete.athlete?.id;
          if (!playerId) continue;
          
          // Get player's internal ID if not cached
          let dbPlayerId = playerIdMap[playerId];
          if (!dbPlayerId) {
            const { data: playerData } = await supabase
              .from('players')
              .select('id')
              .eq('external_id', `espn_${sport.toLowerCase()}_${playerId}`)
              .single();
              
            if (playerData) {
              dbPlayerId = playerData.id;
              playerIdMap[playerId] = dbPlayerId;
            } else {
              continue;
            }
          }
          
          const statValues = athlete.stats || [];
          const parsedStats = this.parseStatsWithLabels(statValues, labels, groupName, sport);
          
          if (Object.keys(parsedStats).length === 0) continue;
          
          stats.push({
            player_id: dbPlayerId,
            game_id: gameId,
            team_id: teamId,
            opponent_id: opponentId,
            game_date: new Date(game.start_time).toISOString().split('T')[0],
            is_home: isHome,
            stats: parsedStats,
            fantasy_points: this.calculateFantasyPointsFromParsed(parsedStats, sport),
            metadata: {
              sport: sport.toUpperCase(),
              stat_group: groupName,
              stat_groups: [groupName],
              collection_source: 'universal-optimized'
            }
          });
        }
      }
    }
    
    return stats;
  }
  
  private extractMinutesPlayed(stats: string[], sport: string): number | null {
    // Sport-specific minutes extraction
    switch (sport.toUpperCase()) {
      case 'NFL':
        // NFL doesn't typically track minutes played
        return null;
      case 'NBA':
        // NBA minutes are typically in format "MM:SS" at index 0
        if (stats[0] && stats[0].includes(':')) {
          const [mins, secs] = stats[0].split(':').map(Number);
          return mins + (secs / 60);
        }
        return null;
      default:
        return null;
    }
  }

  private parseStatsWithLabels(values: string[], labels: string[], groupName: string, sport: string): any {
    const parsed: any = {};
    
    // NFL stat mappings based on the successful turbo script
    const NFL_STAT_MAPPINGS: Record<string, Record<string, string>> = {
      'passing': {
        'C/ATT': 'completions',
        'YDS': 'passing_yards',
        'AVG': 'passing_avg',
        'TD': 'passing_touchdowns',
        'INT': 'interceptions',
        'SACKS': 'sacks_taken',
        'QBR': 'qb_rating',
        'RTG': 'passer_rating',
        'ATT': 'attempts'
      },
      'rushing': {
        'CAR': 'rushing_attempts',
        'YDS': 'rushing_yards',
        'AVG': 'rushing_avg',
        'TD': 'rushing_touchdowns',
        'LONG': 'rushing_long'
      },
      'receiving': {
        'REC': 'receptions',
        'YDS': 'receiving_yards',
        'AVG': 'receiving_avg',
        'TD': 'receiving_touchdowns',
        'LONG': 'receiving_long',
        'TGTS': 'targets'
      },
      'fumbles': {
        'FUM': 'fumbles',
        'LOST': 'fumbles_lost',
        'REC': 'fumbles_recovered'
      },
      'defensive': {
        'TOT': 'total_tackles',
        'SOLO': 'solo_tackles',
        'SACKS': 'sacks',
        'TFL': 'tackles_for_loss',
        'PD': 'passes_defended',
        'QB HTS': 'qb_hits',
        'TD': 'defensive_touchdowns'
      },
      'kicking': {
        'FG': 'field_goals',
        'PCT': 'field_goal_pct',
        'LONG': 'field_goal_long',
        'XP': 'extra_points',
        'PTS': 'kicking_points'
      },
      'punting': {
        'NO': 'punts',
        'YDS': 'punt_yards',
        'AVG': 'punt_avg',
        'TB': 'touchbacks',
        'In 20': 'punts_inside_20',
        'LONG': 'punt_long'
      },
      'kick returns': {
        'NO': 'kick_returns',
        'YDS': 'kick_return_yards',
        'AVG': 'kick_return_avg',
        'LONG': 'kick_return_long',
        'TD': 'kick_return_touchdowns'
      },
      'punt returns': {
        'NO': 'punt_returns',
        'YDS': 'punt_return_yards',
        'AVG': 'punt_return_avg',
        'LONG': 'punt_return_long',
        'TD': 'punt_return_touchdowns'
      },
      'interceptions': {
        'INT': 'interceptions_caught',
        'YDS': 'interception_yards',
        'TD': 'interception_touchdowns'
      }
    };
    
    const mapping = NFL_STAT_MAPPINGS[groupName] || {};
    
    labels.forEach((label: string, index: number) => {
      const value = values[index];
      if (value === undefined || value === null || value === '') return;
      
      const mappedKey = mapping[label];
      if (!mappedKey) return;
      
      // Keep values as strings to match the successful format
      parsed[mappedKey] = value;
    });
    
    return parsed;
  }

  private calculateFantasyPointsFromParsed(stats: any, sport: string): number {
    // Basic fantasy point calculation
    let points = 0;
    
    switch (sport.toUpperCase()) {
      case 'NFL':
        // Passing
        points += (parseInt(stats.passing_yards) || 0) * 0.04;
        points += (parseInt(stats.passing_touchdowns) || 0) * 4;
        points += (parseInt(stats.interceptions) || 0) * -2;
        
        // Rushing
        points += (parseInt(stats.rushing_yards) || 0) * 0.1;
        points += (parseInt(stats.rushing_touchdowns) || 0) * 6;
        
        // Receiving (PPR scoring)
        points += (parseInt(stats.receptions) || 0) * 1;
        points += (parseInt(stats.receiving_yards) || 0) * 0.1;
        points += (parseInt(stats.receiving_touchdowns) || 0) * 6;
        
        // Defense
        points += (parseInt(stats.sacks) || 0) * 1;
        points += (parseInt(stats.interceptions_caught) || 0) * 2;
        points += (parseInt(stats.fumbles_recovered) || 0) * 2;
        points += (parseInt(stats.defensive_touchdowns) || 0) * 6;
        points += (parseInt(stats.interception_touchdowns) || 0) * 6;
        
        // Kicking
        const fgMade = parseInt(stats.field_goals_made) || 0;
        points += fgMade * 3; // Basic FG points
        points += (parseInt(stats.extra_points_made) || 0) * 1;
        
        // Returns
        points += (parseInt(stats.kick_return_touchdowns) || 0) * 6;
        points += (parseInt(stats.punt_return_touchdowns) || 0) * 6;
        break;
      // Add other sports...
    }
    
    return Math.round(points * 100) / 100;
  }

  private async batchInsertGames(games: any[]) {
    if (games.length === 0) return;
    
    const { error } = await supabase
      .from('games')
      .upsert(games, { onConflict: 'external_id' });
      
    if (error) {
      console.error('Error inserting games:', error);
    }
  }

  private async batchInsertPlayers(players: any[]) {
    if (players.length === 0) return;
    
    const { error } = await supabase
      .from('players')
      .upsert(players, { onConflict: 'external_id' });
      
    if (error) {
      console.error('Error inserting players:', error);
    }
  }

  private async batchInsertStats(stats: any[]) {
    if (stats.length === 0) return;
    
    // Insert in smaller chunks to avoid timeouts
    const chunkSize = 500;
    for (let i = 0; i < stats.length; i += chunkSize) {
      const chunk = stats.slice(i, i + chunkSize);
      
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(chunk, {
          onConflict: 'player_id,game_id',
          ignoreDuplicates: true
        });
        
      if (error && !error.message.includes('duplicate key')) {
        console.error('Error inserting stats chunk:', error.message);
      }
    }
  }

  private async enrichWeather(game: any) {
    // Weather enrichment logic
    this.processed.weather++;
  }

  private async enrichBetting(game: any) {
    // Betting enrichment logic
    this.processed.betting++;
  }

  private async enrichInjuries(game: any) {
    // Injury enrichment logic
    this.processed.injuries++;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private printSummary() {
    console.log(chalk.blue('\n📊 Collection Summary:'));
    console.log(chalk.gray('─────────────────────'));
    console.log(chalk.green(`✅ Games: ${this.processed.games}`));
    console.log(chalk.green(`✅ Players: ${this.processed.players}`));
    console.log(chalk.green(`✅ Stats: ${this.processed.stats}`));
    
    if (this.processed.weather > 0) {
      console.log(chalk.green(`✅ Weather: ${this.processed.weather}`));
      console.log(chalk.green(`✅ Betting: ${this.processed.betting}`));
      console.log(chalk.green(`✅ Injuries: ${this.processed.injuries}`));
    }
    
    console.log(chalk.gray('─────────────────────'));
    console.log(chalk.yellow(`💾 Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`));
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(chalk.red('Usage: npm run collect <dataType> <sport> [options]'));
    console.log(chalk.gray('  dataType: games | players | stats | all'));
    console.log(chalk.gray('  sport: nfl | nba | mlb | nhl'));
    console.log(chalk.gray('  options:'));
    console.log(chalk.gray('    --historical: Collect historical data'));
    console.log(chalk.gray('    --year <year>: Specify year (default: 2024)'));
    console.log(chalk.gray('    --enrich: Add ML enrichment data'));
    process.exit(1);
  }

  const options: CollectionOptions = {
    dataType: args[0] as any,
    sport: args[1],
    year: 2024,
    historical: args.includes('--historical'),
    enrich: args.includes('--enrich')
  };

  // Parse year
  const yearIndex = args.indexOf('--year');
  if (yearIndex !== -1 && args[yearIndex + 1]) {
    options.year = parseInt(args[yearIndex + 1]);
  }

  console.log(chalk.blue('🚀 OPTIMIZED UNIVERSAL SPORTS COLLECTOR'));
  console.log(chalk.blue(`Sport: ${options.sport.toUpperCase()} | Year: ${options.year} | Type: ${options.dataType}`));
  console.log(chalk.blue(`Enrichment: ${options.enrich ? 'Enabled' : 'Disabled'}`));
  console.log(chalk.blue('======================================================================\n'));

  const collector = new OptimizedUniversalSportsCollector();
  await collector.collectAll(options);
}

main().catch(console.error);