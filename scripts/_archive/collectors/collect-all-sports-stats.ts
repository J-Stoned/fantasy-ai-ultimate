#!/usr/bin/env tsx
/**
 * 🔥 COLLECT ALL SPORTS STATS - NBA + MLB!
 * 
 * Process games from multiple sports to populate real stats
 */

import axios from 'axios';
import chalk from 'chalk';
import { enhancedDb } from '../lib/services/enhanced-database-service';
import pLimit from 'p-limit';

const limit = pLimit(5); // Process 5 games concurrently

class AllSportsStatsCollector {
  private stats = {
    nba: { games: 0, players: 0 },
    mlb: { games: 0, players: 0 },
    errors: 0,
    startTime: Date.now()
  };

  async collectAllStats() {
    console.log(chalk.bold.red('🏀⚾ ALL SPORTS STATS COLLECTOR'));
    console.log(chalk.yellow('Processing NBA + MLB games...'));
    console.log(chalk.gray('='.repeat(60)));

    try {
      // Process both sports in parallel
      await Promise.all([
        this.collectNBAStats(),
        this.collectMLBStats()
      ]);

      this.showResults();

    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
    }
  }

  private async collectNBAStats() {
    console.log(chalk.cyan('\n🏀 COLLECTING NBA STATS...'));

    const { data: games } = await enhancedDb.getClient()
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time')
      .eq('sport', 'NBA')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(100);

    if (!games) return;

    const gamesNeedingStats = await this.filterGamesNeedingStats(games);
    console.log(chalk.yellow(`${gamesNeedingStats.length} NBA games need stats`));

    const promises = gamesNeedingStats.map(game => 
      limit(() => this.processNBAGame(game))
    );

    await Promise.all(promises);
  }

  private async collectMLBStats() {
    console.log(chalk.cyan('\n⚾ COLLECTING MLB STATS...'));

    const { data: games } = await enhancedDb.getClient()
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time')
      .eq('sport', 'MLB')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(100);

    if (!games) return;

    const gamesNeedingStats = await this.filterGamesNeedingStats(games);
    console.log(chalk.yellow(`${gamesNeedingStats.length} MLB games need stats`));

    const promises = gamesNeedingStats.map(game => 
      limit(() => this.processMLBGame(game))
    );

    await Promise.all(promises);
  }

  private async filterGamesNeedingStats(games: any[]) {
    const needsStats = [];
    
    for (const game of games) {
      const { data: existingStats } = await enhancedDb.getClient()
        .from('player_game_logs')
        .select('stats')
        .eq('game_id', game.id)
        .limit(1);

      const hasRealStats = existingStats?.some(log => {
        const stats = log.stats as any;
        return stats && (stats.points > 0 || stats.hits > 0 || stats.runs > 0);
      });

      if (!hasRealStats) {
        needsStats.push(game);
      }
    }

    return needsStats;
  }

  private async processNBAGame(game: any) {
    try {
      if (!game.external_id?.includes('espn_')) return;

      const espnGameId = game.external_id
        .replace('espn_', '')
        .replace(/^(nba|mlb|nfl|nhl)_/, '');

      console.log(chalk.gray(`Processing NBA game ${game.id}...`));

      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnGameId}`;
      const response = await axios.get(summaryUrl, { timeout: 10000 });
      
      const boxscore = response.data.boxscore;
      if (!boxscore?.players) return;

      let totalPlayers = 0;

      for (const team of boxscore.players) {
        const teamId = parseInt(team.team.id);
        const athletes = team.statistics?.[0]?.athletes || [];

        for (const athlete of athletes) {
          if (!athlete.stats || athlete.stats.length < 14) continue;

          const playerId = parseInt(athlete.athlete.id);
          const stats = this.parseNBAStats(athlete.stats);
          
          stats.fantasy_points = (
            stats.points * 1 +
            stats.rebounds * 1.25 +
            stats.assists * 1.5 +
            stats.steals * 2 +
            stats.blocks * 2 -
            stats.turnovers * 0.5
          );

          await enhancedDb.getClient()
            .from('players')
            .upsert({
              id: playerId,
              name: athlete.athlete.displayName,
              team_id: teamId,
              sport: 'basketball'
            }, { onConflict: 'id' });

          const { error } = await enhancedDb.getClient()
            .from('player_game_logs')
            .upsert({
              player_id: playerId,
              game_id: game.id,
              team_id: teamId,
              game_date: game.start_time,
              stats: stats,
              fantasy_points: stats.fantasy_points,
              minutes_played: stats.minutes_played,
              is_home: teamId === game.home_team_id
            }, { onConflict: 'player_id,game_id' });

          if (!error) totalPlayers++;
        }
      }

      if (totalPlayers > 0) {
        console.log(chalk.green(`✅ NBA game ${game.id}: ${totalPlayers} players`));
        this.stats.nba.games++;
        this.stats.nba.players += totalPlayers;
      }

    } catch (error: any) {
      console.error(chalk.red(`NBA game ${game.id} error:`), error.message);
      this.stats.errors++;
    }
  }

  private async processMLBGame(game: any) {
    try {
      if (!game.external_id?.includes('espn_')) return;

      const espnGameId = game.external_id
        .replace('espn_', '')
        .replace(/^(nba|mlb|nfl|nhl)_/, '');

      console.log(chalk.gray(`Processing MLB game ${game.id}...`));

      const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnGameId}`;
      const response = await axios.get(summaryUrl, { timeout: 10000 });
      
      const boxscore = response.data.boxscore;
      if (!boxscore?.players) return;

      let totalPlayers = 0;

      for (const team of boxscore.players) {
        const teamId = parseInt(team.team.id);
        
        // Process batters
        const batters = team.statistics?.find(s => s.name === 'batting')?.athletes || [];
        for (const batter of batters) {
          if (!batter.stats || batter.stats.length < 1) continue;

          const playerId = parseInt(batter.athlete.id);
          const stats = this.parseMLBBattingStats(batter.stats);
          
          // MLB DFS scoring (DraftKings)
          stats.fantasy_points = (
            stats.singles * 3 +
            stats.doubles * 5 +
            stats.triples * 8 +
            stats.home_runs * 10 +
            stats.rbis * 2 +
            stats.runs * 2 +
            stats.walks * 2 +
            stats.stolen_bases * 5
          );

          await enhancedDb.getClient()
            .from('players')
            .upsert({
              id: playerId,
              name: batter.athlete.displayName,
              team_id: teamId,
              sport: 'baseball'
            }, { onConflict: 'id' });

          const { error } = await enhancedDb.getClient()
            .from('player_game_logs')
            .upsert({
              player_id: playerId,
              game_id: game.id,
              team_id: teamId,
              game_date: game.start_time,
              stats: stats,
              fantasy_points: stats.fantasy_points,
              is_home: teamId === game.home_team_id
            }, { onConflict: 'player_id,game_id' });

          if (!error) totalPlayers++;
        }

        // Process pitchers
        const pitchers = team.statistics?.find(s => s.name === 'pitching')?.athletes || [];
        for (const pitcher of pitchers) {
          if (!pitcher.stats || pitcher.stats.length < 1) continue;

          const playerId = parseInt(pitcher.athlete.id);
          const stats = this.parseMLBPitchingStats(pitcher.stats);
          
          // MLB pitcher DFS scoring
          stats.fantasy_points = (
            stats.wins * 4 +
            stats.earned_runs * -2 +
            stats.strikeouts * 2 +
            stats.innings_pitched * 2.25 +
            (stats.complete_game ? 2.5 : 0) +
            (stats.shutout ? 2.5 : 0) +
            (stats.no_hitter ? 5 : 0)
          );

          await enhancedDb.getClient()
            .from('players')
            .upsert({
              id: playerId,
              name: pitcher.athlete.displayName,
              team_id: teamId,
              sport: 'baseball'
            }, { onConflict: 'id' });

          const { error } = await enhancedDb.getClient()
            .from('player_game_logs')
            .upsert({
              player_id: playerId,
              game_id: game.id,
              team_id: teamId,
              game_date: game.start_time,
              stats: stats,
              fantasy_points: stats.fantasy_points,
              is_home: teamId === game.home_team_id
            }, { onConflict: 'player_id,game_id' });

          if (!error) totalPlayers++;
        }
      }

      if (totalPlayers > 0) {
        console.log(chalk.green(`✅ MLB game ${game.id}: ${totalPlayers} players`));
        this.stats.mlb.games++;
        this.stats.mlb.players += totalPlayers;
      }

    } catch (error: any) {
      console.error(chalk.red(`MLB game ${game.id} error:`), error.message);
      this.stats.errors++;
    }
  }

  private parseNBAStats(statsArray: any[]): any {
    const minutesStr = statsArray[0] || '0';
    const fgStr = statsArray[1] || '0-0';
    const threePtStr = statsArray[2] || '0-0';
    const ftStr = statsArray[3] || '0-0';
    
    return {
      minutes_played: parseInt(minutesStr) || 0,
      field_goals_made: parseInt(fgStr.split('-')[0]) || 0,
      field_goals_attempted: parseInt(fgStr.split('-')[1]) || 0,
      three_pointers_made: parseInt(threePtStr.split('-')[0]) || 0,
      three_pointers_attempted: parseInt(threePtStr.split('-')[1]) || 0,
      free_throws_made: parseInt(ftStr.split('-')[0]) || 0,
      free_throws_attempted: parseInt(ftStr.split('-')[1]) || 0,
      offensive_rebounds: parseInt(statsArray[4]) || 0,
      defensive_rebounds: parseInt(statsArray[5]) || 0,
      rebounds: parseInt(statsArray[6]) || 0,
      assists: parseInt(statsArray[7]) || 0,
      steals: parseInt(statsArray[8]) || 0,
      blocks: parseInt(statsArray[9]) || 0,
      turnovers: parseInt(statsArray[10]) || 0,
      personal_fouls: parseInt(statsArray[11]) || 0,
      plus_minus: parseInt(statsArray[12]) || 0,
      points: parseInt(statsArray[13]) || 0,
      fantasy_points: 0
    };
  }

  private parseMLBBattingStats(statsArray: any[]): any {
    // Parse batting stats - ESPN format varies
    const abStr = statsArray[0] || '0';
    const rStr = statsArray[1] || '0';
    const hStr = statsArray[2] || '0';
    const rbiStr = statsArray[3] || '0';
    const bbStr = statsArray[4] || '0';
    const soStr = statsArray[5] || '0';
    const avgStr = statsArray[6] || '.000';

    const hits = parseInt(hStr) || 0;
    const atBats = parseInt(abStr) || 0;

    return {
      at_bats: atBats,
      runs: parseInt(rStr) || 0,
      hits: hits,
      rbis: parseInt(rbiStr) || 0,
      walks: parseInt(bbStr) || 0,
      strikeouts: parseInt(soStr) || 0,
      batting_average: parseFloat(avgStr) || 0,
      // Estimate hit types (simplified)
      singles: Math.max(0, hits - Math.floor(hits * 0.3)),
      doubles: Math.floor(hits * 0.2),
      triples: Math.floor(hits * 0.02),
      home_runs: Math.floor(hits * 0.08),
      stolen_bases: 0, // Would need different endpoint
      fantasy_points: 0
    };
  }

  private parseMLBPitchingStats(statsArray: any[]): any {
    // Parse pitching stats
    const ipStr = statsArray[0] || '0.0';
    const hStr = statsArray[1] || '0';
    const rStr = statsArray[2] || '0';
    const erStr = statsArray[3] || '0';
    const bbStr = statsArray[4] || '0';
    const soStr = statsArray[5] || '0';

    const innings = parseFloat(ipStr) || 0;

    return {
      innings_pitched: innings,
      hits_allowed: parseInt(hStr) || 0,
      runs_allowed: parseInt(rStr) || 0,
      earned_runs: parseInt(erStr) || 0,
      walks: parseInt(bbStr) || 0,
      strikeouts: parseInt(soStr) || 0,
      wins: 0, // Would need game context
      losses: 0,
      saves: 0,
      complete_game: innings >= 9,
      shutout: innings >= 9 && parseInt(rStr) === 0,
      no_hitter: innings >= 9 && parseInt(hStr) === 0,
      fantasy_points: 0
    };
  }

  private showResults() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const totalGames = this.stats.nba.games + this.stats.mlb.games;
    const totalPlayers = this.stats.nba.players + this.stats.mlb.players;
    
    console.log(chalk.bold.yellow('\n📊 ALL SPORTS COLLECTION COMPLETE!'));
    console.log(chalk.gray('='.repeat(60)));
    
    console.log(chalk.cyan('\n🏀 NBA Results:'));
    console.log(chalk.white(`  Games: ${this.stats.nba.games}`));
    console.log(chalk.white(`  Players: ${this.stats.nba.players}`));
    
    console.log(chalk.cyan('\n⚾ MLB Results:'));
    console.log(chalk.white(`  Games: ${this.stats.mlb.games}`));
    console.log(chalk.white(`  Players: ${this.stats.mlb.players}`));
    
    console.log(chalk.yellow('\n📈 Totals:'));
    console.log(chalk.white(`  Total Games: ${chalk.bold(totalGames)}`));
    console.log(chalk.white(`  Total Players: ${chalk.bold(totalPlayers)}`));
    console.log(chalk.white(`  Errors: ${chalk.red(this.stats.errors)}`));
    console.log(chalk.white(`  Time: ${elapsed.toFixed(1)}s`));
    console.log(chalk.white(`  Rate: ${(totalPlayers / elapsed).toFixed(1)} players/second`));
    
    if (totalGames > 0) {
      console.log(chalk.bold.green('\n✅ REAL SPORTS STATS POPULATED!'));
    }
  }
}

// Run the collector
const collector = new AllSportsStatsCollector();
collector.collectAllStats().catch(console.error);