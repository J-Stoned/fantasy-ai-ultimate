#!/usr/bin/env tsx
/**
 * Comprehensive analysis of remaining NFL coverage gaps - with checkpointing
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GameIssue {
  id: number;
  external_id: string;
  date: string;
  score: string;
  issue: string;
  fixable: boolean;
}

interface Checkpoint {
  processedGames: number;
  gamesWithStats: number;
  gamesWithoutStats: number[];
  lastProcessedId?: number;
  timestamp: string;
}

const CHECKPOINT_FILE = './gap-analysis-checkpoint.json';
const BATCH_SIZE = 100;

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    }
  } catch (error) {
    console.log('No checkpoint found, starting fresh');
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

async function analyzeRemainingGaps() {
  console.log(chalk.bold.cyan('\n🔍 COMPREHENSIVE NFL COVERAGE GAP ANALYSIS (WITH CHECKPOINTS)\n'));

  try {
    // Load checkpoint if exists
    let checkpoint = loadCheckpoint();
    let gamesWithStats = checkpoint?.gamesWithStats || 0;
    let gamesWithoutStats = checkpoint?.gamesWithoutStats || [];
    let processedCount = checkpoint?.processedGames || 0;

    // 1. Get accurate coverage counts
    console.log(chalk.yellow('1. Current Coverage Analysis:'));
    
    // Get ALL NFL games (not just 2024)
    const { data: allNFLGames, count: totalCount } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_score, away_score', { count: 'exact' })
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .neq('home_score', 0)
      .neq('away_score', 0)
      .lte('start_time', new Date().toISOString())
      .order('id', { ascending: true });
    
    console.log(`Total completed NFL games: ${totalCount || 0}`);
    
    if (!allNFLGames) {
      console.error('No games found');
      return;
    }

    // Process in batches, skip already processed
    const gamesToProcess = checkpoint?.lastProcessedId 
      ? allNFLGames.filter(g => g.id > checkpoint.lastProcessedId)
      : allNFLGames;

    console.log(`Games to process: ${gamesToProcess.length} (already processed: ${processedCount})`);
    
    // Check each for stats in batches
    for (let i = 0; i < gamesToProcess.length; i += BATCH_SIZE) {
      const batch = gamesToProcess.slice(i, i + BATCH_SIZE);
      
      for (const game of batch) {
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id);
        
        if (count && count > 0) {
          gamesWithStats++;
        } else {
          gamesWithoutStats.push(game.id);
        }
        processedCount++;
      }
      
      // Save checkpoint after each batch
      const newCheckpoint: Checkpoint = {
        processedGames: processedCount,
        gamesWithStats,
        gamesWithoutStats,
        lastProcessedId: batch[batch.length - 1].id,
        timestamp: new Date().toISOString()
      };
      saveCheckpoint(newCheckpoint);
      
      const progress = ((processedCount / allNFLGames.length) * 100).toFixed(1);
      console.log(`Progress: ${processedCount}/${allNFLGames.length} (${progress}%) - Games with stats: ${gamesWithStats}`);
    }
    
    const totalGames = allNFLGames.length;
    const coveragePercent = ((gamesWithStats / totalGames) * 100).toFixed(1);
    
    console.log(`\nFinal Results:`);
    console.log(`Games with stats: ${gamesWithStats}`);
    console.log(`Games without stats: ${gamesWithoutStats.length}`);
    console.log(chalk.bold.yellow(`Current NFL Coverage: ${coveragePercent}%`));
    
    // 2. Industry standards
    console.log(chalk.yellow('\n2. Industry Standards:'));
    console.log('  95%+ = Gold standard (FanDuel, DraftKings)');
    console.log('  90%+ = Professional grade');
    console.log('  85%+ = Acceptable minimum');
    console.log('  <85% = Inadequate for betting/analytics');
    
    if (parseFloat(coveragePercent) < 95) {
      const gapsTo95 = Math.ceil(totalGames * 0.95) - gamesWithStats;
      console.log(chalk.red(`  Need ${gapsTo95} more games for 95% coverage`));
    }
    
    // 3. Get details for games without stats
    console.log(chalk.yellow('\n3. Fetching details for games without stats...'));
    
    const gamesWithoutStatsDetails = [];
    for (let i = 0; i < gamesWithoutStats.length; i += 100) {
      const batch = gamesWithoutStats.slice(i, i + 100);
      const { data } = await supabase
        .from('games')
        .select('id, external_id, start_time, home_score, away_score')
        .in('id', batch);
      
      if (data) {
        gamesWithoutStatsDetails.push(...data);
      }
    }
    
    // 4. Test sample games
    console.log(chalk.yellow('\n4. Testing sample games with ESPN API...'));
    
    const samplesToTest = gamesWithoutStatsDetails.slice(0, 10);
    const issues: GameIssue[] = [];
    
    for (const game of samplesToTest) {
      const espnId = game.external_id?.replace(/^(?:espn_)?(?:nfl_|nba_|mlb_|nhl_)/, '');
      
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
          {
            params: { event: espnId },
            timeout: 5000
          }
        );
        
        if (response.status === 200 && response.data.boxscore?.players) {
          let playerCount = 0;
          response.data.boxscore.players.forEach((team: any) => {
            team.statistics?.forEach((cat: any) => {
              playerCount += cat.athletes?.length || 0;
            });
          });
          
          issues.push({
            id: game.id,
            external_id: game.external_id,
            date: game.start_time.split('T')[0],
            score: `${game.home_score}-${game.away_score}`,
            issue: playerCount > 0 ? 'ESPN has data - collector failed' : 'ESPN has no player data',
            fixable: playerCount > 0
          });
        } else {
          issues.push({
            id: game.id,
            external_id: game.external_id,
            date: game.start_time.split('T')[0],
            score: `${game.home_score}-${game.away_score}`,
            issue: 'ESPN API no boxscore',
            fixable: false
          });
        }
      } catch (error: any) {
        issues.push({
          id: game.id,
          external_id: game.external_id,
          date: game.start_time.split('T')[0],
          score: `${game.home_score}-${game.away_score}`,
          issue: `ESPN error: ${error.response?.status || error.message}`,
          fixable: error.response?.status !== 404
        });
      }
      
      console.log(`  Tested game ${game.id}...`);
    }
    
    // 5. Summary of findings
    console.log(chalk.yellow('\n5. Issue Summary:'));
    
    const fixableCount = issues.filter(i => i.fixable).length;
    const unfixableCount = issues.filter(i => !i.fixable).length;
    const extrapolatedFixable = Math.round((fixableCount / samplesToTest.length) * gamesWithoutStats.length);
    
    console.log(`Sample tested: ${samplesToTest.length} games`);
    console.log(`Fixable issues: ${fixableCount} (${(fixableCount/samplesToTest.length*100).toFixed(0)}%)`);
    console.log(`Unfixable issues: ${unfixableCount} (${(unfixableCount/samplesToTest.length*100).toFixed(0)}%)`);
    console.log(`Estimated fixable games: ~${extrapolatedFixable} of ${gamesWithoutStats.length}`);
    
    const potentialCoverage = ((gamesWithStats + extrapolatedFixable) / totalGames * 100).toFixed(1);
    console.log(chalk.bold.green(`\nPotential coverage after fixes: ${potentialCoverage}%`));
    
    // Save final report
    const report = {
      summary: {
        totalGames,
        gamesWithStats,
        gamesWithoutStats: gamesWithoutStats.length,
        currentCoverage: coveragePercent,
        potentialCoverage,
        fixableGames: extrapolatedFixable
      },
      sampleIssues: issues,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('./nfl-gap-analysis-report.json', JSON.stringify(report, null, 2));
    console.log(chalk.green('\n📄 Report saved to nfl-gap-analysis-report.json'));
    
    // Clean up checkpoint
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
    }
    
    // 6. Recommendations
    console.log(chalk.bold.cyan('\n🎯 RECOMMENDATIONS:'));
    
    if (parseFloat(potentialCoverage) >= 95) {
      console.log(chalk.green('✅ Can achieve 95%+ coverage by fixing identified issues'));
      console.log('Actions:');
      console.log('  1. Rerun collector on fixable games');
      console.log('  2. Add better error handling for edge cases');
      console.log('  3. Implement retry logic for transient failures');
    } else if (parseFloat(potentialCoverage) >= 90) {
      console.log(chalk.yellow('🟡 Can achieve 90%+ coverage (professional grade)'));
      console.log('Actions:');
      console.log('  1. Fix all fixable issues');
      console.log('  2. Research alternative data sources for older games');
      console.log('  3. Consider 90%+ as acceptable for launch');
    } else {
      console.log(chalk.red('🔴 Need additional data sources to reach professional standards'));
      console.log('Actions:');
      console.log('  1. Investigate alternative APIs');
      console.log('  2. Focus on recent seasons (2022+) for higher coverage');
      console.log('  3. Consider purchasing historical data');
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

analyzeRemainingGaps();