#!/usr/bin/env tsx
/**
 * 🚀 MiLB ULTRA COLLECTOR - Complete the remaining 42,672+ MiLB games
 * 
 * TARGET: Get ALL remaining MiLB games for 100% complete training datasets
 * Strategy: 
 * 1. Extended seasons (2016-2024)
 * 2. Daily date checks (no sampling)
 * 3. Multiple API endpoints
 * 4. Expanded sport IDs and league detection
 * 5. Complex/Rookie/Independent leagues
 */

import { Worker } from 'worker_threads';
import { ParallelCollectionEngine } from './phase2-parallel-engine';
import { pgPool } from '../fantasy-ml/config/database';
import chalk from 'chalk';
import pLimit from 'p-limit';
import * as os from 'os';
import axios from 'axios';

const CPU_COUNT = os.cpus().length;
const CONCURRENT_WORKERS = 12;
const API_BATCH_SIZE = 400; // ULTRA BEAST MODE

class MiLBUltraCollector {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(API_BATCH_SIZE);
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.red.bold('\n🔥🔥🔥 MiLB ULTRA COLLECTOR - 100% COMPLETION MODE! 🔥🔥🔥\n'));
    console.log(chalk.yellow(`⚡ TARGET: 42,672+ remaining MiLB games`));
    console.log(chalk.yellow(`⚡ STRATEGY: Extended seasons, daily checks, all sport IDs`));
    console.log(chalk.yellow(`⚡ API Concurrency: ${API_BATCH_SIZE} ULTRA calls`));
    console.log(chalk.yellow(`⚡ GOAL: 100% complete MiLB datasets\n`));
  }
  
  async collect() {
    const startTime = Date.now();
    
    try {
      console.log(chalk.cyan.bold('📊 STARTING ULTRA MiLB COLLECTION...\n'));
      
      // STEP 1: Extended teams collection with ALL sport IDs
      await this.collectExtendedMiLBTeams();
      
      // STEP 2: Ultra-comprehensive game collection
      await this.collectUltraMiLBGames();
      
      // STEP 3: Show final results
      await this.showUltraSummary();
      
      const totalTime = Date.now() - startTime;
      console.log(chalk.green.bold(`\n✅ ULTRA MiLB COLLECTION COMPLETE in ${(totalTime/1000/60).toFixed(1)} minutes!\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ Ultra Collection failed:'), error);
    } finally {
      await pgPool.end();
    }
  }
  
  /**
   * STEP 1: Collect teams using ALL known sport IDs and leagues
   */
  async collectExtendedMiLBTeams() {
    console.log(chalk.yellow.bold('\n🏟️ COLLECTING EXTENDED MiLB TEAMS...\n'));
    
    // Comprehensive sport ID mapping from MLB API
    const allSportIds = [
      // Standard levels
      { ids: [11], name: 'Triple-A', sport: 'MILB_AAA' },
      { ids: [12], name: 'Double-A', sport: 'MILB_AA' },
      { ids: [13], name: 'High-A', sport: 'MILB_A_HIGH' },
      { ids: [14], name: 'Single-A', sport: 'MILB_A' },
      
      // Rookie and developmental
      { ids: [16], name: 'Rookie Advanced', sport: 'MILB_ROOKIE_ADV' },
      { ids: [17], name: 'Rookie', sport: 'MILB_ROOKIE' },
      { ids: [15], name: 'Complex League', sport: 'MILB_COMPLEX' },
      
      // Additional/historical levels
      { ids: [18], name: 'Winter League', sport: 'MILB_WINTER' },
      { ids: [19], name: 'International', sport: 'MILB_INTL' },
      { ids: [508], name: 'Arizona Complex', sport: 'MILB_AZL' },
      { ids: [509], name: 'Gulf Coast', sport: 'MILB_GCL' },
      { ids: [510], name: 'Dominican', sport: 'MILB_DSL' },
      
      // Independent leagues (try different IDs)
      { ids: [20, 21, 22, 23], name: 'Independent', sport: 'MILB_INDEPENDENT' }
    ];
    
    for (const level of allSportIds) {
      console.log(chalk.cyan(`\n[${level.name}] Collecting teams...`));
      
      try {
        const teams = await this.fetchTeamsForSportIds(level);
        
        if (teams.length > 0) {
          await this.engine.bulkInsert('teams_master', teams, {
            conflictTarget: 'our_team_id',
            updateColumns: ['name', 'city', 'abbreviation', 'updated_at']
          });
          console.log(chalk.green(`✓ ${level.name}: ${teams.length} teams collected`));
        } else {
          console.log(chalk.gray(`- ${level.name}: No teams found`));
        }
        
      } catch (error) {
        console.log(chalk.yellow(`⚠️ ${level.name} teams failed: ${error.message}`));
      }
    }
  }
  
  /**
   * STEP 2: Ultra-comprehensive game collection with extended seasons
   */
  async collectUltraMiLBGames() {
    console.log(chalk.yellow.bold('\n⚾ COLLECTING ULTRA MiLB GAMES...\n'));
    
    // Extended seasons for maximum historical data
    const seasons = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    
    // Get ALL MiLB sports that have teams
    const sportsResult = await pgPool.query(`
      SELECT DISTINCT sport, COUNT(*) as team_count
      FROM teams_master 
      WHERE sport LIKE 'MILB%'
      GROUP BY sport 
      ORDER BY sport
    `);
    
    console.log(chalk.cyan('📋 All MiLB levels found:'));
    sportsResult.rows.forEach(row => {
      console.log(chalk.green(`  ${row.sport}: ${row.team_count} teams`));
    });
    
    // Create ultra-massive task list
    const gameTasks: any[] = [];
    for (const sportRow of sportsResult.rows) {
      for (const season of seasons) {
        gameTasks.push({ 
          sport: sportRow.sport, 
          season: season,
          teamCount: sportRow.team_count
        });
      }
    }
    
    console.log(chalk.yellow(`\n🚀 ULTRA PROCESSING: ${gameTasks.length} sport/season combinations...\n`));
    
    // Ultra-parallel processing
    const batchSize = 15; // Push beyond standard limits
    let totalGames = 0;
    
    for (let i = 0; i < gameTasks.length; i += batchSize) {
      const batch = gameTasks.slice(i, i + batchSize);
      
      console.log(chalk.cyan.bold(`\n📦 ULTRA BATCH ${Math.floor(i/batchSize) + 1}/${Math.ceil(gameTasks.length/batchSize)}: Processing ${batch.length} combinations...\n`));
      
      const gamesArrays = await this.engine.processInParallel(
        batch,
        async (task) => {
          const games = await this.fetchUltraGames(task.sport, task.season);
          const gameCount = games.length;
          if (gameCount > 0) {
            console.log(chalk.green(`  ✓ ${task.sport} ${task.season}: ${gameCount} games`));
          } else {
            console.log(chalk.gray(`  - ${task.sport} ${task.season}: 0 games`));
          }
          return games;
        },
        { concurrency: batchSize }
      );
      
      // Ultra bulk insert
      const allGames = gamesArrays.flat();
      if (allGames.length > 0) {
        await this.engine.bulkInsert('games_master', allGames, {
          conflictTarget: 'our_game_id',
          updateColumns: ['home_score', 'away_score', 'status', 'updated_at']
        });
        totalGames += allGames.length;
        console.log(chalk.yellow(`📊 Ultra Batch ${Math.floor(i/batchSize) + 1} added ${allGames.length} games (Running total: ${totalGames})`));
      }
      
      // Minimal pause for ultra speed
      if (i + batchSize < gameTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(chalk.green.bold(`\n✅ ULTRA TOTAL GAMES COLLECTED: ${totalGames.toLocaleString()}\n`));
  }
  
  /**
   * Fetch teams using comprehensive sport ID strategy
   */
  async fetchTeamsForSportIds(level: any): Promise<any[]> {
    const teams: any[] = [];
    
    try {
      // Strategy 1: MLB Stats API with ALL sport IDs
      for (const sportId of level.ids) {
        const seasons = [2024, 2023, 2022]; // Check multiple seasons for team variations
        
        for (const season of seasons) {
          try {
            const apiUrl = `https://statsapi.mlb.com/api/v1/teams?sportId=${sportId}&activeStatus=Y,I,A&season=${season}`;
            const response = await this.apiLimit(() => axios.get(apiUrl));
            
            for (const team of response.data.teams || []) {
              const teamId = `${level.sport.toLowerCase()}_${team.id}_${season}`;
              
              teams.push({
                our_team_id: teamId,
                sport: level.sport,
                league: this.getLeagueFromSport(level.sport),
                name: team.name,
                city: team.locationName,
                abbreviation: team.abbreviation,
                mlb_api_id: team.id.toString(),
                venue_name: team.venue?.name,
                division: team.division?.name,
                parent_org_id: team.parentOrgId
              });
            }
          } catch (error) {
            // Continue with next sportId/season
          }
        }
      }
      
      // Strategy 2: Alternative endpoints
      if (teams.length === 0) {
        await this.tryAlternativeTeamSources(level, teams);
      }
      
    } catch (error) {
      console.error(chalk.red(`Error fetching ${level.name} teams:`), error.message);
    }
    
    // Remove duplicates based on team name and city
    const uniqueTeams = this.removeDuplicateTeams(teams);
    return uniqueTeams;
  }
  
  /**
   * Ultra-comprehensive game collection with multiple strategies
   */
  async fetchUltraGames(sport: string, season: number): Promise<any[]> {
    const games: any[] = [];
    
    try {
      // Get teams for this sport level
      const teamsResult = await pgPool.query(
        'SELECT id, our_team_id, mlb_api_id FROM teams_master WHERE sport = $1',
        [sport]
      );
      
      if (teamsResult.rows.length === 0) {
        return games;
      }
      
      // Strategy 1: Daily comprehensive search (no sampling!)
      await this.collectGamesDaily(sport, season, teamsResult.rows, games);
      
      // Strategy 2: Alternative sport ID search
      if (games.length < 50) { // If too few games, try alternatives
        await this.collectGamesAlternativeSportIds(sport, season, teamsResult.rows, games);
      }
      
      // Strategy 3: Historical/archived endpoints
      if (games.length < 100) { // Still too few, try archived data
        await this.collectGamesFromArchives(sport, season, teamsResult.rows, games);
      }
      
    } catch (error) {
      console.error(chalk.red(`Error in ultra collection ${sport} ${season}:`), error.message);
    }
    
    return games;
  }
  
  /**
   * Daily comprehensive search - check EVERY day of the season
   */
  async collectGamesDaily(sport: string, season: number, teams: any[], games: any[]) {
    try {
      const sportIds = this.getSportIdsFromSport(sport);
      
      // Extended MiLB season: March through October (covers spring training + playoffs)
      const dates: Date[] = [];
      this.addDateRange(dates, new Date(season, 2, 1), new Date(season, 9, 31));
      
      console.log(chalk.gray(`    Daily scan: ${dates.length} dates for ${sport} ${season}`));
      
      // Check EVERY day (no sampling for ultra mode)
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const dateStr = date.toISOString().split('T')[0];
        
        try {
          for (const sportId of sportIds) {
            const gameUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${dateStr}&hydrate=team,linescore,venue`;
            const response = await this.apiLimit(() => axios.get(gameUrl));
            
            for (const dateEntry of response.data.dates || []) {
              for (const game of dateEntry.games || []) {
                const homeTeam = teams.find(t => t.mlb_api_id === game.teams.home.team.id.toString());
                const awayTeam = teams.find(t => t.mlb_api_id === game.teams.away.team.id.toString());
                
                if (homeTeam && awayTeam) {
                  const gameId = `${sport.toLowerCase()}_${game.gamePk}`;
                  
                  // Avoid duplicates
                  if (!games.find(g => g.our_game_id === gameId)) {
                    games.push({
                      our_game_id: gameId,
                      sport: sport,
                      league: this.getLeagueFromSport(sport),
                      season: season,
                      game_date: new Date(game.gameDate),
                      home_team_id: homeTeam.id,
                      away_team_id: awayTeam.id,
                      home_score: game.teams.home.score || 0,
                      away_score: game.teams.away.score || 0,
                      status: game.status.detailedState,
                      venue: game.venue?.name,
                      mlb_game_id: game.gamePk.toString(),
                      attendance: game.attendance
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          // Continue with next date
        }
        
        // Ultra-aggressive rate limiting
        if (i % 50 === 49) {
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      }
    } catch (error) {
      // Strategy failed
    }
  }
  
  /**
   * Try alternative sport IDs that might have been missed
   */
  async collectGamesAlternativeSportIds(sport: string, season: number, teams: any[], games: any[]) {
    try {
      // Try additional sport IDs that might contain games
      const alternativeSportIds = this.getAlternativeSportIds(sport);
      
      for (const sportId of alternativeSportIds) {
        try {
          const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&season=${season}&hydrate=team,linescore`;
          const response = await this.apiLimit(() => axios.get(scheduleUrl));
          
          for (const dateEntry of response.data.dates || []) {
            for (const game of dateEntry.games || []) {
              const homeTeam = teams.find(t => t.mlb_api_id === game.teams.home.team.id.toString());
              const awayTeam = teams.find(t => t.mlb_api_id === game.teams.away.team.id.toString());
              
              if (homeTeam && awayTeam) {
                const gameId = `${sport.toLowerCase()}_alt_${sportId}_${game.gamePk}`;
                
                if (!games.find(g => g.our_game_id === gameId)) {
                  games.push({
                    our_game_id: gameId,
                    sport: sport,
                    league: this.getLeagueFromSport(sport),
                    season: season,
                    game_date: new Date(game.gameDate),
                    home_team_id: homeTeam.id,
                    away_team_id: awayTeam.id,
                    home_score: game.teams.home.score || 0,
                    away_score: game.teams.away.score || 0,
                    status: game.status.detailedState,
                    venue: game.venue?.name,
                    mlb_game_id: game.gamePk.toString()
                  });
                }
              }
            }
          }
        } catch (error) {
          // Continue with next alternative sport ID
        }
      }
    } catch (error) {
      // Alternative strategy failed
    }
  }
  
  /**
   * Try archived/historical endpoints for older seasons
   */
  async collectGamesFromArchives(sport: string, season: number, teams: any[], games: any[]) {
    try {
      // For older seasons, try different API patterns
      if (season < 2020) {
        const archiveUrl = `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=${this.getSportIdsFromSport(sport)[0]}&season=${season}&gameType=R`;
        
        try {
          const response = await this.apiLimit(() => axios.get(archiveUrl));
          
          for (const game of response.data.games || []) {
            const homeTeam = teams.find(t => t.mlb_api_id === game.teams?.home?.team?.id?.toString());
            const awayTeam = teams.find(t => t.mlb_api_id === game.teams?.away?.team?.id?.toString());
            
            if (homeTeam && awayTeam) {
              const gameId = `${sport.toLowerCase()}_archive_${game.gamePk}`;
              
              if (!games.find(g => g.our_game_id === gameId)) {
                games.push({
                  our_game_id: gameId,
                  sport: sport,
                  league: this.getLeagueFromSport(sport),
                  season: season,
                  game_date: new Date(game.gameDate),
                  home_team_id: homeTeam.id,
                  away_team_id: awayTeam.id,
                  home_score: game.teams?.home?.score || 0,
                  away_score: game.teams?.away?.score || 0,
                  status: game.status?.detailedState || 'Final',
                  venue: game.venue?.name,
                  mlb_game_id: game.gamePk.toString()
                });
              }
            }
          }
        } catch (error) {
          // Archive strategy failed
        }
      }
    } catch (error) {
      // Archive collection failed
    }
  }
  
  /**
   * Show ultra-comprehensive summary
   */
  async showUltraSummary() {
    console.log(chalk.cyan.bold('\n📊 ULTRA MiLB COLLECTION SUMMARY:\n'));
    
    const totalResult = await pgPool.query('SELECT COUNT(*) FROM games_master');
    console.log(chalk.yellow(`📈 TOTAL GAMES IN DATABASE: ${parseInt(totalResult.rows[0].count).toLocaleString()}`));
    
    const milbResult = await pgPool.query(`
      SELECT sport, COUNT(*) as count 
      FROM games_master 
      WHERE sport LIKE 'MILB%'
      GROUP BY sport 
      ORDER BY sport
    `);
    
    console.log(chalk.cyan('\\n⚾ MiLB GAMES BY LEVEL:'));
    let totalMiLB = 0;
    milbResult.rows.forEach(row => {
      totalMiLB += parseInt(row.count);
      console.log(chalk.green(`  ${row.sport}: ${parseInt(row.count).toLocaleString()} games`));
    });
    
    console.log(chalk.yellow(`\\n🎯 TOTAL MiLB GAMES: ${totalMiLB.toLocaleString()}`));
    
    const expectedMiLB = 50400;
    const previousMiLB = 7728; // Before ultra collection
    const improvement = totalMiLB - previousMiLB;
    console.log(chalk.green.bold(`\\n🚀 ULTRA IMPROVEMENT: +${improvement.toLocaleString()} MiLB games added!`));
    console.log(chalk.yellow(`📊 COVERAGE: ${((totalMiLB / expectedMiLB) * 100).toFixed(1)}% of expected MiLB games`));
    
    if (totalMiLB >= expectedMiLB * 0.8) {
      console.log(chalk.green.bold('\\n🎉 EXCELLENT! 80%+ MiLB coverage achieved!'));
    } else {
      const stillMissing = expectedMiLB - totalMiLB;
      console.log(chalk.yellow(`\\n📋 Still missing: ${stillMissing.toLocaleString()} games for 100% coverage`));
    }
  }
  
  // Enhanced helper methods
  private getSportIdsFromSport(sport: string): number[] {
    const sportIdMap = {
      'MILB_AAA': [11],
      'MILB_AA': [12],
      'MILB_A_HIGH': [13],
      'MILB_A': [14],
      'MILB_ROOKIE_ADV': [16],
      'MILB_ROOKIE': [17],
      'MILB_COMPLEX': [15],
      'MILB_WINTER': [18],
      'MILB_INTL': [19],
      'MILB_AZL': [508],
      'MILB_GCL': [509],
      'MILB_DSL': [510],
      'MILB_INDEPENDENT': [20, 21, 22, 23]
    };
    return sportIdMap[sport] || [11, 12, 13, 14];
  }
  
  private getAlternativeSportIds(sport: string): number[] {
    // Additional sport IDs that might contain games for each level
    const alternativeMap = {
      'MILB_AAA': [11, 12], // Sometimes AAA games are in AA sportId
      'MILB_AA': [12, 13],  // Sometimes AA games are in High-A sportId
      'MILB_A_HIGH': [13, 14], 
      'MILB_A': [14, 16],
      'MILB_ROOKIE_ADV': [16, 17, 15],
      'MILB_ROOKIE': [17, 15, 16],
      'MILB_COMPLEX': [15, 508, 509],
      'MILB_AZL': [508, 15],
      'MILB_GCL': [509, 15],
      'MILB_DSL': [510, 15]
    };
    return alternativeMap[sport] || [];
  }
  
  private getLeagueFromSport(sport: string): string {
    const leagueMap = {
      'MILB_AAA': 'Triple-A',
      'MILB_AA': 'Double-A',
      'MILB_A_HIGH': 'High-A',
      'MILB_A': 'Single-A',
      'MILB_ROOKIE_ADV': 'Rookie Advanced',
      'MILB_ROOKIE': 'Rookie',
      'MILB_COMPLEX': 'Complex League',
      'MILB_WINTER': 'Winter League',
      'MILB_INTL': 'International',
      'MILB_AZL': 'Arizona Complex League',
      'MILB_GCL': 'Gulf Coast League',
      'MILB_DSL': 'Dominican Summer League',
      'MILB_INDEPENDENT': 'Independent League'
    };
    return leagueMap[sport] || 'Minor League Baseball';
  }
  
  private async tryAlternativeTeamSources(level: any, teams: any[]) {
    // Try known team lists or other endpoints
    // This would be implemented with fallback team sources
  }
  
  private removeDuplicateTeams(teams: any[]): any[] {
    const seen = new Set();
    return teams.filter(team => {
      const key = `${team.name}_${team.city}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  private addDateRange(dates: Date[], start: Date, end: Date) {
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }
}

// Run the ultra collector!
if (require.main === module) {
  const collector = new MiLBUltraCollector();
  collector.collect().catch(console.error);
}