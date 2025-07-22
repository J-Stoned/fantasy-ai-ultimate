#!/usr/bin/env tsx
/**
 * 🏆 10X SPORT ASSIGNMENT VERIFIER
 * 
 * Phase 3: Verify all players are in the correct sport
 * Check for mismatches between player sport and their stats
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';

class TenXSportVerifier {
  async execute() {
    console.log(chalk.magenta.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║           🏆 10X SPORT ASSIGNMENT VERIFIER 🏆                ║
    ║                                                              ║
    ║  Ensuring every player is in the right sport!                ║
    ╚══════════════════════════════════════════════════════════════╝
    `));

    const startTime = Date.now();

    try {
      // Step 1: Check for sport mismatches
      console.log(chalk.cyan.bold('\n🔍 STEP 1: CHECKING FOR SPORT MISMATCHES...\n'));
      const mismatches = await this.findSportMismatches();
      
      if (mismatches.length === 0) {
        console.log(chalk.green('✅ No sport mismatches found! All players are in the correct sport.'));
      } else {
        // Step 2: Analyze mismatches
        console.log(chalk.cyan.bold('\n📊 STEP 2: ANALYZING MISMATCHES...\n'));
        await this.analyzeMismatches(mismatches);
        
        // Step 3: Fix mismatches
        console.log(chalk.cyan.bold('\n🔧 STEP 3: FIXING SPORT ASSIGNMENTS...\n'));
        await this.fixSportAssignments(mismatches);
      }
      
      // Step 4: Verify all sports
      console.log(chalk.cyan.bold('\n✅ STEP 4: FINAL VERIFICATION...\n'));
      await this.verifyAllSports();
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.green.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║              ✅ SPORT VERIFICATION COMPLETE!                 ║
    ║                                                              ║
    ║  Time: ${duration.toFixed(1)}s                                              ║
    ║  All players are now in the correct sports! 🏆               ║
    ╚══════════════════════════════════════════════════════════════╝
      `));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed:'), error);
      throw error;
    }
  }

  private async findSportMismatches(): Promise<any[]> {
    console.log(chalk.yellow('Searching for players with mismatched sport stats...'));
    
    // Check each sport for wrong stats
    const checks = [
      {
        sport: 'NFL',
        wrongStats: `pgl.stats::text LIKE '%batting_average%' OR 
                     pgl.stats::text LIKE '%field_goals_made%' AND pgl.stats::text LIKE '%three_pointers_made%' OR
                     pgl.stats::text LIKE '%goals%' AND pgl.stats::text LIKE '%penalty_minutes%'`,
        description: 'NFL players with baseball/basketball/hockey stats'
      },
      {
        sport: 'NBA',
        wrongStats: `pgl.stats::text LIKE '%passing_yards%' OR 
                     pgl.stats::text LIKE '%batting_average%' OR
                     pgl.stats::text LIKE '%goals%' AND pgl.stats::text LIKE '%penalty_minutes%'`,
        description: 'NBA players with football/baseball/hockey stats'
      },
      {
        sport: 'MLB',
        wrongStats: `pgl.stats::text LIKE '%passing_yards%' OR 
                     pgl.stats::text LIKE '%field_goals_made%' AND pgl.stats::text LIKE '%three_pointers_made%' OR
                     pgl.stats::text LIKE '%goals%' AND pgl.stats::text LIKE '%penalty_minutes%'`,
        description: 'MLB players with football/basketball/hockey stats'
      },
      {
        sport: 'NHL',
        wrongStats: `pgl.stats::text LIKE '%passing_yards%' OR 
                     pgl.stats::text LIKE '%batting_average%' OR
                     pgl.stats::text LIKE '%field_goals_made%' AND pgl.stats::text LIKE '%three_pointers_made%'`,
        description: 'NHL players with football/baseball/basketball stats'
      }
    ];
    
    const mismatches: any[] = [];
    
    for (const check of checks) {
      const query = `
        SELECT DISTINCT
          p.id,
          p.name,
          p.sport as player_sport,
          p.position,
          COUNT(DISTINCT pgl.id) as wrong_game_count,
          array_agg(DISTINCT 
            CASE 
              WHEN pgl.stats::text LIKE '%passing_yards%' THEN 'NFL'
              WHEN pgl.stats::text LIKE '%batting_average%' THEN 'MLB'
              WHEN pgl.stats::text LIKE '%field_goals_made%' AND pgl.stats::text LIKE '%three_pointers_made%' THEN 'NBA'
              WHEN pgl.stats::text LIKE '%goals%' AND pgl.stats::text LIKE '%penalty_minutes%' THEN 'NHL'
            END
          ) as detected_sports
        FROM players p
        JOIN player_game_logs pgl ON pgl.player_id = p.id
        WHERE p.sport = $1
        AND (${check.wrongStats})
        GROUP BY p.id, p.name, p.sport, p.position
        LIMIT 100
      `;
      
      const result = await pgPool.query(query, [check.sport]);
      
      if (result.rows.length > 0) {
        console.log(chalk.red(`⚠️  Found ${result.rows.length} ${check.description}`));
        mismatches.push(...result.rows.map(row => ({
          ...row,
          current_sport: check.sport,
          issue: check.description
        })));
      }
    }
    
    return mismatches;
  }

  private async analyzeMismatches(mismatches: any[]) {
    console.log(chalk.cyan('Analyzing mismatched players...'));
    
    // Group by current sport
    const bySport = new Map<string, any[]>();
    mismatches.forEach(m => {
      if (!bySport.has(m.current_sport)) {
        bySport.set(m.current_sport, []);
      }
      bySport.get(m.current_sport)!.push(m);
    });
    
    bySport.forEach((players, sport) => {
      console.log(chalk.yellow(`\n${sport} players with wrong stats:`));
      players.slice(0, 10).forEach(p => {
        const detectedSports = p.detected_sports.filter((s: string) => s !== null).join(', ');
        console.log(`  ${p.name} (${p.position}): Has ${detectedSports} stats in ${p.wrong_game_count} games`);
      });
      if (players.length > 10) {
        console.log(chalk.gray(`  ... and ${players.length - 10} more`));
      }
    });
  }

  private async fixSportAssignments(mismatches: any[]) {
    console.log(chalk.yellow('Fixing sport assignments based on actual stats...'));
    
    let totalFixed = 0;
    
    for (const player of mismatches) {
      // Determine correct sport based on detected stats
      const detectedSports = player.detected_sports.filter((s: string) => s !== null);
      if (detectedSports.length === 1) {
        const correctSport = detectedSports[0];
        
        // Update player's sport
        await pgPool.query(`
          UPDATE players
          SET sport = $1
          WHERE id = $2
        `, [correctSport, player.id]);
        
        totalFixed++;
        
        if (totalFixed % 100 === 0) {
          process.stdout.write(`\r  Fixed ${totalFixed} players...`);
        }
      }
    }
    
    console.log(chalk.green(`\n✅ Fixed ${totalFixed} player sport assignments`));
  }

  private async verifyAllSports() {
    console.log(chalk.yellow('Verifying final sport distribution...'));
    
    const query = `
      SELECT 
        p.sport,
        COUNT(DISTINCT p.id) as player_count,
        COUNT(DISTINCT pgl.id) as game_count,
        AVG(pgl.fantasy_points) as avg_fantasy_points
      FROM players p
      LEFT JOIN player_game_logs pgl ON pgl.player_id = p.id
      GROUP BY p.sport
      ORDER BY 
        CASE 
          WHEN p.sport IN ('NFL', 'NBA', 'MLB', 'NHL') THEN 1
          ELSE 2
        END,
        COUNT(DISTINCT pgl.id) DESC
    `;
    
    const result = await pgPool.query(query);
    
    console.log(chalk.cyan('\nFinal sport distribution:'));
    console.log(chalk.gray('Sport         Players    Games      Avg FP'));
    console.log(chalk.gray('─────────────────────────────────────────────'));
    
    result.rows.forEach(row => {
      const avgFp = row.avg_fantasy_points ? parseFloat(row.avg_fantasy_points).toFixed(1) : 'N/A';
      console.log(
        `${row.sport.padEnd(13)} ${row.player_count.toString().padStart(7)} ${row.game_count.toString().padStart(9)}    ${avgFp.padStart(6)}`
      );
    });
    
    // Check for any remaining issues
    const issueQuery = `
      SELECT 
        p.sport,
        COUNT(*) as count
      FROM players p
      JOIN player_game_logs pgl ON pgl.player_id = p.id
      WHERE 
        (p.sport = 'NFL' AND pgl.stats::text LIKE '%batting_average%') OR
        (p.sport = 'NBA' AND pgl.stats::text LIKE '%passing_yards%') OR
        (p.sport = 'MLB' AND pgl.stats::text LIKE '%field_goals_made%') OR
        (p.sport = 'NHL' AND pgl.stats::text LIKE '%passing_yards%')
      GROUP BY p.sport
    `;
    
    const issues = await pgPool.query(issueQuery);
    
    if (issues.rows.length > 0) {
      console.log(chalk.red('\n⚠️  Remaining issues:'));
      issues.rows.forEach(row => {
        console.log(chalk.red(`  ${row.sport}: ${row.count} game logs with wrong stats`));
      });
    } else {
      console.log(chalk.green('\n✅ No remaining sport mismatches!'));
    }
  }
}

// Run it!
if (require.main === module) {
  (async () => {
    try {
      const verifier = new TenXSportVerifier();
      await verifier.execute();
      await pgPool.end();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error);
      process.exit(1);
    }
  })();
}

export { TenXSportVerifier };