#!/usr/bin/env tsx
/**
 * 🔍 IDENTIFY MISSING NBA GAMES - Find the exact 24 games we need for 95%
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

interface MissingGame {
  id: number;
  external_id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  home_score: number;
  away_score: number;
  status: string;
}

async function identifyMissingNBAGames() {
  console.log(chalk.bold.cyan('\n🔍 IDENTIFYING MISSING NBA GAMES FOR 95% COVERAGE\n'));
  
  try {
    // 1. Get all 2024 NBA games with scores
    const { data: allGames, count: totalGames } = await supabase
      .from('games')
      .select('*')
      .eq('sport_id', 'nba')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false });
    
    if (!allGames || !totalGames) {
      console.error('No NBA games found');
      return;
    }
    
    console.log(chalk.yellow(`Total 2024 NBA games: ${totalGames}`));
    
    // 2. Check which games have stats
    const missingGames: MissingGame[] = [];
    let gamesWithStats = 0;
    
    console.log(chalk.gray('Checking each game for stats...'));
    
    for (const game of allGames) {
      const { count: statCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1);
      
      if (!statCount || statCount === 0) {
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
        
        missingGames.push({
          id: game.id,
          external_id: game.external_id,
          home_team: homeTeam?.name || 'Unknown',
          away_team: awayTeam?.name || 'Unknown',
          start_time: game.start_time,
          home_score: game.home_score,
          away_score: game.away_score,
          status: game.status
        });
      } else {
        gamesWithStats++;
      }
    }
    
    // 3. Calculate coverage
    const currentCoverage = ((gamesWithStats / totalGames) * 100).toFixed(1);
    const targetGames = Math.ceil(totalGames * 0.95);
    const gamesNeeded = targetGames - gamesWithStats;
    
    console.log(chalk.bold.yellow('\n📊 NBA COVERAGE ANALYSIS:'));
    console.log(`Current coverage: ${gamesWithStats}/${totalGames} (${currentCoverage}%)`);
    console.log(`Target (95%): ${targetGames}/${totalGames}`);
    console.log(`Games needed: ${gamesNeeded}`);
    console.log(`Missing games found: ${missingGames.length}`);
    
    // 4. Analyze missing games by date
    const missingByMonth = missingGames.reduce((acc, game) => {
      const month = new Date(game.start_time).toISOString().substring(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(chalk.cyan('\n📅 Missing games by month:'));
    Object.entries(missingByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, count]) => {
        console.log(`  ${month}: ${count} games`);
      });
    
    // 5. Show first 30 missing games
    console.log(chalk.bold.green(`\n🎯 FIRST ${Math.min(30, gamesNeeded)} GAMES TO COLLECT:`));
    
    const gamesToCollect = missingGames.slice(0, Math.min(30, gamesNeeded));
    gamesToCollect.forEach((game, idx) => {
      const date = new Date(game.start_time).toLocaleDateString();
      console.log(
        `${idx + 1}. ${date} - ${game.away_team} @ ${game.home_team} ` +
        `(${game.away_score}-${game.home_score}) [ID: ${game.id}, ESPN: ${game.external_id}]`
      );
    });
    
    // 6. Save missing games to file
    const outputData = {
      sport: 'NBA',
      currentCoverage: parseFloat(currentCoverage),
      targetCoverage: 95,
      totalGames,
      gamesWithStats,
      gamesNeeded,
      missingGames: gamesToCollect,
      analysis: {
        byMonth: missingByMonth,
        totalMissing: missingGames.length,
        recommendation: gamesNeeded <= 30 
          ? 'Can achieve 95% with single batch collection'
          : 'Will need multiple collection runs'
      }
    };
    
    fs.writeFileSync(
      './nba-missing-games.json',
      JSON.stringify(outputData, null, 2)
    );
    
    console.log(chalk.green('\n✅ Missing games saved to nba-missing-games.json'));
    
    // 7. Recommendations
    console.log(chalk.bold.cyan('\n💡 RECOMMENDATIONS:'));
    console.log('1. These games are likely missing due to ESPN API gaps');
    console.log('2. Use MCP multi-source collector to fetch from alternative sources');
    console.log('3. Focus on recent games first as they have better data availability');
    console.log('4. Verify player IDs match before inserting stats');
    
    return outputData;
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Run the analysis
identifyMissingNBAGames();