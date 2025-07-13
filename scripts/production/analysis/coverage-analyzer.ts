#!/usr/bin/env tsx
/**
 * Universal Coverage Analyzer - Consolidates 66+ Coverage Scripts
 * 
 * This analyzer consolidates all "truth", "reality", "actual", "fast", "accurate" 
 * coverage checking scripts into a single comprehensive tool that provides
 * detailed analysis across all sports with multiple output formats.
 * 
 * Replaces scripts like:
 * - check-true-coverage.ts
 * - nba-coverage-reality-check.ts 
 * - final-coverage-report.ts
 * - accurate-sports-coverage-report.ts
 * - And 60+ other variations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';
import fs from 'fs/promises';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Coverage analysis configuration
interface CoverageConfig {
  sport: string;
  displayName: string;
  tableQueries: {
    games: string;
    players: string;
    stats: string;
  };
  expectedSeasons: number[];
  keyMetrics: string[];
}

const SPORT_CONFIGS: CoverageConfig[] = [
  {
    sport: 'NBA',
    displayName: '🏀 NBA Basketball',
    tableQueries: {
      games: "sport.eq.NBA,sport_id.eq.nba",
      players: "sport.eq.NBA,sport_id.eq.nba", 
      stats: "sport.eq.NBA,sport_id.eq.nba"
    },
    expectedSeasons: [2023, 2024, 2025],
    keyMetrics: ['points', 'rebounds', 'assists', 'steals', 'blocks']
  },
  {
    sport: 'NFL', 
    displayName: '🏈 NFL Football',
    tableQueries: {
      games: "sport.eq.NFL,sport_id.eq.nfl",
      players: "sport.eq.NFL,sport_id.eq.nfl",
      stats: "sport.eq.NFL,sport_id.eq.nfl"
    },
    expectedSeasons: [2023, 2024, 2025],
    keyMetrics: ['passing_yards', 'rushing_yards', 'receiving_yards', 'touchdowns']
  },
  {
    sport: 'MLB',
    displayName: '⚾ MLB Baseball', 
    tableQueries: {
      games: "sport.eq.MLB,sport_id.eq.mlb",
      players: "sport.eq.MLB,sport_id.eq.mlb",
      stats: "sport.eq.MLB,sport_id.eq.mlb"
    },
    expectedSeasons: [2023, 2024, 2025],
    keyMetrics: ['hits', 'runs', 'rbis', 'home_runs', 'strikeouts']
  },
  {
    sport: 'NHL',
    displayName: '🏒 NHL Hockey',
    tableQueries: {
      games: "sport.eq.NHL,sport_id.eq.nhl", 
      players: "sport.eq.NHL,sport_id.eq.nhl",
      stats: "sport.eq.NHL,sport_id.eq.nhl"
    },
    expectedSeasons: [2023, 2024, 2025],
    keyMetrics: ['goals', 'assists', 'shots', 'hits', 'blocks']
  }
];

// Comprehensive coverage metrics
interface CoverageMetrics {
  sport: string;
  games: {
    total: number;
    completed: number;
    withScores: number;
    withStats: number;
    coverage_percentage: number;
  };
  players: {
    total: number;
    active: number;
    withStats: number;
    coverage_percentage: number;
  };
  stats: {
    total: number;
    game_logs: number;
    season_stats: number;
    quality_score: number;
    completeness: number;
  };
  data_quality: {
    espn_id_compliance: number;
    missing_data_percentage: number;
    duplicate_records: number;
    data_freshness_hours: number;
  };
  pattern_readiness: {
    games_with_full_data: number;
    pattern_eligible_games: number;
    ml_training_ready: boolean;
  };
}

// Analysis output formats
type OutputFormat = 'console' | 'json' | 'csv' | 'markdown' | 'executive';

class UniversalCoverageAnalyzer {
  private startTime = Date.now();
  private metrics: Map<string, CoverageMetrics> = new Map();

  constructor() {
    console.log(chalk.bold.cyan('📊 UNIVERSAL COVERAGE ANALYZER'));
    console.log(chalk.yellow('🎯 Consolidating 66+ coverage scripts into one comprehensive tool\n'));
  }

  // Main analysis entry point
  async analyzeCoverage(options: {
    sports?: string[];
    format?: OutputFormat;
    includeDetails?: boolean;
    outputFile?: string;
    timeRange?: string;
  } = {}): Promise<void> {
    const {
      sports = ['NBA', 'NFL', 'MLB', 'NHL'],
      format = 'console',
      includeDetails = true,
      outputFile,
      timeRange
    } = options;

    console.log(chalk.bold.green('🚀 Starting comprehensive coverage analysis...\n'));

    // Analyze each sport
    for (const sportConfig of SPORT_CONFIGS) {
      if (sports.includes(sportConfig.sport)) {
        console.log(chalk.blue(`Analyzing ${sportConfig.displayName}...`));
        const metrics = await this.analyzeSportCoverage(sportConfig, timeRange);
        this.metrics.set(sportConfig.sport, metrics);
      }
    }

    // Generate output based on format
    await this.generateOutput(format, includeDetails, outputFile);
  }

  // Analyze coverage for a specific sport
  private async analyzeSportCoverage(config: CoverageConfig, timeRange?: string): Promise<CoverageMetrics> {
    const metrics: CoverageMetrics = {
      sport: config.sport,
      games: {
        total: 0,
        completed: 0,
        withScores: 0,
        withStats: 0,
        coverage_percentage: 0
      },
      players: {
        total: 0,
        active: 0,
        withStats: 0,
        coverage_percentage: 0
      },
      stats: {
        total: 0,
        game_logs: 0,
        season_stats: 0,
        quality_score: 0,
        completeness: 0
      },
      data_quality: {
        espn_id_compliance: 0,
        missing_data_percentage: 0,
        duplicate_records: 0,
        data_freshness_hours: 0
      },
      pattern_readiness: {
        games_with_full_data: 0,
        pattern_eligible_games: 0,
        ml_training_ready: false
      }
    };

    // Analyze games
    await this.analyzeGames(config, metrics, timeRange);
    
    // Analyze players
    await this.analyzePlayers(config, metrics);
    
    // Analyze stats
    await this.analyzeStats(config, metrics);
    
    // Analyze data quality
    await this.analyzeDataQuality(config, metrics);
    
    // Check pattern detection readiness
    await this.analyzePatternReadiness(config, metrics);

    return metrics;
  }

  // Analyze games coverage
  private async analyzeGames(config: CoverageConfig, metrics: CoverageMetrics, timeRange?: string): Promise<void> {
    try {
      // Get all games for this sport using chunked pagination
      console.log(chalk.blue(`    Fetching ${config.sport} games in chunks...`));
      
      const allGames: any[] = [];
      let offset = 0;
      const chunkSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('games')
          .select('id, sport, sport_id, status, home_score, away_score, start_time, created_at')
          .or(config.tableQueries.games)
          .order('created_at', { ascending: false })
          .range(offset, offset + chunkSize - 1);

        // Apply time range if specified
        if (timeRange) {
          query = query.gte('start_time', timeRange);
        }

        const { data: gameChunk, error } = await query;
        
        if (error) {
          console.error(chalk.red(`Error fetching ${config.sport} games:`, error.message));
          break;
        }

        if (!gameChunk || gameChunk.length === 0) {
          hasMore = false;
          break;
        }
        
        allGames.push(...gameChunk);
        offset += chunkSize;
        
        console.log(chalk.gray(`      Fetched ${allGames.length} ${config.sport} games so far...`));
        
        if (gameChunk.length < chunkSize) {
          hasMore = false;
        }
      }
      
      const games = allGames;

      if (!games) {
        console.warn(chalk.yellow(`No games found for ${config.sport}`));
        return;
      }

      metrics.games.total = games.length;

      // Analyze game completeness
      const completedGames = games.filter(g => 
        g.status === 'completed' || 
        g.status === 'STATUS_FINAL' || 
        g.status === 'Final' ||
        g.status?.toLowerCase().includes('final')
      );
      metrics.games.completed = completedGames.length;

      const gamesWithScores = games.filter(g => 
        g.home_score !== null && g.away_score !== null
      );
      metrics.games.withScores = gamesWithScores.length;

      // Check which games have associated player stats
      const gameIds = games.map(g => g.id);
      const { data: gamesWithStats } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', gameIds);

      const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id) || []);
      metrics.games.withStats = uniqueGamesWithStats.size;

      // Calculate coverage percentage
      metrics.games.coverage_percentage = metrics.games.total > 0 
        ? (metrics.games.withStats / metrics.games.total) * 100 
        : 0;

      console.log(chalk.green(`  ✅ Games: ${metrics.games.total} total, ${metrics.games.withStats} with stats (${metrics.games.coverage_percentage.toFixed(1)}%)`));

    } catch (error) {
      console.error(chalk.red(`Error analyzing ${config.sport} games:`, error.message));
    }
  }

  // Analyze players coverage
  private async analyzePlayers(config: CoverageConfig, metrics: CoverageMetrics): Promise<void> {
    try {
      // Get all players for this sport
      const { data: players, error } = await supabase
        .from('players')
        .select('id, status, external_id')
        .or(config.tableQueries.players);

      if (error) {
        console.error(chalk.red(`Error fetching ${config.sport} players:`, error.message));
        return;
      }

      if (!players) {
        console.warn(chalk.yellow(`No players found for ${config.sport}`));
        return;
      }

      metrics.players.total = players.length;

      // Count active players
      const activePlayers = players.filter(p => 
        !p.status || p.status === 'active' || p.status === 'ACTIVE'
      );
      metrics.players.active = activePlayers.length;

      // Check which players have stats
      const playerIds = players.map(p => p.id);
      const { data: playersWithStats } = await supabase
        .from('player_game_logs')
        .select('player_id')
        .in('player_id', playerIds);

      const uniquePlayersWithStats = new Set(playersWithStats?.map(s => s.player_id) || []);
      metrics.players.withStats = uniquePlayersWithStats.size;

      metrics.players.coverage_percentage = metrics.players.total > 0 
        ? (metrics.players.withStats / metrics.players.total) * 100 
        : 0;

      console.log(chalk.green(`  ✅ Players: ${metrics.players.total} total, ${metrics.players.withStats} with stats (${metrics.players.coverage_percentage.toFixed(1)}%)`));

    } catch (error) {
      console.error(chalk.red(`Error analyzing ${config.sport} players:`, error.message));
    }
  }

  // Analyze stats coverage and quality
  private async analyzeStats(config: CoverageConfig, metrics: CoverageMetrics): Promise<void> {
    try {
      // Count game logs
      const { count: gameLogsCount } = await supabase
        .from('player_game_logs')
        .select('id', { count: 'exact', head: true })
        .contains('metadata', { sport: config.sport });

      metrics.stats.game_logs = gameLogsCount || 0;

      // Count season stats
      const { count: seasonStatsCount } = await supabase
        .from('player_season_stats')
        .select('id', { count: 'exact', head: true });

      metrics.stats.season_stats = seasonStatsCount || 0;
      metrics.stats.total = metrics.stats.game_logs + metrics.stats.season_stats;

      // Analyze stats quality
      const { data: sampleStats } = await supabase
        .from('player_game_logs')
        .select('stats, computed_metrics, metadata')
        .contains('metadata', { sport: config.sport })
        .limit(1000);

      if (sampleStats && sampleStats.length > 0) {
        // Calculate average quality score
        const qualityScores = sampleStats
          .map(s => s.metadata?.data_quality_score)
          .filter(score => typeof score === 'number');
        
        metrics.stats.quality_score = qualityScores.length > 0 
          ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length 
          : 0;

        // Calculate completeness (percentage of non-empty stat objects)
        const completeStats = sampleStats.filter(s => 
          s.stats && Object.keys(s.stats).length > 0
        );
        metrics.stats.completeness = (completeStats.length / sampleStats.length) * 100;
      }

      console.log(chalk.green(`  ✅ Stats: ${metrics.stats.total.toLocaleString()} total, quality: ${metrics.stats.quality_score.toFixed(1)}%`));

    } catch (error) {
      console.error(chalk.red(`Error analyzing ${config.sport} stats:`, error.message));
    }
  }

  // Analyze data quality metrics
  private async analyzeDataQuality(config: CoverageConfig, metrics: CoverageMetrics): Promise<void> {
    try {
      // Check ESPN ID compliance
      const { data: playersWithIds } = await supabase
        .from('players')
        .select('external_id')
        .or(config.tableQueries.players)
        .not('external_id', 'is', null);

      if (playersWithIds) {
        const standardizedIds = playersWithIds.filter(p => 
          p.external_id?.startsWith(`espn_${config.sport.toLowerCase()}_`)
        );
        metrics.data_quality.espn_id_compliance = playersWithIds.length > 0 
          ? (standardizedIds.length / playersWithIds.length) * 100 
          : 0;
      }

      // Check for missing data
      const { data: recentStats } = await supabase
        .from('player_game_logs')
        .select('stats, time_played')
        .contains('metadata', { sport: config.sport })
        .order('created_at', { ascending: false })
        .limit(1000);

      if (recentStats) {
        const missingTimeData = recentStats.filter(s => !s.time_played || s.time_played === 0);
        metrics.data_quality.missing_data_percentage = (missingTimeData.length / recentStats.length) * 100;
      }

      // Check data freshness
      const { data: latestData } = await supabase
        .from('player_game_logs')
        .select('created_at')
        .contains('metadata', { sport: config.sport })
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestData && latestData[0]) {
        const latestTime = new Date(latestData[0].created_at);
        const now = new Date();
        metrics.data_quality.data_freshness_hours = (now.getTime() - latestTime.getTime()) / (1000 * 60 * 60);
      }

      console.log(chalk.green(`  ✅ Quality: ${metrics.data_quality.espn_id_compliance.toFixed(1)}% ESPN compliant, ${metrics.data_quality.data_freshness_hours.toFixed(1)}h fresh`));

    } catch (error) {
      console.error(chalk.red(`Error analyzing ${config.sport} data quality:`, error.message));
    }
  }

  // Check pattern detection readiness
  private async analyzePatternReadiness(config: CoverageConfig, metrics: CoverageMetrics): Promise<void> {
    try {
      // Count games with complete data for pattern detection
      const { data: completeGames } = await supabase
        .from('games')
        .select(`
          id,
          (select count(*) from player_game_logs where game_id = games.id) as stat_count
        `)
        .or(config.tableQueries.games)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);

      if (completeGames) {
        const gamesWithStats = completeGames.filter(g => g.stat_count > 0);
        metrics.pattern_readiness.games_with_full_data = gamesWithStats.length;
        
        // Games eligible for pattern detection (minimum 10 player stats per game)
        const patternEligibleGames = completeGames.filter(g => g.stat_count >= 10);
        metrics.pattern_readiness.pattern_eligible_games = patternEligibleGames.length;
        
        // ML training ready if we have at least 1000 pattern-eligible games
        metrics.pattern_readiness.ml_training_ready = patternEligibleGames.length >= 1000;
      }

      console.log(chalk.green(`  ✅ Pattern Ready: ${metrics.pattern_readiness.pattern_eligible_games} games eligible for ML training`));

    } catch (error) {
      console.error(chalk.red(`Error analyzing ${config.sport} pattern readiness:`, error.message));
    }
  }

  // Generate output in specified format
  private async generateOutput(format: OutputFormat, includeDetails: boolean, outputFile?: string): Promise<void> {
    const runtime = (Date.now() - this.startTime) / 1000;
    
    let output = '';

    switch (format) {
      case 'console':
        this.printConsoleReport(includeDetails);
        break;
        
      case 'json':
        output = this.generateJSONReport();
        break;
        
      case 'csv':
        output = this.generateCSVReport();
        break;
        
      case 'markdown':
        output = this.generateMarkdownReport(includeDetails);
        break;
        
      case 'executive':
        output = this.generateExecutiveReport();
        break;
    }

    // Save to file if specified
    if (outputFile && output) {
      await fs.writeFile(outputFile, output, 'utf8');
      console.log(chalk.green(`\n📄 Report saved to: ${outputFile}`));
    }

    console.log(chalk.bold.cyan(`\n⏱️  Analysis completed in ${runtime.toFixed(2)}s`));
  }

  // Console output (default)
  private printConsoleReport(includeDetails: boolean): void {
    console.log(chalk.bold.cyan('\n📊 UNIVERSAL COVERAGE ANALYSIS REPORT'));
    console.log(chalk.yellow('='.repeat(80)));

    // Summary statistics
    let totalGames = 0;
    let totalStats = 0;
    let avgCoverage = 0;
    let mlReadySports = 0;

    this.metrics.forEach((metrics, sport) => {
      totalGames += metrics.games.total;
      totalStats += metrics.stats.total;
      avgCoverage += metrics.games.coverage_percentage;
      if (metrics.pattern_readiness.ml_training_ready) mlReadySports++;
    });

    avgCoverage = avgCoverage / this.metrics.size;

    console.log(chalk.bold.green('\n🎯 EXECUTIVE SUMMARY:'));
    console.log(chalk.white(`   📊 Total Games Analyzed: ${totalGames.toLocaleString()}`));
    console.log(chalk.white(`   📈 Total Player Stats: ${totalStats.toLocaleString()}`));
    console.log(chalk.white(`   🎪 Average Coverage: ${avgCoverage.toFixed(1)}%`));
    console.log(chalk.white(`   🤖 ML-Ready Sports: ${mlReadySports}/${this.metrics.size}`));

    // Sport-by-sport breakdown
    console.log(chalk.bold.blue('\n📋 SPORT-BY-SPORT BREAKDOWN:'));
    console.log(chalk.yellow('-'.repeat(80)));

    this.metrics.forEach((metrics, sport) => {
      const config = SPORT_CONFIGS.find(c => c.sport === sport);
      console.log(chalk.bold.white(`\n${config?.displayName || sport}:`));
      
      // Games metrics
      console.log(chalk.cyan('  Games:'));
      console.log(chalk.gray(`    Total: ${metrics.games.total.toLocaleString()}`));
      console.log(chalk.gray(`    Completed: ${metrics.games.completed.toLocaleString()}`));
      console.log(chalk.gray(`    With Stats: ${metrics.games.withStats.toLocaleString()} (${metrics.games.coverage_percentage.toFixed(1)}%)`));
      
      // Players metrics
      console.log(chalk.cyan('  Players:'));
      console.log(chalk.gray(`    Total: ${metrics.players.total.toLocaleString()}`));
      console.log(chalk.gray(`    With Stats: ${metrics.players.withStats.toLocaleString()} (${metrics.players.coverage_percentage.toFixed(1)}%)`));
      
      // Stats quality
      console.log(chalk.cyan('  Data Quality:'));
      console.log(chalk.gray(`    Total Stats: ${metrics.stats.total.toLocaleString()}`));
      console.log(chalk.gray(`    Quality Score: ${metrics.stats.quality_score.toFixed(1)}%`));
      console.log(chalk.gray(`    ESPN ID Compliance: ${metrics.data_quality.espn_id_compliance.toFixed(1)}%`));
      console.log(chalk.gray(`    Data Freshness: ${metrics.data_quality.data_freshness_hours.toFixed(1)} hours`));
      
      // Pattern readiness
      const readyIcon = metrics.pattern_readiness.ml_training_ready ? '✅' : '❌';
      console.log(chalk.cyan('  Pattern Detection:'));
      console.log(chalk.gray(`    Eligible Games: ${metrics.pattern_readiness.pattern_eligible_games.toLocaleString()}`));
      console.log(chalk.gray(`    ML Training Ready: ${readyIcon} ${metrics.pattern_readiness.ml_training_ready}`));
    });

    // Recommendations
    console.log(chalk.bold.yellow('\n💡 RECOMMENDATIONS:'));
    console.log(chalk.yellow('-'.repeat(50)));
    
    this.metrics.forEach((metrics, sport) => {
      const issues: string[] = [];
      
      if (metrics.games.coverage_percentage < 80) {
        issues.push(`Improve game stats coverage (${metrics.games.coverage_percentage.toFixed(1)}%)`);
      }
      
      if (metrics.data_quality.espn_id_compliance < 95) {
        issues.push(`Standardize ESPN IDs (${metrics.data_quality.espn_id_compliance.toFixed(1)}% compliant)`);
      }
      
      if (metrics.stats.quality_score < 70) {
        issues.push(`Improve data quality (${metrics.stats.quality_score.toFixed(1)}% average)`);
      }
      
      if (!metrics.pattern_readiness.ml_training_ready) {
        issues.push(`Collect more complete games for ML training`);
      }
      
      if (issues.length > 0) {
        console.log(chalk.red(`\n${sport}:`));
        issues.forEach(issue => console.log(chalk.gray(`  • ${issue}`)));
      }
    });

    if (includeDetails) {
      console.log(chalk.bold.cyan('\n📈 PATTERN DETECTION READINESS:'));
      console.log(chalk.yellow('-'.repeat(50)));
      
      this.metrics.forEach((metrics, sport) => {
        const percentage = metrics.games.total > 0 
          ? (metrics.pattern_readiness.pattern_eligible_games / metrics.games.total) * 100 
          : 0;
        
        console.log(chalk.white(`${sport}: ${metrics.pattern_readiness.pattern_eligible_games}/${metrics.games.total} games (${percentage.toFixed(1)}%)`));
      });
    }
  }

  // Generate JSON report
  private generateJSONReport(): string {
    const report = {
      generated_at: new Date().toISOString(),
      analysis_runtime_seconds: (Date.now() - this.startTime) / 1000,
      sports_analyzed: Array.from(this.metrics.keys()),
      summary: this.generateSummaryStats(),
      detailed_metrics: Object.fromEntries(this.metrics)
    };
    
    return JSON.stringify(report, null, 2);
  }

  // Generate CSV report
  private generateCSVReport(): string {
    const headers = [
      'Sport', 'Total Games', 'Games with Stats', 'Coverage %', 
      'Total Players', 'Players with Stats', 'Player Coverage %',
      'Total Stats', 'Quality Score', 'ESPN ID Compliance %',
      'Data Freshness (hours)', 'Pattern Eligible Games', 'ML Ready'
    ];
    
    const rows = Array.from(this.metrics.entries()).map(([sport, metrics]) => [
      sport,
      metrics.games.total,
      metrics.games.withStats,
      metrics.games.coverage_percentage.toFixed(1),
      metrics.players.total,
      metrics.players.withStats,
      metrics.players.coverage_percentage.toFixed(1),
      metrics.stats.total,
      metrics.stats.quality_score.toFixed(1),
      metrics.data_quality.espn_id_compliance.toFixed(1),
      metrics.data_quality.data_freshness_hours.toFixed(1),
      metrics.pattern_readiness.pattern_eligible_games,
      metrics.pattern_readiness.ml_training_ready
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  // Generate Markdown report
  private generateMarkdownReport(includeDetails: boolean): string {
    let md = '# Universal Coverage Analysis Report\n\n';
    md += `Generated: ${new Date().toISOString()}\n\n`;
    
    const summary = this.generateSummaryStats();
    md += '## Executive Summary\n\n';
    md += `- **Total Games**: ${summary.totalGames.toLocaleString()}\n`;
    md += `- **Total Stats**: ${summary.totalStats.toLocaleString()}\n`;
    md += `- **Average Coverage**: ${summary.avgCoverage.toFixed(1)}%\n`;
    md += `- **ML-Ready Sports**: ${summary.mlReadySports}/${this.metrics.size}\n\n`;
    
    md += '## Sport Breakdown\n\n';
    md += '| Sport | Games | Coverage % | Players | Stats | Quality % | ML Ready |\n';
    md += '|-------|-------|------------|---------|-------|-----------|----------|\n';
    
    this.metrics.forEach((metrics, sport) => {
      md += `| ${sport} | ${metrics.games.total} | ${metrics.games.coverage_percentage.toFixed(1)}% | `;
      md += `${metrics.players.total} | ${metrics.stats.total} | ${metrics.stats.quality_score.toFixed(1)}% | `;
      md += `${metrics.pattern_readiness.ml_training_ready ? '✅' : '❌'} |\n`;
    });
    
    return md;
  }

  // Generate executive summary report
  private generateExecutiveReport(): string {
    const summary = this.generateSummaryStats();
    
    let report = 'FANTASY AI - COVERAGE ANALYSIS EXECUTIVE SUMMARY\n';
    report += '=' .repeat(60) + '\n\n';
    
    report += 'KEY METRICS:\n';
    report += `• Total Games in Database: ${summary.totalGames.toLocaleString()}\n`;
    report += `• Total Player Stats: ${summary.totalStats.toLocaleString()}\n`;
    report += `• Average Coverage Rate: ${summary.avgCoverage.toFixed(1)}%\n`;
    report += `• Sports Ready for ML: ${summary.mlReadySports}/${this.metrics.size}\n\n`;
    
    report += 'PATTERN DETECTION READINESS:\n';
    this.metrics.forEach((metrics, sport) => {
      const status = metrics.pattern_readiness.ml_training_ready ? 'READY' : 'NOT READY';
      report += `• ${sport}: ${status} (${metrics.pattern_readiness.pattern_eligible_games} eligible games)\n`;
    });
    
    report += '\nRECOMMENDED ACTIONS:\n';
    let actionCount = 1;
    this.metrics.forEach((metrics, sport) => {
      if (metrics.games.coverage_percentage < 80) {
        report += `${actionCount++}. Improve ${sport} game coverage from ${metrics.games.coverage_percentage.toFixed(1)}% to 80%+\n`;
      }
      if (!metrics.pattern_readiness.ml_training_ready) {
        report += `${actionCount++}. Collect more complete ${sport} games for pattern detection\n`;
      }
    });
    
    return report;
  }

  // Generate summary statistics
  private generateSummaryStats() {
    let totalGames = 0;
    let totalStats = 0;
    let avgCoverage = 0;
    let mlReadySports = 0;

    this.metrics.forEach((metrics) => {
      totalGames += metrics.games.total;
      totalStats += metrics.stats.total;
      avgCoverage += metrics.games.coverage_percentage;
      if (metrics.pattern_readiness.ml_training_ready) mlReadySports++;
    });

    avgCoverage = this.metrics.size > 0 ? avgCoverage / this.metrics.size : 0;

    return { totalGames, totalStats, avgCoverage, mlReadySports };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const sports = args.find(arg => arg.startsWith('--sports='))?.split('=')[1]?.split(',').map(s => s.trim().toUpperCase()) || ['NBA', 'NFL', 'MLB', 'NHL'];
  const format = (args.find(arg => arg.startsWith('--format='))?.split('=')[1] as OutputFormat) || 'console';
  const includeDetails = !args.includes('--no-details');
  const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
  const timeRange = args.find(arg => arg.startsWith('--since='))?.split('=')[1];

  const analyzer = new UniversalCoverageAnalyzer();
  
  await analyzer.analyzeCoverage({
    sports,
    format,
    includeDetails,
    outputFile,
    timeRange
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { UniversalCoverageAnalyzer, CoverageMetrics, OutputFormat };