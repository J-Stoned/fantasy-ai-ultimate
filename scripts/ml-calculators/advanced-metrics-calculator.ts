#!/usr/bin/env tsx
/**
 * 🧮 Advanced Metrics Calculator
 * 
 * Calculates advanced metrics from the sports analytics masterclass:
 * - True Shooting % (TS%)
 * - Weighted On-Base Average (wOBA)
 * - Expected Points Added (EPA)
 * - Player Efficiency Rating (PER)
 * - Wins Over Player Replacement (WOPR)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PlayerGameLog {
  id: string;
  player_id: string;
  game_id: string;
  sport: string;
  fantasy_points: number;
  // Basketball
  points?: number;
  field_goals_attempted?: number;
  field_goals_made?: number;
  free_throws_attempted?: number;
  free_throws_made?: number;
  three_pointers_made?: number;
  rebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  minutes?: number;
  // Baseball
  at_bats?: number;
  hits?: number;
  walks?: number;
  hit_by_pitch?: number;
  singles?: number;
  doubles?: number;
  triples?: number;
  home_runs?: number;
  // Football
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_tds?: number;
}

class AdvancedMetricsCalculator {
  
  // Basketball: True Shooting Percentage
  calculateTrueShooting(log: PlayerGameLog): number | null {
    if (!log.points || !log.field_goals_attempted || !log.free_throws_attempted) {
      return null;
    }
    
    // TS% = PTS / (2 * (FGA + 0.44 * FTA))
    const tsa = 2 * (log.field_goals_attempted + 0.44 * log.free_throws_attempted);
    return tsa > 0 ? log.points / tsa : 0;
  }
  
  // Basketball: Player Efficiency Rating (simplified)
  calculatePER(log: PlayerGameLog): number | null {
    if (!log.minutes || log.minutes === 0) return null;
    
    // Simplified PER calculation
    const plusStats = (
      (log.field_goals_made || 0) +
      (log.three_pointers_made || 0) * 0.5 +
      (log.free_throws_made || 0) * 0.5 +
      (log.rebounds || 0) * 1.2 +
      (log.assists || 0) * 1.5 +
      (log.steals || 0) * 2 +
      (log.blocks || 0) * 2
    );
    
    const minusStats = (
      (log.field_goals_attempted || 0) - (log.field_goals_made || 0) +
      (log.free_throws_attempted || 0) - (log.free_throws_made || 0) +
      (log.turnovers || 0) * 2
    );
    
    const per = ((plusStats - minusStats) / log.minutes) * 48;
    return per;
  }
  
  // Baseball: Weighted On-Base Average
  calculateWOBA(log: PlayerGameLog): number | null {
    if (!log.at_bats || log.at_bats === 0) return null;
    
    // wOBA weights (2023 season)
    const weights = {
      walk: 0.690,
      hbp: 0.722,
      single: 0.880,
      double: 1.247,
      triple: 1.578,
      homerun: 2.031
    };
    
    const woba = (
      (log.walks || 0) * weights.walk +
      (log.hit_by_pitch || 0) * weights.hbp +
      (log.singles || 0) * weights.single +
      (log.doubles || 0) * weights.double +
      (log.triples || 0) * weights.triple +
      (log.home_runs || 0) * weights.homerun
    ) / (log.at_bats + (log.walks || 0) + (log.hit_by_pitch || 0));
    
    return woba;
  }
  
  // Football: Expected Points Added (simplified)
  calculateEPA(log: PlayerGameLog): number | null {
    // Simplified EPA based on yards and TDs
    let epa = 0;
    
    // Passing EPA
    if (log.passing_yards) {
      epa += (log.passing_yards / 10) * 0.22; // 0.22 EPA per 10 yards
      epa += (log.passing_tds || 0) * 2.0; // 2.0 EPA per passing TD
      epa -= (log.interceptions || 0) * 2.5; // -2.5 EPA per INT
    }
    
    // Rushing EPA
    if (log.rushing_yards) {
      epa += (log.rushing_yards / 10) * 0.34; // 0.34 EPA per 10 yards
      epa += (log.rushing_tds || 0) * 2.5; // 2.5 EPA per rushing TD
    }
    
    // Receiving EPA
    if (log.receiving_yards) {
      epa += (log.receiving_yards / 10) * 0.28; // 0.28 EPA per 10 yards
      epa += (log.receiving_tds || 0) * 2.2; // 2.2 EPA per receiving TD
    }
    
    return epa || null;
  }
  
  // Universal: Usage Rate
  calculateUsageRate(log: PlayerGameLog, teamStats: any): number | null {
    if (log.sport === 'NBA' && log.minutes && teamStats.total_minutes > 0) {
      const playerPossessions = (
        (log.field_goals_attempted || 0) +
        0.44 * (log.free_throws_attempted || 0) +
        (log.turnovers || 0)
      );
      
      const minutesPct = log.minutes / teamStats.total_minutes;
      const teamPossessions = teamStats.total_possessions || 100;
      
      return (playerPossessions / (minutesPct * teamPossessions)) || 0;
    }
    
    return null;
  }
  
  // Process a batch of game logs
  async processBatch(logs: PlayerGameLog[]) {
    console.log(chalk.cyan(`Processing ${logs.length} game logs...`));
    
    const metrics = [];
    
    for (const log of logs) {
      const metric: any = {
        player_id: log.player_id,
        game_id: log.game_id,
        sport: log.sport,
        fantasy_points_per_minute: log.minutes ? log.fantasy_points / log.minutes : null
      };
      
      // Sport-specific metrics
      switch (log.sport) {
        case 'NBA':
          metric.true_shooting_pct = this.calculateTrueShooting(log);
          metric.player_efficiency_rating = this.calculatePER(log);
          break;
          
        case 'MLB':
          metric.woba = this.calculateWOBA(log);
          break;
          
        case 'NFL':
          metric.epa = this.calculateEPA(log);
          break;
      }
      
      // Only add if we calculated at least one metric
      if (Object.keys(metric).length > 4) {
        metrics.push(metric);
      }
    }
    
    return metrics;
  }
  
  // Main calculation process
  async calculateAllMetrics() {
    console.log(chalk.bold.cyan('🧮 Calculating Advanced Metrics\n'));
    
    const startTime = Date.now();
    let totalProcessed = 0;
    
    // Process by sport
    const sports = ['NBA', 'MLB', 'NFL', 'NHL'];
    
    for (const sport of sports) {
      console.log(chalk.yellow(`\n📊 Processing ${sport} metrics...`));
      
      // Get game logs with stats
      const { data: logs, error } = await supabase
        .from('player_game_logs')
        .select('*')
        .eq('sport', sport)
        .not('fantasy_points', 'is', null)
        .limit(1000);
      
      if (error) {
        console.error(chalk.red(`Error fetching ${sport} logs:`, error));
        continue;
      }
      
      if (!logs || logs.length === 0) {
        console.log(chalk.gray(`  No ${sport} logs found`));
        continue;
      }
      
      // Calculate metrics
      const metrics = await this.processBatch(logs);
      
      if (metrics.length > 0) {
        // Insert in batches
        const batchSize = 100;
        for (let i = 0; i < metrics.length; i += batchSize) {
          const batch = metrics.slice(i, i + batchSize);
          
          const { error: insertError } = await supabase
            .from('advanced_player_metrics')
            .upsert(batch, { onConflict: 'player_id,game_id' });
          
          if (insertError) {
            console.error(chalk.red(`Error inserting batch:`, insertError));
          } else {
            totalProcessed += batch.length;
            console.log(chalk.green(`  ✓ Processed ${batch.length} ${sport} metrics`));
          }
        }
      }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(chalk.gray('\n' + '='.repeat(60)));
    console.log(chalk.bold.green(`✅ Calculated ${totalProcessed} advanced metrics in ${elapsed}s`));
    
    // Show sample metrics
    const { data: sample } = await supabase
      .from('advanced_player_metrics')
      .select('*')
      .limit(5);
    
    if (sample && sample.length > 0) {
      console.log(chalk.cyan('\n📊 Sample Metrics:'));
      sample.forEach(m => {
        console.log(chalk.white(`  Player ${m.player_id}:`));
        if (m.true_shooting_pct) console.log(chalk.gray(`    TS%: ${(m.true_shooting_pct * 100).toFixed(1)}%`));
        if (m.woba) console.log(chalk.gray(`    wOBA: ${m.woba.toFixed(3)}`));
        if (m.epa) console.log(chalk.gray(`    EPA: ${m.epa.toFixed(2)}`));
      });
    }
  }
}

// Team synergy calculator
class TeamSynergyCalculator {
  
  async calculateSynergies() {
    console.log(chalk.bold.cyan('\n🤝 Calculating Team Synergies\n'));
    
    try {
      // Get games with lineups
      const { data: games } = await supabase
        .from('games')
        .select(`
          id,
          sport,
          home_team_id,
          away_team_id,
          home_score,
          away_score
        `)
        .not('home_score', 'is', null)
        .limit(100);
      
      if (!games || games.length === 0) {
        console.log(chalk.yellow('No games found for synergy calculation'));
        return;
      }
      
      // For each game, calculate team synergy
      const synergies = [];
      
      for (const game of games) {
        // Get player stats for this game
        const { data: homeLogs } = await supabase
          .from('player_game_logs')
          .select('player_id, fantasy_points, minutes')
          .eq('game_id', game.id)
          .eq('team_id', game.home_team_id);
        
        const { data: awayLogs } = await supabase
          .from('player_game_logs')
          .select('player_id, fantasy_points, minutes')
          .eq('game_id', game.id)
          .eq('team_id', game.away_team_id);
        
        // Calculate synergy for home team
        if (homeLogs && homeLogs.length >= 5) {
          const playerIds = homeLogs
            .sort((a, b) => (b.minutes || 0) - (a.minutes || 0))
            .slice(0, 5)
            .map(l => l.player_id)
            .sort();
          
          const lineupHash = Buffer.from(playerIds.join(',')).toString('base64');
          
          synergies.push({
            team_id: game.home_team_id,
            lineup_hash: lineupHash,
            player_ids: playerIds,
            sport: game.sport,
            games_played: 1,
            net_rating: game.home_score - game.away_score,
            offensive_rating: game.home_score,
            defensive_rating: game.away_score
          });
        }
      }
      
      if (synergies.length > 0) {
        const { error } = await supabase
          .from('team_synergy_stats')
          .upsert(synergies, { onConflict: 'team_id,lineup_hash' });
        
        if (error) {
          console.error(chalk.red('Error inserting synergies:', error));
        } else {
          console.log(chalk.green(`✅ Calculated ${synergies.length} lineup synergies`));
        }
      }
      
    } catch (error) {
      console.error(chalk.red('Error calculating synergies:', error));
    }
  }
}

// Main execution
async function main() {
  const metricsCalc = new AdvancedMetricsCalculator();
  const synergyCalc = new TeamSynergyCalculator();
  
  if (process.argv.includes('--metrics')) {
    await metricsCalc.calculateAllMetrics();
  } else if (process.argv.includes('--synergy')) {
    await synergyCalc.calculateSynergies();
  } else {
    // Run both
    await metricsCalc.calculateAllMetrics();
    await synergyCalc.calculateSynergies();
  }
}

main().catch(console.error);