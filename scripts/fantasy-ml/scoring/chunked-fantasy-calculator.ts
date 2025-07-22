#!/usr/bin/env tsx
/**
 * 🚀 CHUNKED FANTASY POINTS CALCULATOR
 * 
 * Memory-efficient version that processes data in smaller chunks
 * to avoid string length errors and disconnections
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';
import { getScoringRules, normalizePosition } from './dfs-scoring-rules';

export class ChunkedFantasyCalculator {
  private readonly CHUNK_SIZE = 10_000; // Process 10K records at a time
  private readonly UPDATE_BATCH_SIZE = 5_000; // Update 5K at a time
  
  private totalRecords = 0;
  private processedRecords = 0;
  private startTime = Date.now();
  
  constructor() {
    console.log(chalk.magenta.bold(`
╔════════════════════════════════════════════════════════════════════╗
║         🚀 CHUNKED FANTASY POINTS CALCULATOR 🚀                    ║
║                                                                    ║
║  Memory-Efficient Processing                                       ║
║  Chunk Size: 10,000 records                                       ║
║  Platforms: DK, FD, Yahoo, ESPN, CBS, Sleeper                    ║
╚════════════════════════════════════════════════════════════════════╝
    `));
  }
  
  async calculate() {
    try {
      // Step 1: Get total count
      const countResult = await pgPool.query(`
        SELECT COUNT(*) as total 
        FROM player_game_stats 
        WHERE stats IS NOT NULL
      `);
      this.totalRecords = parseInt(countResult.rows[0].total);
      
      console.log(chalk.cyan(`\n📊 Total records to process: ${this.totalRecords.toLocaleString()}\n`));
      
      // Step 2: Process in chunks
      let offset = 0;
      while (offset < this.totalRecords) {
        await this.processChunk(offset);
        offset += this.CHUNK_SIZE;
      }
      
      // Step 3: Show final results
      await this.showFinalResults();
      
    } catch (error) {
      console.error(chalk.red('❌ CALCULATION FAILED:'), error);
    } finally {
      await pgPool.end();
    }
  }
  
  private async processChunk(offset: number) {
    // Load chunk
    const query = `
      SELECT 
        pgs.id,
        pgs.game_id,
        pgs.player_id,
        pgs.sport,
        pgs.position,
        pgs.stats
      FROM player_game_stats pgs
      WHERE pgs.stats IS NOT NULL
      ORDER BY pgs.id
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pgPool.query(query, [this.CHUNK_SIZE, offset]);
    const records = result.rows;
    
    if (records.length === 0) return;
    
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
        console.error(`Error processing record ${record.id}:`, error);
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
    
    // Update database in batches
    for (let i = 0; i < calculations.length; i += this.UPDATE_BATCH_SIZE) {
      const batch = calculations.slice(i, i + this.UPDATE_BATCH_SIZE);
      await this.updateBatch(batch);
    }
    
    this.processedRecords += records.length;
    this.showProgress();
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
      
      if (statValue !== null && statValue !== undefined) {
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
    // Handle special stat mappings
    if (statName === 'singles') {
      const hits = stats.hits || stats.h || 0;
      const doubles = stats.doubles || stats['2b'] || 0;
      const triples = stats.triples || stats['3b'] || 0;
      const homeRuns = stats.home_runs || stats.hr || 0;
      return Math.max(0, hits - doubles - triples - homeRuns);
    }
    
    if (statName === 'double_double' || statName === 'triple_double') {
      const points = stats.points || stats.pts || 0;
      const rebounds = stats.rebounds || stats.reb || 0;
      const assists = stats.assists || stats.ast || 0;
      const steals = stats.steals || stats.stl || 0;
      const blocks = stats.blocks || stats.blk || 0;
      
      let count = 0;
      if (points >= 10) count++;
      if (rebounds >= 10) count++;
      if (assists >= 10) count++;
      if (steals >= 10) count++;
      if (blocks >= 10) count++;
      
      if (statName === 'double_double') return count >= 2 ? 1 : 0;
      if (statName === 'triple_double') return count >= 3 ? 1 : 0;
    }
    
    // Handle points allowed for DST
    if (statName.startsWith('points_allowed_')) {
      const pointsAllowed = stats.points_allowed || 0;
      if (statName === 'points_allowed_0' && pointsAllowed === 0) return 1;
      if (statName === 'points_allowed_1_6' && pointsAllowed >= 1 && pointsAllowed <= 6) return 1;
      if (statName === 'points_allowed_7_13' && pointsAllowed >= 7 && pointsAllowed <= 13) return 1;
      if (statName === 'points_allowed_14_20' && pointsAllowed >= 14 && pointsAllowed <= 20) return 1;
      if (statName === 'points_allowed_21_27' && pointsAllowed >= 21 && pointsAllowed <= 27) return 1;
      if (statName === 'points_allowed_28_34' && pointsAllowed >= 28 && pointsAllowed <= 34) return 1;
      if (statName === 'points_allowed_35_plus' && pointsAllowed >= 35) return 1;
      return 0;
    }
    
    // Map common stat variations
    const mappings: { [key: string]: string[] } = {
      'passing_yards': ['passing_yards', 'pass_yds', 'passYds'],
      'passing_touchdowns': ['passing_touchdowns', 'pass_td', 'passTD', 'passing_tds'],
      'interceptions': ['interceptions', 'int', 'ints'],
      'rushing_yards': ['rushing_yards', 'rush_yds', 'rushYds'],
      'rushing_touchdowns': ['rushing_touchdowns', 'rush_td', 'rushTD', 'rushing_tds'],
      'receiving_yards': ['receiving_yards', 'rec_yds', 'recYds'],
      'receiving_touchdowns': ['receiving_touchdowns', 'rec_td', 'recTD', 'receiving_tds'],
      'receptions': ['receptions', 'rec', 'catches'],
      'fumbles_lost': ['fumbles_lost', 'fumbles', 'fum'],
      'field_goals_made': ['field_goals_made', 'fgm'],
      'field_goals_missed': ['field_goals_missed', 'fga'],
      'extra_points_made': ['extra_points_made', 'xpm'],
      'points': ['points', 'pts'],
      'rebounds': ['rebounds', 'reb'],
      'assists': ['assists', 'ast'],
      'steals': ['steals', 'stl'],
      'blocks': ['blocks', 'blk'],
      'turnovers': ['turnovers', 'to', 'tov'],
      'three_pointers_made': ['three_pointers_made', 'fg3m'],
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
      'shots': ['shots', 'sog'],
      'plus_minus': ['plus_minus', 'plusMinus']
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
    sport = sport.replace(/^(MILB_|NCAAF_|NCAAB_|NCAABB_)/, '');
    
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
    const eta = (this.totalRecords - this.processedRecords) / rate;
    
    console.log(chalk.cyan(
      `Progress: ${this.processedRecords.toLocaleString()}/${this.totalRecords.toLocaleString()} (${percent}%) | ` +
      `Speed: ${rate.toFixed(0)} rec/s | ETA: ${(eta / 60).toFixed(1)} min`
    ));
  }
  
  private async showFinalResults() {
    const duration = (Date.now() - this.startTime) / 1000;
    
    const result = await pgPool.query(`
      SELECT 
        COUNT(CASE WHEN dk_points IS NOT NULL THEN 1 END) as dk_count,
        COUNT(CASE WHEN fd_points IS NOT NULL THEN 1 END) as fd_count,
        COUNT(CASE WHEN yahoo_points IS NOT NULL THEN 1 END) as yahoo_count,
        COUNT(CASE WHEN espn_points IS NOT NULL THEN 1 END) as espn_count,
        COUNT(CASE WHEN cbs_points IS NOT NULL THEN 1 END) as cbs_count,
        COUNT(CASE WHEN sleeper_points IS NOT NULL THEN 1 END) as sleeper_count,
        AVG(dk_points) as avg_dk,
        AVG(fd_points) as avg_fd,
        AVG(yahoo_points) as avg_yahoo,
        AVG(espn_points) as avg_espn,
        AVG(cbs_points) as avg_cbs,
        AVG(sleeper_points) as avg_sleeper
      FROM player_game_stats
      WHERE stats IS NOT NULL
    `);
    
    const stats = result.rows[0];
    
    console.log(chalk.green.bold(`
╔════════════════════════════════════════════════════════════════════╗
║                  ✅ CALCULATION COMPLETE!                          ║
╚════════════════════════════════════════════════════════════════════╝

📊 RESULTS:
  Total Records: ${this.totalRecords.toLocaleString()}
  Time: ${(duration / 60).toFixed(1)} minutes
  Speed: ${(this.totalRecords / duration).toFixed(0)} records/second

📈 PLATFORM COVERAGE:
  DraftKings: ${parseInt(stats.dk_count).toLocaleString()} (avg: ${parseFloat(stats.avg_dk || '0').toFixed(1)} pts)
  FanDuel: ${parseInt(stats.fd_count).toLocaleString()} (avg: ${parseFloat(stats.avg_fd || '0').toFixed(1)} pts)
  Yahoo: ${parseInt(stats.yahoo_count).toLocaleString()} (avg: ${parseFloat(stats.avg_yahoo || '0').toFixed(1)} pts)
  ESPN: ${parseInt(stats.espn_count).toLocaleString()} (avg: ${parseFloat(stats.avg_espn || '0').toFixed(1)} pts)
  CBS: ${parseInt(stats.cbs_count).toLocaleString()} (avg: ${parseFloat(stats.avg_cbs || '0').toFixed(1)} pts)
  Sleeper: ${parseInt(stats.sleeper_count).toLocaleString()} (avg: ${parseFloat(stats.avg_sleeper || '0').toFixed(1)} pts)
    `));
  }
}

// Run if called directly
if (require.main === module) {
  const calculator = new ChunkedFantasyCalculator();
  calculator.calculate().catch(console.error);
}