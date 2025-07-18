import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 MAXIMUM PERFORMANCE - RYZEN 5 7600X + 32GB RAM!
const HTTP_LIMIT = pLimit(48);   // 48 concurrent requests
const DB_LIMIT = pLimit(12);     // Database operations
const BATCH_SIZE = 2000;         // Huge batches!

class NCAAD1Baseball2023Complete {
  private startTime = Date.now();
  private teamsCollected = 0;
  private gamesCollected = 0;
  private playersCollected = 0;
  private statsCollected = 0;
  
  // Massive caches for 32GB RAM
  private teamCache = new Map<string, number>();
  private gameCache = new Map<string, number>();
  private playerCache = new Map<string, number>();

  async collectEverything() {
    console.log(chalk.cyan('🚀 NCAA D1 Baseball 2023 COMPLETE Collection'));
    console.log(chalk.yellow('📅 Season: Feb 17 - June 26, 2023'));
    console.log(chalk.yellow('💪 CPU: Ryzen 5 7600X (48 concurrent requests)'));
    console.log(chalk.yellow('💾 RAM: 32GB (massive caching)'));
    console.log(chalk.yellow('🎯 Order: Teams → Games → Players → Stats\n'));

    // Step 1: Collect Teams
    console.log(chalk.blue('📚 Step 1: Collecting Teams...'));
    await this.collectTeams();
    
    // Step 2: Collect Games
    console.log(chalk.blue('\n🎮 Step 2: Collecting Games...'));
    await this.collectGames();
    
    // Step 3: Collect Players from Games
    console.log(chalk.blue('\n👥 Step 3: Collecting Players...'));
    await this.collectPlayers();
    
    // Step 4: Collect Stats
    console.log(chalk.blue('\n📊 Step 4: Collecting Stats...'));
    await this.collectStats();
    
    this.printFinalReport();
  }

  async collectTeams() {
    // NCAA D1 Baseball teams are already in our database from previous years
    // But let's verify and update if needed
    const { data: existingTeams } = await supabase
      .from('teams')
      .select('id, external_id, name')
      .eq('sport', 'NCAA_BASEBALL');

    if (existingTeams) {
      existingTeams.forEach(team => {
        this.teamCache.set(team.external_id, team.id);
      });
      this.teamsCollected = existingTeams.length;
      console.log(chalk.green(`✅ Loaded ${this.teamsCollected} NCAA Baseball teams`));
    }
  }

  async collectGames() {
    const startDate = '2023-02-17';
    const endDate = '2023-06-26';
    
    console.log(chalk.gray(`Collecting games from ${startDate} to ${endDate}...`));
    
    const dates = this.generateDateRange(startDate, endDate);
    const gameBuffer = [];
    
    // Process dates in batches
    for (let i = 0; i < dates.length; i += 30) {
      const dateBatch = dates.slice(i, i + 30);
      
      const promises = dateBatch.map(date => 
        HTTP_LIMIT(() => this.fetchGamesForDate(date))
      );
      
      const results = await Promise.all(promises);
      
      for (const { games, teams } of results) {
        gameBuffer.push(...games);
        
        // Update teams if new ones found
        for (const team of teams) {
          if (!this.teamCache.has(team.external_id)) {
            await this.insertTeam(team);
          }
        }
      }
      
      // Insert games in batches
      if (gameBuffer.length >= BATCH_SIZE) {
        await this.insertGames(gameBuffer.splice(0, BATCH_SIZE));
      }
      
      console.log(chalk.gray(`  Progress: ${i + 30}/${dates.length} days | ${this.gamesCollected} games collected`));
    }
    
    // Insert remaining games
    if (gameBuffer.length > 0) {
      await this.insertGames(gameBuffer);
    }
    
    console.log(chalk.green(`✅ Collected ${this.gamesCollected} games for 2023 season`));
  }

  async collectPlayers() {
    // Load all 2023 games
    const games = await this.loadAllGames();
    console.log(chalk.gray(`Processing ${games.length} games to extract players...`));
    
    const playerBuffer = new Map<string, any>();
    
    // Process games in batches to extract players
    for (let i = 0; i < games.length; i += 100) {
      const batch = games.slice(i, i + 100);
      
      const promises = batch.map(game => 
        HTTP_LIMIT(() => this.extractPlayersFromGame(game))
      );
      
      const results = await Promise.all(promises);
      
      // Collect unique players
      for (const players of results) {
        players.forEach(player => {
          if (!this.playerCache.has(player.external_id)) {
            playerBuffer.set(player.external_id, player);
          }
        });
      }
      
      // Insert players when buffer is large
      if (playerBuffer.size >= 1000) {
        await this.insertPlayers(Array.from(playerBuffer.values()));
        playerBuffer.clear();
      }
      
      console.log(chalk.gray(`  Progress: ${i + 100}/${games.length} games | ${this.playersCollected} players found`));
    }
    
    // Insert remaining players
    if (playerBuffer.size > 0) {
      await this.insertPlayers(Array.from(playerBuffer.values()));
    }
    
    console.log(chalk.green(`✅ Collected ${this.playersCollected} players`));
  }

  async collectStats() {
    // Load all 2023 games
    const games = await this.loadAllGames();
    console.log(chalk.gray(`Processing ${games.length} games to extract stats...`));
    
    const statsBuffer = [];
    let successfulGames = 0;
    
    // Process games in batches
    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(game => 
        HTTP_LIMIT(async () => {
          const stats = await this.extractStatsFromGame(game);
          if (stats.length > 0) successfulGames++;
          return stats;
        })
      );
      
      const results = await Promise.all(promises);
      
      // Collect all stats
      for (const gameStats of results) {
        statsBuffer.push(...gameStats);
      }
      
      // Insert stats when buffer is large
      if (statsBuffer.length >= 10000) {
        await this.insertStats(statsBuffer.splice(0, 10000));
      }
      
      const successRate = ((successfulGames / (i + batch.length)) * 100).toFixed(1);
      console.log(chalk.gray(
        `  Progress: ${i + batch.length}/${games.length} games | ` +
        `${this.statsCollected} stats | ${successRate}% success rate`
      ));
    }
    
    // Insert remaining stats
    if (statsBuffer.length > 0) {
      await this.insertStats(statsBuffer);
    }
    
    console.log(chalk.green(`✅ Collected ${this.statsCollected} stats from ${successfulGames} games`));
  }

  generateDateRange(start: string, end: string): string[] {
    const dates = [];
    const current = new Date(start);
    const endDate = new Date(end);
    
    while (current <= endDate) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  async fetchGamesForDate(date: string): Promise<{ games: any[], teams: any[] }> {
    try {
      const dateStr = date.replace(/-/g, '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${dateStr}&limit=300`;
      
      const response = await axios.get(url, { timeout: 5000 });
      const events = response.data.events || [];
      
      const games = [];
      const teams = new Map();
      
      for (const event of events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;
        
        const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
        
        if (!homeTeam || !awayTeam) continue;
        
        // Extract teams
        [homeTeam, awayTeam].forEach(competitor => {
          const team = competitor.team;
          const externalId = `espn_ncaa_baseball_${team.id}`;
          
          if (!teams.has(externalId)) {
            teams.set(externalId, {
              external_id: externalId,
              name: team.displayName || team.name,
              abbreviation: team.abbreviation,
              sport: 'NCAA_BASEBALL',
              metadata: {
                location: team.location,
                color: team.color,
                logo: team.logo
              }
            });
          }
        });
        
        // Create game
        games.push({
          external_id: `espn_ncaa_baseball_${event.id}`,
          sport: 'NCAA_BASEBALL',
          league: 'NCAA',
          start_time: new Date(competition.date),
          home_team_external_id: `espn_ncaa_baseball_${homeTeam.team.id}`,
          away_team_external_id: `espn_ncaa_baseball_${awayTeam.team.id}`,
          home_score: parseInt(homeTeam.score) || 0,
          away_score: parseInt(awayTeam.score) || 0,
          venue: competition.venue?.fullName || 'Unknown',
          status: competition.status?.type?.completed ? 'completed' : 'scheduled',
          metadata: {
            season: 2023,
            attendance: competition.attendance
          }
        });
      }
      
      return { games, teams: Array.from(teams.values()) };
    } catch (error) {
      return { games: [], teams: [] };
    }
  }

  async extractPlayersFromGame(game: any): Promise<any[]> {
    try {
      const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      
      const response = await axios.get(url, { timeout: 5000 });
      const players = [];
      
      if (response.data.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          const teamId = this.getTeamId(game, teamData.team);
          
          for (const category of teamData.statistics || []) {
            for (const athlete of category.athletes || []) {
              if (athlete.athlete) {
                players.push({
                  external_id: `espn_ncaa_baseball_${athlete.athlete.id}`,
                  name: athlete.athlete.displayName || athlete.athlete.name,
                  team_id: teamId,
                  sport: 'NCAA_BASEBALL',
                  metadata: { year: 2023 }
                });
              }
            }
          }
        }
      }
      
      return players;
    } catch (error) {
      return [];
    }
  }

  async extractStatsFromGame(game: any): Promise<any[]> {
    try {
      const gameId = game.external_id.replace('espn_ncaa_baseball_', '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/summary?event=${gameId}`;
      
      const response = await axios.get(url, { timeout: 5000 });
      const stats = [];
      
      if (response.data.boxscore?.players) {
        for (const teamData of response.data.boxscore.players) {
          const teamId = this.getTeamId(game, teamData.team);
          
          for (const category of teamData.statistics || []) {
            for (const athlete of category.athletes || []) {
              if (!athlete.athlete || !athlete.stats) continue;
              
              const parsedStats = category.name === 'batting' 
                ? this.parseBattingStats(athlete.stats)
                : this.parsePitchingStats(athlete.stats);
                
              if (parsedStats && Object.keys(parsedStats).length > 0) {
                stats.push({
                  player_external_id: `espn_ncaa_baseball_${athlete.athlete.id}`,
                  player_name: athlete.athlete.displayName,
                  team_id: teamId,
                  game_id: game.id,
                  stat_type: category.name === 'batting' ? 'batting' : 'pitching',
                  stats: parsedStats,
                  fantasy_points: this.calculateFantasyPoints(parsedStats, category.name)
                });
              }
            }
          }
        }
      }
      
      return stats;
    } catch (error) {
      return [];
    }
  }

  getTeamId(game: any, teamInfo: any): number {
    if (!teamInfo) return game.home_team_id;
    
    const teamExternalId = `espn_ncaa_baseball_${teamInfo.id}`;
    
    if (this.teamCache.get(game.home_team_external_id) === teamExternalId) {
      return game.home_team_id;
    } else if (this.teamCache.get(game.away_team_external_id) === teamExternalId) {
      return game.away_team_id;
    }
    
    return game.home_team_id;
  }

  parseBattingStats(statsArray: any[]): any {
    if (!Array.isArray(statsArray) || statsArray.length < 7) return null;
    
    return {
      ab: parseInt(statsArray[0]) || 0,
      r: parseInt(statsArray[1]) || 0,
      h: parseInt(statsArray[2]) || 0,
      rbi: parseInt(statsArray[3]) || 0,
      bb: parseInt(statsArray[4]) || 0,
      so: parseInt(statsArray[5]) || 0,
      avg: parseFloat(statsArray[6]) || 0
    };
  }

  parsePitchingStats(statsArray: any[]): any {
    if (!Array.isArray(statsArray) || statsArray.length < 7) return null;
    
    const parseIP = (val: any) => {
      if (!val || val === '--') return 0;
      const parts = val.toString().split('.');
      return (parseInt(parts[0]) || 0) + ((parseInt(parts[1]) || 0) / 3);
    };

    return {
      ip: parseIP(statsArray[0]),
      h: parseInt(statsArray[1]) || 0,
      r: parseInt(statsArray[2]) || 0,
      er: parseInt(statsArray[3]) || 0,
      bb: parseInt(statsArray[4]) || 0,
      so: parseInt(statsArray[5]) || 0,
      era: parseFloat(statsArray[6]) || 0
    };
  }

  calculateFantasyPoints(stats: any, type: string): number {
    if (type === 'batting') {
      return (stats.h * 1) + (stats.r * 1) + (stats.rbi * 1) + 
             (stats.bb * 1) + (stats.so * -0.5);
    } else {
      return (stats.ip * 3) + (stats.so * 1) + (stats.er * -1) + 
             (stats.bb * -0.5) + (stats.h * -0.5);
    }
  }

  async insertTeam(team: any) {
    const { data } = await supabase
      .from('teams')
      .upsert(team, { onConflict: 'external_id' })
      .select('id, external_id')
      .single();
      
    if (data) {
      this.teamCache.set(data.external_id, data.id);
      this.teamsCollected++;
    }
  }

  async insertGames(games: any[]) {
    // Map external IDs to internal IDs
    const gamesWithIds = games.map(game => ({
      ...game,
      home_team_id: this.teamCache.get(game.home_team_external_id),
      away_team_id: this.teamCache.get(game.away_team_external_id)
    }));
    
    const { data } = await supabase
      .from('games')
      .upsert(gamesWithIds, { onConflict: 'external_id' })
      .select('id, external_id');
      
    if (data) {
      data.forEach(game => {
        this.gameCache.set(game.external_id, game.id);
      });
      this.gamesCollected += data.length;
    }
  }

  async insertPlayers(players: any[]) {
    const { data } = await supabase
      .from('players')
      .upsert(players, { onConflict: 'external_id' })
      .select('id, external_id');
      
    if (data) {
      data.forEach(player => {
        this.playerCache.set(player.external_id, player.id);
      });
      this.playersCollected += data.length;
    }
  }

  async insertStats(stats: any[]) {
    const statsWithIds = stats
      .map(stat => ({
        player_id: this.playerCache.get(stat.player_external_id),
        game_id: stat.game_id,
        stat_type: stat.stat_type,
        stat_value: stat.stats,
        fantasy_points: stat.fantasy_points
      }))
      .filter(s => s.player_id);
      
    const { error } = await supabase
      .from('player_stats')
      .insert(statsWithIds);
      
    if (!error) {
      this.statsCollected += statsWithIds.length;
    }
  }

  async loadAllGames() {
    const games = [];
    let offset = 0;
    
    while (true) {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('sport', 'NCAA_BASEBALL')
        .gte('start_time', '2023-02-17')
        .lte('start_time', '2023-06-26')
        .range(offset, offset + 999);
        
      if (!data || data.length === 0) break;
      
      games.push(...data);
      offset += 1000;
      
      if (data.length < 1000) break;
    }
    
    // Map team IDs
    games.forEach(game => {
      this.gameCache.set(game.external_id, game.id);
    });
    
    return games;
  }

  printFinalReport() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    
    console.log(chalk.cyan('\n🎉 2023 NCAA D1 BASEBALL COLLECTION COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(chalk.green(`📚 Teams: ${this.teamsCollected}`));
    console.log(chalk.green(`🎮 Games: ${this.gamesCollected}`));
    console.log(chalk.green(`👥 Players: ${this.playersCollected}`));
    console.log(chalk.green(`📊 Stats: ${this.statsCollected.toLocaleString()}`));
    console.log(chalk.yellow(`⏱️  Total Time: ${(elapsed / 60).toFixed(1)} minutes`));
    console.log(chalk.yellow(`⚡ Performance: ${(this.statsCollected / elapsed).toFixed(1)} stats/sec`));
    console.log('═══════════════════════════════════════════════════════════════');
  }
}

// 🚀 RUN IT!
const collector = new NCAAD1Baseball2023Complete();
collector.collectEverything()
  .then(() => {
    console.log(chalk.green('\n✅ 2023 Collection Complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });