#!/usr/bin/env tsx
/**
 * ESPN STATS FIXED - Properly parse ESPN API structure
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class ESPNStatsFixer {
  private stats = {
    games: 0,
    players: 0,
    gameLogs: 0
  };

  async run() {
    console.log('🔧 ESPN STATS FIXER - CORRECT API PARSING');
    console.log('=========================================\n');
    
    try {
      // Test with one game to understand structure
      await this.debugGameStructure();
      
      // Then process recent games
      await this.processGamesCorrectly();
      
      console.log('\n✅ SUMMARY:');
      console.log(`Games: ${this.stats.games}`);
      console.log(`Players: ${this.stats.players}`);
      console.log(`Game logs: ${this.stats.gameLogs}`);
      
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async debugGameStructure() {
    console.log('🔍 Debugging ESPN API structure...\n');
    
    // Get a recent completed game
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
    );
    
    const game = response.data.events?.find((e: any) => e.status.type.completed);
    
    if (game) {
      console.log(`Game: ${game.name} (ID: ${game.id})`);
      
      // Get the summary
      const summary = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.id}`
      );
      
      // Explore the structure
      if (summary.data.boxscore?.players) {
        const teamData = summary.data.boxscore.players[0];
        console.log('\nTeam:', teamData.team.displayName);
        console.log('Statistics keys:', Object.keys(teamData.statistics));
        
        // Check what each number represents
        const statCategories = {
          '0': 'passing',
          '1': 'rushing', 
          '2': 'receiving',
          '3': 'fumbles',
          '4': 'defensive',
          '5': 'kicking',
          '6': 'punting',
          '7': 'kickReturns',
          '8': 'puntReturns',
          '9': 'interceptions'
        };
        
        // Look at each category
        for (const [key, name] of Object.entries(statCategories)) {
          if (teamData.statistics[key]) {
            const players = teamData.statistics[key];
            if (players.length > 0) {
              console.log(`\n${name} (${key}): ${players.length} players`);
              const firstPlayer = players[0];
              console.log('  First player:', firstPlayer.athlete?.displayName);
              console.log('  Stats array:', firstPlayer.stats);
              console.log('  Labels:', firstPlayer.labels);
            }
          }
        }
      }
    }
  }

  async processGamesCorrectly() {
    console.log('\n\n🏈 Processing games with correct parsing...\n');
    
    // Get week 17 games
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2024&seasontype=2&week=17'
    );
    
    const completedGames = response.data.events?.filter((e: any) => 
      e.status.type.completed
    ).slice(0, 5); // Process first 5 games
    
    for (const game of completedGames || []) {
      console.log(`\nProcessing: ${game.name}`);
      await this.processGameStats(game);
    }
  }

  async processGameStats(game: any) {
    try {
      const summary = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.id}`
      );
      
      if (!summary.data.boxscore?.players) {
        console.log('  ⚠️  No player data found');
        return;
      }
      
      this.stats.games++;
      
      // Process each team
      for (const teamData of summary.data.boxscore.players) {
        const teamName = teamData.team.displayName;
        console.log(`  Team: ${teamName}`);
        
        // Process passing stats (category 0)
        if (teamData.statistics[0]) {
          for (const player of teamData.statistics[0]) {
            await this.storePlayerStats(player, game.id, 'passing', teamData.team);
          }
        }
        
        // Process rushing stats (category 1)
        if (teamData.statistics[1]) {
          for (const player of teamData.statistics[1]) {
            await this.storePlayerStats(player, game.id, 'rushing', teamData.team);
          }
        }
        
        // Process receiving stats (category 2)
        if (teamData.statistics[2]) {
          for (const player of teamData.statistics[2]) {
            await this.storePlayerStats(player, game.id, 'receiving', teamData.team);
          }
        }
      }
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  async storePlayerStats(playerData: any, gameId: string, category: string, team: any) {
    try {
      const athlete = playerData.athlete;
      if (!athlete) return;
      
      // Upsert player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .upsert({
          external_id: `espn_${athlete.id}`,
          name: athlete.displayName,
          position: [athlete.position?.abbreviation].filter(Boolean),
          jersey_number: athlete.jersey,
          team_name: team.displayName
        }, { onConflict: 'external_id' })
        .select()
        .single();
      
      if (player) {
        this.stats.players++;
        
        // Parse stats based on category
        const stats: any = { category };
        
        if (category === 'passing' && playerData.stats) {
          // C/ATT, YDS, AVG, TD, INT, SACKS, QBR, RTG
          const [compAtt, yds, avg, td, int, sacks, qbr, rtg] = playerData.stats;
          const [comp, att] = (compAtt || '0/0').split('/').map(Number);
          
          stats.completions = comp || 0;
          stats.attempts = att || 0;
          stats.passing_yards = parseInt(yds) || 0;
          stats.passing_tds = parseInt(td) || 0;
          stats.interceptions = parseInt(int) || 0;
          stats.sacks = parseInt(sacks?.split('-')[0]) || 0;
          stats.qb_rating = parseFloat(rtg) || 0;
        } else if (category === 'rushing' && playerData.stats) {
          // CAR, YDS, AVG, TD, LONG
          const [car, yds, avg, td, long] = playerData.stats;
          
          stats.carries = parseInt(car) || 0;
          stats.rushing_yards = parseInt(yds) || 0;
          stats.rushing_tds = parseInt(td) || 0;
          stats.yards_per_carry = parseFloat(avg) || 0;
          stats.long = parseInt(long) || 0;
        } else if (category === 'receiving' && playerData.stats) {
          // REC, YDS, AVG, TD, LONG, TGTS
          const [rec, yds, avg, td, long, tgts] = playerData.stats;
          
          stats.receptions = parseInt(rec) || 0;
          stats.receiving_yards = parseInt(yds) || 0;
          stats.receiving_tds = parseInt(td) || 0;
          stats.yards_per_reception = parseFloat(avg) || 0;
          stats.long = parseInt(long) || 0;
          stats.targets = parseInt(tgts) || 0;
        }
        
        // Calculate fantasy points
        const fantasyPoints = this.calculateFantasyPoints(stats);
        
        // Store game log
        const { error: logError } = await supabase
          .from('player_game_logs')
          .insert({
            player_id: player.id,
            game_id: `espn_${gameId}`,
            game_date: new Date(),
            stats: stats,
            fantasy_points: fantasyPoints
          });
        
        if (!logError) {
          this.stats.gameLogs++;
          console.log(`    ✅ ${athlete.displayName} (${category}): ${fantasyPoints.toFixed(1)} pts`);
        }
      }
    } catch (error) {
      console.error(`    Error storing ${playerData.athlete?.displayName}:`, error.message);
    }
  }

  calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // Passing (4 pts per TD, 0.04 per yard, -2 per INT)
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_tds || 0) * 4;
    points += (stats.interceptions || 0) * -2;
    
    // Rushing (6 pts per TD, 0.1 per yard)
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_tds || 0) * 6;
    
    // Receiving (6 pts per TD, 0.1 per yard, 0.5 per reception in PPR)
    points += (stats.receptions || 0) * 0.5;
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_tds || 0) * 6;
    
    return points;
  }
}

// Run it
const fixer = new ESPNStatsFixer();
fixer.run();