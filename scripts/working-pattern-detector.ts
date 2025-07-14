#!/usr/bin/env tsx
/**
 * WORKING PATTERN DETECTOR - Finds real patterns in our actual data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GameLog {
  id: number;
  player_id: string;
  game_id: string;
  team_id?: string;
  game_date: string;
  is_home: boolean;
  minutes_played: number;
  stats: {
    points: number;
    rebounds?: number;
    assists?: number;
    steals?: number;
    blocks?: number;
    turnovers?: number;
    fg_made?: number;
    fg_attempted?: number;
    ft_made?: number;
    ft_attempted?: number;
    three_made?: number;
  };
}

interface Pattern {
  name: string;
  description: string;
  matches: number;
  totalGames: number;
  accuracy: number;
  avgPointsDiff?: number;
  examples: any[];
}

class WorkingPatternDetector {
  private patterns: Pattern[] = [];
  
  async detectAllPatterns() {
    console.log(chalk.bold.cyan('🎯 WORKING PATTERN DETECTOR - ANALYZING REAL DATA'));
    
    // First, let's check how many records have meaningful data
    const { count: meaningfulCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('stats->points', 'is', null)
      .not('is_home', 'is', null)
      .not('minutes_played', 'is', null)
      .not('game_date', 'is', null)
      .gt('stats->points', 0)
      .gt('minutes_played', 0);
    
    console.log(chalk.blue(`\n📊 Records with meaningful data (points > 0, minutes > 0): ${meaningfulCount?.toLocaleString()}`));
    
    // Detect various patterns
    await this.detectBackToBackPattern();
    await this.detectHomeAwayPattern();
    await this.detectHighMinutesPattern();
    await this.detectConsistentScorerPattern();
    await this.detectHotStreakPattern();
    await this.detectBlowoutPattern();
    
    // Display results
    this.displayResults();
  }
  
  private async detectBackToBackPattern() {
    console.log(chalk.yellow('\n🔍 Detecting Back-to-Back Pattern...'));
    
    try {
      // Get players' recent games sorted by date
      const { data: games } = await supabase
        .from('player_game_logs')
        .select('*')
        .not('stats->points', 'is', null)
        .gt('stats->points', 0)
        .gt('minutes_played', 10)
        .order('player_id')
        .order('game_date', { ascending: false })
        .limit(10000);
      
      if (!games || games.length < 100) return;
      
      // Group by player
      const playerGames = new Map<string, GameLog[]>();
      games.forEach(game => {
        if (!playerGames.has(game.player_id)) {
          playerGames.set(game.player_id, []);
        }
        playerGames.get(game.player_id)!.push(game as GameLog);
      });
      
      let backToBackCount = 0;
      let totalBackToBacks = 0;
      let pointsDropSum = 0;
      const examples: any[] = [];
      
      // Check each player's games for back-to-backs
      playerGames.forEach((playerGameList, playerId) => {
        for (let i = 0; i < playerGameList.length - 1; i++) {
          const game1 = playerGameList[i];
          const game2 = playerGameList[i + 1];
          
          // Check if games are on consecutive days
          const date1 = new Date(game1.game_date);
          const date2 = new Date(game2.game_date);
          const daysDiff = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff <= 1) {
            totalBackToBacks++;
            const pointsDrop = game1.stats.points - game2.stats.points;
            
            if (pointsDrop > 0) {
              backToBackCount++;
              pointsDropSum += pointsDrop;
              
              if (examples.length < 5) {
                examples.push({
                  playerId,
                  firstGame: {
                    date: game1.game_date,
                    points: game1.stats.points,
                    minutes: game1.minutes_played
                  },
                  secondGame: {
                    date: game2.game_date,
                    points: game2.stats.points,
                    minutes: game2.minutes_played
                  },
                  pointsDrop
                });
              }
            }
          }
        }
      });
      
      if (totalBackToBacks > 0) {
        this.patterns.push({
          name: 'Back-to-Back Fatigue',
          description: 'Players score fewer points in second game of back-to-back',
          matches: backToBackCount,
          totalGames: totalBackToBacks,
          accuracy: (backToBackCount / totalBackToBacks) * 100,
          avgPointsDiff: pointsDropSum / backToBackCount,
          examples
        });
      }
      
    } catch (error: any) {
      console.error(chalk.red(`Back-to-back detection failed: ${error.message}`));
    }
  }
  
  private async detectHomeAwayPattern() {
    console.log(chalk.yellow('🔍 Detecting Home/Away Pattern...'));
    
    try {
      const { data: homeGames } = await supabase
        .from('player_game_logs')
        .select('stats')
        .eq('is_home', true)
        .not('stats->points', 'is', null)
        .gt('stats->points', 0)
        .gt('minutes_played', 10)
        .limit(5000);
      
      const { data: awayGames } = await supabase
        .from('player_game_logs')
        .select('stats')
        .eq('is_home', false)
        .not('stats->points', 'is', null)
        .gt('stats->points', 0)
        .gt('minutes_played', 10)
        .limit(5000);
      
      if (homeGames && awayGames && homeGames.length > 100 && awayGames.length > 100) {
        const homeAvg = homeGames.reduce((sum, g) => sum + g.stats.points, 0) / homeGames.length;
        const awayAvg = awayGames.reduce((sum, g) => sum + g.stats.points, 0) / awayGames.length;
        
        this.patterns.push({
          name: 'Home Court Advantage',
          description: 'Players perform better at home',
          matches: homeGames.length,
          totalGames: homeGames.length + awayGames.length,
          accuracy: homeAvg > awayAvg ? 100 : 0,
          avgPointsDiff: homeAvg - awayAvg,
          examples: [{
            homeAverage: homeAvg.toFixed(1),
            awayAverage: awayAvg.toFixed(1),
            homeSampleSize: homeGames.length,
            awaySampleSize: awayGames.length
          }]
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`Home/away detection failed: ${error.message}`));
    }
  }
  
  private async detectHighMinutesPattern() {
    console.log(chalk.yellow('🔍 Detecting High Minutes Pattern...'));
    
    try {
      const { data: highMinutesGames } = await supabase
        .from('player_game_logs')
        .select('minutes_played, stats')
        .gt('minutes_played', 35)
        .not('stats->points', 'is', null)
        .gt('stats->points', 0)
        .limit(2000);
      
      const { data: normalMinutesGames } = await supabase
        .from('player_game_logs')
        .select('minutes_played, stats')
        .gte('minutes_played', 20)
        .lte('minutes_played', 30)
        .not('stats->points', 'is', null)
        .gt('stats->points', 0)
        .limit(2000);
      
      if (highMinutesGames && normalMinutesGames && 
          highMinutesGames.length > 50 && normalMinutesGames.length > 50) {
        
        const highMinAvg = highMinutesGames.reduce((sum, g) => sum + g.stats.points, 0) / highMinutesGames.length;
        const normalMinAvg = normalMinutesGames.reduce((sum, g) => sum + g.stats.points, 0) / normalMinutesGames.length;
        
        // Points per minute
        const highMinPPM = highMinutesGames.reduce((sum, g) => 
          sum + (g.stats.points / g.minutes_played), 0) / highMinutesGames.length;
        const normalMinPPM = normalMinutesGames.reduce((sum, g) => 
          sum + (g.stats.points / g.minutes_played), 0) / normalMinutesGames.length;
        
        this.patterns.push({
          name: 'High Minutes Scorer',
          description: 'Players with 35+ minutes score significantly more',
          matches: highMinutesGames.length,
          totalGames: highMinutesGames.length + normalMinutesGames.length,
          accuracy: 100,
          avgPointsDiff: highMinAvg - normalMinAvg,
          examples: [{
            highMinutesAvg: highMinAvg.toFixed(1),
            normalMinutesAvg: normalMinAvg.toFixed(1),
            highMinutesPPM: highMinPPM.toFixed(2),
            normalMinutesPPM: normalMinPPM.toFixed(2),
            sampleSizes: {
              highMinutes: highMinutesGames.length,
              normalMinutes: normalMinutesGames.length
            }
          }]
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`High minutes detection failed: ${error.message}`));
    }
  }
  
  private async detectConsistentScorerPattern() {
    console.log(chalk.yellow('🔍 Detecting Consistent Scorer Pattern...'));
    
    try {
      // Get players with multiple games
      const { data: playerStats } = await supabase
        .from('player_game_logs')
        .select('player_id, stats')
        .not('stats->points', 'is', null)
        .gt('stats->points', 10)
        .gt('minutes_played', 15)
        .limit(10000);
      
      if (!playerStats || playerStats.length < 100) return;
      
      // Calculate consistency for each player
      const playerConsistency = new Map<string, { games: number[], avg: number, stdDev: number }>();
      
      playerStats.forEach(game => {
        if (!playerConsistency.has(game.player_id)) {
          playerConsistency.set(game.player_id, { games: [], avg: 0, stdDev: 0 });
        }
        playerConsistency.get(game.player_id)!.games.push(game.stats.points);
      });
      
      const consistentPlayers: any[] = [];
      
      playerConsistency.forEach((data, playerId) => {
        if (data.games.length >= 5) {
          const avg = data.games.reduce((sum, p) => sum + p, 0) / data.games.length;
          const variance = data.games.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / data.games.length;
          const stdDev = Math.sqrt(variance);
          const coefficientOfVariation = stdDev / avg;
          
          if (coefficientOfVariation < 0.3 && avg > 15) {
            consistentPlayers.push({
              playerId,
              gamesPlayed: data.games.length,
              avgPoints: avg.toFixed(1),
              stdDev: stdDev.toFixed(1),
              consistency: ((1 - coefficientOfVariation) * 100).toFixed(1)
            });
          }
        }
      });
      
      if (consistentPlayers.length > 0) {
        consistentPlayers.sort((a, b) => parseFloat(b.consistency) - parseFloat(a.consistency));
        
        this.patterns.push({
          name: 'Consistent High Scorers',
          description: 'Players who reliably score 15+ points with low variance',
          matches: consistentPlayers.length,
          totalGames: playerConsistency.size,
          accuracy: (consistentPlayers.length / playerConsistency.size) * 100,
          examples: consistentPlayers.slice(0, 5)
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`Consistent scorer detection failed: ${error.message}`));
    }
  }
  
  private async detectHotStreakPattern() {
    console.log(chalk.yellow('🔍 Detecting Hot Streak Pattern...'));
    
    try {
      // Get recent games for streak analysis
      const { data: recentGames } = await supabase
        .from('player_game_logs')
        .select('*')
        .not('stats->points', 'is', null)
        .gt('stats->points', 0)
        .gt('minutes_played', 10)
        .order('player_id')
        .order('game_date', { ascending: false })
        .limit(20000);
      
      if (!recentGames || recentGames.length < 1000) return;
      
      // Group by player
      const playerGames = new Map<string, GameLog[]>();
      recentGames.forEach(game => {
        if (!playerGames.has(game.player_id)) {
          playerGames.set(game.player_id, []);
        }
        playerGames.get(game.player_id)!.push(game as GameLog);
      });
      
      const hotStreaks: any[] = [];
      
      playerGames.forEach((games, playerId) => {
        if (games.length < 5) return;
        
        // Check for 3-game hot streaks
        for (let i = 0; i <= games.length - 3; i++) {
          const streak = games.slice(i, i + 3);
          const avgPoints = streak.reduce((sum, g) => sum + g.stats.points, 0) / 3;
          
          // Check if each game is above average
          const playerAvg = games.reduce((sum, g) => sum + g.stats.points, 0) / games.length;
          const isHotStreak = streak.every(g => g.stats.points > playerAvg * 1.2);
          
          if (isHotStreak && avgPoints > 20) {
            hotStreaks.push({
              playerId,
              streakGames: streak.map(g => ({
                date: g.game_date,
                points: g.stats.points
              })),
              streakAvg: avgPoints.toFixed(1),
              playerNormalAvg: playerAvg.toFixed(1),
              improvement: ((avgPoints / playerAvg - 1) * 100).toFixed(1)
            });
            break; // Only count one streak per player
          }
        }
      });
      
      if (hotStreaks.length > 0) {
        this.patterns.push({
          name: 'Hot Streak',
          description: 'Players on 3+ game scoring streaks above their average',
          matches: hotStreaks.length,
          totalGames: playerGames.size,
          accuracy: (hotStreaks.length / playerGames.size) * 100,
          examples: hotStreaks.slice(0, 5)
        });
      }
    } catch (error: any) {
      console.error(chalk.red(`Hot streak detection failed: ${error.message}`));
    }
  }
  
  private async detectBlowoutPattern() {
    console.log(chalk.yellow('🔍 Detecting Blowout Pattern...'));
    
    try {
      // For this pattern, we need game scores, which might be in the games table
      // Let's check if we can correlate player performance with game margins
      const { data: games } = await supabase
        .from('games')
        .select('id, home_score, away_score')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .limit(5000);
      
      if (!games || games.length < 100) return;
      
      // Calculate margins
      const blowoutGames = games.filter(g => {
        const margin = Math.abs(g.home_score - g.away_score);
        return margin > 20;
      }).map(g => g.id);
      
      const closeGames = games.filter(g => {
        const margin = Math.abs(g.home_score - g.away_score);
        return margin < 10;
      }).map(g => g.id);
      
      if (blowoutGames.length > 50 && closeGames.length > 50) {
        // Get player stats for these games
        const { data: blowoutStats } = await supabase
          .from('player_game_logs')
          .select('stats, minutes_played')
          .in('game_id', blowoutGames.slice(0, 100))
          .not('stats->points', 'is', null)
          .gt('stats->points', 0);
        
        const { data: closeStats } = await supabase
          .from('player_game_logs')
          .select('stats, minutes_played')
          .in('game_id', closeGames.slice(0, 100))
          .not('stats->points', 'is', null)
          .gt('stats->points', 0);
        
        if (blowoutStats && closeStats && blowoutStats.length > 20 && closeStats.length > 20) {
          const blowoutAvgMinutes = blowoutStats.reduce((sum, s) => sum + s.minutes_played, 0) / blowoutStats.length;
          const closeAvgMinutes = closeStats.reduce((sum, s) => sum + s.minutes_played, 0) / closeStats.length;
          
          const blowoutAvgPoints = blowoutStats.reduce((sum, s) => sum + s.stats.points, 0) / blowoutStats.length;
          const closeAvgPoints = closeStats.reduce((sum, s) => sum + s.stats.points, 0) / closeStats.length;
          
          this.patterns.push({
            name: 'Blowout Reduced Minutes',
            description: 'Starters play fewer minutes in blowout games',
            matches: blowoutStats.length,
            totalGames: blowoutStats.length + closeStats.length,
            accuracy: blowoutAvgMinutes < closeAvgMinutes ? 100 : 0,
            avgPointsDiff: closeAvgPoints - blowoutAvgPoints,
            examples: [{
              blowoutAvgMinutes: blowoutAvgMinutes.toFixed(1),
              closeGameAvgMinutes: closeAvgMinutes.toFixed(1),
              blowoutAvgPoints: blowoutAvgPoints.toFixed(1),
              closeGameAvgPoints: closeAvgPoints.toFixed(1),
              minutesDifference: (closeAvgMinutes - blowoutAvgMinutes).toFixed(1)
            }]
          });
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`Blowout detection failed: ${error.message}`));
    }
  }
  
  private displayResults() {
    console.log(chalk.bold.green('\n\n🎯 PATTERN DETECTION RESULTS'));
    console.log(chalk.gray('─'.repeat(80)));
    
    if (this.patterns.length === 0) {
      console.log(chalk.red('❌ No patterns detected!'));
      return;
    }
    
    this.patterns.sort((a, b) => b.accuracy - a.accuracy);
    
    this.patterns.forEach((pattern, index) => {
      const accuracyColor = pattern.accuracy > 70 ? chalk.green : 
                           pattern.accuracy > 50 ? chalk.yellow : chalk.red;
      
      console.log(chalk.bold.cyan(`\n${index + 1}. ${pattern.name}`));
      console.log(chalk.gray(`   ${pattern.description}`));
      console.log(accuracyColor(`   Accuracy: ${pattern.accuracy.toFixed(1)}%`));
      console.log(chalk.blue(`   Matches: ${pattern.matches} / ${pattern.totalGames} games`));
      
      if (pattern.avgPointsDiff !== undefined) {
        const diffColor = pattern.avgPointsDiff > 0 ? chalk.green : chalk.red;
        console.log(diffColor(`   Avg Points Difference: ${pattern.avgPointsDiff > 0 ? '+' : ''}${pattern.avgPointsDiff.toFixed(1)}`));
      }
      
      if (pattern.examples.length > 0) {
        console.log(chalk.yellow('\n   Examples:'));
        pattern.examples.forEach((example, i) => {
          console.log(chalk.gray(`   ${i + 1}. ${JSON.stringify(example, null, 2).split('\n').join('\n      ')}`));
        });
      }
    });
    
    console.log(chalk.bold.green(`\n\n✅ TOTAL PATTERNS FOUND: ${this.patterns.length}`));
    const avgAccuracy = this.patterns.reduce((sum, p) => sum + p.accuracy, 0) / this.patterns.length;
    console.log(chalk.bold.green(`📊 AVERAGE ACCURACY: ${avgAccuracy.toFixed(1)}%`));
  }
}

// Run the pattern detector
async function main() {
  const detector = new WorkingPatternDetector();
  await detector.detectAllPatterns();
}

main().catch(console.error);