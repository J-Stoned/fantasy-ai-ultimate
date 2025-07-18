#!/usr/bin/env tsx
/**
 * 🚀 TURBO NCAA 2021 STATS DIRECT COLLECTOR
 * 
 * Collects NCAA stats directly from game APIs, creating players on-demand
 * Handles the issue where roster APIs don't work for many NCAA teams
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

// 10X PERFORMANCE SETTINGS
const CPU_CORES = os.cpus().length;
const httpLimit = pLimit(CPU_CORES * 2); // 24 concurrent HTTP requests
const dbLimit = pLimit(CPU_CORES); // 12 concurrent DB operations

console.log(chalk.cyan('🚀 TURBO NCAA 2021 STATS DIRECT COLLECTOR'));
console.log(chalk.gray(`   CPU: ${CPU_CORES} cores (${CPU_CORES * 2} HTTP threads)`));
console.log(chalk.gray(`   Direct player creation from game stats`));

interface GameInfo {
  id: number;
  external_id: string;
  sport: string;
  home_team_id: number;
  away_team_id: number;
  start_time: string;
}

class TurboNCAAStatsCollector {
  private playerCache = new Map<string, number>();
  private teamCache = new Map<number, any>();
  private stats = {
    games: 0,
    players: 0,
    newPlayers: 0,
    stats: 0,
    errors: 0
  };
  private progressBar: cliProgress.SingleBar;

  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: ' {bar} | {percentage}% | {value}/{total} | {sport} {phase}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  async collectAll() {
    const startTime = Date.now();
    
    // Load existing players and teams
    await this.loadExistingData();
    
    // Process each sport
    for (const sport of ['NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL']) {
      await this.collectSportStats(sport);
    }
    
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(chalk.green('\n✅ COLLECTION COMPLETE!'));
    console.log(chalk.blue(`📊 Games processed: ${this.stats.games.toLocaleString()}`));
    console.log(chalk.blue(`👥 New players created: ${this.stats.newPlayers.toLocaleString()}`));
    console.log(chalk.blue(`📈 Stats collected: ${this.stats.stats.toLocaleString()}`));
    console.log(chalk.blue(`⏱️  Time: ${Math.round(elapsed / 60)} minutes`));
    console.log(chalk.blue(`🚀 Speed: ${Math.round(this.stats.stats / elapsed)} stats/sec`));
    
    if (this.stats.errors > 0) {
      console.log(chalk.red(`⚠️  Errors: ${this.stats.errors}`));
    }
  }

  private async loadExistingData() {
    console.log(chalk.gray('Loading existing players and teams...'));
    
    // Load players
    let offset = 0;
    while (true) {
      const { data: players } = await supabase
        .from('players')
        .select('id, external_id')
        .in('sport', ['NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL'])
        .range(offset, offset + 999);
        
      if (!players || players.length === 0) break;
      
      players.forEach(p => {
        this.playerCache.set(p.external_id, p.id);
      });
      
      offset += players.length;
      if (players.length < 1000) break;
    }
    
    // Load teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id, name, abbreviation')
      .in('sport', ['NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL']);
      
    teams?.forEach(t => {
      this.teamCache.set(t.id, t);
    });
    
    console.log(chalk.gray(`Loaded ${this.playerCache.size} players and ${this.teamCache.size} teams`));
  }

  private async collectSportStats(sport: string) {
    console.log(chalk.yellow(`\n📊 Collecting ${sport} stats...`));
    
    // Get all games for this sport
    const games: GameInfo[] = [];
    let offset = 0;
    
    while (true) {
      const { data: batch } = await supabase
        .from('games')
        .select('id, external_id, sport, home_team_id, away_team_id, start_time')
        .eq('sport', sport)
        .eq('metadata->>season', '2021')
        .range(offset, offset + 999)
        .order('id');
        
      if (!batch || batch.length === 0) break;
      games.push(...batch);
      offset += batch.length;
      if (batch.length < 1000) break;
    }
    
    console.log(chalk.green(`Found ${games.length} ${sport} games`));
    
    this.progressBar.start(games.length, 0, { sport, phase: 'collecting' });
    
    // Process games in batches
    const gameChunks = this.chunkArray(games, 50);
    
    for (const chunk of gameChunks) {
      const promises = chunk.map(game =>
        httpLimit(async () => {
          const result = await this.collectGameStats(game);
          this.progressBar.increment();
          return result;
        })
      );
      
      const results = await Promise.all(promises);
      
      // Process results
      for (const result of results) {
        if (result.newPlayers.length > 0) {
          await this.insertNewPlayers(result.newPlayers);
        }
        
        if (result.stats.length > 0) {
          await this.insertStats(result.stats);
        }
      }
      
      this.stats.games += chunk.length;
    }
    
    this.progressBar.stop();
  }

  private async collectGameStats(game: GameInfo) {
    const newPlayers: any[] = [];
    const stats: any[] = [];
    
    try {
      const gameId = game.external_id.split('_').pop();
      const apiPath = game.sport === 'NCAA_FB' ? 'football/college-football' :
                      game.sport === 'NCAA_BB' ? 'basketball/mens-college-basketball' :
                      'baseball/college-baseball';
                      
      const url = `https://site.api.espn.com/apis/site/v2/sports/${apiPath}/summary?event=${gameId}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (!response.data.boxscore?.players) return { newPlayers, stats };
      
      const gameDate = new Date(game.start_time).toISOString().split('T')[0];
      
      response.data.boxscore.players.forEach((team: any) => {
        if (!team.statistics) return;
        
        // ESPN returns team.team.id as a string, need to compare properly
        const teamESPNId = parseInt(team.team.id);
        let teamId = game.home_team_id;
        
        // Find which team this is by checking the team cache
        const homeTeam = this.teamCache.get(game.home_team_id);
        const awayTeam = this.teamCache.get(game.away_team_id);
        
        if (homeTeam && homeTeam.external_id.includes(teamESPNId.toString())) {
          teamId = game.home_team_id;
        } else if (awayTeam && awayTeam.external_id.includes(teamESPNId.toString())) {
          teamId = game.away_team_id;
        }
        const opponentId = teamId === game.home_team_id ? game.away_team_id : game.home_team_id;
        const isHome = teamId === game.home_team_id;
        
        team.statistics.forEach((statGroup: any) => {
          if (!statGroup.athletes) return;
          
          statGroup.athletes.forEach((athlete: any) => {
            if (!athlete.athlete?.id) return;
            
            const playerExternalId = `espn_ncaa_${athlete.athlete.id}`;
            let playerId = this.playerCache.get(playerExternalId);
            
            if (!playerId) {
              // Create new player
              const newPlayer = {
                external_id: playerExternalId,
                name: athlete.athlete.displayName || athlete.athlete.name || 'Unknown',
                firstname: athlete.athlete.firstName || '',
                lastname: athlete.athlete.lastName || '',
                position: [athlete.athlete.position?.abbreviation].filter(Boolean),
                jersey_number: parseInt(athlete.athlete.jersey) || null,
                team_id: teamId,
                sport: game.sport,
                status: 'active',
                metadata: {
                  created_from: 'game_api',
                  espn_id: athlete.athlete.id
                }
              };
              
              newPlayers.push(newPlayer);
              // Don't process stats for new players yet
              return;
            }
            
            const statMap = this.parseStats(athlete.stats, game.sport, statGroup.name);
            if (Object.keys(statMap).length === 0) return;
            
            stats.push({
              player_id: playerId,
              game_id: game.id,
              team_id: teamId,
              game_date: gameDate,
              opponent_id: opponentId,
              is_home: isHome,
              stats: statMap,
              fantasy_points: this.calculateFantasyPoints(statMap, game.sport)
            });
          });
        });
      });
      
    } catch (error) {
      this.stats.errors++;
    }
    
    return { newPlayers, stats };
  }

  private async insertNewPlayers(players: any[]) {
    if (players.length === 0) return;
    
    await dbLimit(async () => {
      const { data, error } = await supabase
        .from('players')
        .upsert(players, {
          onConflict: 'external_id',
          ignoreDuplicates: false
        })
        .select('id, external_id');
        
      if (!error && data) {
        data.forEach(p => {
          this.playerCache.set(p.external_id, p.id);
        });
        this.stats.newPlayers += data.length;
      } else if (error) {
        console.error(chalk.red('Error inserting players:'), error.message);
      }
    });
  }

  private async insertStats(stats: any[]) {
    if (stats.length === 0) return;
    
    await dbLimit(async () => {
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(stats, {
          onConflict: 'player_id,game_id',
          ignoreDuplicates: true
        });
        
      if (!error) {
        this.stats.stats += stats.length;
      } else {
        console.error(chalk.red('Error inserting stats:'), error.message);
      }
    });
  }

  private parseStats(stats: string[], sport: string, category: string): any {
    const statMap: any = {};
    
    if (sport === 'NCAA_FB') {
      if (category.toLowerCase().includes('passing')) {
        const compAtt = stats[0]?.split('/') || ['0', '0'];
        statMap.completions = parseInt(compAtt[0]) || 0;
        statMap.attempts = parseInt(compAtt[1]) || 0;
        statMap.passing_yards = parseInt(stats[1]) || 0;
        statMap.passing_touchdowns = parseInt(stats[3]) || 0;
        statMap.interceptions = parseInt(stats[4]) || 0;
      } else if (category.toLowerCase().includes('rushing')) {
        statMap.rushing_attempts = parseInt(stats[0]) || 0;
        statMap.rushing_yards = parseInt(stats[1]) || 0;
        statMap.rushing_touchdowns = parseInt(stats[3]) || 0;
      } else if (category.toLowerCase().includes('receiving')) {
        statMap.receptions = parseInt(stats[0]) || 0;
        statMap.receiving_yards = parseInt(stats[1]) || 0;
        statMap.receiving_touchdowns = parseInt(stats[3]) || 0;
      }
    } else if (sport === 'NCAA_BB') {
      statMap.minutes_played = parseInt(stats[0]) || 0;
      const fgm = stats[1]?.split('-') || ['0', '0'];
      statMap.field_goals_made = parseInt(fgm[0]) || 0;
      statMap.field_goals_attempted = parseInt(fgm[1]) || 0;
      const tpm = stats[2]?.split('-') || ['0', '0'];
      statMap.three_pointers_made = parseInt(tpm[0]) || 0;
      statMap.three_pointers_attempted = parseInt(tpm[1]) || 0;
      const ftm = stats[3]?.split('-') || ['0', '0'];
      statMap.free_throws_made = parseInt(ftm[0]) || 0;
      statMap.free_throws_attempted = parseInt(ftm[1]) || 0;
      statMap.rebounds = parseInt(stats[6]) || 0;
      statMap.assists = parseInt(stats[7]) || 0;
      statMap.blocks = parseInt(stats[8]) || 0;
      statMap.steals = parseInt(stats[9]) || 0;
      statMap.turnovers = parseInt(stats[10]) || 0;
      statMap.points = parseInt(stats[11]) || 0;
    } else if (sport === 'NCAA_BASEBALL') {
      if (category.toLowerCase().includes('batting')) {
        statMap.at_bats = parseInt(stats[0]) || 0;
        statMap.runs = parseInt(stats[1]) || 0;
        statMap.hits = parseInt(stats[2]) || 0;
        statMap.rbi = parseInt(stats[3]) || 0;
        statMap.walks = parseInt(stats[4]) || 0;
        statMap.strikeouts = parseInt(stats[5]) || 0;
      } else if (category.toLowerCase().includes('pitching')) {
        statMap.innings_pitched = parseFloat(stats[0]) || 0;
        statMap.hits_allowed = parseInt(stats[1]) || 0;
        statMap.runs_allowed = parseInt(stats[2]) || 0;
        statMap.earned_runs = parseInt(stats[3]) || 0;
        statMap.walks_allowed = parseInt(stats[4]) || 0;
        statMap.strikeouts_pitched = parseInt(stats[5]) || 0;
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
      points += (stats.strikeouts_pitched || 0) * 2;
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

// Run the collector
async function main() {
  const collector = new TurboNCAAStatsCollector();
  await collector.collectAll();
}

main().catch(console.error);