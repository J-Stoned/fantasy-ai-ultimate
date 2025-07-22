#!/usr/bin/env tsx
/**
 * Maps ESPN game IDs to NCAA.com game IDs using team names and dates
 */

import axios from 'axios';
import chalk from 'chalk';
import pgPool from './pg-config';
import pLimit from 'p-limit';

const NCAA_API_BASE = 'https://ncaa-api.henrygd.me';

export class NCAAGameMapper {
  private apiLimit = pLimit(5); // NCAA API rate limit
  
  async mapESPNToNCAA(sport: 'baseball' | 'icehockey-men', espnGameId: string, gameDate: Date, homeTeam: string, awayTeam: string): Promise<string | null> {
    try {
      const dateStr = gameDate.toISOString().split('T')[0];
      const division = 'd1';
      
      const scoreboardUrl = `${NCAA_API_BASE}/scoreboard/${sport}/${division}/${dateStr}`;
      
      const response = await axios.get(scoreboardUrl, { 
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      if (response.data.games && response.data.games.length > 0) {
        // Find matching game by team names
        for (const game of response.data.games) {
          const ncaaHome = game.game.home.names.short || game.game.home.names.char6 || game.game.home.names.full;
          const ncaaAway = game.game.away.names.short || game.game.away.names.char6 || game.game.away.names.full;
          
          // Fuzzy match team names (handle variations)
          if (this.teamsMatch(homeTeam, ncaaHome) && this.teamsMatch(awayTeam, ncaaAway)) {
            return game.game.gameID;
          }
        }
      }
      
      return null;
    } catch (error) {
      // Silently fail - not all dates have games
      return null;
    }
  }
  
  private teamsMatch(dbTeam: string, ncaaTeam: string): boolean {
    // Normalize team names
    const normalize = (name: string) => name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace('state', 'st')
      .replace('university', '')
      .replace('college', '');
    
    const dbNorm = normalize(dbTeam);
    const ncaaNorm = normalize(ncaaTeam);
    
    // Check if one contains the other
    return dbNorm.includes(ncaaNorm) || ncaaNorm.includes(dbNorm) ||
           // Check common abbreviations
           this.getTeamAbbreviation(dbTeam) === ncaaTeam;
  }
  
  private getTeamAbbreviation(teamName: string): string {
    // Common NCAA team abbreviations
    const abbreviations: Record<string, string> = {
      'Louisiana State Tigers': 'LSU',
      'Texas Christian Horned Frogs': 'TCU',
      'Southern Methodist Mustangs': 'SMU',
      'Virginia Commonwealth Rams': 'VCU',
      'University of California Los Angeles Bruins': 'UCLA',
      'University of Southern California Trojans': 'USC',
      // Add more as needed
    };
    
    return abbreviations[teamName] || '';
  }
  
  async findNCAASiteGameId(sport: 'NCAA_BASEBALL' | 'NCAA_HOCKEY', gameId: number): Promise<string | null> {
    const game = await pgPool.query(`
      SELECT 
        g.espn_game_id,
        g.game_date,
        ht.name as home_team,
        at.name as away_team
      FROM games_master g
      JOIN teams_master ht ON g.home_team_id = ht.id
      JOIN teams_master at ON g.away_team_id = at.id
      WHERE g.id = $1
    `, [gameId]);
    
    if (game.rows.length === 0) return null;
    
    const row = game.rows[0];
    const apiSport = sport === 'NCAA_BASEBALL' ? 'baseball' : 'icehockey-men';
    
    return this.mapESPNToNCAA(apiSport, row.espn_game_id, new Date(row.game_date), row.home_team, row.away_team);
  }
}

// Test if called directly
if (require.main === module) {
  (async () => {
    const mapper = new NCAAGameMapper();
    
    // Test with a few games
    const testGames = await pgPool.query(`
      SELECT 
        g.id,
        g.espn_game_id,
        g.game_date,
        ht.name as home_team,
        at.name as away_team
      FROM games_master g
      JOIN teams_master ht ON g.home_team_id = ht.id
      JOIN teams_master at ON g.away_team_id = at.id
      WHERE g.sport = 'NCAA_BASEBALL'
      AND g.status = 'STATUS_FINAL'
      AND NOT EXISTS (
        SELECT 1 FROM player_game_stats pgs 
        WHERE pgs.game_id = g.id
      )
      ORDER BY g.game_date DESC
      LIMIT 5
    `);
    
    console.log(chalk.yellow('Testing NCAA game mapping...\n'));
    
    for (const game of testGames.rows) {
      console.log(`ESPN ID ${game.espn_game_id}: ${game.away_team} @ ${game.home_team}`);
      const ncaaId = await mapper.mapESPNToNCAA('baseball', game.espn_game_id, new Date(game.game_date), game.home_team, game.away_team);
      
      if (ncaaId) {
        console.log(chalk.green(`  ✅ Found NCAA ID: ${ncaaId}`));
      } else {
        console.log(chalk.red(`  ❌ No match found`));
      }
    }
    
    await pgPool.end();
  })();
}