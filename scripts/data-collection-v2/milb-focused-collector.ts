#!/usr/bin/env tsx
/**
 * 🚀 MiLB FOCUSED COLLECTOR - Target the remaining gaps for complete datasets
 * 
 * Analysis shows we need to focus on:
 * 1. Missing 2020 season data (COVID season - limited but some games exist)
 * 2. 2016-2017 historical data completion  
 * 3. All Rookie/Complex/Independent league games
 * 4. More comprehensive daily scanning for existing levels
 */

import { ParallelCollectionEngine } from './phase2-parallel-engine';
import { pgPool } from '../fantasy-ml/config/database';
import chalk from 'chalk';
import pLimit from 'p-limit';
import axios from 'axios';

class MiLBFocusedCollector {
  private engine: ParallelCollectionEngine;
  private apiLimit = pLimit(200); // Focused but aggressive
  
  constructor() {
    this.engine = new ParallelCollectionEngine();
    console.log(chalk.red.bold('\\n🎯 MiLB FOCUSED COLLECTOR - COMPLETE THE GAPS! 🎯\\n'));
    console.log(chalk.yellow('⚡ Current: 11,867 MiLB games (23.5% coverage)'));
    console.log(chalk.yellow('⚡ Target: 50,400+ MiLB games (100% coverage)'));
    console.log(chalk.yellow('⚡ Missing: 38,533+ games to collect'));
    console.log(chalk.yellow('⚡ Strategy: Focus on high-value gaps\\n'));
  }
  
  async collect() {
    const startTime = Date.now();
    
    try {
      console.log(chalk.cyan.bold('📊 STARTING FOCUSED MiLB COLLECTION...\\n'));
      
      // PHASE 1: Complete 2020 COVID season (limited but valuable)
      await this.collect2020CovidSeason();
      
      // PHASE 2: Complete 2016-2017 historical seasons
      await this.collectHistoricalSeasons();
      
      // PHASE 3: Focus on high-volume rookie/complex leagues
      await this.collectRookieComplexLeagues();
      
      // PHASE 4: Fill gaps in existing levels with enhanced daily scanning
      await this.fillExistingLevelGaps();
      
      // Show results
      await this.showFocusedSummary();
      
      const totalTime = Date.now() - startTime;
      console.log(chalk.green.bold(`\\n✅ FOCUSED COLLECTION COMPLETE in ${(totalTime/1000/60).toFixed(1)} minutes!\\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ Focused Collection failed:'), error);
    } finally {
      await pgPool.end();
    }
  }
  
  /**
   * PHASE 1: Collect 2020 COVID season games (limited schedule but exists)
   */
  async collect2020CovidSeason() {
    console.log(chalk.yellow.bold('\\n🦠 PHASE 1: 2020 COVID SEASON COLLECTION...\\n'));
    
    const milbLevels = ['MILB_AAA', 'MILB_AA', 'MILB_A_HIGH', 'MILB_A'];
    
    for (const sport of milbLevels) {
      console.log(chalk.cyan(`[${sport}] Collecting 2020 COVID season...`));
      
      try {
        const teams = await pgPool.query(
          'SELECT id, our_team_id, mlb_api_id FROM teams_master WHERE sport = $1',
          [sport]
        );
        
        if (teams.rows.length === 0) continue;
        
        const games = await this.collect2020Games(sport, teams.rows);
        
        if (games.length > 0) {
          await this.engine.bulkInsert('games_master', games, {
            conflictTarget: 'our_game_id',
            updateColumns: ['home_score', 'away_score', 'status', 'updated_at']
          });
          console.log(chalk.green(`  ✓ ${sport} 2020: ${games.length} COVID season games`));
        } else {
          console.log(chalk.gray(`  - ${sport} 2020: No games found`));
        }
        
      } catch (error) {
        console.log(chalk.red(`  ❌ ${sport} 2020 failed: ${error.message}`));
      }
    }
  }
  
  /**
   * PHASE 2: Complete 2016-2017 historical seasons
   */
  async collectHistoricalSeasons() {
    console.log(chalk.yellow.bold('\\n📚 PHASE 2: HISTORICAL SEASONS 2016-2017...\\n'));
    
    const historicalSeasons = [2016, 2017];
    const milbLevels = ['MILB_AAA', 'MILB_AA', 'MILB_A_HIGH', 'MILB_A'];
    
    for (const season of historicalSeasons) {
      console.log(chalk.cyan(`\\n--- COLLECTING ${season} SEASON ---`));
      
      for (const sport of milbLevels) {
        try {
          const teams = await pgPool.query(
            'SELECT id, our_team_id, mlb_api_id FROM teams_master WHERE sport = $1',
            [sport]
          );
          
          if (teams.rows.length === 0) continue;
          
          const games = await this.collectHistoricalGames(sport, season, teams.rows);
          
          if (games.length > 0) {
            await this.engine.bulkInsert('games_master', games, {
              conflictTarget: 'our_game_id',
              updateColumns: ['home_score', 'away_score', 'status', 'updated_at']
            });
            console.log(chalk.green(`  ✓ ${sport} ${season}: ${games.length} historical games`));
          } else {
            console.log(chalk.gray(`  - ${sport} ${season}: No additional games`));
          }
          
        } catch (error) {
          console.log(chalk.red(`  ❌ ${sport} ${season} failed: ${error.message}`));
        }
      }
    }
  }
  
  /**
   * PHASE 3: Focus on rookie/complex leagues (high volume)
   */
  async collectRookieComplexLeagues() {
    console.log(chalk.yellow.bold('\\n🏆 PHASE 3: ROOKIE & COMPLEX LEAGUES...\\n'));
    
    const rookieLeagues = [
      { sport: 'MILB_ROOKIE', name: 'Rookie League' },
      { sport: 'MILB_ROOKIE_ADV', name: 'Rookie Advanced' },
      { sport: 'MILB_GCL', name: 'Gulf Coast League' },
      { sport: 'MILB_INDEPENDENT', name: 'Independent League' }
    ];
    
    const seasons = [2018, 2019, 2021, 2022, 2023, 2024];
    
    for (const league of rookieLeagues) {
      console.log(chalk.cyan(`\\n[${league.name}] Comprehensive collection...`));
      
      const teams = await pgPool.query(
        'SELECT id, our_team_id, mlb_api_id FROM teams_master WHERE sport = $1',
        [league.sport]
      );
      
      if (teams.rows.length === 0) {
        console.log(chalk.gray(`  No teams found for ${league.name}`));
        continue;
      }
      
      for (const season of seasons) {
        try {
          const games = await this.collectRookieGames(league.sport, season, teams.rows);
          
          if (games.length > 0) {
            await this.engine.bulkInsert('games_master', games, {
              conflictTarget: 'our_game_id',
              updateColumns: ['home_score', 'away_score', 'status', 'updated_at']
            });
            console.log(chalk.green(`  ✓ ${league.name} ${season}: ${games.length} games`));
          } else {
            console.log(chalk.gray(`  - ${league.name} ${season}: No games`));
          }
          
        } catch (error) {
          console.log(chalk.red(`  ❌ ${league.name} ${season}: ${error.message}`));
        }
      }
    }
  }
  
  /**
   * PHASE 4: Fill gaps in existing levels with enhanced scanning
   */
  async fillExistingLevelGaps() {
    console.log(chalk.yellow.bold('\\n🔍 PHASE 4: FILLING EXISTING LEVEL GAPS...\\n'));
    
    // Focus on seasons that should have more games
    const gapSeasons = [
      { sport: 'MILB_A', seasons: [2022, 2023, 2024], expectedMin: 1000 },
      { sport: 'MILB_A_HIGH', seasons: [2022, 2023, 2024], expectedMin: 1000 },
      { sport: 'MILB_AA', seasons: [2022, 2023, 2024], expectedMin: 1000 },
      { sport: 'MILB_AAA', seasons: [2022, 2023, 2024], expectedMin: 1000 }
    ];
    
    for (const gap of gapSeasons) {
      for (const season of gap.seasons) {
        // Check current count
        const currentResult = await pgPool.query(
          'SELECT COUNT(*) FROM games_master WHERE sport = $1 AND season = $2',
          [gap.sport, season]
        );
        
        const currentCount = parseInt(currentResult.rows[0].count);
        
        if (currentCount < gap.expectedMin) {
          console.log(chalk.cyan(`[${gap.sport} ${season}] Current: ${currentCount}, Expected: ${gap.expectedMin}+`));
          
          try {
            const teams = await pgPool.query(
              'SELECT id, our_team_id, mlb_api_id FROM teams_master WHERE sport = $1',
              [gap.sport]
            );
            
            const games = await this.collectGapFillingGames(gap.sport, season, teams.rows);
            
            if (games.length > 0) {
              await this.engine.bulkInsert('games_master', games, {
                conflictTarget: 'our_game_id',
                updateColumns: ['home_score', 'away_score', 'status', 'updated_at']
              });
              console.log(chalk.green(`  ✓ ${gap.sport} ${season}: +${games.length} gap-filling games`));
            }
            
          } catch (error) {
            console.log(chalk.red(`  ❌ ${gap.sport} ${season} gap filling failed`));
          }
        } else {
          console.log(chalk.green(`  ✓ ${gap.sport} ${season}: ${currentCount} games (sufficient)`));
        }
      }
    }
  }
  
  /**
   * Collect 2020 COVID season games
   */
  async collect2020Games(sport: string, teams: any[]): Promise<any[]> {
    const games: any[] = [];
    
    try {
      const sportIds = this.getSportIds(sport);
      
      // COVID season had limited schedule: July-September 2020
      const covidDates: Date[] = [];
      this.addDateRange(covidDates, new Date(2020, 6, 1), new Date(2020, 8, 30));
      
      for (const sportId of sportIds) {
        for (let i = 0; i < covidDates.length; i += 3) { // Check every 3rd day
          const date = covidDates[i];
          const dateStr = date.toISOString().split('T')[0];
          
          try {
            const gameUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${dateStr}&hydrate=team,linescore`;
            const response = await this.apiLimit(() => axios.get(gameUrl));
            
            for (const dateEntry of response.data.dates || []) {
              for (const game of dateEntry.games || []) {
                const homeTeam = teams.find(t => t.mlb_api_id === game.teams.home.team.id.toString());
                const awayTeam = teams.find(t => t.mlb_api_id === game.teams.away.team.id.toString());
                
                if (homeTeam && awayTeam) {
                  games.push({
                    our_game_id: `${sport.toLowerCase()}_covid_${game.gamePk}`,
                    sport: sport,
                    league: this.getLeague(sport),
                    season: 2020,
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
          } catch (error) {
            // Continue with next date
          }
          
          if (i % 30 === 29) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }
    } catch (error) {
      // Strategy failed
    }
    
    return games;
  }
  
  /**
   * Enhanced historical collection for 2016-2017
   */
  async collectHistoricalGames(sport: string, season: number, teams: any[]): Promise<any[]> {
    const games: any[] = [];
    
    try {
      const sportIds = this.getSportIds(sport);
      
      // Historical seasons: April through September
      const dates: Date[] = [];
      this.addDateRange(dates, new Date(season, 3, 1), new Date(season, 8, 30));
      
      for (const sportId of sportIds) {
        // Try season-wide schedule first
        try {
          const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&season=${season}&gameType=R&hydrate=team`;
          const response = await this.apiLimit(() => axios.get(scheduleUrl));
          
          for (const dateEntry of response.data.dates || []) {
            for (const game of dateEntry.games || []) {
              const homeTeam = teams.find(t => t.mlb_api_id === game.teams.home.team.id.toString());
              const awayTeam = teams.find(t => t.mlb_api_id === game.teams.away.team.id.toString());
              
              if (homeTeam && awayTeam) {
                const gameId = `${sport.toLowerCase()}_hist_${season}_${game.gamePk}`;
                
                games.push({
                  our_game_id: gameId,
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
        } catch (error) {
          // Fall back to daily checking for historical data
          for (let i = 0; i < dates.length; i += 7) { // Weekly sampling for historical
            const date = dates[i];
            const dateStr = date.toISOString().split('T')[0];
            
            try {
              const gameUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${dateStr}&hydrate=team`;
              const response = await this.apiLimit(() => axios.get(gameUrl));
              
              for (const dateEntry of response.data.dates || []) {
                for (const game of dateEntry.games || []) {
                  const homeTeam = teams.find(t => t.mlb_api_id === game.teams.home.team.id.toString());
                  const awayTeam = teams.find(t => t.mlb_api_id === game.teams.away.team.id.toString());
                  
                  if (homeTeam && awayTeam) {
                    const gameId = `${sport.toLowerCase()}_hist_daily_${season}_${game.gamePk}`;
                    
                    games.push({
                      our_game_id: gameId,
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
            } catch (error) {
              // Continue
            }
          }
        }
      }
    } catch (error) {
      // Historical collection failed
    }
    
    return games;
  }
  
  /**
   * Collect rookie league games with extended sport IDs
   */
  async collectRookieGames(sport: string, season: number, teams: any[]): Promise<any[]> {
    const games: any[] = [];
    
    try {
      const sportIds = this.getRookieSportIds(sport);
      
      // Rookie seasons: May through August (shorter seasons)
      const dates: Date[] = [];
      this.addDateRange(dates, new Date(season, 4, 1), new Date(season, 7, 31));
      
      for (const sportId of sportIds) {
        try {
          const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&season=${season}&hydrate=team`;
          const response = await this.apiLimit(() => axios.get(scheduleUrl));
          
          for (const dateEntry of response.data.dates || []) {
            for (const game of dateEntry.games || []) {
              const homeTeam = teams.find(t => t.mlb_api_id === game.teams.home.team.id.toString());
              const awayTeam = teams.find(t => t.mlb_api_id === game.teams.away.team.id.toString());
              
              if (homeTeam && awayTeam) {
                const gameId = `${sport.toLowerCase()}_${season}_${game.gamePk}`;
                
                games.push({
                  our_game_id: gameId,
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
        } catch (error) {
          // Continue with next sport ID
        }
      }
    } catch (error) {
      // Rookie collection failed
    }
    
    return games;
  }
  
  /**
   * Collect games to fill gaps in existing levels
   */
  async collectGapFillingGames(sport: string, season: number, teams: any[]): Promise<any[]> {
    const games: any[] = [];
    
    try {
      const sportIds = this.getSportIds(sport);
      
      // Enhanced daily scanning for gap filling
      const dates: Date[] = [];
      this.addDateRange(dates, new Date(season, 3, 1), new Date(season, 8, 30));
      
      for (const sportId of sportIds) {
        // Check every other day for gap filling
        for (let i = 0; i < dates.length; i += 2) {
          const date = dates[i];
          const dateStr = date.toISOString().split('T')[0];
          
          try {
            const gameUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${dateStr}&hydrate=team,linescore`;
            const response = await this.apiLimit(() => axios.get(gameUrl));
            
            for (const dateEntry of response.data.dates || []) {
              for (const game of dateEntry.games || []) {
                const homeTeam = teams.find(t => t.mlb_api_id === game.teams.home.team.id.toString());
                const awayTeam = teams.find(t => t.mlb_api_id === game.teams.away.team.id.toString());
                
                if (homeTeam && awayTeam) {
                  const gameId = `${sport.toLowerCase()}_gap_${season}_${game.gamePk}`;
                  
                  games.push({
                    our_game_id: gameId,
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
          } catch (error) {
            // Continue with next date
          }
          
          if (i % 50 === 49) {
            await new Promise(resolve => setTimeout(resolve, 30));
          }
        }
      }
    } catch (error) {
      // Gap filling failed
    }
    
    return games;
  }
  
  /**
   * Show focused collection summary
   */
  async showFocusedSummary() {
    console.log(chalk.cyan.bold('\\n📊 FOCUSED COLLECTION SUMMARY:\\n'));
    
    const totalResult = await pgPool.query('SELECT COUNT(*) FROM games_master');
    console.log(chalk.yellow(`📈 TOTAL GAMES: ${parseInt(totalResult.rows[0].count).toLocaleString()}`));
    
    const milbResult = await pgPool.query(`
      SELECT sport, COUNT(*) as count 
      FROM games_master 
      WHERE sport LIKE 'MILB%'
      GROUP BY sport 
      ORDER BY sport
    `);
    
    console.log(chalk.cyan('\\n⚾ FINAL MiLB GAMES BY LEVEL:'));
    let totalMiLB = 0;
    milbResult.rows.forEach(row => {
      totalMiLB += parseInt(row.count);
      console.log(chalk.green(`  ${row.sport}: ${parseInt(row.count).toLocaleString()} games`));
    });
    
    console.log(chalk.yellow(`\\n🎯 TOTAL MiLB GAMES: ${totalMiLB.toLocaleString()}`));
    
    const expectedMiLB = 50400;
    const coverage = ((totalMiLB / expectedMiLB) * 100).toFixed(1);
    console.log(chalk.yellow(`📊 FINAL COVERAGE: ${coverage}% of expected MiLB games`));
    
    const startingMiLB = 11867; // Before focused collection
    const focusedImprovement = totalMiLB - startingMiLB;
    console.log(chalk.green.bold(`\\n🎯 FOCUSED IMPROVEMENT: +${focusedImprovement.toLocaleString()} games`));
    
    if (totalMiLB >= expectedMiLB * 0.8) {
      console.log(chalk.green.bold('\\n🎉 OUTSTANDING! 80%+ MiLB coverage achieved!'));
    } else if (totalMiLB >= expectedMiLB * 0.5) {
      console.log(chalk.green.bold('\\n🎉 EXCELLENT! 50%+ MiLB coverage achieved!'));
    }
  }
  
  // Helper methods
  private getSportIds(sport: string): number[] {
    const sportIdMap = {
      'MILB_AAA': [11],
      'MILB_AA': [12],
      'MILB_A_HIGH': [13],
      'MILB_A': [14]
    };
    return sportIdMap[sport] || [14];
  }
  
  private getRookieSportIds(sport: string): number[] {
    const rookieIdMap = {
      'MILB_ROOKIE': [17, 16],
      'MILB_ROOKIE_ADV': [16, 17],
      'MILB_GCL': [509, 15],
      'MILB_INDEPENDENT': [20, 21, 22, 23]
    };
    return rookieIdMap[sport] || [17];
  }
  
  private getLeague(sport: string): string {
    const leagueMap = {
      'MILB_AAA': 'Triple-A',
      'MILB_AA': 'Double-A',
      'MILB_A_HIGH': 'High-A',
      'MILB_A': 'Single-A',
      'MILB_ROOKIE': 'Rookie',
      'MILB_ROOKIE_ADV': 'Rookie Advanced',
      'MILB_GCL': 'Gulf Coast League',
      'MILB_INDEPENDENT': 'Independent League'
    };
    return leagueMap[sport] || 'Minor League Baseball';
  }
  
  private addDateRange(dates: Date[], start: Date, end: Date) {
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }
}

// Run the focused collector!
if (require.main === module) {
  const collector = new MiLBFocusedCollector();
  collector.collect().catch(console.error);
}