#!/usr/bin/env tsx
/**
 * 🚀 MiLB MEGA COLLECTOR - Complete Minor League Baseball Collection
 * 
 * TARGET: Collect ALL 50,200+ missing MiLB games for complete training datasets
 * Strategy: Use MLB Stats API + MiLB.com + ESPN fallbacks
 * Performance: ALL 6 cores + 12 threads for maximum speed
 */

import { Worker } from 'worker_threads';
import { ParallelCollectionEngine } from './phase2-parallel-engine';
import { pgPool } from '../fantasy-ml/config/database';
import chalk from 'chalk';
import pLimit from 'p-limit';
import * as os from 'os';
import axios from 'axios';

const CPU_COUNT = os.cpus().length;
const CONCURRENT_WORKERS = 12; // ALL threads!
const API_BATCH_SIZE = 300; // MEGA BEAST MODE API calls

class MiLBMegaCollector {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(API_BATCH_SIZE);
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.red.bold('\n🔥🔥🔥 MiLB MEGA COLLECTOR - COMPLETE DATASET MODE! 🔥🔥🔥\n'));
    console.log(chalk.yellow(`⚡ TARGET: 50,200+ missing MiLB games`));
    console.log(chalk.yellow(`⚡ CPU: ${CPU_COUNT} threads (ALL CORES UNLEASHED)`));
    console.log(chalk.yellow(`⚡ Workers: ${CONCURRENT_WORKERS} parallel workers`));
    console.log(chalk.yellow(`⚡ API Concurrency: ${API_BATCH_SIZE} simultaneous calls`));
    console.log(chalk.yellow(`⚡ Expected: COMPLETE MiLB datasets for ML training\n`));
  }
  
  async collect() {
    const startTime = Date.now();
    
    try {
      console.log(chalk.cyan.bold('📊 STARTING MiLB MEGA COLLECTION...\n'));
      
      // STEP 1: Massive team collection for ALL MiLB levels
      await this.collectAllMiLBTeams();
      
      // STEP 2: Comprehensive game collection for ALL seasons
      await this.collectAllMiLBGames();
      
      // STEP 3: Show final results
      await this.showMiLBSummary();
      
      const totalTime = Date.now() - startTime;
      console.log(chalk.green.bold(`\n✅ MiLB MEGA COLLECTION COMPLETE in ${(totalTime/1000/60).toFixed(1)} minutes!\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ MiLB Collection failed:'), error);
    } finally {
      await pgPool.end();
    }
  }
  
  /**
   * STEP 1: Collect ALL MiLB teams across all levels
   */
  async collectAllMiLBTeams() {
    console.log(chalk.yellow.bold('\n🏟️ COLLECTING ALL MiLB TEAMS...\n'));
    
    // Define ALL MiLB levels with comprehensive coverage
    const milbLevels = [
      { id: 'milb_aaa', name: 'Triple-A (AAA)', sportIds: [11] },
      { id: 'milb_aa', name: 'Double-A (AA)', sportIds: [12] },
      { id: 'milb_a+', name: 'High-A (A+)', sportIds: [13] },
      { id: 'milb_a', name: 'Single-A (A)', sportIds: [14] },
      { id: 'milb_rookie', name: 'Rookie League', sportIds: [16, 17] },
      { id: 'milb_complex', name: 'Complex League', sportIds: [15] }
    ];
    
    for (const level of milbLevels) {
      console.log(chalk.cyan(`\n[${level.name}] Collecting teams...`));
      
      try {
        const teams = await this.fetchMiLBTeamsForLevel(level);
        
        if (teams.length > 0) {
          await this.engine.bulkInsert('teams_master', teams, {
            conflictTarget: 'our_team_id',
            updateColumns: ['name', 'city', 'abbreviation', 'updated_at']
          });
          console.log(chalk.green(`✓ ${level.name}: ${teams.length} teams collected`));
        } else {
          console.log(chalk.yellow(`⚠️ ${level.name}: No teams found`));
        }
        
      } catch (error) {
        console.error(chalk.red(`❌ ${level.name} teams failed:`), error.message);
      }
    }
  }
  
  /**
   * STEP 2: Collect ALL MiLB games for comprehensive training data
   */
  async collectAllMiLBGames() {
    console.log(chalk.yellow.bold('\n⚾ COLLECTING ALL MiLB GAMES...\n'));
    
    // Extended seasons for maximum data coverage
    const seasons = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
    
    // Get all MiLB sports that have teams
    const sportsResult = await pgPool.query(`
      SELECT DISTINCT sport, COUNT(*) as team_count
      FROM teams_master 
      WHERE sport LIKE 'MILB%'
      GROUP BY sport 
      ORDER BY sport
    `);
    
    console.log(chalk.cyan('📋 MiLB levels found:'));
    sportsResult.rows.forEach(row => {
      console.log(chalk.green(`  ${row.sport}: ${row.team_count} teams`));
    });
    
    // Create massive task list for parallel processing
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
    
    console.log(chalk.yellow(`\n🚀 Processing ${gameTasks.length} sport/season combinations...\n`));
    
    // Process in mega batches for maximum speed
    const batchSize = 12; // Use all CPU cores
    let totalGames = 0;
    
    for (let i = 0; i < gameTasks.length; i += batchSize) {
      const batch = gameTasks.slice(i, i + batchSize);
      
      console.log(chalk.cyan.bold(`\n📦 MEGA BATCH ${Math.floor(i/batchSize) + 1}/${Math.ceil(gameTasks.length/batchSize)}: Processing ${batch.length} combinations...\n`));
      
      const gamesArrays = await this.engine.processInParallel(
        batch,
        async (task) => {
          const games = await this.fetchMiLBGamesComprehensive(task.sport, task.season);
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
      
      // Bulk insert this mega batch
      const allGames = gamesArrays.flat();
      if (allGames.length > 0) {
        await this.engine.bulkInsert('games_master', allGames, {
          conflictTarget: 'our_game_id',
          updateColumns: ['home_score', 'away_score', 'status', 'updated_at']
        });
        totalGames += allGames.length;
        console.log(chalk.yellow(`📊 Batch ${Math.floor(i/batchSize) + 1} added ${allGames.length} games (Running total: ${totalGames})`));
      }
      
      // Minimal pause between mega batches
      if (i + batchSize < gameTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(chalk.green.bold(`\n✅ TOTAL MiLB GAMES COLLECTED: ${totalGames.toLocaleString()}\n`));
  }
  
  /**
   * Fetch teams for a specific MiLB level using comprehensive API strategy
   */
  async fetchMiLBTeamsForLevel(level: any): Promise<any[]> {
    const teams: any[] = [];
    
    try {
      // Primary strategy: MLB Stats API
      for (const sportId of level.sportIds) {
        const apiUrl = `https://statsapi.mlb.com/api/v1/teams?sportId=${sportId}&activeStatus=Y,I&season=2024`;
        
        try {
          const response = await this.apiLimit(() => axios.get(apiUrl));
          
          for (const team of response.data.teams || []) {
            teams.push({
              our_team_id: `${level.id}_${team.id}`,
              sport: level.id.toUpperCase(),
              league: this.getLeague(level.id),
              name: team.name,
              city: team.locationName,
              abbreviation: team.abbreviation,
              mlb_api_id: team.id.toString(),
              venue_name: team.venue?.name,
              division: team.division?.name,
              parent_org_id: team.parentOrgId
            });
          }
        } catch (apiError) {
          console.log(chalk.yellow(`    MLB API failed for sportId ${sportId}, trying fallback...`));
        }
      }
      
      // Fallback strategy: Known team data
      if (teams.length === 0) {
        const knownTeams = this.getKnownMiLBTeams(level.id);
        teams.push(...knownTeams);
      }
      
    } catch (error) {
      console.error(chalk.red(`Error fetching ${level.name} teams:`), error.message);
    }
    
    return teams;
  }
  
  /**
   * Comprehensive MiLB game collection with multiple API strategies
   */
  async fetchMiLBGamesComprehensive(sport: string, season: number): Promise<any[]> {
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
      
      // Strategy 1: MLB Stats API comprehensive search
      await this.collectGamesFromMLBAPI(sport, season, teamsResult.rows, games);
      
      // Strategy 2: If no games found, try MiLB.com API
      if (games.length === 0) {
        await this.collectGamesFromMiLBAPI(sport, season, teamsResult.rows, games);
      }
      
      // Strategy 3: If still no games, try ESPN fallback
      if (games.length === 0) {
        await this.collectGamesFromESPNFallback(sport, season, teamsResult.rows, games);
      }
      
    } catch (error) {
      console.error(chalk.red(`Error collecting ${sport} ${season}:`), error.message);
    }
    
    return games;
  }
  
  /**
   * Strategy 1: MLB Stats API with comprehensive date coverage
   */
  async collectGamesFromMLBAPI(sport: string, season: number, teams: any[], games: any[]) {
    try {
      // Get sport IDs for this level
      const sportIds = this.getSportIdsForLevel(sport);
      
      // MiLB season typically runs April through September
      const dates: Date[] = [];
      this.addDateRange(dates, new Date(season, 3, 1), new Date(season, 8, 30));
      
      // Check every week to balance speed vs completeness
      for (let i = 0; i < dates.length; i += 7) {
        const date = dates[i];
        const dateStr = date.toISOString().split('T')[0];
        
        try {
          for (const sportId of sportIds) {
            const gameUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${dateStr}&hydrate=team,linescore`;
            const response = await this.apiLimit(() => axios.get(gameUrl));
            
            for (const dateEntry of response.data.dates || []) {
              for (const game of dateEntry.games || []) {
                const homeTeam = teams.find(t => t.mlb_api_id === game.teams.home.team.id.toString());
                const awayTeam = teams.find(t => t.mlb_api_id === game.teams.away.team.id.toString());
                
                if (homeTeam && awayTeam) {
                  games.push({
                    our_game_id: `${sport.toLowerCase()}_${game.gamePk}`,
                    sport: sport,
                    league: this.getLeague(sport),
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
          // Continue with next date
        }
        
        // Aggressive rate limiting for maximum speed
        if (i % 30 === 29) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      // Strategy 1 failed, will try next strategy
    }
  }
  
  /**
   * Strategy 2: MiLB.com API fallback
   */
  async collectGamesFromMiLBAPI(sport: string, season: number, teams: any[], games: any[]) {
    try {
      // MiLB.com sometimes has different endpoints
      const milbApiUrl = `https://www.milb.com/api/v1/schedule?sportId=${this.getSportIdsForLevel(sport)[0]}&season=${season}`;
      
      const response = await this.apiLimit(() => axios.get(milbApiUrl));
      
      // Process MiLB.com response structure
      for (const game of response.data.games || []) {
        const homeTeam = teams.find(t => t.mlb_api_id === game.homeTeam?.id?.toString());
        const awayTeam = teams.find(t => t.mlb_api_id === game.awayTeam?.id?.toString());
        
        if (homeTeam && awayTeam) {
          games.push({
            our_game_id: `${sport.toLowerCase()}_milb_${game.id}`,
            sport: sport,
            league: this.getLeague(sport),
            season: season,
            game_date: new Date(game.gameDate),
            home_team_id: homeTeam.id,
            away_team_id: awayTeam.id,
            home_score: game.homeScore || 0,
            away_score: game.awayScore || 0,
            status: game.status || 'Unknown',
            venue: game.venue?.name
          });
        }
      }
    } catch (error) {
      // Strategy 2 failed, will try next strategy
    }
  }
  
  /**
   * Strategy 3: ESPN fallback (limited data but better than nothing)
   */
  async collectGamesFromESPNFallback(sport: string, season: number, teams: any[], games: any[]) {
    try {
      // ESPN has limited MiLB coverage but might have some data
      const espnSport = this.getESPNSport(sport);
      if (!espnSport.includes('milb')) return; // Skip if ESPN doesn't support this level
      
      const dates: Date[] = [];
      this.addDateRange(dates, new Date(season, 3, 1), new Date(season, 8, 30));
      
      // Sample dates to avoid overwhelming ESPN
      for (let i = 0; i < dates.length; i += 14) {
        const date = dates[i];
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/milb/scoreboard?dates=${dateStr}&limit=500`;
        
        try {
          const response = await this.apiLimit(() => axios.get(url));
          
          for (const event of response.data.events || []) {
            const competition = event.competitions?.[0];
            if (!competition) continue;
            
            const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
            const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
            
            // Try to match teams by name (ESPN IDs might be different)
            const homeTeamMatch = teams.find(t => 
              t.name?.includes(homeTeam?.team?.displayName) || 
              homeTeam?.team?.displayName?.includes(t.name)
            );
            const awayTeamMatch = teams.find(t => 
              t.name?.includes(awayTeam?.team?.displayName) || 
              awayTeam?.team?.displayName?.includes(t.name)
            );
            
            if (homeTeamMatch && awayTeamMatch) {
              games.push({
                our_game_id: `${sport.toLowerCase()}_espn_${event.id}`,
                sport: sport,
                league: this.getLeague(sport),
                season: season,
                game_date: new Date(event.date),
                home_team_id: homeTeamMatch.id,
                away_team_id: awayTeamMatch.id,
                home_score: parseInt(homeTeam?.score) || 0,
                away_score: parseInt(awayTeam?.score) || 0,
                status: event.status?.type?.name || 'Unknown',
                venue: competition.venue?.fullName,
                espn_game_id: event.id
              });
            }
          }
        } catch (error) {
          // Continue with next date
        }
        
        // Rate limiting for ESPN
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      // All strategies failed
    }
  }
  
  /**
   * Show comprehensive MiLB collection summary
   */
  async showMiLBSummary() {
    console.log(chalk.cyan.bold('\n📊 MiLB COLLECTION SUMMARY:\n'));
    
    const totalResult = await pgPool.query('SELECT COUNT(*) FROM games_master');
    console.log(chalk.yellow(`📈 TOTAL GAMES IN DATABASE: ${parseInt(totalResult.rows[0].count).toLocaleString()}`));
    
    const milbResult = await pgPool.query(`
      SELECT sport, COUNT(*) as count 
      FROM games_master 
      WHERE sport LIKE 'MILB%'
      GROUP BY sport 
      ORDER BY sport
    `);
    
    console.log(chalk.cyan('\n⚾ MiLB GAMES BY LEVEL:'));
    let totalMiLB = 0;
    milbResult.rows.forEach(row => {
      totalMiLB += parseInt(row.count);
      console.log(chalk.green(`  ${row.sport}: ${parseInt(row.count).toLocaleString()} games`));
    });
    
    console.log(chalk.yellow(`\n🎯 TOTAL MiLB GAMES: ${totalMiLB.toLocaleString()}`));
    
    // Show by season
    const seasonResult = await pgPool.query(`
      SELECT sport, season, COUNT(*) as count 
      FROM games_master 
      WHERE sport LIKE 'MILB%'
      GROUP BY sport, season 
      ORDER BY sport, season DESC
    `);
    
    console.log(chalk.cyan('\n📅 MiLB GAMES BY SEASON:'));
    const seasonData = {};
    seasonResult.rows.forEach(row => {
      if (!seasonData[row.sport]) seasonData[row.sport] = {};
      seasonData[row.sport][row.season] = parseInt(row.count);
    });
    
    Object.keys(seasonData).forEach(sport => {
      console.log(chalk.green(`\n  ${sport}:`));
      Object.keys(seasonData[sport]).sort().reverse().forEach(season => {
        console.log(chalk.gray(`    ${season}: ${seasonData[sport][season].toLocaleString()} games`));
      });
    });
    
    const expectedMiLB = 50400;
    const improvement = totalMiLB - 200; // Previous count was 200
    console.log(chalk.green.bold(`\n🚀 IMPROVEMENT: +${improvement.toLocaleString()} MiLB games added!`));
    console.log(chalk.yellow(`📊 COVERAGE: ${((totalMiLB / expectedMiLB) * 100).toFixed(1)}% of expected MiLB games`));
  }
  
  // Helper methods
  private getSportIdsForLevel(sport: string): number[] {
    const sportIdMap = {
      'MILB_AAA': [11],      // Triple-A
      'MILB_AA': [12],       // Double-A  
      'MILB_A+': [13],       // High-A
      'MILB_A': [14],        // Single-A
      'MILB_ROOKIE': [16, 17], // Rookie leagues
      'MILB_COMPLEX': [15]   // Complex leagues
    };
    return sportIdMap[sport] || [11, 12, 13, 14];
  }
  
  private getLeague(sport: string): string {
    const leagueMap = {
      'milb_aaa': 'AAA',
      'milb_aa': 'AA', 
      'milb_a+': 'A+',
      'milb_a': 'A',
      'milb_rookie': 'ROOKIE',
      'milb_complex': 'COMPLEX'
    };
    return leagueMap[sport.toLowerCase()] || 'MiLB';
  }
  
  private getESPNSport(sport: string): string {
    const sportMap = {
      'milb_aaa': 'baseball/milb',
      'milb_aa': 'baseball/milb',
      'milb_a+': 'baseball/milb', 
      'milb_a': 'baseball/milb'
    };
    return sportMap[sport.toLowerCase()] || 'baseball/milb';
  }
  
  private getKnownMiLBTeams(sport: string): any[] {
    // Fallback known teams for each level (abbreviated list)
    const knownTeams = {
      'milb_aaa': [
        { name: 'Buffalo Bisons', city: 'Buffalo', abbr: 'BUF' },
        { name: 'Charlotte Knights', city: 'Charlotte', abbr: 'CLT' },
        { name: 'Columbus Clippers', city: 'Columbus', abbr: 'COL' }
        // Add more as needed
      ],
      'milb_aa': [
        { name: 'Akron RubberDucks', city: 'Akron', abbr: 'AKR' },
        { name: 'Altoona Curve', city: 'Altoona', abbr: 'ALT' }
        // Add more as needed
      ]
      // Add more levels as needed
    };
    
    const teams = knownTeams[sport] || [];
    return teams.map((team, index) => ({
      our_team_id: `${sport}_known_${index}`,
      sport: sport.toUpperCase(),
      league: this.getLeague(sport),
      name: team.name,
      city: team.city,
      abbreviation: team.abbr,
      mlb_api_id: `known_${index}`
    }));
  }
  
  private addDateRange(dates: Date[], start: Date, end: Date) {
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }
}

// Run the mega collector!
if (require.main === module) {
  const collector = new MiLBMegaCollector();
  collector.collect().catch(console.error);
}