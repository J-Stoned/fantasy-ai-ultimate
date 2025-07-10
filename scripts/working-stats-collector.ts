#!/usr/bin/env tsx
/**
 * WORKING STATS COLLECTOR - Fixed player stats collection
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class WorkingStatsCollector {
  private stats = {
    games: 0,
    players: 0,
    gameLogs: 0,
    errors: 0
  };

  async run() {
    console.log('🎯 WORKING STATS COLLECTOR - FIXING PLAYER STATS');
    console.log('===============================================\n');
    
    const startTime = Date.now();
    
    try {
      // Test with one game first to debug
      await this.testSingleGame();
      
      // If that works, process recent games
      await this.processRecentGames();
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + '='.repeat(50));
      console.log(`✅ Collection complete in ${elapsed} seconds`);
      console.log(`📊 Games processed: ${this.stats.games}`);
      console.log(`👤 Players found: ${this.stats.players}`);
      console.log(`📈 Game logs created: ${this.stats.gameLogs}`);
      console.log(`❌ Errors: ${this.stats.errors}`);
      
    } catch (error) {
      console.error('Fatal error:', error);
    } finally {
      await prisma.$disconnect();
    }
  }

  async testSingleGame() {
    console.log('🧪 Testing with a single game first...\n');
    
    try {
      // Get a recent completed NFL game
      const response = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
      );
      
      const completedGame = response.data.events?.find((e: any) => 
        e.status.type.completed === true
      );
      
      if (completedGame) {
        console.log(`Found completed game: ${completedGame.name}`);
        console.log(`Game ID: ${completedGame.id}`);
        console.log(`Status: ${completedGame.status.type.name}`);
        
        // Get the box score
        await this.getDetailedBoxScore(completedGame.id, 'nfl');
      }
    } catch (error) {
      console.error('Test game error:', error);
    }
  }

  async getDetailedBoxScore(gameId: string, sport: string) {
    console.log(`\n📦 Getting box score for game ${gameId}...`);
    
    try {
      const endpoint = sport === 'nfl' ? 'football/nfl' : 'basketball/nba';
      const url = `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/summary?event=${gameId}`;
      
      console.log(`URL: ${url}`);
      
      const response = await axios.get(url);
      
      // Debug the response structure
      console.log('\nResponse structure:');
      console.log('- Has boxscore?', !!response.data.boxscore);
      console.log('- Has players?', !!response.data.boxscore?.players);
      console.log('- Has teams?', !!response.data.boxscore?.teams);
      
      // Try different paths for player stats
      if (response.data.boxscore?.players) {
        console.log('\n✅ Found players in boxscore.players');
        
        for (const teamPlayers of response.data.boxscore.players) {
          console.log(`\nTeam: ${teamPlayers.team.displayName}`);
          
          // Check statistics structure
          if (teamPlayers.statistics) {
            console.log('Statistics categories:', Object.keys(teamPlayers.statistics));
            
            for (const [category, players] of Object.entries(teamPlayers.statistics)) {
              console.log(`\n${category}: ${(players as any[]).length} players`);
              
              for (const player of players as any[]) {
                await this.processPlayerStat(player, gameId, category, teamPlayers.team);
              }
            }
          }
        }
      } else if (response.data.boxscore?.teams) {
        console.log('\n✅ Found teams in boxscore.teams');
        
        for (const team of response.data.boxscore.teams) {
          if (team.statistics) {
            for (const [category, stats] of Object.entries(team.statistics)) {
              if (Array.isArray(stats)) {
                console.log(`${category}: ${stats.length} players`);
              }
            }
          }
        }
      }
      
      // Also check for player participation
      if (response.data.playerParticipation) {
        console.log('\n✅ Found playerParticipation data');
      }
      
    } catch (error) {
      console.error('Box score error:', error.message);
      this.stats.errors++;
    }
  }

  async processPlayerStat(playerData: any, gameId: string, category: string, team: any) {
    try {
      // Extract player info
      const athlete = playerData.athlete || playerData;
      
      if (!athlete.id) {
        console.log('⚠️  No athlete ID found');
        return;
      }
      
      console.log(`  Processing ${athlete.displayName} (${category})`);
      
      // Upsert player
      const player = await prisma.player.upsert({
        where: {
          id: `espn_${athlete.id}`
        },
        update: {
          fullName: athlete.displayName,
          jerseyNumber: athlete.jersey,
          position: athlete.position ? [athlete.position.abbreviation] : []
        },
        create: {
          id: `espn_${athlete.id}`,
          firstName: athlete.displayName.split(' ')[0] || 'Unknown',
          lastName: athlete.displayName.split(' ').slice(1).join(' ') || 'Unknown',
          fullName: athlete.displayName,
          jerseyNumber: athlete.jersey,
          position: athlete.position ? [athlete.position.abbreviation] : [],
          sportId: 'nfl'
        }
      });
      
      this.stats.players++;
      
      // Parse stats based on category
      const stats: any = { category };
      
      if (playerData.stats && Array.isArray(playerData.stats)) {
        console.log(`    Raw stats: ${playerData.stats.join(', ')}`);
        
        if (category === 'passing') {
          stats.completions = parseInt(playerData.stats[0]) || 0;
          stats.attempts = parseInt(playerData.stats[1]) || 0;
          stats.passing_yards = parseInt(playerData.stats[2]) || 0;
          stats.passing_tds = parseInt(playerData.stats[4]) || 0;
          stats.interceptions = parseInt(playerData.stats[5]) || 0;
          stats.qb_rating = parseFloat(playerData.stats[8]) || 0;
        } else if (category === 'rushing') {
          stats.carries = parseInt(playerData.stats[0]) || 0;
          stats.rushing_yards = parseInt(playerData.stats[1]) || 0;
          stats.yards_per_carry = parseFloat(playerData.stats[2]) || 0;
          stats.rushing_tds = parseInt(playerData.stats[3]) || 0;
          stats.long = parseInt(playerData.stats[4]) || 0;
        } else if (category === 'receiving') {
          stats.receptions = parseInt(playerData.stats[0]) || 0;
          stats.receiving_yards = parseInt(playerData.stats[1]) || 0;
          stats.yards_per_reception = parseFloat(playerData.stats[2]) || 0;
          stats.receiving_tds = parseInt(playerData.stats[3]) || 0;
          stats.targets = parseInt(playerData.stats[4]) || 0;
          stats.long = parseInt(playerData.stats[5]) || 0;
        }
      }
      
      // Calculate fantasy points
      const fantasyPoints = this.calculateFantasyPoints(stats);
      console.log(`    Fantasy points: ${fantasyPoints.toFixed(2)}`);
      
      // Create game log
      const gameLog = await prisma.playerGameLog.create({
        data: {
          playerId: player.id,
          gameId: `espn_${gameId}`,
          gameDate: new Date(),
          stats: stats,
          fantasyPoints: fantasyPoints
        }
      });
      
      this.stats.gameLogs++;
      console.log(`    ✅ Game log created`);
      
    } catch (error) {
      console.error(`    ❌ Error processing ${playerData.athlete?.displayName}:`, error.message);
      this.stats.errors++;
    }
  }

  async processRecentGames() {
    console.log('\n\n🏈 Processing recent NFL games...\n');
    
    // Get recent weeks
    const weeks = [15, 16, 17, 18];
    
    for (const week of weeks) {
      try {
        console.log(`\nWeek ${week}:`);
        
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2024&seasontype=2&week=${week}`
        );
        
        const completedGames = response.data.events?.filter((e: any) => 
          e.status.type.completed === true
        ) || [];
        
        console.log(`Found ${completedGames.length} completed games`);
        
        for (const game of completedGames) {
          console.log(`\n  Processing: ${game.name}`);
          await this.getDetailedBoxScore(game.id, 'nfl');
          this.stats.games++;
        }
        
      } catch (error) {
        console.error(`Week ${week} error:`, error.message);
      }
    }
  }

  calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // Passing
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_tds || 0) * 4;
    points += (stats.interceptions || 0) * -2;
    
    // Rushing
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_tds || 0) * 6;
    
    // Receiving
    points += (stats.receptions || 0) * 0.5; // PPR
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_tds || 0) * 6;
    
    return points;
  }
}

// Run it
const collector = new WorkingStatsCollector();
collector.run();