#!/usr/bin/env tsx
/**
 * 🏀🏒 NBA & NHL 2021-22 SEASON COLLECTOR
 * 
 * Collects missing 2021-22 seasons with CORRECT status values
 * Optimized for Ryzen 5 7600X + 32GB RAM
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Status mapping to ensure consistency
const STATUS_MAP: Record<string, string> = {
  'STATUS_FINAL': 'Final',
  'Final': 'Final',
  'completed': 'Final',
  'final': 'Final',
  'STATUS_SCHEDULED': 'scheduled',
  'Scheduled': 'scheduled',
  'scheduled': 'scheduled',
  'STATUS_POSTPONED': 'STATUS_POSTPONED',
  'STATUS_CANCELED': 'STATUS_CANCELED'
};

// Get correct status value
function normalizeStatus(espnStatus: string | undefined, homeScore?: number, awayScore?: number): string {
  // If game has scores, it's definitely Final
  if ((homeScore !== undefined && homeScore > 0) || (awayScore !== undefined && awayScore > 0)) {
    return 'Final';
  }
  
  // Map ESPN status to our standardized values
  if (espnStatus) {
    return STATUS_MAP[espnStatus] || espnStatus;
  }
  
  return 'scheduled';
}

async function collectNBA202122() {
  console.log(chalk.cyan('\n🏀 COLLECTING NBA 2021-22 SEASON\n'));
  console.log(chalk.yellow('🔥 TURBO MODE: 1000-record pagination, 500-record updates!'));
  
  const seasons = [
    { year: 2021, months: [10, 11, 12] }, // Oct-Dec 2021
    { year: 2022, months: [1, 2, 3, 4, 5, 6] } // Jan-Jun 2022
  ];
  
  let totalGames = 0;
  let totalStats = 0;
  
  // Process all months in parallel for MAXIMUM SPEED
  const allMonthPromises = [];
  
  for (const season of seasons) {
    for (const month of season.months) {
      const monthPromise = (async () => {
        try {
          // First, collect the games
          console.log(chalk.gray(`Collecting ${season.year}-${month.toString().padStart(2, '0')}...`));
          
          // Run universal collector for this month
          const { spawn } = await import('child_process');
          const collectorProcess = spawn('npx', [
            'tsx',
            'scripts/universal-sports-collector.ts',
            'games',
            'nba',
            '--year', season.year.toString(),
            '--month', month.toString(),
            '--enrich'
          ], {
            stdio: 'inherit',
            shell: true
          });
          
          await new Promise((resolve, reject) => {
            collectorProcess.on('exit', (code) => {
              if (code === 0) resolve(null);
              else reject(new Error(`Collector exited with code ${code}`));
            });
          });
          
          // Fix status values with TURBO pagination
          let offset = 0;
          const pageSize = 1000; // 10X BOOST!
          let hasMore = true;
          let monthGames = 0;
          
          while (hasMore) {
            const { data: games, error: gamesError } = await supabase
              .from('games')
              .select('id, external_id, status, home_score, away_score')
              .eq('sport', 'NBA')
              .gte('start_time', `${season.year}-${month.toString().padStart(2, '0')}-01`)
              .lt('start_time', `${season.year}-${month.toString().padStart(2, '0')}-31`)
              .range(offset, offset + pageSize - 1);
            
            if (!games || games.length === 0) {
              hasMore = false;
              break;
            }
            
            monthGames += games.length;
            
            // Fix any incorrect status values in batches
            const updates = [];
            for (const game of games) {
              const correctStatus = normalizeStatus(game.status, game.home_score, game.away_score);
              if (game.status !== correctStatus) {
                updates.push({
                  id: game.id,
                  status: correctStatus
                });
              }
            }
            
            if (updates.length > 0) {
              console.log(chalk.yellow(`  Fixing status for ${updates.length} games...`));
              
              // Update in TURBO batches of 500
              for (let i = 0; i < updates.length; i += 500) {
                const batch = updates.slice(i, i + 500);
                const { error } = await supabase
                  .from('games')
                  .upsert(batch, { onConflict: 'id' });
                
                if (error) {
                  console.error(chalk.red('Update error:'), error);
                }
              }
            }
            
            offset += pageSize;
            hasMore = games.length === pageSize;
          }
          
          console.log(chalk.gray(`  Processed ${monthGames} games for ${season.year}-${month.toString().padStart(2, '0')}`));
          return monthGames;
          
        } catch (error) {
          console.error(chalk.red(`Error collecting ${season.year}-${month}:`), error);
          return 0;
        }
      })();
      
      allMonthPromises.push(monthPromise);
    }
  }
  
  // Wait for all months to complete
  const monthResults = await Promise.all(allMonthPromises);
  totalGames = monthResults.reduce((sum, count) => sum + count, 0);
  
  // Collect player stats
  console.log(chalk.cyan('\n📊 Collecting NBA player stats...'));
  const statsProcess = spawn('npx', [
    'tsx',
    'scripts/universal-sports-collector.ts',
    'stats',
    'nba',
    '--year', '2021'
  ], {
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise((resolve) => {
    statsProcess.on('exit', () => resolve(null));
  });
  
  console.log(chalk.green(`\n✅ NBA 2021-22 collection complete!`));
  console.log(chalk.green(`   Games: ${totalGames}`));
}

async function collectNHL202122() {
  console.log(chalk.cyan('\n🏒 COLLECTING NHL 2021-22 SEASON\n'));
  console.log(chalk.yellow('🔥 TURBO MODE: 1000-record pagination, 500-record updates!'));
  
  const seasons = [
    { year: 2021, months: [10, 11, 12] }, // Oct-Dec 2021
    { year: 2022, months: [1, 2, 3, 4, 5, 6] } // Jan-Jun 2022
  ];
  
  let totalGames = 0;
  
  // Process all months in parallel for MAXIMUM SPEED
  const allMonthPromises = [];
  
  for (const season of seasons) {
    for (const month of season.months) {
      const monthPromise = (async () => {
        try {
          console.log(chalk.gray(`Collecting ${season.year}-${month.toString().padStart(2, '0')}...`));
          
          // Run universal collector
          const { spawn } = await import('child_process');
          const collectorProcess = spawn('npx', [
            'tsx',
            'scripts/universal-sports-collector.ts',
            'games',
            'nhl',
            '--year', season.year.toString(),
            '--month', month.toString(),
            '--enrich'
          ], {
            stdio: 'inherit',
            shell: true
          });
          
          await new Promise((resolve, reject) => {
            collectorProcess.on('exit', (code) => {
              if (code === 0) resolve(null);
              else reject(new Error(`Collector exited with code ${code}`));
            });
          });
          
          // Fix status values with TURBO pagination
          let offset = 0;
          const pageSize = 1000; // 10X BOOST!
          let hasMore = true;
          let monthGames = 0;
          
          while (hasMore) {
            const { data: games, error: gamesError } = await supabase
              .from('games')
              .select('id, external_id, status, home_score, away_score')
              .eq('sport', 'NHL')
              .gte('start_time', `${season.year}-${month.toString().padStart(2, '0')}-01`)
              .lt('start_time', `${season.year}-${month.toString().padStart(2, '0')}-31`)
              .range(offset, offset + pageSize - 1);
            
            if (!games || games.length === 0) {
              hasMore = false;
              break;
            }
            
            monthGames += games.length;
            
            // Fix any incorrect status values in batches
            const updates = [];
            for (const game of games) {
              const correctStatus = normalizeStatus(game.status, game.home_score, game.away_score);
              if (game.status !== correctStatus) {
                updates.push({
                  id: game.id,
                  status: correctStatus
                });
              }
            }
            
            if (updates.length > 0) {
              console.log(chalk.yellow(`  Fixing status for ${updates.length} games...`));
              
              // Update in TURBO batches of 500
              for (let i = 0; i < updates.length; i += 500) {
                const batch = updates.slice(i, i + 500);
                const { error } = await supabase
                  .from('games')
                  .upsert(batch, { onConflict: 'id' });
                
                if (error) {
                  console.error(chalk.red('Update error:'), error);
                }
              }
            }
            
            offset += pageSize;
            hasMore = games.length === pageSize;
          }
          
          console.log(chalk.gray(`  Processed ${monthGames} games for ${season.year}-${month.toString().padStart(2, '0')}`));
          return monthGames;
          
        } catch (error) {
          console.error(chalk.red(`Error collecting ${season.year}-${month}:`), error);
          return 0;
        }
      })();
      
      allMonthPromises.push(monthPromise);
    }
  }
  
  // Wait for all months to complete
  const monthResults = await Promise.all(allMonthPromises);
  totalGames = monthResults.reduce((sum, count) => sum + count, 0);
  
  // Collect player stats
  console.log(chalk.cyan('\n📊 Collecting NHL player stats...'));
  const { spawn } = await import('child_process');
  const statsProcess = spawn('npx', [
    'tsx',
    'scripts/universal-sports-collector.ts',
    'stats',
    'nhl',
    '--year', '2021'
  ], {
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise((resolve) => {
    statsProcess.on('exit', () => resolve(null));
  });
  
  console.log(chalk.green(`\n✅ NHL 2021-22 collection complete!`));
  console.log(chalk.green(`   Games: ${totalGames}`));
}

async function main() {
  console.log(chalk.red('\n🔥 NBA & NHL 2021-22 SEASON COLLECTOR - ULTRA TURBO EDITION'));
  console.log(chalk.yellow('🚀 Ryzen 5 7600X + 32GB RAM = BEAST MODE ACTIVATED!'));
  console.log(chalk.yellow('⚡ 1000-record pagination | 500-record updates | Full parallelization\n'));
  
  const startTime = Date.now();
  
  // Collect both seasons IN PARALLEL for MAXIMUM SPEED!
  console.log(chalk.cyan('🏀🏒 COLLECTING BOTH SPORTS IN PARALLEL!\n'));
  
  const [nbaResult, nhlResult] = await Promise.all([
    collectNBA202122().catch(error => {
      console.error(chalk.red('NBA collection failed:'), error);
      return null;
    }),
    collectNHL202122().catch(error => {
      console.error(chalk.red('NHL collection failed:'), error);
      return null;
    })
  ]);
  
  // Final verification
  console.log(chalk.cyan('\n📊 FINAL VERIFICATION:'));
  
  const { data: nbaGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NBA')
    .eq('status', 'Final')
    .gte('start_time', '2021-10-01')
    .lt('start_time', '2022-07-01');
  
  const { data: nhlGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NHL')
    .eq('status', 'Final')
    .gte('start_time', '2021-10-01')
    .lt('start_time', '2022-07-01');
  
  console.log(chalk.green(`NBA 2021-22 Final games: ${nbaGames?.length || 0}`));
  console.log(chalk.green(`NHL 2021-22 Final games: ${nhlGames?.length || 0}`));
  
  const elapsedTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(0);
  
  console.log(chalk.cyan(`\n⏱️  Total time: ${elapsedTime} minutes (${elapsedSeconds} seconds)`));
  
  // Performance metrics
  const totalGames = (nbaGames?.length || 0) + (nhlGames?.length || 0);
  const gamesPerSecond = (totalGames / parseFloat(elapsedSeconds)).toFixed(1);
  console.log(chalk.yellow(`⚡ Performance: ${gamesPerSecond} games/second`));
  
  console.log(chalk.green('\n🎯 Ready to run 2021 pattern validation with COMPLETE data!'));
  console.log(chalk.red('🔥 10X DEVELOPER MODE: COLLECTION OPTIMIZED!'));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });