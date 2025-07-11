#!/usr/bin/env tsx
/**
 * ⚾ MLB 2023 TARGETED COLLECTOR - Fix the stats gap!
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

class MLB2023Collector {
  private limit = pLimit(3); // Limit concurrent requests
  private playerCache = new Map<string, number>();
  private teamCache = new Map<string, number>();
  
  async run() {
    console.log(chalk.bold.red('⚾ MLB 2023 TARGETED COLLECTOR\n'));
    
    // Load caches
    await this.loadCaches();
    
    // Get all 2023 MLB games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport_id', 'mlb')
      .gte('start_time', '2023-01-01')
      .lt('start_time', '2024-01-01')
      .order('start_time');
    
    if (!games || games.length === 0) {
      console.log('No 2023 MLB games found!');
      return;
    }
    
    console.log(`Found ${games.length} MLB 2023 games to process\n`);
    
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
    // Load all MLB players
    const { data: players } = await supabase
      .from('players')
      .select('id, name, external_id')
      .eq('sport', 'mlb');
    
    players?.forEach(p => {
      this.playerCache.set(p.name.toLowerCase(), p.id);
      if (p.external_id) {
        this.playerCache.set(p.external_id, p.id);
      }
    });
    
    // Load all MLB teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, abbreviation')
      .eq('sport_id', 'mlb');
    
    teams?.forEach(t => {
      this.teamCache.set(t.abbreviation.toLowerCase(), t.id);
      this.teamCache.set(t.name.toLowerCase(), t.id);
    });
    
    console.log(`Loaded ${this.playerCache.size} player entries, ${this.teamCache.size} team entries`);
  }
  
  private async collectGameStats(game: any): Promise<number> {
    try {
      // ESPN API URL for MLB box score
      // Extract the numeric ID from external_id format: "espn_mlb_401472263" -> "401472263"
      const espnId = game.external_id?.replace('espn_mlb_', '') || game.external_id;
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`;
      
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
        
        // Process batters
        if (team.statistics && team.statistics[0] && team.statistics[0].athletes) {
          for (const athlete of team.statistics[0].athletes) {
            const playerId = this.playerCache.get(athlete.athlete.displayName.toLowerCase());
            if (!playerId) continue;
            
            const stats = this.parseMLBStats(athlete.stats);
            if (Object.keys(stats).length > 0) {
              statsToInsert.push({
                game_id: game.id,
                player_id: playerId,
                team_id: teamId,
                opponent_id: teamId === game.home_team_id ? game.away_team_id : game.home_team_id,
                game_date: game.start_time,
                stats,
                fantasy_points: this.calculateMLBFantasyPoints(stats)
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
  
  private parseMLBStats(stats: string[]): any {
    // MLB stats order: AB, R, H, RBI, HR, BB, SO, AVG
    return {
      AB: parseInt(stats[0]) || 0,
      R: parseInt(stats[1]) || 0,
      H: parseInt(stats[2]) || 0,
      RBI: parseInt(stats[3]) || 0,
      HR: parseInt(stats[4]) || 0,
      BB: parseInt(stats[5]) || 0,
      SO: parseInt(stats[6]) || 0,
      AVG: parseFloat(stats[7]) || 0
    };
  }
  
  private calculateMLBFantasyPoints(stats: any): number {
    // Standard MLB fantasy scoring
    return (
      stats.R * 1 +      // Runs
      stats.H * 1 +      // Hits
      stats.RBI * 1 +    // RBIs
      stats.HR * 4 +     // Home runs
      stats.BB * 1 +     // Walks
      stats.SO * -1      // Strikeouts
    );
  }
}

// Run the collector
const collector = new MLB2023Collector();
collector.run().catch(console.error);