#!/usr/bin/env tsx
/**
 * ⚾ MLB 2023-2024 MEGA COLLECTOR - Get BOTH seasons!
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

class MLB20232024Collector {
  private limit = pLimit(3);
  private playerCache = new Map<string, number>();
  private teamCache = new Map<string, number>();
  
  async run() {
    console.log(chalk.bold.red('⚾ MLB 2023-2024 MEGA COLLECTOR\n'));
    
    await this.loadCaches();
    
    // Get ALL MLB games from 2023 AND 2024
    const allGames: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .eq('sport_id', 'mlb')
        .gte('start_time', '2023-01-01')
        .lt('start_time', '2025-01-01')
        .order('start_time')
        .range(offset, offset + pageSize - 1);
      
      if (error || !games || games.length === 0) break;
      
      allGames.push(...games);
      if (games.length < pageSize) break;
      offset += pageSize;
    }
    
    const games = allGames;
    
    if (games.length === 0) {
      console.log('No MLB games found!');
      return;
    }
    
    // Split by season for reporting
    const games2023 = games.filter(g => g.start_time < '2024-01-01');
    const games2024 = games.filter(g => g.start_time >= '2024-01-01');
    
    console.log(`Found ${games.length} total MLB games:`);
    console.log(`- 2023 season: ${games2023.length} games`);
    console.log(`- 2024 season: ${games2024.length} games\n`);
    
    let processed = 0;
    let withStats = 0;
    let alreadyHadStats = 0;
    
    const batchSize = 50;
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(game => 
          this.limit(async () => {
            const stats = await this.collectGameStats(game);
            processed++;
            
            if (stats > 0) {
              if (stats === -1) {
                alreadyHadStats++;
              } else {
                withStats++;
              }
            }
            
            if (processed % 100 === 0) {
              console.log(`Progress: ${processed}/${games.length} games (${withStats} newly added, ${alreadyHadStats} already had stats)`);
            }
          })
        )
      );
    }
    
    console.log(chalk.green(`\n✅ COMPLETE!`));
    console.log(`Processed: ${processed} games`);
    console.log(`Newly added: ${withStats} games`);
    console.log(`Already had stats: ${alreadyHadStats} games`);
    console.log(`Total with stats: ${withStats + alreadyHadStats}/${processed} (${((withStats + alreadyHadStats) / processed * 100).toFixed(1)}%)`);
  }
  
  private async loadCaches() {
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
      const { count: existing } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (existing && existing > 0) {
        return -1; // Already has stats
      }
      
      const espnId = game.external_id?.replace('espn_mlb_', '') || game.external_id;
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`;
      
      const response = await axios.get(url);
      const data = response.data;
      
      if (!data.boxscore || !data.boxscore.players) {
        return 0;
      }
      
      const statsToInsert = [];
      
      for (const team of data.boxscore.players) {
        const teamId = this.teamCache.get(team.team.abbreviation.toLowerCase());
        if (!teamId) continue;
        
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
    return (
      stats.R * 1 +
      stats.H * 1 +
      stats.RBI * 1 +
      stats.HR * 4 +
      stats.BB * 1 +
      stats.SO * -1
    );
  }
}

const collector = new MLB20232024Collector();
collector.run().catch(console.error);