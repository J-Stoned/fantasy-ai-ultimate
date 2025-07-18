#!/usr/bin/env tsx
/**
 * 🚀 TURBO NCAA 2021 COLLECTOR - 10X PERFORMANCE
 * 
 * Collects all NCAA sports (Football, Basketball, Baseball) for 2021
 * Uses all 12 CPU cores and 32GB RAM for maximum speed!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import os from 'os';
import { DateTime } from 'luxon';
import ncaaAdapter from './adapters/ncaa-adapter.js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 10X PERFORMANCE SETTINGS - USE ALL HARDWARE!
const CPU_CORES = os.cpus().length;
const TOTAL_RAM = os.totalmem() / 1024 / 1024 / 1024; // GB
const httpLimit = pLimit(CPU_CORES * 2); // 24 concurrent HTTP requests
const dbLimit = pLimit(CPU_CORES); // 12 concurrent DB operations

// AGGRESSIVE BATCH SIZES
const BATCH_SIZES = {
  games: 500,
  players: 1000,
  stats: 2000
};

console.log(chalk.cyan('🚀 TURBO NCAA 2021 COLLECTOR - 10X MODE'));
console.log(chalk.gray(`   CPU: ${CPU_CORES} cores (${CPU_CORES * 2} HTTP threads)`));
console.log(chalk.gray(`   RAM: ${TOTAL_RAM.toFixed(1)}GB`));
console.log(chalk.gray(`   Batch Sizes: Games=${BATCH_SIZES.games}, Players=${BATCH_SIZES.players}, Stats=${BATCH_SIZES.stats}`));

interface SportConfig {
  sport: string;
  apiPath: string;
  dateRanges: { start: string; end: string }[];
}

class TurboNCAA2021Collector {
  private teamIdMap = new Map<string, number>();
  private gameIdMap = new Map<string, number>();
  private playerIdMap = new Map<string, number>();
  private stats = {
    games: 0,
    players: 0,
    stats: 0,
    errors: 0
  };
  private progressBar: cliProgress.MultiBar;

  constructor() {
    this.progressBar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: ' {bar} | {percentage}% | {value}/{total} | {duration_formatted} | {sport}'
    }, cliProgress.Presets.shades_grey);
  }

  async collectAll() {
    const startTime = Date.now();
    
    // Load team mappings first
    await this.loadTeamMappings();
    
    // Define all sports to collect
    const sportsConfig: SportConfig[] = [
      {
        sport: 'NCAA_FB',
        apiPath: 'football/college-football',
        dateRanges: [
          { start: '20210828', end: '20210930' },
          { start: '20211001', end: '20211031' },
          { start: '20211101', end: '20211130' },
          { start: '20211201', end: '20220110' }
        ]
      },
      {
        sport: 'NCAA_BB',
        apiPath: 'basketball/mens-college-basketball',
        dateRanges: [
          { start: '20211109', end: '20211130' },
          { start: '20211201', end: '20211231' },
          { start: '20220101', end: '20220131' },
          { start: '20220201', end: '20220228' },
          { start: '20220301', end: '20220404' }
        ]
      },
      {
        sport: 'NCAA_BASEBALL',
        apiPath: 'baseball/college-baseball',
        dateRanges: [
          { start: '20210219', end: '20210331' },
          { start: '20210401', end: '20210430' },
          { start: '20210501', end: '20210531' },
          { start: '20210601', end: '20210630' }
        ]
      }
    ];

    console.log(chalk.yellow('\n📊 Phase 1: Collecting games for all sports in parallel...'));
    
    // Collect all games in parallel
    const gamePromises = sportsConfig.map(config => 
      this.collectSportGames(config)
    );
    
    await Promise.all(gamePromises);
    
    console.log(chalk.yellow('\n👥 Phase 2: Collecting players for all sports in parallel...'));
    
    // Collect all players in parallel
    const playerPromises = sportsConfig.map(config =>
      this.collectSportPlayers(config.sport)
    );
    
    await Promise.all(playerPromises);
    
    console.log(chalk.yellow('\n📊 Phase 3: Collecting stats for all sports in parallel...'));
    
    // Collect all stats in parallel
    const statsPromises = sportsConfig.map(config =>
      this.collectSportStats(config.sport)
    );
    
    await Promise.all(statsPromises);
    
    this.progressBar.stop();
    
    // Final summary
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(chalk.green('\n✅ TURBO COLLECTION COMPLETE!'));
    console.log(chalk.blue(`🎮 Games: ${this.stats.games.toLocaleString()}`));
    console.log(chalk.blue(`👥 Players: ${this.stats.players.toLocaleString()}`));
    console.log(chalk.blue(`📊 Stats: ${this.stats.stats.toLocaleString()}`));
    console.log(chalk.blue(`⏱️  Time: ${Math.round(elapsed / 60)} minutes`));
    console.log(chalk.blue(`🚀 Speed: ${Math.round(this.stats.stats / elapsed)} stats/sec`));
    
    if (this.stats.errors > 0) {
      console.log(chalk.red(`⚠️  Errors: ${this.stats.errors}`));
    }
  }

  private async loadTeamMappings() {
    console.log(chalk.gray('Loading team mappings...'));
    
    let offset = 0;
    while (true) {
      const { data: teams } = await supabase
        .from('teams')
        .select('id, external_id')
        .ilike('sport', 'NCAA%')
        .range(offset, offset + 999)
        .order('id');
        
      if (!teams || teams.length === 0) break;
      
      teams.forEach(team => {
        this.teamIdMap.set(team.external_id, team.id);
      });
      
      offset += teams.length;
      if (teams.length < 1000) break;
    }
    
    console.log(chalk.gray(`Loaded ${this.teamIdMap.size} team mappings`));
  }

  private async collectSportGames(config: SportConfig) {
    const bar = this.progressBar.create(100, 0, { sport: config.sport });
    const allGames: any[] = [];
    
    // Collect games from all date ranges in parallel
    const datePromises = config.dateRanges.map(range =>
      httpLimit(async () => {
        const games = await this.fetchGamesForDateRange(config, range);
        return games;
      })
    );
    
    const gamesArrays = await Promise.all(datePromises);
    gamesArrays.forEach(games => allGames.push(...games));
    
    bar.update(50);
    
    // Process games in batches
    const gameChunks = this.chunkArray(allGames, BATCH_SIZES.games);
    
    for (const chunk of gameChunks) {
      const transformedGames = chunk
        .map(game => {
          const transformed = ncaaAdapter.transformGame(game);
          if (!transformed) return null; // Skip null games
          
          return {
            external_id: transformed.external_id,
            sport: config.sport,
            home_team_id: this.teamIdMap.get(`espn_ncaa_fb_${transformed.home_team_id}`) || 
                         this.teamIdMap.get(`espn_ncaa_bb_${transformed.home_team_id}`) ||
                         this.teamIdMap.get(`espn_ncaa_baseball_${transformed.home_team_id}`) ||
                         this.teamIdMap.get(`espn_${transformed.home_team_id}`), // Fallback for old format
            away_team_id: this.teamIdMap.get(`espn_ncaa_fb_${transformed.away_team_id}`) ||
                         this.teamIdMap.get(`espn_ncaa_bb_${transformed.away_team_id}`) ||
                         this.teamIdMap.get(`espn_ncaa_baseball_${transformed.away_team_id}`) ||
                         this.teamIdMap.get(`espn_${transformed.away_team_id}`), // Fallback for old format
            start_time: transformed.date,
            home_score: transformed.home_score,
            away_score: transformed.away_score,
            status: transformed.status,
            venue: transformed.metadata.venue,
            metadata: {
              ...transformed.metadata,
              season: '2021',
              espn_id: game.id
            }
          };
        })
        .filter(g => g && g.home_team_id && g.away_team_id);
      
      if (transformedGames.length > 0) {
        await dbLimit(async () => {
          const { error } = await supabase
            .from('games')
            .upsert(transformedGames, {
              onConflict: 'external_id',
              ignoreDuplicates: false
            });
            
          if (error) {
            console.error(chalk.red(`\nError inserting ${config.sport} games:`), error.message);
            this.stats.errors++;
          } else {
            this.stats.games += transformedGames.length;
          }
        });
      }
    }
    
    bar.update(100);
    console.log(chalk.green(`\n✅ ${config.sport}: ${allGames.length} games collected`));
  }

  private async fetchGamesForDateRange(config: SportConfig, range: { start: string; end: string }) {
    const games: any[] = [];
    const startDate = DateTime.fromFormat(range.start, 'yyyyMMdd');
    const endDate = DateTime.fromFormat(range.end, 'yyyyMMdd');
    
    let currentDate = startDate;
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toFormat('yyyyMMdd');
      
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${config.apiPath}/scoreboard?dates=${dateStr}&limit=300`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data.events) {
          games.push(...response.data.events);
        }
      } catch (error) {
        // Silently continue on error
      }
      
      currentDate = currentDate.plus({ days: 1 });
    }
    
    return games;
  }

  private async collectSportPlayers(sport: string) {
    const bar = this.progressBar.create(100, 0, { sport: `${sport} Players` });
    
    // Get all games for this sport
    const gameIds: number[] = [];
    let offset = 0;
    
    while (true) {
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .eq('sport', sport)
        .eq('metadata->>season', '2021')
        .range(offset, offset + 999)
        .order('id');
        
      if (!games || games.length === 0) break;
      
      gameIds.push(...games.map(g => g.id));
      offset += games.length;
      if (games.length < 1000) break;
    }
    
    bar.update(20);
    
    // Get team rosters in parallel
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', sport);
      
    if (!teams) return;
    
    const rosterPromises = teams.map(team =>
      httpLimit(async () => {
        const roster = await this.fetchTeamRoster(team, sport);
        return roster;
      })
    );
    
    const rosters = await Promise.all(rosterPromises);
    const allPlayers = rosters.flat();
    
    bar.update(60);
    
    // Insert players in batches
    const playerChunks = this.chunkArray(allPlayers, BATCH_SIZES.players);
    
    for (const chunk of playerChunks) {
      await dbLimit(async () => {
        const { error } = await supabase
          .from('players')
          .upsert(chunk, {
            onConflict: 'external_id',
            ignoreDuplicates: false
          });
          
        if (!error) {
          this.stats.players += chunk.length;
        }
      });
    }
    
    bar.update(100);
  }

  private async fetchTeamRoster(team: any, sport: string) {
    try {
      const teamId = team.external_id.split('_').pop();
      const apiPath = sport === 'NCAA_FB' ? 'football/college-football' :
                      sport === 'NCAA_BB' ? 'basketball/mens-college-basketball' :
                      'baseball/college-baseball';
                      
      const url = `https://site.api.espn.com/apis/site/v2/sports/${apiPath}/teams/${teamId}/roster`;
      const response = await axios.get(url, { timeout: 5000 });
      
      if (!response.data.athletes) return [];
      
      return response.data.athletes.map((athlete: any) => ({
        external_id: `espn_ncaa_${athlete.id}`,
        name: athlete.displayName,
        firstname: athlete.firstName,
        lastname: athlete.lastName,
        position: [athlete.position?.abbreviation].filter(Boolean),
        jersey_number: parseInt(athlete.jersey) || null,
        team_id: team.id,
        sport: sport,
        status: athlete.status?.type || 'active',
        metadata: {
          height: athlete.displayHeight,
          weight: athlete.displayWeight,
          class: athlete.experience?.displayValue,
          hometown: athlete.birthPlace?.city
        }
      }));
    } catch (error) {
      return [];
    }
  }

  private async collectSportStats(sport: string) {
    const bar = this.progressBar.create(100, 0, { sport: `${sport} Stats` });
    
    // Get all games with their external IDs
    const games: any[] = [];
    let offset = 0;
    
    while (true) {
      const { data: batch } = await supabase
        .from('games')
        .select('id, external_id, home_team_id, away_team_id')
        .eq('sport', sport)
        .eq('metadata->>season', '2021')
        .range(offset, offset + 999)
        .order('id');
        
      if (!batch || batch.length === 0) break;
      games.push(...batch);
      offset += batch.length;
      if (batch.length < 1000) break;
    }
    
    bar.update(20);
    
    // Load player mappings for this sport
    const playerMap = new Map<string, number>();
    offset = 0;
    
    while (true) {
      const { data: players } = await supabase
        .from('players')
        .select('id, external_id')
        .eq('sport', sport)
        .range(offset, offset + 999);
        
      if (!players || players.length === 0) break;
      
      players.forEach(p => playerMap.set(p.external_id, p.id));
      offset += players.length;
      if (players.length < 1000) break;
    }
    
    bar.update(40);
    
    // Process games in parallel batches
    const gameChunks = this.chunkArray(games, 50);
    let processed = 0;
    
    for (const chunk of gameChunks) {
      const statsPromises = chunk.map(game =>
        httpLimit(async () => {
          const stats = await this.fetchGameStats(game, sport, playerMap);
          return stats;
        })
      );
      
      const statsArrays = await Promise.all(statsPromises);
      const allStats = statsArrays.flat();
      
      if (allStats.length > 0) {
        // Insert stats in batches
        const statChunks = this.chunkArray(allStats, BATCH_SIZES.stats);
        
        for (const statChunk of statChunks) {
          await dbLimit(async () => {
            const { error } = await supabase
              .from('player_game_logs')
              .upsert(statChunk, {
                onConflict: 'player_id,game_id',
                ignoreDuplicates: true
              });
              
            if (!error) {
              this.stats.stats += statChunk.length;
            }
          });
        }
      }
      
      processed += chunk.length;
      bar.update(40 + (processed / games.length) * 60);
    }
    
    bar.update(100);
  }

  private async fetchGameStats(game: any, sport: string, playerMap: Map<string, number>) {
    try {
      const gameId = game.external_id.split('_').pop();
      const apiPath = sport === 'NCAA_FB' ? 'football/college-football' :
                      sport === 'NCAA_BB' ? 'basketball/mens-college-basketball' :
                      'baseball/college-baseball';
                      
      const url = `https://site.api.espn.com/apis/site/v2/sports/${apiPath}/summary?event=${gameId}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (!response.data.boxscore?.players) return [];
      
      const stats: any[] = [];
      
      response.data.boxscore.players.forEach((team: any) => {
        if (!team.statistics) return;
        
        team.statistics.forEach((statGroup: any) => {
          if (!statGroup.athletes) return;
          
          statGroup.athletes.forEach((athlete: any) => {
            if (!athlete.athlete?.id) return;
            
            const playerId = playerMap.get(`espn_ncaa_${athlete.athlete.id}`);
            if (!playerId) {
              // Create player on the fly if not found
              const newPlayer = {
                external_id: `espn_ncaa_${athlete.athlete.id}`,
                name: athlete.athlete.displayName || athlete.athlete.name,
                firstname: athlete.athlete.firstName,
                lastname: athlete.athlete.lastName,
                position: [athlete.athlete.position?.abbreviation].filter(Boolean),
                jersey_number: parseInt(athlete.athlete.jersey) || null,
                team_id: team.team.id === game.home_team_id ? game.home_team_id : game.away_team_id,
                sport: sport,
                status: 'active',
                metadata: {}
              };
              
              // We'll need to insert this player later
              return;
            }
            
            const statMap = this.parseStats(athlete.stats, sport, statGroup.name);
            if (Object.keys(statMap).length === 0) return;
            
            stats.push({
              player_id: playerId,
              game_id: game.id,
              team_id: team.team.id === game.home_team_id ? game.home_team_id : game.away_team_id,
              game_date: new Date().toISOString().split('T')[0],
              opponent_id: team.team.id === game.home_team_id ? game.away_team_id : game.home_team_id,
              is_home: team.team.id === game.home_team_id,
              stats: statMap,
              fantasy_points: this.calculateFantasyPoints(statMap, sport),
              sport: sport
            });
          });
        });
      });
      
      return stats;
    } catch (error) {
      return [];
    }
  }

  private parseStats(stats: string[], sport: string, category: string): any {
    // Sport-specific stat parsing
    const statMap: any = {};
    
    if (sport === 'NCAA_FB') {
      if (category.includes('passing')) {
        statMap.completions = parseInt(stats[0]?.split('/')[0]) || 0;
        statMap.attempts = parseInt(stats[0]?.split('/')[1]) || 0;
        statMap.passing_yards = parseInt(stats[1]) || 0;
        statMap.passing_touchdowns = parseInt(stats[3]) || 0;
        statMap.interceptions = parseInt(stats[4]) || 0;
      } else if (category.includes('rushing')) {
        statMap.rushing_attempts = parseInt(stats[0]) || 0;
        statMap.rushing_yards = parseInt(stats[1]) || 0;
        statMap.rushing_touchdowns = parseInt(stats[3]) || 0;
      }
    } else if (sport === 'NCAA_BB') {
      statMap.minutes = parseInt(stats[0]) || 0;
      statMap.field_goals_made = parseInt(stats[1]?.split('-')[0]) || 0;
      statMap.field_goals_attempted = parseInt(stats[1]?.split('-')[1]) || 0;
      statMap.three_pointers_made = parseInt(stats[2]?.split('-')[0]) || 0;
      statMap.three_pointers_attempted = parseInt(stats[2]?.split('-')[1]) || 0;
      statMap.free_throws_made = parseInt(stats[3]?.split('-')[0]) || 0;
      statMap.free_throws_attempted = parseInt(stats[3]?.split('-')[1]) || 0;
      statMap.rebounds = parseInt(stats[6]) || 0;
      statMap.assists = parseInt(stats[7]) || 0;
      statMap.steals = parseInt(stats[9]) || 0;
      statMap.blocks = parseInt(stats[8]) || 0;
      statMap.turnovers = parseInt(stats[10]) || 0;
      statMap.points = parseInt(stats[11]) || 0;
    } else if (sport === 'NCAA_BASEBALL') {
      if (category.includes('batting')) {
        statMap.at_bats = parseInt(stats[0]) || 0;
        statMap.runs = parseInt(stats[1]) || 0;
        statMap.hits = parseInt(stats[2]) || 0;
        statMap.rbi = parseInt(stats[3]) || 0;
        statMap.walks = parseInt(stats[4]) || 0;
        statMap.strikeouts = parseInt(stats[5]) || 0;
      } else if (category.includes('pitching')) {
        statMap.innings_pitched = parseFloat(stats[0]) || 0;
        statMap.hits_allowed = parseInt(stats[1]) || 0;
        statMap.runs_allowed = parseInt(stats[2]) || 0;
        statMap.earned_runs = parseInt(stats[3]) || 0;
        statMap.walks_allowed = parseInt(stats[4]) || 0;
        statMap.strikeouts = parseInt(stats[5]) || 0;
      }
    }
    
    return statMap;
  }

  private calculateFantasyPoints(stats: any, sport: string): number {
    let points = 0;
    
    if (sport === 'NCAA_FB') {
      points += (stats.passing_yards || 0) * 0.04;
      points += (stats.passing_touchdowns || 0) * 4;
      points -= (stats.interceptions || 0) * 2;
      points += (stats.rushing_yards || 0) * 0.1;
      points += (stats.rushing_touchdowns || 0) * 6;
      points += (stats.receiving_yards || 0) * 0.1;
      points += (stats.receiving_touchdowns || 0) * 6;
      points += (stats.receptions || 0) * 0.5;
    } else if (sport === 'NCAA_BB') {
      points += (stats.points || 0);
      points += (stats.rebounds || 0) * 1.2;
      points += (stats.assists || 0) * 1.5;
      points += (stats.steals || 0) * 3;
      points += (stats.blocks || 0) * 3;
      points -= (stats.turnovers || 0);
    } else if (sport === 'NCAA_BASEBALL') {
      points += (stats.hits || 0) * 3;
      points += (stats.runs || 0) * 2;
      points += (stats.rbi || 0) * 2;
      points += (stats.walks || 0) * 1;
      points += (stats.stolen_bases || 0) * 2;
      points += (stats.strikeouts || 0) * 2; // For pitchers
      points += (stats.wins || 0) * 5;
    }
    
    return Math.round(points * 10) / 10;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Run the turbo collector
async function main() {
  const collector = new TurboNCAA2021Collector();
  await collector.collectAll();
}

main().catch(console.error);