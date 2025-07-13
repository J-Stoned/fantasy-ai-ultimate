#!/usr/bin/env tsx
/**
 * 🚀 TURBO REAL STATS COLLECTOR - ALL SPORTS
 * 
 * Uses the WORKING ESPN API method to get REAL boxscores
 * Processes NBA, NFL, MLB with actual player stats
 * Maximum parallel processing with standardized schema
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import axios from 'axios';
import pLimit from 'p-limit';
import * as os from 'os';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Use all CPU cores
const limit = pLimit(os.cpus().length);

class TurboRealStatsCollector {
  private processed = 0;
  private playersCreated = 0;
  private errors = 0;
  private startTime = Date.now();

  async run() {
    console.log(chalk.bold.green('🚀 TURBO REAL STATS COLLECTOR - ALL SPORTS'));
    console.log(chalk.gray(`CPU Cores: ${os.cpus().length} | Using ESPN API`));
    console.log('='.repeat(60));

    // Process each sport in parallel
    await Promise.all([
      this.collectNBA(),
      this.collectNFL(),
      this.collectMLB()
    ]);

    this.printResults();
  }

  private async collectNBA() {
    console.log(chalk.cyan('\n🏀 Collecting NBA games...'));
    
    try {
      // Get today's NBA games
      const scoreboardRes = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
      );
      
      const games = scoreboardRes.data.events || [];
      console.log(`Found ${games.length} NBA games`);

      // Process each game in parallel
      await Promise.all(
        games.map(game => 
          limit(async () => {
            if (game.status.type.completed) {
              await this.processNBAGame(game);
            }
          })
        )
      );

      // Also process recent games from database
      const { data: recentGames } = await supabase
        .from('games')
        .select('id, espn_id')
        .eq('sport_type', 'NBA')
        .not('espn_id', 'is', null)
        .order('start_time', { ascending: false })
        .limit(50);

      if (recentGames) {
        await Promise.all(
          recentGames.map(game => 
            limit(async () => {
              const espnId = game.espn_id?.split('_').pop();
              if (espnId) {
                await this.fetchAndSaveNBABoxscore(espnId, game.id);
              }
            })
          )
        );
      }
    } catch (error) {
      console.error('NBA collection error:', error);
    }
  }

  private async processNBAGame(game: any) {
    try {
      const gameId = game.id;
      
      // Create/update game record
      const { data: gameRecord } = await supabase
        .from('games')
        .upsert({
          espn_id: `nba_${gameId}`,
          sport_type: 'NBA',
          home_team_name: game.competitions[0].competitors[0].team.displayName,
          away_team_name: game.competitions[0].competitors[1].team.displayName,
          home_score: parseInt(game.competitions[0].competitors[0].score),
          away_score: parseInt(game.competitions[0].competitors[1].score),
          start_time: game.date,
          status: 'completed'
        }, { onConflict: 'espn_id' })
        .select()
        .single();

      if (gameRecord) {
        await this.fetchAndSaveNBABoxscore(gameId, gameRecord.id);
      }
    } catch (error) {
      this.errors++;
    }
  }

  private async fetchAndSaveNBABoxscore(espnId: string, gameId: number) {
    try {
      const res = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`
      );

      if (!res.data.boxscore) return;

      const boxscore = res.data.boxscore;
      const teams = boxscore.teams || [];

      for (const team of teams) {
        const statistics = team.statistics || [];
        
        for (const player of statistics) {
          if (!player.athlete) continue;

          // Parse stats
          const stats = {
            minutes: parseInt(player.minutes) || 0,
            points: parseInt(player.points) || 0,
            rebounds: parseInt(player.rebounds) || 0,
            assists: parseInt(player.assists) || 0,
            steals: parseInt(player.steals) || 0,
            blocks: parseInt(player.blocks) || 0,
            turnovers: parseInt(player.turnovers) || 0,
            fouls: parseInt(player.fouls) || 0,
            fgm: parseInt(player.fgm) || 0,
            fga: parseInt(player.fga) || 0,
            ftm: parseInt(player.ftm) || 0,
            fta: parseInt(player.fta) || 0,
            tpm: parseInt(player.tpm) || 0,
            tpa: parseInt(player.tpa) || 0
          };

          // Skip if no stats
          if (stats.minutes === 0 && stats.points === 0) continue;

          // Calculate fantasy points
          const fantasyPoints = stats.points + 
            stats.rebounds * 1.2 + 
            stats.assists * 1.5 + 
            stats.steals * 3 + 
            stats.blocks * 3 - 
            stats.turnovers;

          // Find or create player
          let { data: playerRecord } = await supabase
            .from('players')
            .select('id')
            .eq('espn_id', player.athlete.id)
            .single();

          if (!playerRecord) {
            const { data: newPlayer } = await supabase
              .from('players')
              .insert({
                name: player.athlete.displayName,
                espn_id: player.athlete.id,
                position: player.athlete.position?.abbreviation || 'G',
                jersey_number: player.athlete.jersey,
                team_id: team.team.id
              })
              .select()
              .single();
            
            playerRecord = newPlayer;
            this.playersCreated++;
          }

          if (playerRecord) {
            // Save stats
            await supabase
              .from('player_game_logs')
              .upsert({
                player_id: playerRecord.id,
                game_id: gameId,
                minutes_played: stats.minutes,
                points: stats.points,
                rebounds: stats.rebounds,
                assists: stats.assists,
                steals: stats.steals,
                blocks: stats.blocks,
                turnovers: stats.turnovers,
                personal_fouls: stats.fouls,
                field_goals_made: stats.fgm,
                field_goals_attempted: stats.fga,
                three_pointers_made: stats.tpm,
                three_pointers_attempted: stats.tpa,
                free_throws_made: stats.ftm,
                free_throws_attempted: stats.fta,
                fantasy_points: fantasyPoints,
                game_date: new Date().toISOString()
              }, { 
                onConflict: 'player_id,game_id' 
              });

            this.processed++;
          }
        }
      }
    } catch (error) {
      this.errors++;
    }
  }

  private async collectNFL() {
    console.log(chalk.blue('\n🏈 Collecting NFL games...'));
    
    try {
      const scoreboardRes = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
      );
      
      const games = scoreboardRes.data.events || [];
      console.log(`Found ${games.length} NFL games`);

      await Promise.all(
        games.map(game => 
          limit(async () => {
            if (game.status.type.completed) {
              await this.processNFLGame(game);
            }
          })
        )
      );
    } catch (error) {
      console.error('NFL collection error:', error);
    }
  }

  private async processNFLGame(game: any) {
    try {
      const gameId = game.id;
      
      // Create/update game record
      const { data: gameRecord } = await supabase
        .from('games')
        .upsert({
          espn_id: `nfl_${gameId}`,
          sport_type: 'NFL',
          home_team_name: game.competitions[0].competitors[0].team.displayName,
          away_team_name: game.competitions[0].competitors[1].team.displayName,
          home_score: parseInt(game.competitions[0].competitors[0].score),
          away_score: parseInt(game.competitions[0].competitors[1].score),
          start_time: game.date,
          status: 'completed'
        }, { onConflict: 'espn_id' })
        .select()
        .single();

      if (gameRecord) {
        await this.fetchAndSaveNFLBoxscore(gameId, gameRecord.id);
      }
    } catch (error) {
      this.errors++;
    }
  }

  private async fetchAndSaveNFLBoxscore(espnId: string, gameId: number) {
    try {
      const res = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`
      );

      if (!res.data.boxscore) return;

      const boxscore = res.data.boxscore;
      const teams = boxscore.teams || [];

      for (const team of teams) {
        const statistics = team.statistics || [];
        
        // Process different stat categories
        const passing = statistics.find(s => s.name === 'passingStats')?.athletes || [];
        const rushing = statistics.find(s => s.name === 'rushingStats')?.athletes || [];
        const receiving = statistics.find(s => s.name === 'receivingStats')?.athletes || [];
        
        // Process passing stats
        for (const player of passing) {
          if (!player.athlete) continue;
          
          const stats = {
            completions: parseInt(player.completions) || 0,
            attempts: parseInt(player.attempts) || 0,
            yards: parseInt(player.yards) || 0,
            touchdowns: parseInt(player.touchdowns) || 0,
            interceptions: parseInt(player.interceptions) || 0
          };
          
          // Skip if no stats
          if (stats.attempts === 0) continue;
          
          // Calculate fantasy points (standard scoring)
          const fantasyPoints = (stats.yards * 0.04) + 
            (stats.touchdowns * 4) - 
            (stats.interceptions * 2);
          
          await this.saveNFLPlayerStats(player, gameId, 'passing', stats, fantasyPoints, team.team.id);
        }
        
        // Process rushing stats
        for (const player of rushing) {
          if (!player.athlete) continue;
          
          const stats = {
            carries: parseInt(player.carries) || 0,
            yards: parseInt(player.yards) || 0,
            touchdowns: parseInt(player.touchdowns) || 0,
            fumbles: parseInt(player.fumbles) || 0
          };
          
          if (stats.carries === 0) continue;
          
          const fantasyPoints = (stats.yards * 0.1) + 
            (stats.touchdowns * 6) - 
            (stats.fumbles * 2);
          
          await this.saveNFLPlayerStats(player, gameId, 'rushing', stats, fantasyPoints, team.team.id);
        }
        
        // Process receiving stats
        for (const player of receiving) {
          if (!player.athlete) continue;
          
          const stats = {
            receptions: parseInt(player.receptions) || 0,
            targets: parseInt(player.targets) || 0,
            yards: parseInt(player.yards) || 0,
            touchdowns: parseInt(player.touchdowns) || 0
          };
          
          if (stats.targets === 0) continue;
          
          const fantasyPoints = (stats.receptions * 1) + 
            (stats.yards * 0.1) + 
            (stats.touchdowns * 6);
          
          await this.saveNFLPlayerStats(player, gameId, 'receiving', stats, fantasyPoints, team.team.id);
        }
      }
    } catch (error) {
      this.errors++;
    }
  }

  private async saveNFLPlayerStats(player: any, gameId: number, statType: string, stats: any, fantasyPoints: number, teamId: string) {
    // Find or create player
    let { data: playerRecord } = await supabase
      .from('players')
      .select('id')
      .eq('espn_id', player.athlete.id)
      .single();

    if (!playerRecord) {
      const { data: newPlayer } = await supabase
        .from('players')
        .insert({
          name: player.athlete.displayName,
          espn_id: player.athlete.id,
          position: player.athlete.position?.abbreviation || 'FLEX',
          jersey_number: player.athlete.jersey,
          team_id: teamId
        })
        .select()
        .single();
      
      playerRecord = newPlayer;
      this.playersCreated++;
    }

    if (playerRecord) {
      // Map NFL stats to standardized schema
      const gameLog: any = {
        player_id: playerRecord.id,
        game_id: gameId,
        fantasy_points: fantasyPoints,
        game_date: new Date().toISOString()
      };
      
      // Add sport-specific stats based on type
      if (statType === 'passing') {
        gameLog.passing_yards = stats.yards;
        gameLog.passing_touchdowns = stats.touchdowns;
        gameLog.passing_attempts = stats.attempts;
        gameLog.passing_completions = stats.completions;
        gameLog.interceptions = stats.interceptions;
      } else if (statType === 'rushing') {
        gameLog.rushing_yards = stats.yards;
        gameLog.rushing_touchdowns = stats.touchdowns;
        gameLog.rushing_attempts = stats.carries;
        gameLog.fumbles = stats.fumbles;
      } else if (statType === 'receiving') {
        gameLog.receiving_yards = stats.yards;
        gameLog.receiving_touchdowns = stats.touchdowns;
        gameLog.receptions = stats.receptions;
        gameLog.targets = stats.targets;
      }
      
      await supabase
        .from('player_game_logs')
        .upsert(gameLog, { 
          onConflict: 'player_id,game_id' 
        });

      this.processed++;
    }
  }

  private async collectMLB() {
    console.log(chalk.red('\n⚾ Collecting MLB games...'));
    
    try {
      const scoreboardRes = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard'
      );
      
      const games = scoreboardRes.data.events || [];
      console.log(`Found ${games.length} MLB games`);

      await Promise.all(
        games.map(game => 
          limit(async () => {
            if (game.status.type.completed) {
              await this.processMLBGame(game);
            }
          })
        )
      );
    } catch (error) {
      console.error('MLB collection error:', error);
    }
  }

  private async processMLBGame(game: any) {
    try {
      const gameId = game.id;
      
      // Create/update game record
      const { data: gameRecord } = await supabase
        .from('games')
        .upsert({
          espn_id: `mlb_${gameId}`,
          sport_type: 'MLB',
          home_team_name: game.competitions[0].competitors[0].team.displayName,
          away_team_name: game.competitions[0].competitors[1].team.displayName,
          home_score: parseInt(game.competitions[0].competitors[0].score),
          away_score: parseInt(game.competitions[0].competitors[1].score),
          start_time: game.date,
          status: 'completed'
        }, { onConflict: 'espn_id' })
        .select()
        .single();

      if (gameRecord) {
        await this.fetchAndSaveMLBBoxscore(gameId, gameRecord.id);
      }
    } catch (error) {
      this.errors++;
    }
  }

  private async fetchAndSaveMLBBoxscore(espnId: string, gameId: number) {
    try {
      const res = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`
      );

      if (!res.data.boxscore) return;

      const boxscore = res.data.boxscore;
      const teams = boxscore.teams || [];

      for (const team of teams) {
        // MLB has batting and pitching stats
        const batting = team.statistics?.find(s => s.type === 'batting')?.athletes || [];
        const pitching = team.statistics?.find(s => s.type === 'pitching')?.athletes || [];
        
        // Process batting stats
        for (const player of batting) {
          if (!player.athlete) continue;
          
          const stats = {
            atBats: parseInt(player.atBats) || 0,
            runs: parseInt(player.runs) || 0,
            hits: parseInt(player.hits) || 0,
            doubles: parseInt(player.doubles) || 0,
            triples: parseInt(player.triples) || 0,
            homeRuns: parseInt(player.homeRuns) || 0,
            rbi: parseInt(player.rbi) || 0,
            walks: parseInt(player.walks) || 0,
            strikeouts: parseInt(player.strikeouts) || 0,
            stolenBases: parseInt(player.stolenBases) || 0
          };
          
          // Skip if didn't play
          if (stats.atBats === 0 && stats.walks === 0) continue;
          
          // Calculate fantasy points (DraftKings scoring)
          const fantasyPoints = 
            (stats.hits - stats.doubles - stats.triples - stats.homeRuns) * 3 + // singles
            stats.doubles * 5 +
            stats.triples * 8 +
            stats.homeRuns * 10 +
            stats.rbi * 2 +
            stats.runs * 2 +
            stats.walks * 2 +
            stats.stolenBases * 5;
          
          await this.saveMLBPlayerStats(player, gameId, 'batting', stats, fantasyPoints, team.team.id);
        }
        
        // Process pitching stats
        for (const player of pitching) {
          if (!player.athlete) continue;
          
          const stats = {
            inningsPitched: parseFloat(player.inningsPitched) || 0,
            earnedRuns: parseInt(player.earnedRuns) || 0,
            hits: parseInt(player.hits) || 0,
            walks: parseInt(player.walks) || 0,
            strikeouts: parseInt(player.strikeouts) || 0,
            homeRuns: parseInt(player.homeRuns) || 0,
            pitchCount: parseInt(player.pitchCount) || 0
          };
          
          if (stats.inningsPitched === 0) continue;
          
          // Calculate fantasy points
          const fantasyPoints = 
            stats.inningsPitched * 2.25 +
            stats.strikeouts * 2 -
            stats.earnedRuns * 2 -
            stats.hits * 0.6 -
            stats.walks * 0.6 -
            stats.homeRuns * 2.6;
          
          await this.saveMLBPlayerStats(player, gameId, 'pitching', stats, fantasyPoints, team.team.id);
        }
      }
    } catch (error) {
      this.errors++;
    }
  }

  private async saveMLBPlayerStats(player: any, gameId: number, statType: string, stats: any, fantasyPoints: number, teamId: string) {
    // Find or create player
    let { data: playerRecord } = await supabase
      .from('players')
      .select('id')
      .eq('espn_id', player.athlete.id)
      .single();

    if (!playerRecord) {
      const { data: newPlayer } = await supabase
        .from('players')
        .insert({
          name: player.athlete.displayName,
          espn_id: player.athlete.id,
          position: player.athlete.position?.abbreviation || 'UTIL',
          jersey_number: player.athlete.jersey,
          team_id: teamId
        })
        .select()
        .single();
      
      playerRecord = newPlayer;
      this.playersCreated++;
    }

    if (playerRecord) {
      // Map MLB stats to standardized schema
      const gameLog: any = {
        player_id: playerRecord.id,
        game_id: gameId,
        fantasy_points: fantasyPoints,
        game_date: new Date().toISOString()
      };
      
      // Add sport-specific stats
      if (statType === 'batting') {
        gameLog.at_bats = stats.atBats;
        gameLog.runs = stats.runs;
        gameLog.hits = stats.hits;
        gameLog.doubles = stats.doubles;
        gameLog.triples = stats.triples;
        gameLog.home_runs = stats.homeRuns;
        gameLog.rbi = stats.rbi;
        gameLog.walks = stats.walks;
        gameLog.strikeouts = stats.strikeouts;
        gameLog.stolen_bases = stats.stolenBases;
      } else if (statType === 'pitching') {
        gameLog.innings_pitched = stats.inningsPitched;
        gameLog.earned_runs = stats.earnedRuns;
        gameLog.hits_allowed = stats.hits;
        gameLog.walks_allowed = stats.walks;
        gameLog.strikeouts_pitched = stats.strikeouts;
        gameLog.home_runs_allowed = stats.homeRuns;
        gameLog.pitch_count = stats.pitchCount;
      }
      
      await supabase
        .from('player_game_logs')
        .upsert(gameLog, { 
          onConflict: 'player_id,game_id' 
        });

      this.processed++;
    }
  }

  private printResults() {
    const runtime = (Date.now() - this.startTime) / 1000 / 60;
    const rate = Math.round(this.processed / runtime);

    console.log('\n' + chalk.bold.green('🏆 TURBO REAL STATS COMPLETE!'));
    console.log('='.repeat(60));
    console.log(`Players processed: ${chalk.green(this.processed)}`);
    console.log(`Players created: ${chalk.cyan(this.playersCreated)}`);
    console.log(`Errors: ${chalk.red(this.errors)}`);
    console.log(`Runtime: ${runtime.toFixed(1)} minutes`);
    console.log(`Speed: ${chalk.bold(rate)} players/minute`);
    console.log('\n' + chalk.bold.yellow('✅ REAL ESPN STATS COLLECTED!'));
  }
}

// Run the collector
new TurboRealStatsCollector().run().catch(console.error);