#!/usr/bin/env tsx
/**
 * Collect detailed player statistics for games
 * This adds depth to our data with individual performance metrics
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class PlayerStatsCollector {
  private statsCollected = 0;
  private playersAdded = 0;
  
  async collectStats() {
    console.log(chalk.blue.bold('📊 COLLECTING PLAYER STATISTICS\n'));
    
    // Get games that need stats
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .like('external_id', 'nfl_%')
      .order('start_time', { ascending: false })
      .limit(50);
      
    if (!games || games.length === 0) {
      console.log(chalk.red('No NFL games found for stats collection'));
      return;
    }
    
    console.log(chalk.yellow(`Processing ${games.length} NFL games...\n`));
    
    for (const game of games) {
      await this.collectGameStats(game);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(chalk.green.bold('\n✅ STATS COLLECTION COMPLETE!\n'));
    console.log(`Players added: ${this.playersAdded}`);
    console.log(`Stats collected: ${this.statsCollected}`);
  }
  
  private async collectGameStats(game: any) {
    try {
      // Extract ESPN game ID from external_id
      const espnId = game.external_id.replace('nfl_', '');
      
      // Get game summary with player stats
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`
      );
      
      const boxscore = response.data.boxscore;
      
      if (!boxscore || !boxscore.players) {
        return;
      }
      
      // Process each team's players
      for (const teamPlayers of boxscore.players) {
        const teamId = teamPlayers.team.id;
        
        // Process different stat categories
        for (const category of teamPlayers.statistics || []) {
          await this.processStatCategory(game.id, teamId, category);
        }
      }
      
      process.stdout.write(`\r   Processed game ${game.id} - ${this.statsCollected} stats collected`);
      
    } catch (error) {
      // Game stats might not be available
    }
  }
  
  private async processStatCategory(gameId: number, teamId: number, category: any) {
    const statType = category.name.toLowerCase();
    
    for (const player of category.athletes || []) {
      // Ensure player exists
      const playerData = {
        id: parseInt(player.athlete.id),
        name: player.athlete.displayName,
        position: player.athlete.position?.abbreviation || null,
        jersey_number: player.athlete.jersey || null,
        team_id: teamId
      };
      
      const { error: playerError } = await supabase
        .from('players')
        .upsert(playerData, { onConflict: 'id' });
        
      if (!playerError && !player.athlete.id) {
        this.playersAdded++;
      }
      
      // Process stats based on category
      if (statType === 'passing' && player.stats.length >= 10) {
        await this.saveStats(gameId, player.athlete.id, {
          passing_completions: parseInt(player.stats[0]) || 0,
          passing_attempts: parseInt(player.stats[1]) || 0,
          passing_yards: parseInt(player.stats[2]) || 0,
          passing_touchdowns: parseInt(player.stats[5]) || 0,
          passing_interceptions: parseInt(player.stats[6]) || 0,
          passing_rating: parseFloat(player.stats[9]) || 0
        });
      } else if (statType === 'rushing' && player.stats.length >= 5) {
        await this.saveStats(gameId, player.athlete.id, {
          rushing_attempts: parseInt(player.stats[0]) || 0,
          rushing_yards: parseInt(player.stats[1]) || 0,
          rushing_touchdowns: parseInt(player.stats[3]) || 0,
          rushing_long: parseInt(player.stats[4]) || 0
        });
      } else if (statType === 'receiving' && player.stats.length >= 5) {
        await this.saveStats(gameId, player.athlete.id, {
          receiving_receptions: parseInt(player.stats[0]) || 0,
          receiving_yards: parseInt(player.stats[1]) || 0,
          receiving_touchdowns: parseInt(player.stats[3]) || 0,
          receiving_targets: parseInt(player.stats[4]) || 0
        });
      }
    }
  }
  
  private async saveStats(gameId: number, playerId: number, stats: any) {
    for (const [statType, statValue] of Object.entries(stats)) {
      if (statValue !== 0) {
        const { error } = await supabase
          .from('player_stats')
          .upsert({
            game_id: gameId,
            player_id: playerId,
            stat_type: statType,
            stat_value: statValue as number
          });
          
        if (!error) {
          this.statsCollected++;
        }
      }
    }
  }
}

// Additional data sources we could tap into
console.log(chalk.cyan.bold('\n📚 ADDITIONAL DATA SOURCES:\n'));

console.log(chalk.yellow('Free APIs:'));
console.log('• ESPN - We\'re using this (extensive data)');
console.log('• The Odds API - Historical betting lines');
console.log('• OpenWeather API - Weather conditions');
console.log('• NewsAPI - Sports news sentiment');

console.log(chalk.yellow('\nData Repositories:'));
console.log('• nflverse (R/Python packages) - Complete NFL data');
console.log('• basketball-reference.com - NBA historical data');
console.log('• Kaggle Datasets:');
console.log('  - NFL Play by Play Data (2009-2024)');
console.log('  - NBA games data (1946-2024)');
console.log('  - MLB Pitch by Pitch data');

console.log(chalk.yellow('\nPremium Sources:'));
console.log('• Sportradar API - Real-time comprehensive data');
console.log('• Stats Perform - Advanced analytics');
console.log('• PFF (Pro Football Focus) - Player grades');

console.log(chalk.green.bold('\n💡 Data Collection Tips:'));
console.log('1. Use batch processing to avoid rate limits');
console.log('2. Cache API responses locally');
console.log('3. Collect data during off-peak hours');
console.log('4. Start with most recent seasons first');
console.log('5. Add data incrementally (don\'t overload DB)');

// Run the collector
const collector = new PlayerStatsCollector();
collector.collectStats().catch(console.error);