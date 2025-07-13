#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE NFL COVERAGE GAP - Why is it 68.8% not 99.5%?
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateNFLCoverageGap() {
  console.log(chalk.bold.cyan('\n🔍 INVESTIGATING NFL COVERAGE GAP\n'));
  
  try {
    // 1. Check what the collector reported
    console.log(chalk.yellow('Checking collector report...'));
    
    if (fs.existsSync('./nfl-coverage-report-v4.json')) {
      const report = JSON.parse(fs.readFileSync('./nfl-coverage-report-v4.json', 'utf-8'));
      console.log('Collector reported:');
      console.log(`  Coverage: ${report.coverage}%`);
      console.log(`  Games with stats: ${report.gamesWithStats}/${report.totalGames}`);
      console.log(`  Players matched: ${report.successfulMatches}`);
    } else {
      console.log(chalk.red('No collector report found'));
    }
    
    // 2. Check actual database
    console.log(chalk.yellow('\nChecking actual database...'));
    
    const { data: nflGames, count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null);
    
    console.log(`Total NFL 2024 games: ${totalGames}`);
    
    if (!nflGames) return;
    
    // 3. Count games with actual stats
    let gamesWithStats = 0;
    let gamesWithoutStats = 0;
    const missingStatGames = [];
    
    console.log(chalk.gray('Checking each game for stats...'));
    
    for (const game of nflGames) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1);
      
      if (count && count > 0) {
        gamesWithStats++;
      } else {
        gamesWithoutStats++;
        if (missingStatGames.length < 10) {
          missingStatGames.push({
            id: game.id,
            external_id: game.external_id,
            date: new Date(game.start_time).toLocaleDateString(),
            home_team_id: game.home_team_id,
            away_team_id: game.away_team_id
          });
        }
      }
    }
    
    const actualCoverage = ((gamesWithStats / totalGames!) * 100).toFixed(1);
    
    console.log(chalk.bold.yellow('\n📊 ACTUAL DATABASE STATS:'));
    console.log(`Games with stats: ${gamesWithStats}`);
    console.log(`Games without stats: ${gamesWithoutStats}`);
    console.log(`Actual coverage: ${actualCoverage}%`);
    
    // 4. Show sample missing games
    console.log(chalk.red('\nSample games missing stats:'));
    for (const game of missingStatGames) {
      // Get team names
      const { data: homeTeam } = await supabase
        .from('teams')
        .select('name')
        .eq('id', game.home_team_id)
        .single();
      
      const { data: awayTeam } = await supabase
        .from('teams')
        .select('name')
        .eq('id', game.away_team_id)
        .single();
      
      console.log(`  ${game.date}: ${awayTeam?.name || 'Unknown'} @ ${homeTeam?.name || 'Unknown'} (ID: ${game.id})`);
    }
    
    // 5. Check for partial stats
    console.log(chalk.yellow('\nChecking for games with partial stats...'));
    
    let partialStatsGames = 0;
    let fullStatsGames = 0;
    
    for (const game of nflGames.slice(0, 50)) { // Check first 50
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count) {
        if (count > 0 && count < 20) {
          partialStatsGames++;
        } else if (count >= 20) {
          fullStatsGames++;
        }
      }
    }
    
    console.log(`Games with partial stats (<20 players): ${partialStatsGames}`);
    console.log(`Games with full stats (20+ players): ${fullStatsGames}`);
    
    // 6. Check date patterns
    console.log(chalk.yellow('\nAnalyzing missing games by month...'));
    
    const missingByMonth: Record<string, number> = {};
    
    for (const game of nflGames) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1);
      
      if (!count || count === 0) {
        const month = new Date(game.start_time).toISOString().substring(0, 7);
        missingByMonth[month] = (missingByMonth[month] || 0) + 1;
      }
    }
    
    console.log('Missing games by month:');
    Object.entries(missingByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, count]) => {
        console.log(`  ${month}: ${count} games`);
      });
    
    // 7. Gap analysis
    console.log(chalk.bold.red('\n🚨 GAP ANALYSIS:'));
    console.log(`Collector claimed: 99.5% (430/432 games)`);
    console.log(`Database reality: ${actualCoverage}% (${gamesWithStats}/${totalGames} games)`);
    console.log(`Missing games: ${gamesWithoutStats}`);
    console.log(`Gap: ${(99.5 - parseFloat(actualCoverage)).toFixed(1)}%`);
    
    // 8. Possible causes
    console.log(chalk.cyan('\n💡 POSSIBLE CAUSES:'));
    console.log('1. Stats were collected but not saved to database');
    console.log('2. Database insert errors during collection');
    console.log('3. Player matching failed for many games');
    console.log('4. Collector counted games differently than database query');
    console.log('5. Some games were deleted after collection');
    
    // 9. Recommendation
    console.log(chalk.bold.green('\n✅ RECOMMENDATION:'));
    console.log('1. Re-run NFL collector with better error handling');
    console.log('2. Add verification after each game insert');
    console.log('3. Use smaller batch sizes for inserts');
    console.log('4. Check for games in early 2024 season (Jan-Aug)');
    
    // Save investigation results
    const investigation = {
      timestamp: new Date().toISOString(),
      collectorReport: {
        coverage: '99.5%',
        gamesWithStats: 430,
        totalGames: 432
      },
      databaseReality: {
        coverage: actualCoverage + '%',
        gamesWithStats,
        totalGames,
        gamesWithoutStats
      },
      gap: gamesWithoutStats,
      missingByMonth,
      sampleMissingGames: missingStatGames
    };
    
    fs.writeFileSync(
      './nfl-coverage-investigation.json',
      JSON.stringify(investigation, null, 2)
    );
    
    console.log(chalk.green('\n✅ Investigation saved to nfl-coverage-investigation.json'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

investigateNFLCoverageGap();