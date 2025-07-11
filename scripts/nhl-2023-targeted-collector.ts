#!/usr/bin/env tsx
/**
 * 🏒 NHL 2023-24 TARGETED COLLECTOR - Complete the season!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class NHL2023Collector {
  private limit = pLimit(3); // Limit concurrent requests
  private playerCache = new Map<string, number>();
  private teamCache = new Map<string, number>();
  
  async run() {
    console.log(chalk.bold.cyan('🏒 NHL 2023-24 TARGETED COLLECTOR\n'));
    
    // Load caches
    await this.loadCaches();
    
    // Get all 2023-24 NHL games with pagination
    const allGames: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .eq('sport_id', 'nhl')
        .gte('start_time', '2023-10-01')
        .lt('start_time', '2024-07-01')
        .order('start_time')
        .range(offset, offset + pageSize - 1);
      
      if (error || !games || games.length === 0) break;
      
      allGames.push(...games);
      if (games.length < pageSize) break;
      offset += pageSize;
    }
    
    const games = allGames;
    
    if (games.length === 0) {
      console.log('No 2023-24 NHL games found!');
      return;
    }
    
    console.log(`Found ${games.length} NHL 2023-24 games to process\n`);
    
    let processed = 0;
    let withStats = 0;
    
    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(game => 
          this.limit(async () => {
            const stats = await this.collectGameStats(game);
            processed++;
            if (stats > 0) withStats++;
            
            if (processed % 100 === 0) {
              console.log(`Progress: ${processed}/${games.length} games (${withStats} with stats)`);
            }
          })
        )
      );
    }
    
    console.log(chalk.green(`\n✅ COMPLETE! Processed ${processed} games, ${withStats} had stats`));
  }
  
  private async loadCaches() {
    // Load all NHL players
    const { data: players } = await supabase
      .from('players')
      .select('id, name, external_id')
      .eq('sport', 'nhl');
    
    players?.forEach(p => {
      this.playerCache.set(p.name.toLowerCase(), p.id);
      if (p.external_id) {
        this.playerCache.set(p.external_id, p.id);
      }
    });
    
    // Load all NHL teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport_id', 'nhl');
    
    teams?.forEach(t => {
      this.teamCache.set(t.abbreviation.toLowerCase(), t.id);
      this.teamCache.set(t.name.toLowerCase(), t.id);
    });
    
    console.log(`Loaded ${this.playerCache.size} player entries, ${this.teamCache.size} team entries`);
  }
  
  private async collectGameStats(game: any): Promise<number> {
    try {
      // Check if game already has stats
      const { count: existing } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (existing && existing > 0) {
        return existing; // Already has stats
      }
      
      // ESPN API URL for NHL box score
      // Extract the numeric ID from external_id format: "espn_nhl_401547450" -> "401547450"
      const espnId = game.external_id?.replace('espn_nhl_', '') || game.external_id;
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${espnId}`;
      
      const response = await axios.get(url);
      const data = response.data;
      
      if (!data.boxscore || !data.boxscore.players) {
        return 0;
      }
      
      const statsToInsert = [];
      
      // Process both teams
      for (const team of data.boxscore.players) {
        const teamId = this.teamCache.get(team.team.abbreviation.toLowerCase());
        if (!teamId) continue;
        
        // Process skaters
        if (team.statistics && team.statistics[0] && team.statistics[0].athletes) {
          for (const athlete of team.statistics[0].athletes) {
            const playerId = this.playerCache.get(athlete.athlete.displayName.toLowerCase());
            if (!playerId) continue;
            
            const stats = this.parseNHLStats(athlete.stats);
            if (Object.keys(stats).length > 0) {
              statsToInsert.push({
                game_id: game.id,
                player_id: playerId,
                team_id: teamId,
                opponent_id: teamId === game.home_team_id ? game.away_team_id : game.home_team_id,
                game_date: game.start_time,
                stats,
                fantasy_points: this.calculateNHLFantasyPoints(stats)
              });
            }
          }
        }
      }
      
      // Insert stats
      if (statsToInsert.length > 0) {
        const { error } = await supabase
          .from('player_game_logs')
          .upsert(statsToInsert, { onConflict: 'game_id,player_id' });
        
        if (error) {
          console.error(`Error inserting stats for game ${game.id}:`, error.message);
          return 0;
        }
      }
      
      return statsToInsert.length;
    } catch (error: any) {
      if (!error.response || error.response.status !== 404) {
        console.error(`Error collecting game ${game.id}:`, error.message);
      }
      return 0;
    }
  }
  
  private parseNHLStats(stats: string[]): any {
    // NHL stats order varies by position
    // Skaters: G, A, +/-, SOG, PIM, TOI
    return {
      G: parseInt(stats[0]) || 0,
      A: parseInt(stats[1]) || 0,
      PlusMinus: parseInt(stats[2]) || 0,
      SOG: parseInt(stats[3]) || 0,
      PIM: parseInt(stats[4]) || 0,
      TOI: stats[5] || '0:00'
    };
  }
  
  private calculateNHLFantasyPoints(stats: any): number {
    // Standard NHL fantasy scoring
    return (
      stats.G * 3 +        // Goals
      stats.A * 2 +        // Assists
      stats.SOG * 0.5 +    // Shots on goal
      stats.PlusMinus * 1  // Plus/minus
    );
  }
}

// Run the collector
const collector = new NHL2023Collector();
collector.run().catch(console.error);