#!/usr/bin/env tsx
/**
 * 🏒 CREATE ALL NHL PLAYERS FIRST
 * 
 * Scans all games and creates players before stats collection
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import axios from 'axios';
import pLimit from 'p-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL,
  max: 20
});

const API_CONCURRENCY = 200;

class NHLPlayerCreator {
  private apiLimit = pLimit(API_CONCURRENCY);
  private totalGames: number = 0;
  private processedGames: number = 0;
  private playersFound = new Map<string, any>();
  private existingPlayers = new Set<string>();
  
  async create() {
    console.log(chalk.cyan.bold('\n🏒 NHL PLAYER CREATOR\n'));
    
    try {
      // Cache existing players
      const existing = await pool.query(`
        SELECT espn_id FROM players_master 
        WHERE sport = 'NHL' 
        AND espn_id IS NOT NULL
      `);
      
      existing.rows.forEach(p => {
        this.existingPlayers.add(p.espn_id.toString());
      });
      
      console.log(chalk.green(`✅ Found ${existing.rows.length} existing NHL players`));
      
      // Get all NHL games
      const games = await pool.query(`
        SELECT 
          g.*,
          ht.espn_id as home_espn_id,
          at.espn_id as away_espn_id
        FROM games_master g
        JOIN teams_master ht ON g.home_team_id = ht.id
        JOIN teams_master at ON g.away_team_id = at.id
        WHERE g.sport = 'NHL'
        AND g.status = 'STATUS_FINAL'
        AND g.espn_game_id IS NOT NULL
        ORDER BY g.game_date DESC
      `);
      
      this.totalGames = games.rows.length;
      console.log(chalk.cyan(`\nScanning ${this.totalGames} NHL games for players...\n`));
      
      // Process all games to find players
      const promises = games.rows.map(game => 
        this.apiLimit(() => this.scanGameForPlayers(game))
      );
      
      // Process in batches
      const batchSize = 500;
      for (let i = 0; i < promises.length; i += batchSize) {
        const batch = promises.slice(i, i + batchSize);
        await Promise.all(batch);
        console.log(chalk.yellow(`Scanned ${Math.min(i + batchSize, promises.length)}/${promises.length} games...`));
      }
      
      // Create all new players
      const newPlayers = Array.from(this.playersFound.values()).filter(
        p => !this.existingPlayers.has(p.espn_id.toString())
      );
      
      if (newPlayers.length > 0) {
        console.log(chalk.cyan(`\n📝 Creating ${newPlayers.length} new NHL players...\n`));
        await this.createPlayers(newPlayers);
      }
      
      console.log(chalk.green.bold(`
✅ NHL PLAYER CREATION COMPLETE!
📊 Games scanned: ${this.processedGames}
👥 Total players found: ${this.playersFound.size}
🆕 New players created: ${newPlayers.length}
      `));
      
    } catch (error) {
      console.error(chalk.red('❌ Player creation failed:'), error);
    } finally {
      await pool.end();
    }
  }
  
  private async scanGameForPlayers(game: any) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${game.espn_game_id}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.data.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          const teamId = teamData.team.id === game.home_espn_id 
            ? game.home_team_id 
            : game.away_team_id;
          
          // Scan all categories (forwards, defenses, goalies)
          for (const category of teamData.statistics || []) {
            for (const player of category.athletes || []) {
              if (player.athlete?.id && player.athlete?.displayName) {
                const espnId = player.athlete.id.toString();
                
                if (!this.playersFound.has(espnId)) {
                  this.playersFound.set(espnId, {
                    espn_id: parseInt(espnId),
                    name: player.athlete.displayName,
                    team_id: teamId,
                    position: player.athlete.position?.abbreviation || 
                      (category.name === 'forwards' ? 'F' : 
                       category.name === 'defenses' ? 'D' : 'G')
                  });
                }
              }
            }
          }
        }
      }
      
      this.processedGames++;
      
    } catch (error: any) {
      // Ignore errors
    }
  }
  
  private async createPlayers(players: any[]) {
    // Insert in batches of 500
    const batchSize = 500;
    
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;
      
      batch.forEach(p => {
        placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, NOW())`);
        values.push(
          `NHL_${p.espn_id}`, // our_player_id
          p.name, 
          'NHL', 
          p.team_id, 
          p.position, 
          p.espn_id, 
          'active'
        );
      });
      
      await pool.query(`
        INSERT INTO players_master (
          our_player_id, name, sport, team_id, position, espn_id, status, created_at
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (espn_id, sport) WHERE espn_id IS NOT NULL DO NOTHING
      `, values);
      
      console.log(chalk.green(`  ✅ Created batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(players.length/batchSize)} (${batch.length} players)`));
    }
  }
}

// Run the creator
const creator = new NHLPlayerCreator();
creator.create().catch(console.error);