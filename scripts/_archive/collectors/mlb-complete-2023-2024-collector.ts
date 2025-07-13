#!/usr/bin/env tsx
/**
 * ⚾ MLB COMPLETE 2023-2024 COLLECTOR - Get EVERYTHING!
 * 1. Fetch all missing games
 * 2. Collect stats for ALL games
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class MLBCompletCollector {
  private limit = pLimit(3);
  private playerCache = new Map<string, number>();
  private teamCache = new Map<string, number>();
  
  // ESPN team name to our DB team name mapping
  private teamNameMapping: { [key: string]: string } = {
    'Baltimore Orioles': 'Baltimore Orioles',
    'Boston Red Sox': 'Boston Red Sox',
    'New York Yankees': 'New York Yankees',
    'Tampa Bay Rays': 'Tampa Bay Rays',
    'Toronto Blue Jays': 'Toronto Blue Jays',
    'Chicago White Sox': 'Chicago White Sox',
    'Cleveland Guardians': 'Cleveland Guardians',
    'Detroit Tigers': 'Detroit Tigers',
    'Kansas City Royals': 'Kansas City Royals',
    'Minnesota Twins': 'Minnesota Twins',
    'Houston Astros': 'Houston Astros',
    'Los Angeles Angels': 'Los Angeles Angels',
    'Oakland Athletics': 'Oakland Athletics',
    'Seattle Mariners': 'Seattle Mariners',
    'Texas Rangers': 'Texas Rangers',
    'Atlanta Braves': 'Atlanta Braves',
    'Miami Marlins': 'Miami Marlins',
    'New York Mets': 'New York Mets',
    'Philadelphia Phillies': 'Philadelphia Phillies',
    'Washington Nationals': 'Washington Nationals',
    'Chicago Cubs': 'Chicago Cubs',
    'Cincinnati Reds': 'Cincinnati Reds',
    'Milwaukee Brewers': 'Milwaukee Brewers',
    'Pittsburgh Pirates': 'Pittsburgh Pirates',
    'St. Louis Cardinals': 'St. Louis Cardinals',
    'Arizona Diamondbacks': 'Arizona Diamondbacks',
    'Colorado Rockies': 'Colorado Rockies',
    'Los Angeles Dodgers': 'Los Angeles Dodgers',
    'San Diego Padres': 'San Diego Padres',
    'San Francisco Giants': 'San Francisco Giants'
  };
  
  async run() {
    console.log(chalk.bold.red('⚾ MLB COMPLETE 2023-2024 COLLECTOR\n'));
    
    // Step 1: Load caches
    await this.loadCaches();
    
    // Step 2: Fetch all missing games
    console.log(chalk.yellow('\n📥 STEP 1: FETCHING MISSING GAMES...\n'));
    await this.fetchMissingGames();
    
    // Step 3: Collect stats for all games
    console.log(chalk.yellow('\n📊 STEP 2: COLLECTING STATS FOR ALL GAMES...\n'));
    await this.collectAllStats();
    
    // Step 4: Final report
    await this.finalReport();
  }
  
  private async loadCaches() {
    const { data: players } = await supabase
      .from('players')
      .select('id, name, external_id')
      .eq('sport', 'mlb');
    
    players?.forEach(p => {
      this.playerCache.set(p.name.toLowerCase(), p.id);
      if (p.external_id) {
        this.playerCache.set(p.external_id, p.id);
      }
    });
    
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport_id', 'mlb');
    
    teams?.forEach(t => {
      this.teamCache.set(t.name, t.id);
      this.teamCache.set(t.abbreviation.toLowerCase(), t.id);
    });
    
    console.log(`Loaded ${this.playerCache.size} player entries, ${this.teamCache.size} team entries`);
  }
  
  private async fetchMissingGames() {
    const seasons = [
      { year: 2023, start: '2023-03-30', end: '2023-11-01' },
      { year: 2024, start: '2024-03-20', end: '2024-10-31' }
    ];
    
    for (const season of seasons) {
      console.log(`Fetching ${season.year} season...`);
      
      const allGames = [];
      const startDate = new Date(season.start);
      const endDate = new Date(season.end);
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
        
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateStr}`;
          const response = await axios.get(url);
          
          if (response.data.events) {
            for (const event of response.data.events) {
              // Only regular season games
              if (event.season?.type !== 2) continue;
              
              const competition = event.competitions[0];
              const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
              const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
              
              const homeTeamName = this.teamNameMapping[homeTeam.team.displayName] || homeTeam.team.displayName;
              const awayTeamName = this.teamNameMapping[awayTeam.team.displayName] || awayTeam.team.displayName;
              
              const homeTeamId = this.teamCache.get(homeTeamName);
              const awayTeamId = this.teamCache.get(awayTeamName);
              
              if (homeTeamId && awayTeamId) {
                allGames.push({
                  external_id: `espn_mlb_${event.id}`,
                  sport_id: 'mlb',
                  home_team_id: homeTeamId,
                  away_team_id: awayTeamId,
                  home_team_score: competition.status.type.completed ? parseInt(homeTeam.score) : null,
                  away_team_score: competition.status.type.completed ? parseInt(awayTeam.score) : null,
                  start_time: event.date,
                  status: competition.status.type.completed ? 'completed' : 'scheduled'
                });
              }
            }
          }
          
          process.stdout.write(`\r  ${currentDate.toISOString().split('T')[0]}: ${allGames.length} games`);
          
        } catch (error) {
          // Continue on error
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`\n  Total ${season.year} games found: ${allGames.length}`);
      
      // Insert games
      if (allGames.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < allGames.length; i += batchSize) {
          const batch = allGames.slice(i, i + batchSize);
          await supabase.from('games').upsert(batch, { onConflict: 'external_id' });
        }
        console.log(`  ✅ ${season.year} games added to database\n`);
      }
    }
  }
  
  private async collectAllStats() {
    // Get ALL MLB games
    const allGames: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .eq('sport_id', 'mlb')
        .order('start_time')
        .range(offset, offset + pageSize - 1);
      
      if (error || !games || games.length === 0) break;
      
      allGames.push(...games);
      if (games.length < pageSize) break;
      offset += pageSize;
    }
    
    console.log(`Found ${allGames.length} total MLB games\n`);
    
    let processed = 0;
    let withStats = 0;
    let newStats = 0;
    let errors = 0;
    
    const batchSize = 50;
    for (let i = 0; i < allGames.length; i += batchSize) {
      const batch = allGames.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(game => 
          this.limit(async () => {
            const result = await this.collectGameStats(game);
            processed++;
            
            if (result > 0) {
              withStats++;
              newStats += result;
            } else if (result === -1) {
              withStats++;
            } else if (result === -2) {
              errors++;
            }
            
            if (processed % 100 === 0) {
              console.log(`Progress: ${processed}/${allGames.length} games (${withStats} with stats, ${newStats} new logs added)`);
            }
          })
        )
      );
    }
    
    console.log(chalk.green(`\n✅ STATS COLLECTION COMPLETE!`));
    console.log(`Total games: ${processed}`);
    console.log(`Games with stats: ${withStats} (${(withStats/processed*100).toFixed(1)}%)`);
    console.log(`New logs added: ${newStats}`);
    console.log(`Errors: ${errors}`);
  }
  
  private async collectGameStats(game: any): Promise<number> {
    try {
      // Check if already has stats
      const { count: existing } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (existing && existing > 0) {
        return -1; // Already has stats
      }
      
      // Only collect stats for completed games
      if (game.status !== 'completed' || !game.home_team_score) {
        return 0;
      }
      
      const espnId = game.external_id?.replace('espn_mlb_', '') || game.external_id;
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`;
      
      const response = await axios.get(url);
      const data = response.data;
      
      if (!data.boxscore || !data.boxscore.players) {
        return 0;
      }
      
      const statsToInsert = [];
      
      for (const team of data.boxscore.players) {
        const teamId = this.teamCache.get(team.team.abbreviation.toLowerCase());
        if (!teamId) continue;
        
        if (team.statistics && team.statistics[0] && team.statistics[0].athletes) {
          for (const athlete of team.statistics[0].athletes) {
            const playerId = this.playerCache.get(athlete.athlete.displayName.toLowerCase());
            if (!playerId) continue;
            
            const stats = this.parseMLBStats(athlete.stats);
            if (Object.keys(stats).length > 0) {
              statsToInsert.push({
                game_id: game.id,
                player_id: playerId,
                team_id: teamId,
                opponent_id: teamId === game.home_team_id ? game.away_team_id : game.home_team_id,
                game_date: game.start_time,
                stats,
                fantasy_points: this.calculateMLBFantasyPoints(stats)
              });
            }
          }
        }
      }
      
      if (statsToInsert.length > 0) {
        const { error } = await supabase
          .from('player_game_logs')
          .upsert(statsToInsert, { onConflict: 'game_id,player_id' });
        
        if (error) {
          return -2; // Error
        }
      }
      
      return statsToInsert.length;
    } catch (error) {
      return -2; // Error
    }
  }
  
  private parseMLBStats(stats: string[]): any {
    return {
      AB: parseInt(stats[0]) || 0,
      R: parseInt(stats[1]) || 0,
      H: parseInt(stats[2]) || 0,
      RBI: parseInt(stats[3]) || 0,
      HR: parseInt(stats[4]) || 0,
      BB: parseInt(stats[5]) || 0,
      SO: parseInt(stats[6]) || 0,
      AVG: parseFloat(stats[7]) || 0
    };
  }
  
  private calculateMLBFantasyPoints(stats: any): number {
    return (
      stats.R * 1 +
      stats.H * 1 +
      stats.RBI * 1 +
      stats.HR * 4 +
      stats.BB * 1 +
      stats.SO * -1
    );
  }
  
  private async finalReport() {
    console.log(chalk.bold.cyan('\n📊 FINAL MLB REPORT\n'));
    
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'mlb');
    
    const { count: games2023 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'mlb')
      .gte('start_time', '2023-01-01')
      .lt('start_time', '2024-01-01');
    
    const { count: games2024 } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'mlb')
      .gte('start_time', '2024-01-01');
    
    const { count: mlbLogs } = await supabase
      .from('player_game_logs')
      .select('*, player:players!inner(sport)', { count: 'exact', head: true })
      .eq('players.sport', 'mlb');
    
    console.log(`Total MLB games: ${totalGames}`);
    console.log(`  2023: ${games2023} games`);
    console.log(`  2024: ${games2024} games`);
    console.log(`\nTotal MLB player logs: ${mlbLogs?.toLocaleString()}`);
    console.log(`Average logs per game: ${mlbLogs && totalGames ? (mlbLogs / totalGames).toFixed(1) : 0}`);
    
    const coverage = mlbLogs && totalGames && totalGames > 0 ? 
      Math.min((mlbLogs / (totalGames * 20) * 100), 100).toFixed(1) : 0;
    
    console.log(`\nEstimated coverage: ${coverage}%`);
    console.log(coverage >= 90 ? chalk.green('✅ MLB COMPLETE!') : chalk.yellow('⚠️  Needs more work'));
  }
}

const collector = new MLBCompletCollector();
collector.run().catch(console.error);