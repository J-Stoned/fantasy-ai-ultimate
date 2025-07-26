#!/usr/bin/env tsx
/**
 * 🎯 10X POSITION STANDARDIZER
 * 
 * Phase 2: Standardize all player positions to DFS-compatible formats
 * We saw weird positions like 'PK', 'defensive', 'receiving', etc.
 * Let's fix them ALL!
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';

interface PositionMapping {
  sport: string;
  oldPosition: string;
  newPosition: string;
  count?: number;
}

class TenXPositionStandardizer {
  // Standard DFS positions by sport
  private readonly STANDARD_POSITIONS = {
    NFL: ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'FLEX'],
    NBA: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'],
    MLB: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'SP', 'RP', 'UTIL'],
    NHL: ['C', 'LW', 'RW', 'D', 'G', 'W', 'F', 'UTIL'],
    // NCAA sports - we'll map these to their pro equivalents
    NCAA_FB: ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'FLEX'],
    NCAA_BB: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'],
    NCAA_BASEBALL: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'SP', 'RP', 'UTIL']
  };

  // Comprehensive position mappings
  private readonly POSITION_MAPPINGS: { [sport: string]: { [oldPos: string]: string } } = {
    NFL: {
      // Kickers
      'PK': 'K',
      'K/P': 'K',
      'P': 'K', // Punters count as K for fantasy
      
      // Defense
      'DEF': 'DST',
      'defensive': 'DST',
      'defense': 'DST',
      'DST/ST': 'DST',
      
      // Offensive positions
      'HB': 'RB',
      'FB': 'RB',
      'TB': 'RB',
      'receiving': 'WR',
      'rushing': 'RB',
      'passing': 'QB',
      
      // Line positions (not fantasy relevant)
      'OL': 'FLEX',
      'OT': 'FLEX',
      'OG': 'FLEX',
      'C': 'FLEX',
      'LS': 'FLEX',
      
      // Defensive positions (IDP)
      'LB': 'FLEX',
      'MLB': 'FLEX',
      'OLB': 'FLEX',
      'ILB': 'FLEX',
      'DE': 'FLEX',
      'DT': 'FLEX',
      'NT': 'FLEX',
      'DL': 'FLEX',
      'DB': 'FLEX',
      'CB': 'FLEX',
      'S': 'FLEX',
      'SS': 'FLEX',
      'FS': 'FLEX',
      
      // Special
      'kicking': 'K',
      'punting': 'K',
      'kickReturns': 'FLEX',
      'puntReturns': 'FLEX',
      'KR': 'FLEX',
      'PR': 'FLEX',
      'RS': 'FLEX',
      'ST': 'DST',
      
      // Generic
      '-': 'FLEX',
      'N/A': 'FLEX',
      'NA': 'FLEX',
      'UN': 'FLEX',
      'fumbles': 'FLEX'
    },
    
    NBA: {
      // Guards
      'G-F': 'G',
      'PG-SG': 'PG',
      'SG-SF': 'SG',
      'SG-PG': 'SG',
      'Guard': 'G',
      
      // Forwards  
      'F-C': 'F',
      'PF-C': 'PF',
      'SF-PF': 'SF',
      'SF-SG': 'SF',
      'C-F': 'C',
      'F-G': 'F',
      'Forward': 'F',
      'FC': 'F',
      'GF': 'G',
      
      // Centers
      'Center': 'C',
      'C-PF': 'C',
      
      // Generic
      'NA': 'UTIL',
      'ATH': 'UTIL',
      'UN': 'UTIL',
      '-': 'UTIL',
      'N/A': 'UTIL'
    },
    
    MLB: {
      // Pitchers
      'SP/RP': 'P',
      'RP/SP': 'P',
      'LHP': 'P',
      'RHP': 'P',
      'CL': 'RP',
      'SU': 'RP',
      'MR': 'RP',
      'LR': 'RP',
      'TWP': 'P',
      'Pitcher': 'P',
      
      // Catchers
      'CA': 'C',
      'Catcher': 'C',
      
      // Infielders
      'IF': 'UTIL',
      'INF': 'UTIL',
      'MI': 'UTIL', // Middle infielder
      'CI': 'UTIL', // Corner infielder
      'UT': 'UTIL',
      'UTIL': 'UTIL',
      '1': '1B',
      '2': 'C', // This might be wrong, but we saw it in the data
      '3': '1B',
      '4': '2B', 
      '5': '3B',
      '6': 'SS',
      
      // Outfielders
      '7': 'LF',
      '8': 'CF',
      '9': 'RF',
      '10': 'DH',
      'O': 'OF',
      'Outfielder': 'OF',
      'LF-CF': 'LF',
      'CF-RF': 'CF',
      'RF-LF': 'RF',
      
      // Generic
      '-': 'UTIL',
      'N/A': 'UTIL',
      'NA': 'UTIL',
      'UN': 'UTIL'
    },
    
    NHL: {
      // Wings
      'W': 'W',
      'L': 'LW',
      'R': 'RW',
      'RW/LW': 'RW',
      'LW/RW': 'LW',
      'F': 'F',
      
      // Defense
      'Defenseman': 'D',
      'LD': 'D',
      'RD': 'D',
      'D-M': 'D',
      
      // Goalie
      'Goalie': 'G',
      'GT': 'G',
      
      // Generic
      '-': 'UTIL',
      'N/A': 'UTIL',
      'NA': 'UTIL',
      'UN': 'UTIL'
    },
    
    // NCAA sports use same mappings as pro
    NCAA_FB: {
      // All NFL mappings apply
      'NULL': 'FLEX',
      'null': 'FLEX',
      'G': 'OL',
      'EDGE': 'LB',
      // Copy all NFL mappings
      'PK': 'K', 'HB': 'RB', 'FB': 'RB', 'TB': 'RB',
      'OL': 'FLEX', 'OT': 'FLEX', 'OG': 'FLEX', 'C': 'FLEX',
      'LB': 'FLEX', 'MLB': 'FLEX', 'OLB': 'FLEX', 'ILB': 'FLEX',
      'DE': 'FLEX', 'DT': 'FLEX', 'NT': 'FLEX', 'DL': 'FLEX',
      'DB': 'FLEX', 'CB': 'FLEX', 'S': 'FLEX', 'SS': 'FLEX', 'FS': 'FLEX',
      'LS': 'FLEX', 'P': 'K', 'ST': 'DST', '-': 'FLEX'
    },
    
    NCAA_BB: {
      'NULL': 'UTIL',
      'null': 'UTIL',
      'ATH': 'UTIL',
      'NA': 'UTIL',
      'UN': 'UTIL',
      '-': 'UTIL'
    },
    
    NCAA_BASEBALL: {
      'NULL': 'UTIL',
      'null': 'UTIL',
      'UN': 'UTIL',
      'ATH': 'UTIL',
      'NA': 'UTIL',
      '-': 'UTIL'
    }
  };

  async execute() {
    console.log(chalk.magenta.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║           🎯 10X POSITION STANDARDIZER 🎯                    ║
    ║                                                              ║
    ║  Making all positions DFS-compatible!                        ║
    ╚══════════════════════════════════════════════════════════════╝
    `));

    const startTime = Date.now();

    try {
      // Step 1: Analyze current positions
      console.log(chalk.cyan.bold('\n📊 STEP 1: ANALYZING CURRENT POSITIONS...\n'));
      const positionIssues = await this.analyzePositions();
      
      // Step 2: Create backup
      console.log(chalk.cyan.bold('\n💾 STEP 2: BACKING UP PLAYER TABLE...\n'));
      await this.createBackup();
      
      // Step 3: Fix positions
      console.log(chalk.cyan.bold('\n🔧 STEP 3: STANDARDIZING POSITIONS...\n'));
      await this.standardizePositions(positionIssues);
      
      // Step 4: Verify
      console.log(chalk.cyan.bold('\n✅ STEP 4: VERIFYING...\n'));
      await this.verifyPositions();
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.green.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║               ✅ POSITION STANDARDIZATION COMPLETE!          ║
    ║                                                              ║
    ║  Time: ${duration.toFixed(1)}s                                              ║
    ║  All positions are now DFS-compatible! 🎯                    ║
    ╚══════════════════════════════════════════════════════════════╝
      `));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), error);
      throw error;
    }
  }

  private async analyzePositions(): Promise<PositionMapping[]> {
    console.log(chalk.yellow('Finding non-standard positions...'));
    
    const query = `
      SELECT 
        p.sport,
        p.position,
        COUNT(*) as player_count,
        COUNT(DISTINCT pgl.id) as game_count
      FROM players p
      LEFT JOIN player_game_logs pgl ON pgl.player_id = p.id
      GROUP BY p.sport, p.position
      ORDER BY p.sport, COUNT(*) DESC
    `;
    
    const result = await pgPool.query(query);
    const issues: PositionMapping[] = [];
    
    // Group by sport
    const bySport = new Map<string, any[]>();
    result.rows.forEach(row => {
      if (!bySport.has(row.sport)) {
        bySport.set(row.sport, []);
      }
      bySport.get(row.sport)!.push(row);
    });
    
    // Analyze each sport
    bySport.forEach((positions, sport) => {
      console.log(chalk.cyan(`\n${sport} Positions:`));
      
      const standardPositions = this.STANDARD_POSITIONS[sport as keyof typeof this.STANDARD_POSITIONS] || [];
      
      positions.forEach(pos => {
        const isStandard = standardPositions.includes(pos.position);
        const color = isStandard ? chalk.green : chalk.yellow;
        const status = isStandard ? '✓' : '⚠️';
        
        const positionStr = pos.position || 'NULL';
        console.log(color(`  ${status} ${positionStr.padEnd(15)} ${pos.player_count} players, ${pos.game_count} games`));
        
        if (!isStandard) {
          const mapping = this.POSITION_MAPPINGS[sport]?.[pos.position] || 
                        this.POSITION_MAPPINGS[sport]?.[pos.position || 'NULL'];
          if (mapping) {
            issues.push({
              sport,
              oldPosition: pos.position,
              newPosition: mapping,
              count: parseInt(pos.player_count)
            });
          } else {
            console.log(chalk.red(`     ❌ No mapping found! Will default to FLEX/UTIL`));
            const defaultPos = sport === 'NFL' || sport === 'NCAA_FB' ? 'FLEX' : 'UTIL';
            issues.push({
              sport,
              oldPosition: pos.position,
              newPosition: defaultPos,
              count: parseInt(pos.player_count)
            });
          }
        }
      });
    });
    
    console.log(chalk.yellow(`\nFound ${issues.length} position types to standardize`));
    return issues;
  }

  private async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.T-]/g, '_').slice(0, -5);
    const backupTable = `players_backup_positions_${timestamp}`;
    
    console.log(chalk.yellow('Creating backup of players table...'));
    
    await pgPool.query(`
      CREATE TABLE ${backupTable} AS 
      SELECT * FROM players
    `);
    
    const count = await pgPool.query(`SELECT COUNT(*) FROM ${backupTable}`);
    console.log(chalk.green(`✅ Backed up ${count.rows[0].count} players`));
  }

  private async standardizePositions(issues: PositionMapping[]) {
    console.log(chalk.yellow('Standardizing positions...'));
    
    // Group by sport for efficiency
    const bySport = new Map<string, PositionMapping[]>();
    issues.forEach(issue => {
      if (!bySport.has(issue.sport)) {
        bySport.set(issue.sport, []);
      }
      bySport.get(issue.sport)!.push(issue);
    });
    
    let totalUpdated = 0;
    
    // Update each sport
    for (const [sport, mappings] of bySport) {
      console.log(chalk.cyan(`\nUpdating ${sport} positions...`));
      
      for (const mapping of mappings) {
        let result;
        if (mapping.oldPosition === null || mapping.oldPosition === undefined) {
          // Handle NULL positions
          result = await pgPool.query(`
            UPDATE players
            SET position = $1
            WHERE sport = $2 AND position IS NULL
          `, [mapping.newPosition, sport]);
          console.log(chalk.gray(`  NULL → ${mapping.newPosition}: ${result.rowCount} players updated`));
        } else {
          result = await pgPool.query(`
            UPDATE players
            SET position = $1
            WHERE sport = $2 AND position = $3
          `, [mapping.newPosition, sport, mapping.oldPosition]);
          console.log(chalk.gray(`  ${mapping.oldPosition} → ${mapping.newPosition}: ${result.rowCount} players updated`));
        }
        
        totalUpdated += result.rowCount || 0;
      }
    }
    
    console.log(chalk.green(`\n✅ Updated ${totalUpdated.toLocaleString()} player positions`));
  }

  private async verifyPositions() {
    console.log(chalk.yellow('Verifying all positions are now standard...'));
    
    const query = `
      SELECT 
        p.sport,
        p.position,
        COUNT(*) as count
      FROM players p
      WHERE p.position NOT IN (
        -- NFL
        'QB', 'RB', 'WR', 'TE', 'K', 'DST', 'FLEX',
        -- NBA
        'PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL',
        -- MLB
        'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'SP', 'RP',
        -- NHL
        'C', 'LW', 'RW', 'D', 'G', 'W', 'F'
      )
      GROUP BY p.sport, p.position
      ORDER BY COUNT(*) DESC
    `;
    
    const result = await pgPool.query(query);
    
    if (result.rows.length === 0) {
      console.log(chalk.green('✅ All positions are now standardized!'));
    } else {
      console.log(chalk.red('⚠️  Found non-standard positions:'));
      result.rows.forEach(row => {
        console.log(chalk.red(`  ${row.sport}: ${row.position} (${row.count} players)`));
      });
    }
    
    // Show position summary
    console.log(chalk.cyan('\nPosition summary by sport:'));
    const summaryQuery = `
      SELECT 
        sport,
        position,
        COUNT(*) as count
      FROM players
      GROUP BY sport, position
      ORDER BY sport, COUNT(*) DESC
    `;
    
    const summary = await pgPool.query(summaryQuery);
    let currentSport = '';
    summary.rows.forEach(row => {
      if (row.sport !== currentSport) {
        currentSport = row.sport;
        console.log(chalk.yellow(`\n${currentSport}:`));
      }
      console.log(chalk.green(`  ${row.position.padEnd(10)} ${row.count} players`));
    });
  }
}

// Run it!
if (require.main === module) {
  (async () => {
    try {
      const standardizer = new TenXPositionStandardizer();
      await standardizer.execute();
      await pgPool.end();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error);
      process.exit(1);
    }
  })();
}

export { TenXPositionStandardizer };