#!/usr/bin/env tsx
/**
 * Fix the 66 NFL games without stats - targeted collector
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PlayerCache {
  [key: string]: {
    id: number;
    name: string;
  };
}

class NFLGameFixer {
  private playerCache: PlayerCache = {};
  private fixedGames = 0;
  private failedGames = 0;
  private stats: any[] = [];

  constructor() {}

  async loadPlayerCache() {
    console.log(chalk.yellow('Loading NFL players...'));
    
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: players, error } = await supabase
        .from('players')
        .select('id, name')
        .eq('sport', 'nfl')
        .range(offset, offset + limit - 1)
        .order('id');
      
      if (error) {
        console.error('Error loading players:', error);
        break;
      }
      
      if (players && players.length > 0) {
        players.forEach(player => {
          const key = this.normalizePlayerName(player.name);
          this.playerCache[key] = player;
        });
        offset += players.length;
        hasMore = players.length === limit;
      } else {
        hasMore = false;
      }
    }
    
    console.log(chalk.green(`Loaded ${Object.keys(this.playerCache).length} NFL players`));
  }

  normalizePlayerName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+jr$/i, '')
      .replace(/\s+sr$/i, '')
      .replace(/\s+iii$/i, '')
      .replace(/\s+ii$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  findPlayer(displayName: string): number | null {
    const normalized = this.normalizePlayerName(displayName);
    const player = this.playerCache[normalized];
    
    if (player) {
      return player.id;
    }
    
    // Try partial matches
    const parts = normalized.split(' ');
    if (parts.length >= 2) {
      const lastFirst = `${parts[parts.length - 1]} ${parts[0]}`;
      if (this.playerCache[lastFirst]) {
        return this.playerCache[lastFirst].id;
      }
    }
    
    return null;
  }

  async processGame(gameId: number, externalId: string) {
    try {
      // Clean the ESPN ID - remove ALL prefixes
      const espnId = externalId.replace(/^(?:espn_)?(?:nfl_)?/, '');
      
      console.log(chalk.blue(`\nProcessing game ${gameId} - ESPN ID: ${espnId}`));
      
      // Try the API call
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
        {
          params: { event: espnId },
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (!response.data.boxscore?.players) {
        console.log(chalk.yellow('  No boxscore data available'));
        this.failedGames++;
        return;
      }
      
      let totalStats = 0;
      
      // Process each team
      for (const team of response.data.boxscore.players) {
        const teamId = team.team?.id;
        
        for (const category of (team.statistics || [])) {
          const statType = category.name?.toLowerCase() || '';
          
          for (const athlete of (category.athletes || [])) {
            const playerId = this.findPlayer(athlete.athlete?.displayName || '');
            
            if (!playerId) {
              console.log(chalk.yellow(`  Player not found: ${athlete.athlete?.displayName}`));
              continue;
            }
            
            const statsData = this.extractStats(athlete.stats || [], statType);
            
            if (Object.keys(statsData).length > 0) {
              this.stats.push({
                game_id: gameId,
                player_id: playerId,
                team_id: teamId,
                sport: 'nfl',
                ...statsData,
                fantasy_points: this.calculateFantasyPoints(statsData)
              });
              totalStats++;
            }
          }
        }
      }
      
      if (totalStats > 0) {
        console.log(chalk.green(`  ✅ Collected ${totalStats} player stats`));
        this.fixedGames++;
      } else {
        console.log(chalk.yellow(`  ⚠️  No stats collected`));
        this.failedGames++;
      }
      
    } catch (error: any) {
      console.log(chalk.red(`  ❌ Error: ${error.response?.status || error.message}`));
      
      // If we get a 400, it might be the ESPN ID format
      if (error.response?.status === 400) {
        // Try without the "espn_" prefix if it exists
        if (externalId.startsWith('espn_')) {
          const cleanId = externalId.replace('espn_', '');
          console.log(chalk.yellow(`  Retrying with clean ID: ${cleanId}`));
          return this.processGame(gameId, cleanId);
        }
      }
      
      this.failedGames++;
    }
  }

  extractStats(stats: string[], statType: string): any {
    const result: any = {};
    
    if (statType.includes('passing')) {
      const [comp, att, yards, td, int] = stats;
      if (att && att !== '0') {
        result.passing_completions = parseInt(comp) || 0;
        result.passing_attempts = parseInt(att) || 0;
        result.passing_yards = parseInt(yards) || 0;
        result.passing_touchdowns = parseInt(td) || 0;
        result.passing_interceptions = parseInt(int) || 0;
      }
    } else if (statType.includes('rushing')) {
      const [carries, yards, avg, td] = stats;
      if (carries && carries !== '0') {
        result.rushing_attempts = parseInt(carries) || 0;
        result.rushing_yards = parseInt(yards) || 0;
        result.rushing_touchdowns = parseInt(td) || 0;
      }
    } else if (statType.includes('receiving')) {
      const [rec, yards, avg, td] = stats;
      if (rec && rec !== '0') {
        result.receiving_receptions = parseInt(rec) || 0;
        result.receiving_yards = parseInt(yards) || 0;
        result.receiving_touchdowns = parseInt(td) || 0;
      }
    }
    
    return result;
  }

  calculateFantasyPoints(stats: any): number {
    let points = 0;
    
    // Standard scoring
    points += (stats.passing_yards || 0) * 0.04;
    points += (stats.passing_touchdowns || 0) * 4;
    points += (stats.passing_interceptions || 0) * -2;
    points += (stats.rushing_yards || 0) * 0.1;
    points += (stats.rushing_touchdowns || 0) * 6;
    points += (stats.receiving_receptions || 0) * 0.5;
    points += (stats.receiving_yards || 0) * 0.1;
    points += (stats.receiving_touchdowns || 0) * 6;
    
    return Math.round(points * 100) / 100;
  }

  async saveStats() {
    if (this.stats.length === 0) {
      console.log(chalk.yellow('No stats to save'));
      return;
    }
    
    console.log(chalk.yellow(`\nSaving ${this.stats.length} stats to database...`));
    
    // Save in batches
    const batchSize = 100;
    for (let i = 0; i < this.stats.length; i += batchSize) {
      const batch = this.stats.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(batch, {
          onConflict: 'game_id,player_id',
          ignoreDuplicates: true
        });
      
      if (error) {
        console.error(chalk.red('Error saving batch:'), error);
      } else {
        console.log(chalk.green(`  Saved batch ${Math.floor(i / batchSize) + 1}`));
      }
    }
  }

  async run() {
    console.log(chalk.bold.cyan('\n🔧 NFL GAME FIXER - TARGETING 66 SPECIFIC GAMES\n'));
    
    // Load the game list from our analysis
    const analysisPath = './nfl-66-games-analysis.json';
    if (!fs.existsSync(analysisPath)) {
      console.error(chalk.red('Analysis file not found. Run analyze-66-games-specifically.ts first'));
      return;
    }
    
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
    const fixableGames = analysis.games.filter((g: any) => g.fixable);
    
    console.log(chalk.yellow(`Found ${fixableGames.length} fixable games from analysis`));
    
    // Load players
    await this.loadPlayerCache();
    
    // Process each game
    for (let i = 0; i < fixableGames.length; i++) {
      const game = fixableGames[i];
      
      console.log(chalk.yellow(`\nProgress: ${i + 1}/${fixableGames.length} (${((i + 1) / fixableGames.length * 100).toFixed(1)}%)`));
      await this.processGame(game.gameId, game.externalId);
      
      // Save stats every 10 games
      if ((i + 1) % 10 === 0) {
        await this.saveStats();
        this.stats = [];
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save remaining stats
    await this.saveStats();
    
    // Final report
    console.log(chalk.bold.cyan('\n📊 FINAL REPORT:\n'));
    console.log(`Games processed: ${fixableGames.length}`);
    console.log(`Games fixed: ${this.fixedGames}`);
    console.log(`Games failed: ${this.failedGames}`);
    console.log(`Success rate: ${(this.fixedGames / fixableGames.length * 100).toFixed(1)}%`);
    
    // Check new coverage
    const { data: totalGames } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null);
    
    const totalCount = totalGames?.length || 432;
    const newCoverage = ((366 + this.fixedGames) / totalCount * 100).toFixed(1);
    
    console.log(chalk.bold.green(`\n✨ NEW COVERAGE: ${newCoverage}%`));
    
    if (parseFloat(newCoverage) >= 95) {
      console.log(chalk.bold.green('🎉 ACHIEVED 95%+ COVERAGE - GOLD STANDARD!'));
    } else if (parseFloat(newCoverage) >= 90) {
      console.log(chalk.bold.yellow('✅ ACHIEVED 90%+ COVERAGE - PROFESSIONAL GRADE!'));
    }
  }
}

// Run the fixer
const fixer = new NFLGameFixer();
fixer.run().catch(console.error);