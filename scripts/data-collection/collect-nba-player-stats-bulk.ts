#!/usr/bin/env tsx
/**
 * 🏀 NBA PLAYER STATS BULK COLLECTOR
 * 
 * Collect player stats for thousands of NBA games
 * to boost our accuracy from 65% to 75%+!
 */

import chalk from 'chalk';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface PlayerBoxScore {
  player_id: string;
  player_name: string;
  team: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
}

class NBAStatsCollector {
  private stats = {
    gamesProcessed: 0,
    playerStatsCreated: 0,
    playersCreated: 0,
    errors: 0,
    startTime: Date.now()
  };

  async collectBulkStats() {
    console.log(chalk.bold.red('🏀 NBA PLAYER STATS BULK COLLECTOR'));
    console.log(chalk.yellow('Target: 10,000+ games for 75%+ accuracy!'));
    console.log(chalk.gray('='.repeat(60)));

    try {
      // Get NBA games without player stats
      const { data: games, count } = await supabase
        .from('games')
        .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
        .eq('sport', 'nba')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(10000);

      if (!games || games.length === 0) {
        console.log(chalk.red('No NBA games found!'));
        return;
      }

      console.log(chalk.green(`Found ${games.length} NBA games to process`));
      
      // Check which games already have stats
      const gameIds = games.map(g => g.id);
      const { data: existingStats } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', gameIds);
      
      const gamesWithStats = new Set(existingStats?.map(s => s.game_id) || []);
      const gamesToProcess = games.filter(g => !gamesWithStats.has(g.id));
      
      console.log(chalk.yellow(`${gamesToProcess.length} games need player stats`));
      
      // Process games in batches
      const batchSize = 10;
      for (let i = 0; i < gamesToProcess.length; i += batchSize) {
        const batch = gamesToProcess.slice(i, i + batchSize);
        
        await Promise.all(batch.map(game => this.collectGameStats(game)));
        
        // Progress update
        console.log(chalk.gray(`Progress: ${i + batch.length}/${gamesToProcess.length} games`));
        
        // Rate limiting
        await delay(2000);
      }

      this.printSummary();

    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
    }
  }

  private async collectGameStats(game: any) {
    try {
      // Try ESPN API first
      if (game.external_id?.startsWith('espn_')) {
        const espnId = game.external_id.replace('espn_', '');
        await this.collectESPNBoxScore(espnId, game.id);
        return;
      }

      // Try to find ESPN game ID by date and teams
      const gameDate = new Date(game.start_time);
      const dateStr = gameDate.toISOString().split('T')[0].replace(/-/g, '');
      
      // ESPN scoreboard API
      const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
      const response = await axios.get(scoreboardUrl);
      
      const events = response.data.events || [];
      
      // Find matching game
      for (const event of events) {
        const homeTeam = event.competitions[0].competitors.find((t: any) => t.homeAway === 'home');
        const awayTeam = event.competitions[0].competitors.find((t: any) => t.homeAway === 'away');
        
        // Simple match by scores
        if (homeTeam.score == game.home_score && awayTeam.score == game.away_score) {
          await this.collectESPNBoxScore(event.id, game.id);
          break;
        }
      }
      
    } catch (error: any) {
      console.error(chalk.red(`Error processing game ${game.id}:`), error.message);
      this.stats.errors++;
    }
  }

  private async collectESPNBoxScore(espnGameId: string, dbGameId: number) {
    try {
      const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnGameId}`;
      const response = await axios.get(boxscoreUrl);
      
      if (!response.data.boxscore?.players) {
        return;
      }

      const playerStats: any[] = [];
      
      // Process each team
      for (const teamData of response.data.boxscore.players) {
        const teamName = teamData.team.displayName;
        
        // Find statistics array
        const stats = teamData.statistics.find((s: any) => 
          s.name === 'starters' || s.name === 'bench'
        );
        
        if (!stats?.athletes) continue;
        
        for (const athlete of stats.athletes) {
          // Skip if no stats
          if (!athlete.stats || athlete.stats.length === 0) continue;
          
          const playerName = athlete.athlete.displayName;
          const playerId = athlete.athlete.id;
          
          // Parse stats array (ESPN uses positional array)
          const [min, fg, threes, ft, oreb, dreb, reb, ast, stl, blk, to, pf, plusMinus, pts] = athlete.stats;
          
          // Parse made/attempted
          const parseFraction = (str: string) => {
            if (!str || str === '--') return { made: 0, attempted: 0 };
            const [made, attempted] = str.split('-').map(Number);
            return { made: made || 0, attempted: attempted || 0 };
          };
          
          const fgStats = parseFraction(fg);
          const threeStats = parseFraction(threes);
          const ftStats = parseFraction(ft);
          
          // Ensure player exists
          const { data: player } = await supabase
            .from('players')
            .upsert({
              external_id: `espn_${playerId}`,
              name: playerName,
              team: teamName,
              position: athlete.athlete.position?.abbreviation || null
            }, { onConflict: 'external_id' })
            .select()
            .single();
          
          if (!player) continue;
          
          // Create player stats in key-value format
          const statsToInsert = [
            { stat_type: 'minutes', stat_value: parseInt(min) || 0 },
            { stat_type: 'points', stat_value: parseInt(pts) || 0 },
            { stat_type: 'rebounds', stat_value: parseInt(reb) || 0 },
            { stat_type: 'assists', stat_value: parseInt(ast) || 0 },
            { stat_type: 'steals', stat_value: parseInt(stl) || 0 },
            { stat_type: 'blocks', stat_value: parseInt(blk) || 0 },
            { stat_type: 'turnovers', stat_value: parseInt(to) || 0 },
            { stat_type: 'fouls', stat_value: parseInt(pf) || 0 },
            { stat_type: 'fg_made', stat_value: fgStats.made },
            { stat_type: 'fg_attempted', stat_value: fgStats.attempted },
            { stat_type: 'three_made', stat_value: threeStats.made },
            { stat_type: 'three_attempted', stat_value: threeStats.attempted },
            { stat_type: 'ft_made', stat_value: ftStats.made },
            { stat_type: 'ft_attempted', stat_value: ftStats.attempted }
          ].map(stat => ({
            player_id: player.id,
            game_id: dbGameId,
            stat_type: stat.stat_type,
            stat_value: stat.stat_value,
            fantasy_points: this.calculateFantasyPoints(stat.stat_type, stat.stat_value)
          }));
          
          playerStats.push(...statsToInsert);
        }
      }
      
      // Bulk insert all stats
      if (playerStats.length > 0) {
        const { error } = await supabase
          .from('player_stats')
          .insert(playerStats);
          
        if (!error) {
          this.stats.playerStatsCreated += playerStats.length;
          this.stats.gamesProcessed++;
          console.log(chalk.green(`✓ Game ${dbGameId}: ${playerStats.length} player stats added`));
        } else {
          console.error(chalk.red('Insert error:'), error);
          this.stats.errors++;
        }
      }
      
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error(chalk.red(`ESPN API error for game ${espnGameId}:`), error.message);
      }
      this.stats.errors++;
    }
  }

  private calculateFantasyPoints(statType: string, value: number): number {
    // Standard fantasy scoring
    const scoring: Record<string, number> = {
      points: 1,
      rebounds: 1.2,
      assists: 1.5,
      steals: 3,
      blocks: 3,
      turnovers: -1,
      fg_made: 0,
      three_made: 0.5,
      ft_made: 0
    };
    
    return value * (scoring[statType] || 0);
  }

  private printSummary() {
    const runtime = (Date.now() - this.stats.startTime) / 1000;
    
    console.log(chalk.bold.yellow('\n📊 COLLECTION SUMMARY:'));
    console.log(chalk.gray('='.repeat(60)));
    console.log(chalk.white(`Games processed: ${chalk.bold(this.stats.gamesProcessed)}`));
    console.log(chalk.white(`Player stats created: ${chalk.bold(this.stats.playerStatsCreated)}`));
    console.log(chalk.white(`Errors: ${chalk.bold.red(this.stats.errors)}`));
    console.log(chalk.white(`Runtime: ${chalk.bold(runtime.toFixed(1))} seconds`));
    console.log(chalk.white(`Stats per game: ${chalk.bold((this.stats.playerStatsCreated / this.stats.gamesProcessed).toFixed(1))}`));
    
    if (this.stats.gamesProcessed > 0) {
      console.log(chalk.bold.green('\n✅ SUCCESS! Player data collected for pattern enhancement!'));
      console.log(chalk.yellow('Next step: Run player feature engineering'));
    }
  }
}

// Run the collector
const collector = new NBAStatsCollector();
collector.collectBulkStats().catch(console.error);