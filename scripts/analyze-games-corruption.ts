#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE GAMES TABLE CORRUPTION
 * 
 * Deep analysis of games table to identify orphaned, corrupted, and empty games
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GameAnalysis {
  sport: string;
  totalGames: number;
  validGames: number;
  orphanedGames: number;
  emptyGames: number;
  brokenReferences: number;
  dateRange: { earliest: string; latest: string };
  issues: string[];
}

async function analyzeGamesCorruption() {
  console.log(chalk.cyan.bold('\n🔍 ANALYZING GAMES TABLE CORRUPTION\n'));
  
  try {
    // 1. Overall games statistics
    const { data: allGames, error: gamesError } = await supabase
      .from('games')
      .select('id, sport, home_team_id, away_team_id, start_time, home_score, away_score, status')
      .order('start_time');
    
    if (gamesError) throw gamesError;
    
    console.log(chalk.white(`📊 Total games in database: ${allGames?.length || 0}`));
    console.log('');
    
    // 2. Analysis by sport
    const sportAnalyses: GameAnalysis[] = [];
    const gamesBySport: { [key: string]: any[] } = {};
    
    allGames?.forEach(game => {
      const sport = game.sport || 'UNKNOWN';
      if (!gamesBySport[sport]) gamesBySport[sport] = [];
      gamesBySport[sport].push(game);
    });
    
    for (const [sport, games] of Object.entries(gamesBySport)) {
      console.log(chalk.cyan(`🏈 ${sport.toUpperCase()} GAMES ANALYSIS`));
      console.log(chalk.gray('═'.repeat(60)));
      
      let validGames = 0;
      let orphanedGames = 0;
      let emptyGames = 0;
      let brokenReferences = 0;
      const issues: string[] = [];
      
      // Check each game
      for (const game of games) {
        let isValid = true;
        
        // Check for null team references
        if (!game.home_team_id || !game.away_team_id) {
          brokenReferences++;
          isValid = false;
        }
        
        // Check for missing scores (completed games should have scores)
        if (game.status === 'completed' && (game.home_score === null || game.away_score === null)) {
          emptyGames++;
          isValid = false;
        }
        
        // Check if teams actually exist
        if (game.home_team_id) {
          const { data: homeTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('id', game.home_team_id)
            .single();
          
          if (!homeTeam) {
            orphanedGames++;
            isValid = false;
          }
        }
        
        if (game.away_team_id) {
          const { data: awayTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('id', game.away_team_id)
            .single();
          
          if (!awayTeam) {
            orphanedGames++;
            isValid = false;
          }
        }
        
        if (isValid) validGames++;
      }
      
      // Get date range
      const dates = games.map(g => g.start_time).filter(d => d);
      const earliest = dates.length > 0 ? dates[0] : 'N/A';
      const latest = dates.length > 0 ? dates[dates.length - 1] : 'N/A';
      
      // Check for stats coverage
      const { count: statsCount } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .in('game_id', games.map(g => g.id));
      
      const statsPerGame = games.length > 0 ? ((statsCount || 0) / games.length).toFixed(1) : '0';
      
      // Display results
      console.log(chalk.white(`   Total games: ${games.length}`));
      console.log(chalk.green(`   Valid games: ${validGames}`));
      console.log(chalk.red(`   Orphaned games: ${orphanedGames}`));
      console.log(chalk.yellow(`   Empty games: ${emptyGames}`));
      console.log(chalk.red(`   Broken references: ${brokenReferences}`));
      console.log(chalk.white(`   Date range: ${earliest} to ${latest}`));
      console.log(chalk.white(`   Stats per game: ${statsPerGame}`));
      
      // Add issues
      if (orphanedGames > 0) issues.push(`${orphanedGames} orphaned games`);
      if (emptyGames > 0) issues.push(`${emptyGames} empty games`);
      if (brokenReferences > 0) issues.push(`${brokenReferences} broken references`);
      
      if (issues.length > 0) {
        console.log(chalk.red('   🚨 Issues found:'));
        issues.forEach(issue => console.log(chalk.red(`     • ${issue}`)));
      }
      
      console.log('');
      
      sportAnalyses.push({
        sport,
        totalGames: games.length,
        validGames,
        orphanedGames,
        emptyGames,
        brokenReferences,
        dateRange: { earliest, latest },
        issues
      });
    }
    
    // 3. Player stats analysis
    console.log(chalk.yellow('📊 PLAYER STATS ANALYSIS'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    const { count: orphanedStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .is('game_id', null);
    
    const { count: validStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .not('game_id', 'is', null);
    
    console.log(chalk.white(`   Total player stats: ${totalStats || 0}`));
    console.log(chalk.green(`   Valid stats: ${validStats || 0}`));
    console.log(chalk.red(`   Orphaned stats: ${orphanedStats || 0}`));
    console.log('');
    
    // 4. Player game logs analysis
    console.log(chalk.yellow('📊 PLAYER GAME LOGS ANALYSIS'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: orphanedLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .is('game_id', null);
    
    console.log(chalk.white(`   Total game logs: ${totalLogs || 0}`));
    console.log(chalk.red(`   Orphaned logs: ${orphanedLogs || 0}`));
    console.log('');
    
    // 5. Summary and recommendations
    console.log(chalk.yellow('📋 CLEANUP RECOMMENDATIONS'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const totalOrphanedGames = sportAnalyses.reduce((sum, a) => sum + a.orphanedGames, 0);
    const totalEmptyGames = sportAnalyses.reduce((sum, a) => sum + a.emptyGames, 0);
    const totalBrokenRefs = sportAnalyses.reduce((sum, a) => sum + a.brokenReferences, 0);
    
    console.log(chalk.red(`🗑️  Games to delete: ${totalOrphanedGames + totalEmptyGames + totalBrokenRefs}`));
    console.log(chalk.red(`🗑️  Orphaned stats to delete: ${orphanedStats || 0}`));
    console.log(chalk.red(`🗑️  Orphaned logs to delete: ${orphanedLogs || 0}`));
    
    const recommendations = [
      'Run nuclear-games-cleanup.ts to remove orphaned and broken games',
      'Run nuclear-stats-cleanup.ts to remove orphaned player stats',
      'Focus on games within 2023-2025 date range for our target',
      'Validate all remaining games have proper team references',
      'Ensure all stats have valid game and player references'
    ];
    
    recommendations.forEach(rec => {
      console.log(chalk.white(`   • ${rec}`));
    });
    
    console.log(chalk.green('\n✅ Games corruption analysis complete!'));
    
    return {
      totalGames: allGames?.length || 0,
      totalOrphanedGames,
      totalEmptyGames,
      totalBrokenRefs,
      totalStats: totalStats || 0,
      orphanedStats: orphanedStats || 0,
      orphanedLogs: orphanedLogs || 0,
      sportAnalyses
    };
    
  } catch (error) {
    console.error(chalk.red('❌ Error analyzing games:'), error);
    throw error;
  }
}

// Run analysis
if (require.main === module) {
  analyzeGamesCorruption()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default analyzeGamesCorruption;