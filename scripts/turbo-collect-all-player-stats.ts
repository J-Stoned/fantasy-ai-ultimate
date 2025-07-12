#!/usr/bin/env tsx
/**
 * 🚀 TURBO PLAYER STATS COLLECTOR - ALL SPORTS
 * 
 * Mass collection of player stats from ESPN API
 * Handles NBA, NFL, MLB with proper parsing
 */

import axios from 'axios';
import chalk from 'chalk';
import { enhancedDb } from '../lib/services/enhanced-database-service';
import pLimit from 'p-limit';
import ora from 'ora';

const limit = pLimit(10); // Process 10 games concurrently

interface PlayerStats {
  player_id: number;
  game_id: number;
  team_id: number;
  opponent_id: number;
  game_date: string;
  is_home: boolean;
  stats: any;
  fantasy_points: number;
  minutes_played?: number;
}

class TurboStatsCollector {
  private stats = {
    gamesProcessed: 0,
    playersUpdated: 0,
    errors: 0,
    startTime: Date.now(),
    byLeague: {} as Record<string, { games: number; players: number; errors: number }>
  };

  private spinner = ora('Initializing Turbo Stats Collector...');

  async collectAllStats(league?: string, limit?: number) {
    this.spinner.start();
    console.log(chalk.bold.red('\n🚀 TURBO PLAYER STATS COLLECTOR'));
    console.log(chalk.yellow('Collecting stats at maximum speed...'));
    console.log(chalk.gray('='.repeat(60)));

    try {
      const leagues = league ? [league] : ['NBA', 'NFL', 'MLB'];
      
      for (const l of leagues) {
        this.stats.byLeague[l] = { games: 0, players: 0, errors: 0 };
        await this.collectLeagueStats(l, limit);
      }

      this.showResults();

    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
    } finally {
      this.spinner.stop();
    }
  }

  private async collectLeagueStats(league: string, gameLimit?: number) {
    this.spinner.text = `Fetching ${league} games...`;

    // Get all games with ESPN IDs that have scores (exclude future games)
    const today = new Date().toISOString();
    const { data: games, error } = await enhancedDb.getClient()
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
      .eq('sport', league)
      .like('external_id', 'espn_%')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .lt('start_time', today) // Only past games
      .order('start_time', { ascending: false })
      .limit(gameLimit || 1000);

    if (error) {
      console.error(chalk.red(`Error fetching ${league} games:`), error);
      return;
    }

    if (!games || games.length === 0) {
      console.log(chalk.yellow(`No ${league} games found with ESPN IDs`));
      return;
    }

    console.log(chalk.green(`\n📊 Found ${games.length} ${league} games with ESPN IDs`));

    // Check which games already have stats
    this.spinner.text = `Checking existing ${league} stats...`;
    const gamesNeedingStats = [];
    
    for (const game of games) {
      const { data: existingStats } = await enhancedDb.getClient()
        .from('player_game_logs')
        .select('id')
        .eq('game_id', game.id)
        .limit(1);

      if (!existingStats || existingStats.length === 0) {
        gamesNeedingStats.push(game);
      }
    }

    console.log(chalk.yellow(`${gamesNeedingStats.length} ${league} games need stats`));

    if (gamesNeedingStats.length === 0) {
      console.log(chalk.green(`✅ All ${league} games already have stats!`));
      return;
    }

    // Process games in batches
    const batchSize = 50;
    for (let i = 0; i < gamesNeedingStats.length; i += batchSize) {
      const batch = gamesNeedingStats.slice(i, i + batchSize);
      this.spinner.text = `Processing ${league} games ${i + 1}-${Math.min(i + batchSize, gamesNeedingStats.length)} of ${gamesNeedingStats.length}...`;
      
      const promises = batch.map(game => 
        limit(() => this.processGame(game, league))
      );

      await Promise.all(promises);
    }
  }

  private async processGame(game: any, league: string) {
    try {
      const espnGameId = game.external_id
        .replace('espn_', '')
        .replace(/^(nba|mlb|nfl|nhl)_/, '');

      // Determine ESPN sport and league
      const espnSport = this.getEspnSport(league);
      const espnLeague = league.toLowerCase();

      // Fetch boxscore
      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/${espnLeague}/summary?event=${espnGameId}`;
      const response = await axios.get(summaryUrl, { 
        timeout: 10000,
        validateStatus: (status) => status < 500 
      });
      
      if (response.status !== 200 || !response.data.boxscore) {
        this.stats.byLeague[league].errors++;
        return;
      }

      const boxscore = response.data.boxscore;
      if (!boxscore.players || boxscore.players.length === 0) {
        return;
      }

      const playerStats: PlayerStats[] = [];

      // Process each team's players
      for (const team of boxscore.players) {
        const teamId = parseInt(team.team.id);
        const isHome = teamId === game.home_team_id;
        const opponentId = isHome ? game.away_team_id : game.home_team_id;
        
        // Find the correct statistics based on sport
        const stats = this.extractTeamStats(team, league);
        
        for (const athlete of stats) {
          if (!athlete.athlete?.id) continue;

          const playerId = parseInt(athlete.athlete.id);
          const parsedStats = this.parsePlayerStats(athlete, league);
          
          if (!parsedStats || Object.keys(parsedStats).length === 0) continue;

          // Calculate fantasy points
          const fantasyPoints = this.calculateFantasyPoints(parsedStats, league);

          // Ensure player exists
          await enhancedDb.getClient()
            .from('players')
            .upsert({
              id: playerId,
              name: athlete.athlete.displayName || athlete.athlete.fullName,
              team_id: teamId,
              sport: this.getSport(league),
              position: this.extractPosition(athlete),
              jersey_number: athlete.athlete.jersey ? parseInt(athlete.athlete.jersey) : null
            }, { 
              onConflict: 'id',
              ignoreDuplicates: true 
            });

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
        }
      }

      // Bulk insert all player stats for this game
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
          this.stats.byLeague[league].games++;
          this.stats.byLeague[league].players += playerStats.length;
        } else {
          console.error(chalk.red(`Error inserting stats for game ${game.id}:`), error);
          this.stats.byLeague[league].errors++;
        }
      }

    } catch (error: any) {
      this.stats.errors++;
      this.stats.byLeague[league].errors++;
      if (error.response?.status !== 404) {
        console.error(chalk.red(`Error processing ${league} game ${game.id}:`), error.message);
      }
    }
  }

  private extractTeamStats(team: any, league: string): any[] {
    // Handle different structures for different sports
    if (league === 'MLB') {
      // MLB has multiple statistic types (batting, pitching, fielding)
      const battingStats = team.statistics?.find((s: any) => 
        s.name === 'batting' || s.type === 'batting'
      );
      return battingStats?.athletes || [];
    } else if (team.statistics && team.statistics.length > 0) {
      // NBA and NFL typically have one statistics array
      return team.statistics[0]?.athletes || [];
    }
    return [];
  }

  private parsePlayerStats(athlete: any, league: string): any {
    const stats = athlete.stats;
    if (!stats || stats.length === 0) return null;

    switch (league) {
      case 'NBA':
        return this.parseNBAStats(stats);
      case 'NFL':
        return this.parseNFLStats(stats, athlete.athlete?.position?.abbreviation);
      case 'MLB':
        return this.parseMLBStats(stats, athlete);
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

    const result: any = {};

    // Parse based on position
    if (position === 'QB') {
      const passingStr = stats[0] || '0/0';
      const [completions, attempts] = passingStr.split('/').map(s => parseInt(s) || 0);
      
      result.completions = completions;
      result.attempts = attempts;
      result.passing_yards = parseInt(stats[1]) || 0;
      result.passing_touchdowns = parseInt(stats[2]) || 0;
      result.interceptions = parseInt(stats[3]) || 0;
      result.sacks = parseInt(stats[4]) || 0;
      result.qb_rating = parseFloat(stats[5]) || 0;
    }

    // Rushing stats (usually starts at index 6 for QBs, 0 for RBs)
    const rushIndex = position === 'QB' ? 6 : 0;
    if (stats[rushIndex]) {
      result.rushing_attempts = parseInt(stats[rushIndex]) || 0;
      result.rushing_yards = parseInt(stats[rushIndex + 1]) || 0;
      result.rushing_touchdowns = parseInt(stats[rushIndex + 2]) || 0;
      result.rushing_long = parseInt(stats[rushIndex + 3]) || 0;
    }

    // Receiving stats
    const recIndex = position === 'WR' || position === 'TE' ? 0 : 
                    position === 'RB' ? 4 : 10;
    if (stats[recIndex] && position !== 'QB') {
      result.receptions = parseInt(stats[recIndex]) || 0;
      result.receiving_yards = parseInt(stats[recIndex + 1]) || 0;
      result.receiving_touchdowns = parseInt(stats[recIndex + 2]) || 0;
      result.receiving_long = parseInt(stats[recIndex + 3]) || 0;
      result.targets = parseInt(stats[recIndex + 4]) || 0;
    }

    // Default values for missing stats
    result.fumbles = 0;
    result.fumbles_lost = 0;
    result.two_point_conversions = 0;

    return result;
  }

  private parseMLBStats(stats: any[], athlete: any): any {
    if (!stats || stats.length === 0) return null;

    // MLB batting stats - based on actual API response
    // Stats: ['H-AB', 'AB', 'R', 'H', 'RBI', 'HR', 'BB', 'K', '#P', 'AVG', 'OBP', 'SLG']
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
      singles: 0
    };

    // Calculate singles from total hits (simplified - would need more data for doubles/triples)
    if (result.hits > 0) {
      result.singles = Math.max(0, result.hits - result.home_runs);
    }

    // Pitching stats defaults
    result.innings_pitched = 0;
    result.wins = 0;
    result.losses = 0;
    result.saves = 0;
    result.earned_runs = 0;
    result.hits_allowed = 0;
    result.walks_allowed = 0;

    return result;
  }

  private calculateFantasyPoints(stats: any, league: string): number {
    switch (league) {
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
          (stats.receptions || 0) * 1 + // PPR
          (stats.two_point_conversions || 0) * 2 -
          (stats.interceptions || 0) * 2 -
          (stats.fumbles_lost || 0) * 2
        );

      case 'MLB':
        // Batting points
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
        
        // Pitching points
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

  private getEspnSport(league: string): string {
    switch (league) {
      case 'NBA': return 'basketball';
      case 'NFL': return 'football';
      case 'MLB': return 'baseball';
      default: return league.toLowerCase();
    }
  }

  private getSport(league: string): string {
    switch (league) {
      case 'NBA': return 'basketball';
      case 'NFL': return 'football';
      case 'MLB': return 'baseball';
      default: return league.toLowerCase();
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
    
    console.log(chalk.bold.yellow('\n📊 TURBO STATS COLLECTION COMPLETE!'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.white(`Total Games Processed: ${chalk.bold(this.stats.gamesProcessed)}`));
    console.log(chalk.white(`Total Players Updated: ${chalk.bold(this.stats.playersUpdated)}`));
    
    // Show breakdown by league
    console.log(chalk.cyan('\nBreakdown by League:'));
    for (const [league, stats] of Object.entries(this.stats.byLeague)) {
      console.log(chalk.white(
        `  ${league}: ${stats.games} games, ${stats.players} players, ${stats.errors} errors`
      ));
    }
    
    console.log(chalk.white(`\nTotal Errors: ${chalk.red(this.stats.errors)}`));
    console.log(chalk.white(`Time: ${elapsed.toFixed(1)}s`));
    console.log(chalk.white(`Rate: ${(this.stats.playersUpdated / elapsed).toFixed(1)} players/second`));
    
    if (this.stats.gamesProcessed > 0) {
      console.log(chalk.bold.green('\n✅ TURBO COLLECTION COMPLETE!'));
      console.log(chalk.yellow('Run again to collect more games or use --league flag to target specific sport'));
    }
  }
}

// CLI handling
const args = process.argv.slice(2);
const league = args.find(arg => ['NBA', 'NFL', 'MLB'].includes(arg.toUpperCase()))?.toUpperCase();
const limitArg = args.find(arg => arg.startsWith('--limit='));
const gameLimit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

// Run the collector
const collector = new TurboStatsCollector();
collector.collectAllStats(league, gameLimit).catch(console.error);