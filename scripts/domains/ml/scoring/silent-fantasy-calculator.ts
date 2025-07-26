#!/usr/bin/env tsx
/**
 * 🤫 SILENT FANTASY POINTS CALCULATOR
 * 
 * Minimal output version to avoid disconnections
 * Only shows progress every 100K records
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';
import { getScoringRules, normalizePosition } from './dfs-scoring-rules';

export class SilentFantasyCalculator {
  private readonly CHUNK_SIZE = 10_000;
  private readonly UPDATE_BATCH_SIZE = 5_000;
  private readonly PROGRESS_INTERVAL = 100_000; // Only show progress every 100K
  
  private totalRecords = 0;
  private processedRecords = 0;
  private startTime = Date.now();
  private lastProgressShown = 0;
  
  async calculate() {
    try {
      // Get total count
      const countResult = await pgPool.query(`
        SELECT COUNT(*) as total 
        FROM player_game_stats 
        WHERE stats IS NOT NULL AND dk_points IS NULL
      `);
      this.totalRecords = parseInt(countResult.rows[0].total);
      
      console.log(chalk.cyan(`📊 Records to process: ${this.totalRecords.toLocaleString()}`));
      console.log(chalk.yellow('Processing... (updates every 100K records)'));
      
      // Process in chunks
      let offset = 0;
      while (true) {
        const processed = await this.processChunk(offset);
        if (processed === 0) break;
        offset += this.CHUNK_SIZE;
      }
      
      // Final summary
      const duration = (Date.now() - this.startTime) / 1000;
      console.log(chalk.green(`\n✅ Complete! Processed ${this.processedRecords.toLocaleString()} records in ${(duration / 60).toFixed(1)} minutes`));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
    } finally {
      await pgPool.end();
    }
  }
  
  private async processChunk(offset: number): Promise<number> {
    const result = await pgPool.query(`
      SELECT id, game_id, player_id, sport, position, stats
      FROM player_game_stats
      WHERE stats IS NOT NULL AND dk_points IS NULL
      ORDER BY id
      LIMIT $1 OFFSET $2
    `, [this.CHUNK_SIZE, offset]);
    
    const records = result.rows;
    if (records.length === 0) return 0;
    
    // Calculate fantasy points
    const calculations = records.map(record => {
      try {
        const sport = this.normalizeSport(record.sport);
        const position = normalizePosition(record.position, sport);
        
        return {
          id: record.id,
          dk_points: this.calculateFantasyPoints(record.stats, sport, position, 'draftkings'),
          fd_points: this.calculateFantasyPoints(record.stats, sport, position, 'fanduel'),
          yahoo_points: this.calculateFantasyPoints(record.stats, sport, position, 'yahoo'),
          espn_points: this.calculateFantasyPoints(record.stats, sport, position, 'espn'),
          cbs_points: this.calculateFantasyPoints(record.stats, sport, position, 'cbs'),
          sleeper_points: this.calculateFantasyPoints(record.stats, sport, position, 'sleeper')
        };
      } catch (error) {
        return {
          id: record.id,
          dk_points: 0,
          fd_points: 0,
          yahoo_points: 0,
          espn_points: 0,
          cbs_points: 0,
          sleeper_points: 0
        };
      }
    });
    
    // Update database
    for (let i = 0; i < calculations.length; i += this.UPDATE_BATCH_SIZE) {
      const batch = calculations.slice(i, i + this.UPDATE_BATCH_SIZE);
      await this.updateBatch(batch);
    }
    
    this.processedRecords += records.length;
    
    // Only show progress every 100K records
    if (this.processedRecords - this.lastProgressShown >= this.PROGRESS_INTERVAL) {
      this.showProgress();
      this.lastProgressShown = this.processedRecords;
    }
    
    return records.length;
  }
  
  private async updateBatch(calculations: any[]) {
    const values = calculations.map((calc, idx) => {
      const baseIdx = idx * 7;
      return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6}, $${baseIdx + 7})`;
    }).join(',');
    
    const params = calculations.flatMap(calc => [
      calc.id,
      calc.dk_points,
      calc.fd_points,
      calc.yahoo_points,
      calc.espn_points,
      calc.cbs_points,
      calc.sleeper_points
    ]);
    
    const query = `
      UPDATE player_game_stats pgs
      SET 
        dk_points = v.dk_points::numeric,
        fd_points = v.fd_points::numeric,
        yahoo_points = v.yahoo_points::numeric,
        espn_points = v.espn_points::numeric,
        cbs_points = v.cbs_points::numeric,
        sleeper_points = v.sleeper_points::numeric,
        updated_at = NOW()
      FROM (VALUES ${values}) AS v(id, dk_points, fd_points, yahoo_points, espn_points, cbs_points, sleeper_points)
      WHERE pgs.id = v.id::integer
    `;
    
    await pgPool.query(query, params);
  }
  
  private calculateFantasyPoints(stats: any, sport: string, position: string, platform: string): number {
    const rules = getScoringRules(sport as any, platform as any, position);
    
    if (!rules || rules.length === 0) {
      return 0;
    }
    
    let totalPoints = 0;
    const appliedBonuses = new Set<string>();
    
    for (const rule of rules) {
      const statValue = this.getStatValue(stats, rule.stat);
      
      if (statValue !== null && statValue !== undefined && statValue !== 0) {
        if (rule.isBonus || rule.bonusThreshold) {
          if (rule.bonusThreshold && statValue >= rule.bonusThreshold) {
            const bonusKey = `${rule.stat}_${rule.bonusThreshold}`;
            if (!appliedBonuses.has(bonusKey)) {
              totalPoints += rule.bonusPoints || rule.points;
              appliedBonuses.add(bonusKey);
            }
          }
        } else {
          totalPoints += statValue * rule.points;
        }
      }
    }
    
    return Math.round(totalPoints * 100) / 100;
  }
  
  private getStatValue(stats: any, statName: string): number {
    // Handle special cases
    if (statName === 'singles') {
      const hits = stats.hits || stats.h || 0;
      const doubles = stats.doubles || stats['2b'] || 0;
      const triples = stats.triples || stats['3b'] || 0;
      const homeRuns = stats.home_runs || stats.hr || 0;
      return Math.max(0, hits - doubles - triples - homeRuns);
    }
    
    // Simple stat mappings
    const mappings: { [key: string]: string[] } = {
      'passing_yards': ['passing_yards', 'pass_yds', 'passYds', 'passYards'],
      'passing_touchdowns': ['passing_touchdowns', 'pass_td', 'passTD', 'passing_tds', 'passTDs'],
      'interceptions': ['interceptions', 'int', 'ints'],
      'rushing_yards': ['rushing_yards', 'rush_yds', 'rushYds', 'rushYards'],
      'rushing_touchdowns': ['rushing_touchdowns', 'rush_td', 'rushTD', 'rushing_tds', 'rushTDs'],
      'receiving_yards': ['receiving_yards', 'rec_yds', 'recYds', 'recYards'],
      'receiving_touchdowns': ['receiving_touchdowns', 'rec_td', 'recTD', 'receiving_tds', 'recTDs'],
      'receptions': ['receptions', 'rec', 'catches'],
      'fumbles_lost': ['fumbles_lost', 'fumbles', 'fum', 'fumblesLost'],
      'points': ['points', 'pts'],
      'rebounds': ['rebounds', 'reb'],
      'assists': ['assists', 'ast'],
      'steals': ['steals', 'stl'],
      'blocks': ['blocks', 'blk'],
      'turnovers': ['turnovers', 'to', 'tov'],
      'hits': ['hits', 'h'],
      'doubles': ['doubles', '2b'],
      'triples': ['triples', '3b'],
      'home_runs': ['home_runs', 'hr'],
      'rbis': ['rbis', 'rbi'],
      'runs': ['runs', 'r'],
      'walks': ['walks', 'bb'],
      'stolen_bases': ['stolen_bases', 'sb'],
      'strikeouts': ['strikeouts', 'so', 'k'],
      'innings_pitched': ['innings_pitched', 'ip'],
      'earned_runs': ['earned_runs', 'er'],
      'wins': ['wins', 'w'],
      'saves': ['saves', 'sv'],
      'goals': ['goals', 'g'],
      'shots': ['shots', 'sog']
    };
    
    const possibleNames = mappings[statName] || [statName];
    
    for (const name of possibleNames) {
      if (stats[name] !== undefined && stats[name] !== null) {
        return stats[name];
      }
    }
    
    return 0;
  }
  
  private normalizeSport(sport: string): string {
    sport = sport.toUpperCase();
    
    if (sport.includes('NFL') || sport === 'NCAAF') return 'NFL';
    if (sport.includes('NBA') || sport === 'NCAAB') return 'NBA';
    if (sport.includes('MLB') || sport.includes('MILB')) return 'MLB';
    if (sport.includes('NHL')) return 'NHL';
    
    return sport;
  }
  
  private showProgress() {
    const percent = (this.processedRecords / this.totalRecords * 100).toFixed(1);
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.processedRecords / elapsed;
    
    console.log(`  ${this.processedRecords.toLocaleString()} / ${this.totalRecords.toLocaleString()} (${percent}%) - ${rate.toFixed(0)} rec/s`);
  }
}

// Run if called directly
if (require.main === module) {
  const calculator = new SilentFantasyCalculator();
  calculator.calculate().catch(console.error);
}