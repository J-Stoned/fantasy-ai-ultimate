#!/usr/bin/env tsx
/**
 * 🚀 COLLECT ALL 2023 SEASONS - The 10X data collection script
 * This will collect ALL games from 2023 season for NBA, MLB, NHL
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CollectionStats {
  sport: string;
  targetGames: number;
  gamesCollected: number;
  gamesWithStats: number;
  startTime: Date;
  endTime?: Date;
  errors: string[];
}

class Season2023Collector {
  private stats: Record<string, CollectionStats> = {
    nba: {
      sport: 'NBA',
      targetGames: 1310,
      gamesCollected: 0,
      gamesWithStats: 0,
      startTime: new Date(),
      errors: []
    },
    mlb: {
      sport: 'MLB', 
      targetGames: 2470,
      gamesCollected: 0,
      gamesWithStats: 0,
      startTime: new Date(),
      errors: []
    },
    nhl: {
      sport: 'NHL',
      targetGames: 1392,
      gamesCollected: 0,
      gamesWithStats: 0,
      startTime: new Date(),
      errors: []
    }
  };
  
  async collectAll2023Seasons() {
    console.log(chalk.bold.cyan('\n🚀 COLLECTING ALL 2023 SEASONS - 10X MODE ACTIVATED!\n'));
    console.log(chalk.yellow('Target: ~5,172 games across NBA, MLB, NHL'));
    console.log(chalk.yellow('This will populate ~250,000+ player game logs\n'));
    
    // Run collectors in parallel for maximum speed
    const promises = [
      this.collectNBA2023(),
      this.collectMLB2023(),
      this.collectNHL2023()
    ];
    
    await Promise.all(promises);
    
    // Generate final report
    this.generateFinalReport();
  }
  
  private async collectNBA2023() {
    console.log(chalk.bold.blue('\n🏀 COLLECTING NBA 2023-24 SEASON\n'));
    
    const startDate = '2023-10-24'; // NBA season start
    const endDate = '2024-04-14';   // Regular season end
    
    await this.collectSportSeason('nba', startDate, endDate);
  }
  
  private async collectMLB2023() {
    console.log(chalk.bold.red('\n⚾ COLLECTING MLB 2023 SEASON\n'));
    
    const startDate = '2023-03-30'; // MLB season start
    const endDate = '2023-11-01';   // World Series end
    
    await this.collectSportSeason('mlb', startDate, endDate);
  }
  
  private async collectNHL2023() {
    console.log(chalk.bold.cyan('\n🏒 COLLECTING NHL 2023-24 SEASON\n'));
    
    const startDate = '2023-10-10'; // NHL season start
    const endDate = '2024-06-24';   // Stanley Cup Finals end
    
    await this.collectSportSeason('nhl', startDate, endDate);
  }
  
  private async collectSportSeason(sport: string, startDate: string, endDate: string) {
    const sportStats = this.stats[sport];
    
    try {
      // First, collect all games for the date range
      console.log(chalk.yellow(`Collecting ${sport.toUpperCase()} games from ${startDate} to ${endDate}...`));
      
      const espnSport = this.getESPNSportName(sport);
      let currentDate = new Date(startDate);
      const end = new Date(endDate);
      let gameIds = new Set<string>();
      
      // Collect games day by day
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
        
        try {
          const response = await axios.get(
            `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/scoreboard`,
            { params: { dates: dateStr } }
          );
          
          const events = response.data.events || [];
          
          for (const event of events) {
            gameIds.add(event.id);
            
            // Insert game into database
            await this.insertGame(sport, event);
          }
          
          if (events.length > 0) {
            console.log(chalk.gray(`  ${currentDate.toISOString().split('T')[0]}: ${events.length} games`));
          }
          
        } catch (error) {
          sportStats.errors.push(`Failed to get games for ${dateStr}`);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      sportStats.gamesCollected = gameIds.size;
      console.log(chalk.green(`\n✅ Collected ${gameIds.size} ${sport.toUpperCase()} games`));
      
      // Now collect stats for each game
      console.log(chalk.yellow(`\nCollecting player stats for ${gameIds.size} games...`));
      
      let processed = 0;
      for (const gameId of gameIds) {
        const success = await this.collectGameStats(sport, gameId);
        if (success) {
          sportStats.gamesWithStats++;
        }
        
        processed++;
        
        // Progress update
        if (processed % 50 === 0) {
          const pct = ((processed / gameIds.size) * 100).toFixed(1);
          console.log(chalk.gray(`  Progress: ${processed}/${gameIds.size} (${pct}%)`));
        }
        
        // Small delay between games
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.error(chalk.red(`Error collecting ${sport}:`), error);
      sportStats.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    
    sportStats.endTime = new Date();
  }
  
  private async insertGame(sport: string, event: any) {
    try {
      const game = {
        external_id: `espn_${sport}_${event.id}`,
        sport_id: sport,
        home_team_id: await this.getTeamId(sport, event.competitions[0].competitors[0].team),
        away_team_id: await this.getTeamId(sport, event.competitions[0].competitors[1].team),
        start_time: event.date,
        venue: event.competitions[0].venue?.fullName || null,
        home_score: parseInt(event.competitions[0].competitors[0].score) || null,
        away_score: parseInt(event.competitions[0].competitors[1].score) || null,
        status: event.status.type.name,
        metadata: {
          season: 2023,
          attendance: event.competitions[0].attendance || null
        }
      };
      
      const { error } = await supabase
        .from('games')
        .upsert(game, { onConflict: 'external_id' });
      
      if (error) {
        console.error('Game insert error:', error);
      }
      
    } catch (error) {
      // Silently continue
    }
  }
  
  private async getTeamId(sport: string, espnTeam: any): Promise<number> {
    // Try to find team by external_id or name
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('sport_id', sport)
      .or(`external_id.eq.espn_${sport}_${espnTeam.id},name.ilike.%${espnTeam.name}%`)
      .limit(1)
      .single();
    
    return team?.id || 0;
  }
  
  private async collectGameStats(sport: string, gameId: string): Promise<boolean> {
    try {
      const espnSport = this.getESPNSportName(sport);
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/summary`,
        { params: { event: gameId } }
      );
      
      const data = response.data;
      
      // Get game from our database
      const { data: game } = await supabase
        .from('games')
        .select('id')
        .eq('external_id', `espn_${sport}_${gameId}`)
        .single();
      
      if (!game) return false;
      
      // Process player stats
      const playerStats = [];
      
      if (data.boxscore?.players) {
        for (const team of data.boxscore.players) {
          for (const player of team.statistics?.[0]?.athletes || []) {
            const stat = await this.parsePlayerStats(sport, player, game.id);
            if (stat) {
              playerStats.push(stat);
            }
          }
        }
      }
      
      // Insert stats in batches
      if (playerStats.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < playerStats.length; i += batchSize) {
          const batch = playerStats.slice(i, i + batchSize);
          
          const { error } = await supabase
            .from('player_game_logs')
            .insert(batch);
          
          if (error) {
            console.error('Stats insert error:', error);
            return false;
          }
        }
      }
      
      return playerStats.length > 0;
      
    } catch (error) {
      return false;
    }
  }
  
  private async parsePlayerStats(sport: string, playerData: any, gameId: number): Promise<any> {
    // Get player from database
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('sport', sport)
      .ilike('name', `%${playerData.athlete.displayName}%`)
      .limit(1)
      .single();
    
    if (!player) return null;
    
    const stats = this.parseSportSpecificStats(sport, playerData.stats);
    if (!stats) return null;
    
    return {
      game_id: gameId,
      player_id: player.id,
      game_date: new Date().toISOString(),
      stats: stats,
      fantasy_points: this.calculateFantasyPoints(sport, stats)
    };
  }
  
  private parseSportSpecificStats(sport: string, stats: string[]): any {
    if (!stats || stats.length === 0) return null;
    
    switch (sport) {
      case 'nba':
        return {
          minutes: stats[0],
          points: parseInt(stats[13]) || 0,
          rebounds: parseInt(stats[6]) || 0,
          assists: parseInt(stats[7]) || 0,
          steals: parseInt(stats[8]) || 0,
          blocks: parseInt(stats[9]) || 0,
          turnovers: parseInt(stats[10]) || 0
        };
        
      case 'mlb':
        return {
          atBats: parseInt(stats[0]) || 0,
          runs: parseInt(stats[1]) || 0,
          hits: parseInt(stats[2]) || 0,
          rbi: parseInt(stats[3]) || 0,
          walks: parseInt(stats[4]) || 0,
          strikeouts: parseInt(stats[5]) || 0
        };
        
      case 'nhl':
        return {
          goals: parseInt(stats[0]) || 0,
          assists: parseInt(stats[1]) || 0,
          points: parseInt(stats[2]) || 0,
          plusMinus: parseInt(stats[3]) || 0,
          pim: parseInt(stats[4]) || 0,
          shots: parseInt(stats[5]) || 0
        };
        
      default:
        return null;
    }
  }
  
  private calculateFantasyPoints(sport: string, stats: any): number {
    switch (sport) {
      case 'nba':
        return stats.points + (stats.rebounds * 1.2) + (stats.assists * 1.5) + 
               (stats.steals * 3) + (stats.blocks * 3) - stats.turnovers;
               
      case 'mlb':
        return (stats.hits * 3) + (stats.runs * 2) + (stats.rbi * 2) + 
               (stats.walks * 1) - (stats.strikeouts * 0.5);
               
      case 'nhl':
        return (stats.goals * 3) + (stats.assists * 2) + (stats.shots * 0.5) + 
               (stats.plusMinus * 1);
               
      default:
        return 0;
    }
  }
  
  private getESPNSportName(sport: string): string {
    const mapping: Record<string, string> = {
      'nba': 'basketball/nba',
      'mlb': 'baseball/mlb',
      'nhl': 'hockey/nhl',
      'nfl': 'football/nfl'
    };
    return mapping[sport] || sport;
  }
  
  private generateFinalReport() {
    console.log(chalk.bold.cyan('\n📊 2023 SEASON COLLECTION REPORT\n'));
    
    let totalGames = 0;
    let totalStats = 0;
    
    for (const [sport, stats] of Object.entries(this.stats)) {
      const duration = stats.endTime ? 
        ((stats.endTime.getTime() - stats.startTime.getTime()) / 1000 / 60).toFixed(1) : 
        'In progress';
      
      console.log(chalk.bold.yellow(`${stats.sport}:`));
      console.log(`  Games collected: ${stats.gamesCollected}/${stats.targetGames}`);
      console.log(`  Games with stats: ${stats.gamesWithStats}`);
      console.log(`  Success rate: ${((stats.gamesWithStats / stats.gamesCollected) * 100).toFixed(1)}%`);
      console.log(`  Duration: ${duration} minutes`);
      
      if (stats.errors.length > 0) {
        console.log(chalk.red(`  Errors: ${stats.errors.length}`));
      }
      
      totalGames += stats.gamesCollected;
      totalStats += stats.gamesWithStats;
      
      console.log('');
    }
    
    console.log(chalk.bold.green('TOTAL:'));
    console.log(`  Games collected: ${totalGames}`);
    console.log(`  Games with stats: ${totalStats}`);
    console.log(`  Overall success: ${((totalStats / totalGames) * 100).toFixed(1)}%`);
    
    // Save report
    const report = {
      collectionDate: new Date().toISOString(),
      stats: this.stats,
      summary: {
        totalGamesCollected: totalGames,
        totalGamesWithStats: totalStats,
        estimatedPlayerLogs: totalStats * 40
      }
    };
    
    fs.writeFileSync('./2023-season-collection-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.green('\n✅ Report saved to 2023-season-collection-report.json'));
  }
}

// Run the collector
const collector = new Season2023Collector();
collector.collectAll2023Seasons();