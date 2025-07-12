#!/usr/bin/env tsx
/**
 * 🚀 AGGRESSIVE TURBO PLAYER STATS COLLECTOR
 * 
 * Mass collection with higher concurrency and better error handling
 */

import axios from 'axios';
import chalk from 'chalk';
import { enhancedDb } from '../lib/services/enhanced-database-service';
import pLimit from 'p-limit';
import ora from 'ora';

const limit = pLimit(20); // Higher concurrency

class AggressiveStatsCollector {
  private stats = {
    gamesProcessed: 0,
    playersUpdated: 0,
    errors: 0,
    apiErrors: 0,
    startTime: Date.now(),
    byLeague: {} as Record<string, { games: number; players: number; errors: number }>
  };

  private spinner = ora('Initializing Aggressive Stats Collector...');

  async collectAllStats() {
    this.spinner.start();
    console.log(chalk.bold.red('\n🚀 AGGRESSIVE STATS COLLECTOR - MAXIMUM SPEED'));
    console.log(chalk.yellow('Target: 100% coverage of games with ESPN IDs'));
    console.log(chalk.gray('='.repeat(60)));

    try {
      // Get ALL games with ESPN IDs that don't have stats
      const { data: allGames } = await enhancedDb.getClient()
        .from('games')
        .select('id, external_id, sport, home_team_id, away_team_id, start_time')
        .like('external_id', 'espn_%')
        .not('home_score', 'is', null)
        .lt('start_time', new Date().toISOString())
        .order('start_time', { ascending: false })
        .range(0, 9999); // Use range to get more games

      if (!allGames || allGames.length === 0) {
        console.log(chalk.red('No games found'));
        return;
      }

      console.log(chalk.green(`\nFound ${allGames.length} total games with ESPN IDs`));

      // Check which games already have stats in batches
      this.spinner.text = 'Checking existing stats coverage...';
      const gamesNeedingStats = [];
      
      // Process in chunks to avoid memory issues
      const chunkSize = 500;
      for (let i = 0; i < allGames.length; i += chunkSize) {
        const chunk = allGames.slice(i, i + chunkSize);
        const gameIds = chunk.map(g => g.id);
        
        const { data: existingStats } = await enhancedDb.getClient()
          .from('player_game_logs')
          .select('game_id')
          .in('game_id', gameIds);

        const hasStats = new Set(existingStats?.map(s => s.game_id) || []);
        const needStats = chunk.filter(g => !hasStats.has(g.id));
        gamesNeedingStats.push(...needStats);
      }

      console.log(chalk.yellow(`${gamesNeedingStats.length} games need stats!`));

      if (gamesNeedingStats.length === 0) {
        console.log(chalk.green('✅ All games already have stats!'));
        return;
      }

      // Group by sport
      const bySport: Record<string, any[]> = {};
      gamesNeedingStats.forEach(g => {
        if (!bySport[g.sport]) {
          bySport[g.sport] = [];
          this.stats.byLeague[g.sport] = { games: 0, players: 0, errors: 0 };
        }
        bySport[g.sport].push(g);
      });

      // Show breakdown
      console.log(chalk.cyan('\nBreakdown by sport:'));
      Object.entries(bySport).forEach(([sport, games]) => {
        console.log(`  ${sport}: ${games.length} games`);
      });

      // Process each sport
      for (const [sport, games] of Object.entries(bySport)) {
        console.log(chalk.bold.cyan(`\n📊 Processing ${sport}...`));
        await this.processSportGames(sport, games);
      }

      this.showResults();

    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
    } finally {
      this.spinner.stop();
    }
  }

  private async processSportGames(sport: string, games: any[]) {
    const batchSize = 200;
    
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      this.spinner.text = `Processing ${sport} games ${i + 1}-${Math.min(i + batchSize, games.length)} of ${games.length}...`;
      
      const promises = batch.map(game => 
        limit(() => this.processGame(game, sport))
      );

      await Promise.all(promises);
      
      // Show progress
      if (this.stats.byLeague[sport].games > 0) {
        console.log(chalk.green(
          `  Progress: ${this.stats.byLeague[sport].games} games, ${this.stats.byLeague[sport].players} players collected`
        ));
      }
    }
  }

  private async processGame(game: any, sport: string) {
    try {
      const espnGameId = game.external_id
        .replace('espn_', '')
        .replace(/^(nba|mlb|nfl|nhl)_/, '');

      // Determine ESPN sport and league
      const espnSport = this.getEspnSport(sport);
      const espnLeague = sport.toLowerCase();

      // Fetch boxscore with retry
      const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/${espnLeague}/summary?event=${espnGameId}`;
      
      let response;
      let retries = 3;
      
      while (retries > 0) {
        try {
          response = await axios.get(url, { 
            timeout: 15000,
            validateStatus: (status) => status < 500 
          });
          break;
        } catch (error: any) {
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }
      
      if (!response || response.status !== 200 || !response.data.boxscore) {
        this.stats.byLeague[sport].errors++;
        this.stats.apiErrors++;
        return;
      }

      const boxscore = response.data.boxscore;
      if (!boxscore.players || boxscore.players.length === 0) {
        return;
      }

      const playerStats: any[] = [];

      // Process each team's players
      for (const team of boxscore.players) {
        const teamId = parseInt(team.team.id);
        const isHome = teamId === game.home_team_id;
        const opponentId = isHome ? game.away_team_id : game.home_team_id;
        
        // Find the correct statistics
        const stats = this.extractTeamStats(team, sport);
        
        for (const athlete of stats) {
          if (!athlete.athlete?.id) continue;

          const playerId = parseInt(athlete.athlete.id);
          const parsedStats = this.parsePlayerStats(athlete, sport);
          
          if (!parsedStats || Object.keys(parsedStats).length === 0) continue;

          // Calculate fantasy points
          const fantasyPoints = this.calculateFantasyPoints(parsedStats, sport);

          playerStats.push({
            player_id: playerId,
            game_id: game.id,
            team_id: teamId,
            opponent_id: opponentId,
            game_date: game.start_time,
            is_home: isHome,
            stats: parsedStats,
            fantasy_points: fantasyPoints,
            minutes_played: parsedStats.minutes_played || null
          });

          // Also ensure player exists
          await enhancedDb.getClient()
            .from('players')
            .upsert({
              id: playerId,
              name: athlete.athlete.displayName || athlete.athlete.fullName,
              team_id: teamId,
              sport: this.getSportName(sport),
              position: this.extractPosition(athlete),
              jersey_number: athlete.athlete.jersey ? parseInt(athlete.athlete.jersey) : null
            }, { 
              onConflict: 'id',
              ignoreDuplicates: true 
            });
        }
      }

      // Bulk insert all player stats
      if (playerStats.length > 0) {
        const { error } = await enhancedDb.getClient()
          .from('player_game_logs')
          .upsert(playerStats, { 
            onConflict: 'player_id,game_id',
            ignoreDuplicates: true 
          });

        if (!error) {
          this.stats.gamesProcessed++;
          this.stats.playersUpdated += playerStats.length;
          this.stats.byLeague[sport].games++;
          this.stats.byLeague[sport].players += playerStats.length;
        } else {
          this.stats.byLeague[sport].errors++;
        }
      }

    } catch (error: any) {
      this.stats.errors++;
      this.stats.byLeague[sport].errors++;
    }
  }

  private extractTeamStats(team: any, sport: string): any[] {
    if (sport === 'MLB') {
      const battingStats = team.statistics?.find((s: any) => 
        s.name === 'batting' || s.type === 'batting'
      );
      return battingStats?.athletes || [];
    } else if (team.statistics && team.statistics.length > 0) {
      return team.statistics[0]?.athletes || [];
    }
    return [];
  }

  private parsePlayerStats(athlete: any, sport: string): any {
    const stats = athlete.stats;
    if (!stats || stats.length === 0) return null;

    switch (sport) {
      case 'NBA':
        return this.parseNBAStats(stats);
      case 'NFL':
        return this.parseNFLStats(stats, athlete.athlete?.position?.abbreviation);
      case 'MLB':
        return this.parseMLBStats(stats);
      default:
        return null;
    }
  }

  private parseNBAStats(stats: any[]): any {
    if (stats.length < 14) return null;

    const minutesStr = stats[0] || '0';
    const minutes = parseInt(minutesStr) || 0;
    
    // Skip players who didn't play
    if (minutes === 0 && stats[13] === '0') return null;

    const fgStr = stats[1] || '0-0';
    const threePtStr = stats[2] || '0-0';
    const ftStr = stats[3] || '0-0';
    
    return {
      minutes_played: minutes,
      field_goals_made: parseInt(fgStr.split('-')[0]) || 0,
      field_goals_attempted: parseInt(fgStr.split('-')[1]) || 0,
      three_pointers_made: parseInt(threePtStr.split('-')[0]) || 0,
      three_pointers_attempted: parseInt(threePtStr.split('-')[1]) || 0,
      free_throws_made: parseInt(ftStr.split('-')[0]) || 0,
      free_throws_attempted: parseInt(ftStr.split('-')[1]) || 0,
      offensive_rebounds: parseInt(stats[4]) || 0,
      defensive_rebounds: parseInt(stats[5]) || 0,
      rebounds: parseInt(stats[6]) || 0,
      assists: parseInt(stats[7]) || 0,
      steals: parseInt(stats[8]) || 0,
      blocks: parseInt(stats[9]) || 0,
      turnovers: parseInt(stats[10]) || 0,
      personal_fouls: parseInt(stats[11]) || 0,
      plus_minus: parseInt(stats[12]) || 0,
      points: parseInt(stats[13]) || 0
    };
  }

  private parseNFLStats(stats: any[], position?: string): any {
    if (!stats || stats.length === 0) return null;

    const result: any = {
      completions: 0,
      attempts: 0,
      passing_yards: 0,
      passing_touchdowns: 0,
      interceptions: 0,
      rushing_attempts: 0,
      rushing_yards: 0,
      rushing_touchdowns: 0,
      receptions: 0,
      receiving_yards: 0,
      receiving_touchdowns: 0,
      targets: 0,
      fumbles: 0,
      fumbles_lost: 0,
      two_point_conversions: 0
    };

    // Parse based on position - this is simplified
    if (position === 'QB' && stats.length >= 6) {
      const passingStr = stats[0] || '0/0';
      const [completions, attempts] = passingStr.split('/').map(s => parseInt(s) || 0);
      
      result.completions = completions;
      result.attempts = attempts;
      result.passing_yards = parseInt(stats[1]) || 0;
      result.passing_touchdowns = parseInt(stats[2]) || 0;
      result.interceptions = parseInt(stats[3]) || 0;
    }

    return result;
  }

  private parseMLBStats(stats: any[]): any {
    if (!stats || stats.length === 0) return null;

    const hitsAtBats = stats[0] || '0-0';
    const [hits, atBats] = hitsAtBats.split('-').map(s => parseInt(s) || 0);
    
    const result: any = {
      at_bats: parseInt(stats[1]) || atBats || 0,
      runs: parseInt(stats[2]) || 0,
      hits: parseInt(stats[3]) || hits || 0,
      rbis: parseInt(stats[4]) || 0,
      home_runs: parseInt(stats[5]) || 0,
      walks: parseInt(stats[6]) || 0,
      strikeouts: parseInt(stats[7]) || 0,
      pitch_count: parseInt(stats[8]) || 0,
      batting_average: parseFloat(stats[9]) || 0,
      on_base_percentage: parseFloat(stats[10]) || 0,
      slugging_percentage: parseFloat(stats[11]) || 0,
      stolen_bases: 0,
      caught_stealing: 0,
      doubles: 0,
      triples: 0,
      singles: 0,
      innings_pitched: 0,
      wins: 0,
      losses: 0,
      saves: 0,
      earned_runs: 0,
      hits_allowed: 0,
      walks_allowed: 0
    };

    if (result.hits > 0) {
      result.singles = Math.max(0, result.hits - result.home_runs);
    }

    return result;
  }

  private calculateFantasyPoints(stats: any, sport: string): number {
    switch (sport) {
      case 'NBA':
        return (
          (stats.points || 0) * 1 +
          (stats.rebounds || 0) * 1.25 +
          (stats.assists || 0) * 1.5 +
          (stats.steals || 0) * 2 +
          (stats.blocks || 0) * 2 -
          (stats.turnovers || 0) * 0.5
        );

      case 'NFL':
        return (
          (stats.passing_yards || 0) * 0.04 +
          (stats.passing_touchdowns || 0) * 4 +
          (stats.rushing_yards || 0) * 0.1 +
          (stats.rushing_touchdowns || 0) * 6 +
          (stats.receiving_yards || 0) * 0.1 +
          (stats.receiving_touchdowns || 0) * 6 +
          (stats.receptions || 0) * 1 +
          (stats.two_point_conversions || 0) * 2 -
          (stats.interceptions || 0) * 2 -
          (stats.fumbles_lost || 0) * 2
        );

      case 'MLB':
        const battingPoints = (
          (stats.singles || 0) * 3 +
          (stats.doubles || 0) * 5 +
          (stats.triples || 0) * 8 +
          (stats.home_runs || 0) * 10 +
          (stats.runs || 0) * 2 +
          (stats.rbis || 0) * 2 +
          (stats.walks || 0) * 2 +
          (stats.stolen_bases || 0) * 5 -
          (stats.caught_stealing || 0) * 2
        );
        
        const pitchingPoints = (
          (stats.innings_pitched || 0) * 3 +
          (stats.wins || 0) * 5 +
          (stats.saves || 0) * 5 +
          (stats.strikeouts || 0) * 2 -
          (stats.earned_runs || 0) * 2 -
          (stats.hits_allowed || 0) * 0.5 -
          (stats.walks_allowed || 0) * 1
        );
        
        return battingPoints + pitchingPoints;

      default:
        return 0;
    }
  }

  private getEspnSport(sport: string): string {
    switch (sport) {
      case 'NBA': return 'basketball';
      case 'NFL': return 'football';
      case 'MLB': return 'baseball';
      default: return sport.toLowerCase();
    }
  }

  private getSportName(sport: string): string {
    switch (sport) {
      case 'NBA': return 'basketball';
      case 'NFL': return 'football';
      case 'MLB': return 'baseball';
      default: return sport.toLowerCase();
    }
  }

  private extractPosition(athlete: any): string[] {
    const pos = athlete.athlete?.position?.abbreviation || 
                athlete.position || 
                athlete.athlete?.position?.name;
    return pos ? [pos] : [];
  }

  private showResults() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    
    console.log(chalk.bold.yellow('\n📊 AGGRESSIVE COLLECTION COMPLETE!'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.white(`Total Games Processed: ${chalk.bold(this.stats.gamesProcessed)}`));
    console.log(chalk.white(`Total Players Updated: ${chalk.bold(this.stats.playersUpdated)}`));
    
    // Show breakdown by league
    console.log(chalk.cyan('\nBreakdown by Sport:'));
    for (const [sport, stats] of Object.entries(this.stats.byLeague)) {
      console.log(chalk.white(
        `  ${sport}: ${stats.games} games, ${stats.players} players, ${stats.errors} errors`
      ));
    }
    
    console.log(chalk.white(`\nTotal Errors: ${chalk.red(this.stats.errors)}`));
    console.log(chalk.white(`API Errors: ${chalk.red(this.stats.apiErrors)}`));
    console.log(chalk.white(`Time: ${elapsed.toFixed(1)}s`));
    console.log(chalk.white(`Rate: ${(this.stats.playersUpdated / elapsed).toFixed(1)} players/second`));
    console.log(chalk.white(`Games/second: ${(this.stats.gamesProcessed / elapsed).toFixed(1)}`));
    
    if (this.stats.gamesProcessed > 0) {
      console.log(chalk.bold.green('\n✅ MASSIVE COLLECTION COMPLETE!'));
      console.log(chalk.yellow('Run npx tsx scripts/check-coverage.ts to see updated coverage'));
    }
  }
}

// Run the collector
const collector = new AggressiveStatsCollector();
collector.collectAllStats().catch(console.error);