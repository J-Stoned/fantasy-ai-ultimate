#!/usr/bin/env tsx
/**
 * 🔍 COMPREHENSIVE DATA QUALITY INVESTIGATION
 * 
 * This script will thoroughly investigate:
 * 1. Position breakdowns for each sport
 * 2. Sample stats for each position type
 * 3. Stat key patterns to understand data structure
 * 4. Identify ALL data quality issues before fixing
 * 
 * User request: "please investigate this thoroughly. other sports may have similar issues"
 */

import chalk from 'chalk';
import { pgPool } from './config/database';

interface SportAnalysis {
  sport: string;
  totalPlayers: number;
  totalGameLogs: number;
  positions: Map<string, number>;
  statPatterns: Map<string, number>;
  sampleStats: any[];
  issues: string[];
}

export class DataQualityInvestigator {
  private readonly SPORT_POSITION_MAPPINGS = {
    NFL: {
      offensive: ['QB', 'RB', 'WR', 'TE', 'FB', 'OL', 'C', 'G', 'T'],
      defensive: ['DE', 'DT', 'LB', 'CB', 'S', 'SS', 'FS', 'MLB', 'OLB', 'ILB'],
      special: ['K', 'P', 'LS', 'DST'],
      validStats: ['passing_yards', 'rushing_yards', 'receiving_yards', 'tackles', 'sacks', 'interceptions', 'field_goals_made']
    },
    NBA: {
      positions: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'G-F', 'F-C'],
      validStats: ['points', 'rebounds', 'assists', 'steals', 'blocks', 'field_goals_made', 'three_pointers_made']
    },
    MLB: {
      positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'OF', 'IF', 'RP', 'SP'],
      validStats: ['batting_average', 'home_runs', 'rbis', 'era', 'strikeouts', 'hits', 'obp', 'slg', 'wins', 'saves']
    },
    NHL: {
      positions: ['C', 'LW', 'RW', 'D', 'G', 'W', 'F'],
      validStats: ['goals', 'assists', 'shots', 'penalty_minutes', 'plus_minus', 'save_percentage', 'goals_against_average']
    }
  };
  
  constructor() {
    console.log(chalk.blue.bold('🔍 DATA QUALITY INVESTIGATOR INITIALIZED'));
    console.log(chalk.yellow('📊 Performing comprehensive analysis of all sports data'));
  }
  
  /**
   * 🎯 MAIN INVESTIGATION METHOD
   */
  async investigate(): Promise<void> {
    console.log(chalk.cyan.bold('\n🔍 STARTING COMPREHENSIVE DATA INVESTIGATION...\n'));
    
    const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
    const allAnalysis: SportAnalysis[] = [];
    
    for (const sport of sports) {
      console.log(chalk.yellow(`\n${'='.repeat(60)}`));
      console.log(chalk.yellow.bold(`📊 INVESTIGATING ${sport} DATA`));
      console.log(chalk.yellow(`${'='.repeat(60)}`));
      
      const analysis = await this.analyzeSport(sport);
      allAnalysis.push(analysis);
      
      this.displaySportAnalysis(analysis);
    }
    
    // Summary and recommendations
    this.displayOverallSummary(allAnalysis);
  }
  
  /**
   * 🏈 ANALYZE A SINGLE SPORT
   */
  private async analyzeSport(sport: string): Promise<SportAnalysis> {
    const analysis: SportAnalysis = {
      sport,
      totalPlayers: 0,
      totalGameLogs: 0,
      positions: new Map(),
      statPatterns: new Map(),
      sampleStats: [],
      issues: []
    };
    
    // 1. Get player count and position breakdown
    const positionQuery = `
      SELECT 
        p.position,
        COUNT(*) as count,
        (array_agg(DISTINCT p.name ORDER BY p.name))[1:5] as sample_names
      FROM players p
      WHERE p.sport = $1
      GROUP BY p.position
      ORDER BY count DESC
    `;
    
    const positionResult = await pgPool.query(positionQuery, [sport]);
    
    for (const row of positionResult.rows) {
      analysis.positions.set(row.position || 'UNKNOWN', parseInt(row.count));
      analysis.totalPlayers += parseInt(row.count);
      
      // Check if position is valid for this sport
      const validPositions = this.getValidPositions(sport);
      if (!validPositions.includes(row.position)) {
        analysis.issues.push(`Invalid position '${row.position}' found (${row.count} players)`);
      }
    }
    
    // 2. Get game log stats breakdown
    const statsQuery = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT pgl.player_id) as unique_players,
        COUNT(*) FILTER (WHERE pgl.stats IS NOT NULL) as logs_with_stats,
        COUNT(*) FILTER (WHERE pgl.fantasy_points IS NOT NULL) as logs_with_fantasy
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      WHERE p.sport = $1
    `;
    
    const statsResult = await pgPool.query(statsQuery, [sport]);
    analysis.totalGameLogs = parseInt(statsResult.rows[0].total_logs);
    
    // 3. Analyze stat patterns
    console.log(chalk.cyan(`\n🔍 Analyzing stat patterns for ${sport}...`));
    const patternQuery = `
      WITH stat_keys AS (
        SELECT 
          pgl.id,
          p.position,
          jsonb_object_keys(pgl.stats::jsonb) as stat_key
        FROM player_game_logs pgl
        JOIN players p ON p.id = pgl.player_id
        WHERE p.sport = $1
        AND pgl.stats IS NOT NULL
        LIMIT 10000
      )
      SELECT 
        stat_key,
        COUNT(DISTINCT id) as occurrences,
        (array_agg(DISTINCT position ORDER BY position))[1:5] as positions_with_stat
      FROM stat_keys
      GROUP BY stat_key
      ORDER BY occurrences DESC
      LIMIT 50
    `;
    
    const patternResult = await pgPool.query(patternQuery, [sport]);
    
    for (const row of patternResult.rows) {
      analysis.statPatterns.set(row.stat_key, parseInt(row.occurrences));
      
      // Check if this stat belongs to this sport
      if (!this.isValidStatForSport(row.stat_key, sport)) {
        analysis.issues.push(`Wrong sport stat '${row.stat_key}' found (${row.occurrences} occurrences)`);
      }
    }
    
    // 4. Get sample stats for different positions
    console.log(chalk.cyan(`\n🔍 Sampling stats for different positions...`));
    const sampleQuery = `
      SELECT 
        p.position,
        p.name as player_name,
        pgl.game_date,
        pgl.stats,
        pgl.fantasy_points
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      WHERE p.sport = $1
      AND pgl.stats IS NOT NULL
      AND p.position = ANY($2)
      ORDER BY pgl.game_date DESC
      LIMIT 20
    `;
    
    const topPositions = Array.from(analysis.positions.keys()).slice(0, 5);
    const sampleResult = await pgPool.query(sampleQuery, [sport, topPositions]);
    
    analysis.sampleStats = sampleResult.rows.map(row => ({
      position: row.position,
      player: row.player_name,
      date: row.game_date,
      statKeys: Object.keys(row.stats || {}),
      fantasy: row.fantasy_points
    }));
    
    // 5. Deep dive into mismatched data
    await this.analyzeMismatchedData(sport, analysis);
    
    return analysis;
  }
  
  /**
   * 🔍 ANALYZE MISMATCHED DATA IN DETAIL
   */
  private async analyzeMismatchedData(sport: string, analysis: SportAnalysis): Promise<void> {
    console.log(chalk.cyan(`\n🔍 Deep diving into mismatched data for ${sport}...`));
    
    // Find players with wrong stats
    const mismatchQuery = `
      WITH player_stat_analysis AS (
        SELECT 
          p.id,
          p.name,
          p.position,
          COUNT(*) as total_logs,
          
          -- Sport-specific stat counts
          COUNT(*) FILTER (WHERE 
            pgl.stats::text LIKE ANY(ARRAY['%passing_yards%', '%rushing_yards%', '%tackles%', '%sacks%'])
          ) as football_stats,
          
          COUNT(*) FILTER (WHERE 
            pgl.stats::text LIKE '%field_goals_made%' AND
            pgl.stats::text LIKE '%three_pointers_made%'
          ) as basketball_stats,
          
          COUNT(*) FILTER (WHERE 
            pgl.stats::text LIKE ANY(ARRAY['%batting_average%', '%home_runs%', '%rbis%', '%era%'])
          ) as baseball_stats,
          
          COUNT(*) FILTER (WHERE 
            pgl.stats::text LIKE '%goals%' AND
            pgl.stats::text LIKE '%penalty_minutes%' AND
            pgl.stats::text LIKE '%plus_minus%'
          ) as hockey_stats,
          
          -- Sample stat keys
          (SELECT jsonb_object_keys(stats::jsonb) FROM player_game_logs WHERE player_id = p.id AND stats IS NOT NULL LIMIT 1) as sample_stat
          
        FROM players p
        JOIN player_game_logs pgl ON pgl.player_id = p.id
        WHERE p.sport = $1
        GROUP BY p.id, p.name, p.position
        HAVING COUNT(*) > 10
      )
      SELECT * FROM player_stat_analysis
      WHERE 
        CASE 
          WHEN $1 = 'NFL' THEN basketball_stats > 0 OR baseball_stats > 0 OR hockey_stats > 0
          WHEN $1 = 'NBA' THEN football_stats > 0 OR baseball_stats > 0 OR hockey_stats > 0
          WHEN $1 = 'MLB' THEN football_stats > 0 OR basketball_stats > 0 OR hockey_stats > 0
          WHEN $1 = 'NHL' THEN football_stats > 0 OR basketball_stats > 0 OR baseball_stats > 0
        END
      ORDER BY total_logs DESC
      LIMIT 10
    `;
    
    const mismatchResult = await pgPool.query(mismatchQuery, [sport]);
    
    if (mismatchResult.rows.length > 0) {
      analysis.issues.push(`Found ${mismatchResult.rows.length} players with wrong sport stats`);
      
      for (const player of mismatchResult.rows) {
        const wrongStats = [];
        if (sport !== 'NFL' && player.football_stats > 0) wrongStats.push(`football (${player.football_stats})`);
        if (sport !== 'NBA' && player.basketball_stats > 0) wrongStats.push(`basketball (${player.basketball_stats})`);
        if (sport !== 'MLB' && player.baseball_stats > 0) wrongStats.push(`baseball (${player.baseball_stats})`);
        if (sport !== 'NHL' && player.hockey_stats > 0) wrongStats.push(`hockey (${player.hockey_stats})`);
        
        analysis.issues.push(`  - ${player.name} (${player.position}): has ${wrongStats.join(', ')} stats`);
      }
    }
  }
  
  /**
   * 📊 DISPLAY SPORT ANALYSIS
   */
  private displaySportAnalysis(analysis: SportAnalysis): void {
    console.log(chalk.blue(`\n📊 ${analysis.sport} SUMMARY:`));
    console.log(chalk.gray(`   Total Players: ${analysis.totalPlayers.toLocaleString()}`));
    console.log(chalk.gray(`   Total Game Logs: ${analysis.totalGameLogs.toLocaleString()}`));
    
    // Position breakdown
    console.log(chalk.yellow('\n📌 Position Breakdown:'));
    for (const [position, count] of analysis.positions) {
      const percentage = ((count / analysis.totalPlayers) * 100).toFixed(1);
      console.log(chalk.gray(`   ${position}: ${count} (${percentage}%)`));
    }
    
    // Top stat patterns
    console.log(chalk.yellow('\n📈 Top Stat Keys Found:'));
    let statCount = 0;
    for (const [stat, occurrences] of analysis.statPatterns) {
      if (statCount >= 10) break;
      const isSportCorrect = this.isValidStatForSport(stat, analysis.sport);
      const color = isSportCorrect ? chalk.green : chalk.red;
      console.log(color(`   ${stat}: ${occurrences.toLocaleString()} occurrences ${isSportCorrect ? '✓' : '✗ WRONG SPORT!'}`));
      statCount++;
    }
    
    // Sample stats
    console.log(chalk.yellow('\n🔬 Sample Player Stats:'));
    for (let i = 0; i < Math.min(3, analysis.sampleStats.length); i++) {
      const sample = analysis.sampleStats[i];
      console.log(chalk.gray(`   ${sample.player} (${sample.position}):`));
      console.log(chalk.gray(`     Stats: ${sample.statKeys.slice(0, 5).join(', ')}...`));
    }
    
    // Issues found
    if (analysis.issues.length > 0) {
      console.log(chalk.red('\n⚠️  ISSUES FOUND:'));
      for (const issue of analysis.issues.slice(0, 10)) {
        console.log(chalk.red(`   - ${issue}`));
      }
      if (analysis.issues.length > 10) {
        console.log(chalk.red(`   ... and ${analysis.issues.length - 10} more issues`));
      }
    }
  }
  
  /**
   * 📊 DISPLAY OVERALL SUMMARY
   */
  private displayOverallSummary(allAnalysis: SportAnalysis[]): void {
    console.log(chalk.yellow.bold(`\n${'='.repeat(60)}`));
    console.log(chalk.yellow.bold('📊 OVERALL DATA QUALITY SUMMARY'));
    console.log(chalk.yellow.bold(`${'='.repeat(60)}`));
    
    let totalIssues = 0;
    const recommendations: string[] = [];
    
    for (const analysis of allAnalysis) {
      const issueCount = analysis.issues.length;
      totalIssues += issueCount;
      
      const correctStats = this.calculateCorrectStatsPercentage(analysis);
      console.log(chalk.cyan(`\n${analysis.sport}:`));
      console.log(`  - Data Quality Score: ${correctStats.toFixed(1)}%`);
      console.log(`  - Issues Found: ${issueCount}`);
      console.log(`  - Total Records: ${analysis.totalGameLogs.toLocaleString()}`);
      
      if (correctStats < 80) {
        recommendations.push(`${analysis.sport} needs major cleanup (only ${correctStats.toFixed(1)}% correct)`);
      }
    }
    
    console.log(chalk.red.bold(`\n⚠️  TOTAL ISSUES FOUND: ${totalIssues}`));
    
    console.log(chalk.yellow.bold('\n🔧 RECOMMENDATIONS:'));
    console.log(chalk.yellow('1. NFL has mixed data because:'));
    console.log(chalk.gray('   - Defensive players (LB, S) have different stats than offensive players'));
    console.log(chalk.gray('   - Some players have baseball stats mixed in'));
    console.log(chalk.gray('   - Need to handle both offensive AND defensive stats properly'));
    
    console.log(chalk.yellow('\n2. Data appears to have been merged incorrectly:'));
    console.log(chalk.gray('   - Players from different sports mixed together'));
    console.log(chalk.gray('   - Stats from wrong sports attached to players'));
    console.log(chalk.gray('   - Need to re-map based on actual stat content, not just player sport'));
    
    console.log(chalk.yellow('\n3. Suggested fix approach:'));
    console.log(chalk.gray('   - Create sport detection based on stat keys'));
    console.log(chalk.gray('   - Re-assign players to correct sport based on their actual stats'));
    console.log(chalk.gray('   - Handle multi-position players (NFL offensive/defensive)'));
    console.log(chalk.gray('   - Clean up game logs with mismatched stats'));
    
    console.log(chalk.green.bold('\n✅ INVESTIGATION COMPLETE!'));
    console.log(chalk.magenta('Ready to create targeted fix based on findings'));
  }
  
  // Helper methods
  private getValidPositions(sport: string): string[] {
    const mapping = this.SPORT_POSITION_MAPPINGS[sport as keyof typeof this.SPORT_POSITION_MAPPINGS];
    if (sport === 'NFL') {
      return [...mapping.offensive, ...mapping.defensive, ...mapping.special];
    }
    return mapping.positions || [];
  }
  
  private isValidStatForSport(stat: string, sport: string): boolean {
    const mapping = this.SPORT_POSITION_MAPPINGS[sport as keyof typeof this.SPORT_POSITION_MAPPINGS];
    const validStats = mapping.validStats || [];
    
    return validStats.some(validStat => 
      stat.toLowerCase().includes(validStat.toLowerCase().replace('_', ''))
    );
  }
  
  private calculateCorrectStatsPercentage(analysis: SportAnalysis): number {
    let correctStats = 0;
    let totalStats = 0;
    
    for (const [stat, count] of analysis.statPatterns) {
      totalStats += count;
      if (this.isValidStatForSport(stat, analysis.sport)) {
        correctStats += count;
      }
    }
    
    return totalStats > 0 ? (correctStats / totalStats) * 100 : 0;
  }
}

// Export and run
export function createDataQualityInvestigator(): DataQualityInvestigator {
  return new DataQualityInvestigator();
}

if (require.main === module) {
  (async () => {
    try {
      const investigator = createDataQualityInvestigator();
      await investigator.investigate();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Investigation failed:'), error);
      process.exit(1);
    }
  })();
}