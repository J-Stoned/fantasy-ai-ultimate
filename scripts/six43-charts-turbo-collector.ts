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

// 6-4-3 Charts API config (update when you get credentials)
const API_KEY = process.env.SIX43_CHARTS_API_KEY || 'YOUR_API_KEY_HERE';
const API_URL = process.env.SIX43_CHARTS_API_URL || 'https://api.643charts.com/v1';

class Six43ChartsTurboCollector {
  private startTime = Date.now();
  private gamesProcessed = 0;
  private newGamesFound = 0;
  private statsCollected = 0;
  private playersCreated = 0;
  
  // Massive caches for 32GB RAM
  private teamMapping = new Map<string, number>(); // 643 ID -> our ID
  private playerMapping = new Map<string, number>(); // 643 ID -> our ID
  private existingGames = new Set<string>();
  private statsBuffer: any[] = [];

  async collectAllSeasons() {
    console.log(chalk.cyan('🚀 6-4-3 Charts TURBO COLLECTOR - COMPLETE D1 COVERAGE!'));
    console.log(chalk.yellow('💪 CPU: Ryzen 5 7600X (48 concurrent requests)'));
    console.log(chalk.yellow('💾 RAM: 32GB (massive caching)'));
    console.log(chalk.yellow('🎯 Target: 100% D1 coverage 2021-2025'));
    console.log(chalk.yellow('📊 Expected: 500,000+ new stats!\n'));

    // Check API credentials
    if (API_KEY === 'YOUR_API_KEY_HERE') {
      console.log(chalk.red('❌ API credentials not found!'));
      console.log(chalk.yellow('Add to .env.local:'));
      console.log('  SIX43_CHARTS_API_KEY=your_key');
      console.log('  SIX43_CHARTS_API_URL=api_endpoint');
      return;
    }

    // Load existing data
    await this.loadExistingData();

    // Process each season
    const seasons = [
      { year: 2021, start: '2021-02-19', end: '2021-06-30' },
      { year: 2022, start: '2022-02-18', end: '2022-06-27' },
      { year: 2023, start: '2023-02-17', end: '2023-06-26' },
      { year: 2024, start: '2024-02-16', end: '2024-06-25' },
      { year: 2025, start: '2025-02-14', end: '2025-07-18' }
    ];

    for (const season of seasons) {
      await this.processSeason(season);
    }

    this.printFinalReport();
  }

  async loadExistingData() {
    console.log(chalk.blue('📥 Loading existing data...'));

    // Load our existing games to avoid duplicates
    const { data: games } = await supabase
      .from('games')
      .select('external_id')
      .eq('sport', 'NCAA_BASEBALL');

    games?.forEach(game => {
      this.existingGames.add(game.external_id);
    });

    // Load team mappings (we'll build this as we go)
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, external_id')
      .eq('sport', 'NCAA_BASEBALL');

    console.log(chalk.green(`✅ Loaded: ${this.existingGames.size} existing games, ${teams?.length || 0} teams\n`));
  }

  async processSeason(season: { year: number, start: string, end: string }) {
    console.log(chalk.blue(`\n📅 Processing ${season.year} Season...`));
    
    try {
      // Example API call structure (adjust based on actual API docs)
      const gamesUrl = `${API_URL}/games`;
      const params = {
        sport: 'baseball',
        division: 'D1',
        start_date: season.start,
        end_date: season.end,
        include_stats: true
      };

      const headers = {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      };

      const response = await axios.get(gamesUrl, { params, headers });
      const games = response.data.games || [];

      console.log(chalk.gray(`Found ${games.length} total games`));

      // Process in batches
      for (let i = 0; i < games.length; i += BATCH_SIZE) {
        const batch = games.slice(i, i + BATCH_SIZE);
        const batchStart = Date.now();

        const promises = batch.map(game => 
          HTTP_LIMIT(() => this.processGame(game, season.year))
        );

        await Promise.all(promises);
        await this.flushBuffers();

        const batchTime = (Date.now() - batchStart) / 1000;
        console.log(chalk.gray(
          `  Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} games in ${batchTime.toFixed(1)}s | ` +
          `${this.newGamesFound} new games | ${this.statsCollected} stats collected`
        ));
      }

    } catch (error: any) {
      console.log(chalk.red(`Error processing ${season.year}: ${error.message}`));
    }
  }

  async processGame(gameData: any, year: number) {
    try {
      // Skip if we already have this game
      const gameExternalId = `643_ncaa_baseball_${gameData.id}`;
      if (this.existingGames.has(gameExternalId)) {
        this.gamesProcessed++;
        return;
      }

      // Map teams
      const homeTeamId = await this.getOrCreateTeam(gameData.home_team);
      const awayTeamId = await this.getOrCreateTeam(gameData.away_team);

      // Create game record
      const game = {
        external_id: gameExternalId,
        sport: 'NCAA_BASEBALL',
        league: 'NCAA',
        start_time: new Date(gameData.date),
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_score: gameData.home_score || 0,
        away_score: gameData.away_score || 0,
        venue: gameData.venue || 'Unknown',
        status: 'completed',
        metadata: {
          source: '643charts',
          year: year
        }
      };

      // Insert game and get ID
      const { data: insertedGame } = await supabase
        .from('games')
        .insert(game)
        .select('id')
        .single();

      if (!insertedGame) return;

      this.newGamesFound++;

      // Process player stats
      if (gameData.stats) {
        for (const teamStats of [gameData.home_stats, gameData.away_stats]) {
          if (!teamStats) continue;

          // Process batters
          for (const batter of teamStats.batting || []) {
            const playerId = await this.getOrCreatePlayer(batter, teamStats.team_id);
            
            if (batter.stats) {
              this.statsBuffer.push({
                player_id: playerId,
                game_id: insertedGame.id,
                stat_type: 'batting',
                stat_value: this.parseBattingStats(batter.stats),
                fantasy_points: this.calculateFantasyPoints(batter.stats, 'batting')
              });
              this.statsCollected++;
            }
          }

          // Process pitchers
          for (const pitcher of teamStats.pitching || []) {
            const playerId = await this.getOrCreatePlayer(pitcher, teamStats.team_id);
            
            if (pitcher.stats) {
              this.statsBuffer.push({
                player_id: playerId,
                game_id: insertedGame.id,
                stat_type: 'pitching',
                stat_value: this.parsePitchingStats(pitcher.stats),
                fantasy_points: this.calculateFantasyPoints(pitcher.stats, 'pitching')
              });
              this.statsCollected++;
            }
          }
        }
      }

      this.gamesProcessed++;

    } catch (error) {
      this.gamesProcessed++;
    }
  }

  async getOrCreateTeam(teamData: any): Promise<number> {
    // Check cache first
    const cached = this.teamMapping.get(teamData.id);
    if (cached) return cached;

    // Try to find existing team by name
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('sport', 'NCAA_BASEBALL')
      .ilike('name', `%${teamData.name}%`)
      .single();

    if (existing) {
      this.teamMapping.set(teamData.id, existing.id);
      return existing.id;
    }

    // Create new team
    const { data: newTeam } = await supabase
      .from('teams')
      .insert({
        external_id: `643_ncaa_baseball_${teamData.id}`,
        name: teamData.name,
        abbreviation: teamData.abbreviation || teamData.name.substring(0, 3).toUpperCase(),
        sport: 'NCAA_BASEBALL',
        metadata: {
          source: '643charts',
          conference: teamData.conference
        }
      })
      .select('id')
      .single();

    if (newTeam) {
      this.teamMapping.set(teamData.id, newTeam.id);
      return newTeam.id;
    }

    return 0;
  }

  async getOrCreatePlayer(playerData: any, teamId: number): Promise<number> {
    // Check cache first
    const cached = this.playerMapping.get(playerData.id);
    if (cached) return cached;

    // Create new player
    const { data: newPlayer } = await supabase
      .from('players')
      .insert({
        external_id: `643_ncaa_baseball_${playerData.id}`,
        name: playerData.name,
        team_id: teamId,
        sport: 'NCAA_BASEBALL',
        metadata: {
          source: '643charts',
          number: playerData.number,
          position: playerData.position
        }
      })
      .select('id')
      .single();

    if (newPlayer) {
      this.playerMapping.set(playerData.id, newPlayer.id);
      this.playersCreated++;
      return newPlayer.id;
    }

    return 0;
  }

  parseBattingStats(stats: any): any {
    return {
      ab: stats.at_bats || 0,
      h: stats.hits || 0,
      r: stats.runs || 0,
      rbi: stats.rbi || 0,
      bb: stats.walks || 0,
      so: stats.strikeouts || 0,
      hr: stats.home_runs || 0,
      sb: stats.stolen_bases || 0,
      avg: stats.batting_average || 0
    };
  }

  parsePitchingStats(stats: any): any {
    return {
      ip: stats.innings_pitched || 0,
      h: stats.hits_allowed || 0,
      r: stats.runs_allowed || 0,
      er: stats.earned_runs || 0,
      bb: stats.walks || 0,
      so: stats.strikeouts || 0,
      hr: stats.home_runs_allowed || 0,
      era: stats.era || 0
    };
  }

  calculateFantasyPoints(stats: any, type: string): number {
    if (type === 'batting') {
      return (stats.hits * 1) + (stats.runs * 1) + (stats.rbi * 1) + 
             (stats.walks * 1) + (stats.home_runs * 3) + (stats.stolen_bases * 1) + 
             (stats.strikeouts * -0.5);
    } else {
      return (stats.innings_pitched * 3) + (stats.strikeouts * 1) + 
             (stats.earned_runs * -1) + (stats.walks * -0.5) + 
             (stats.hits_allowed * -0.5) + (stats.home_runs_allowed * -1);
    }
  }

  async flushBuffers() {
    if (this.statsBuffer.length > 0) {
      const stats = [...this.statsBuffer];
      this.statsBuffer = [];

      await DB_LIMIT(async () => {
        const { error } = await supabase
          .from('player_stats')
          .insert(stats);

        if (error) {
          console.error(chalk.red('DB Error:'), error.message);
        }
      });
    }
  }

  printFinalReport() {
    const elapsed = (Date.now() - this.startTime) / 1000;

    console.log(chalk.cyan('\n🎉 6-4-3 CHARTS COLLECTION COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(chalk.green(`✅ Games Processed: ${this.gamesProcessed.toLocaleString()}`));
    console.log(chalk.green(`🆕 New Games Added: ${this.newGamesFound.toLocaleString()}`));
    console.log(chalk.green(`📈 Stats Collected: ${this.statsCollected.toLocaleString()}`));
    console.log(chalk.green(`👥 New Players Created: ${this.playersCreated.toLocaleString()}`));
    console.log(chalk.yellow(`📊 Avg Stats/Game: ${(this.statsCollected / this.newGamesFound || 0).toFixed(1)}`));
    console.log(chalk.yellow(`⚡ Performance: ${(this.gamesProcessed / elapsed).toFixed(1)} games/sec`));
    console.log(chalk.yellow(`⏱️  Total Time: ${(elapsed / 60).toFixed(1)} minutes`));
    console.log('═══════════════════════════════════════════════════════════════');
  }
}

// 🚀 RUN IT!
const collector = new Six43ChartsTurboCollector();
collector.collectAllSeasons()
  .then(() => {
    console.log(chalk.green('\n✅ 6-4-3 Charts integration complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });