/**
 * 🧠 IN-MEMORY CACHE
 * 
 * Loads entire database into RAM for O(1) lookups
 * Eliminates thousands of database queries during collection
 * 
 * Memory usage:
 * - Teams: ~1MB (224 teams)
 * - Players: ~100MB (32K players)
 * - Games: ~50MB (22K games)
 * - Total: ~150MB (leaves 31.85GB for processing)
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';

interface CachedTeam {
  id: number;
  name: string;
  sport: string;
  external_id: string;
}

interface CachedPlayer {
  id: number;
  name: string;
  team_id: number;
  sport: string;
  external_id: string;
}

interface CachedGame {
  id: number;
  external_id: string;
  sport: string;
  start_time: string;
  home_team_id: number;
  away_team_id: number;
}

export class InMemoryCache {
  private teams: Map<number, CachedTeam> = new Map();
  private players: Map<number, CachedPlayer> = new Map();
  private games: Map<number, CachedGame> = new Map();
  
  // Fast lookups
  private teamsByExternalId: Map<string, CachedTeam> = new Map();
  private playersByExternalId: Map<string, CachedPlayer> = new Map();
  private gamesByExternalId: Map<string, CachedGame> = new Map();
  private gamesBySportYear: Map<string, CachedGame[]> = new Map();
  
  private supabase: any;
  
  async initialize() {
    // Create supabase client when initialized
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    console.log(chalk.gray('  Loading teams...'));
    await this.loadTeams();
    
    console.log(chalk.gray('  Loading players...'));
    await this.loadPlayers();
    
    console.log(chalk.gray('  Loading games...'));
    await this.loadGames();
    
    // Build indexes
    this.buildIndexes();
  }
  
  private async loadTeams() {
    // Load all teams with external_ids in batches to handle large datasets
    let allTeams: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data: batch, error } = await this.supabase
        .from('teams')
        .select('id, name, sport, external_id')
        .not('external_id', 'is', null)
        .range(offset, offset + batchSize - 1);
        
      if (error) {
        console.error('Error loading teams batch:', error);
        break;
      }
      
      if (!batch || batch.length === 0) break;
      
      allTeams = allTeams.concat(batch);
      offset += batchSize;
      
      // Break if we got less than full batch (no more data)
      if (batch.length < batchSize) break;
    }
    
    console.log(chalk.gray(`    Total teams loaded: ${allTeams.length}`));
    
    allTeams.forEach(team => {
      this.teams.set(team.id, team);
    });
  }
  
  private async loadPlayers() {
    // Load all players at once since we have enough RAM
    console.log(chalk.gray('    Loading all players...'));
    
    // Load all players in chunks (Supabase has a 1000 row limit by default)
    let allPlayers: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data: batch, error } = await this.supabase
        .from('players')
        .select('id, name, team_id, sport, external_id')
        .range(offset, offset + batchSize - 1);
        
      if (error) {
        console.error('Error loading players batch:', error);
        break;
      }
      
      if (!batch || batch.length === 0) break;
      
      allPlayers = allPlayers.concat(batch);
      offset += batchSize;
      
      console.log(chalk.gray(`    Loaded ${allPlayers.length} players so far...`));
    }
    
    if (allPlayers.length === 0) {
      console.log(chalk.red('    No players found'));
      return;
    }
    
    console.log(chalk.gray(`    Total loaded: ${allPlayers.length} players`));
    
    allPlayers.forEach(player => {
      this.players.set(player.id, player);
    });
  }
  
  private async loadGames() {
    // Load all games
    let offset = 0;
    const batchSize = 5000;
    
    while (true) {
      const { data: games } = await this.supabase
        .from('games')
        .select('id, external_id, sport, start_time, home_team_id, away_team_id')
        .range(offset, offset + batchSize - 1);
        
      if (!games || games.length === 0) break;
      
      games.forEach(game => {
        this.games.set(game.id, game);
      });
      
      offset += batchSize;
    }
  }
  
  private buildIndexes() {
    console.log(chalk.gray('  Building indexes...'));
    
    // Team indexes
    this.teams.forEach(team => {
      if (team.external_id) {
        this.teamsByExternalId.set(team.external_id, team);
      }
    });
    
    // Player indexes
    this.players.forEach(player => {
      if (player.external_id) {
        this.playersByExternalId.set(player.external_id, player);
      }
    });
    
    // Game indexes
    this.games.forEach(game => {
      if (game.external_id) {
        this.gamesByExternalId.set(game.external_id, game);
      }
      
      // Index by sport and year
      const gameDate = new Date(game.start_time);
      const year = gameDate.getFullYear();
      
      // For NFL, handle season year differently (2021 season runs into 2022)
      let seasonYear = year;
      if (game.sport === 'NFL') {
        // NFL season starts in September, so Jan-Aug games belong to previous season
        if (gameDate.getMonth() < 8) { // Months are 0-indexed, so 8 = September
          seasonYear = year - 1;
        }
      }
      
      const key = `${game.sport}_${seasonYear}`;
      
      if (!this.gamesBySportYear.has(key)) {
        this.gamesBySportYear.set(key, []);
      }
      this.gamesBySportYear.get(key)!.push(game);
    });
  }
  
  // Fast lookups
  getTeamById(id: number): CachedTeam | undefined {
    return this.teams.get(id);
  }
  
  getTeamByExternalId(externalId: string): CachedTeam | undefined {
    return this.teamsByExternalId.get(externalId);
  }
  
  getPlayerById(id: number): CachedPlayer | undefined {
    return this.players.get(id);
  }
  
  getPlayerByExternalId(externalId: string): CachedPlayer | undefined {
    return this.playersByExternalId.get(externalId);
  }
  
  getGameById(id: number): CachedGame | undefined {
    return this.games.get(id);
  }
  
  getGameByExternalId(externalId: string): CachedGame | undefined {
    return this.gamesByExternalId.get(externalId);
  }
  
  getGamesForSportYear(sport: string, year: number): CachedGame[] {
    return this.gamesBySportYear.get(`${sport}_${year}`) || [];
  }
  
  getStats() {
    return {
      teams: this.teams.size,
      players: this.players.size,
      games: this.games.size
    };
  }
  
  // Serialize for worker threads
  serialize() {
    return {
      teams: Array.from(this.teams.entries()),
      players: Array.from(this.players.entries()),
      games: Array.from(this.games.entries()),
      teamsByExternalId: Array.from(this.teamsByExternalId.entries()),
      playersByExternalId: Array.from(this.playersByExternalId.entries()),
      gamesByExternalId: Array.from(this.gamesByExternalId.entries())
    };
  }
  
  // Deserialize in worker threads
  static deserialize(data: any): InMemoryCache {
    const cache = new InMemoryCache();
    
    cache.teams = new Map(data.teams);
    cache.players = new Map(data.players);
    cache.games = new Map(data.games);
    cache.teamsByExternalId = new Map(data.teamsByExternalId);
    cache.playersByExternalId = new Map(data.playersByExternalId);
    cache.gamesByExternalId = new Map(data.gamesByExternalId);
    
    return cache;
  }
}