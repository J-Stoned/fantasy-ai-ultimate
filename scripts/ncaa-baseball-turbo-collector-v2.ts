import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 MAXIMIZE CPU USAGE - 12 threads for Ryzen 5 7600X!
const HTTP_LIMIT = pLimit(24); // 2x threads for HTTP requests
const DB_LIMIT = pLimit(6);     // Separate pool for DB operations
const BATCH_SIZE = 500;         // Larger batches to utilize 32GB RAM
const PREFETCH_DAYS = 30;       // Prefetch 30 days at a time

interface Season {
  year: number;
  startDate: string;
  endDate: string;
}

const SEASONS: Season[] = [
  { year: 2021, startDate: '2021-02-19', endDate: '2021-06-30' },
  { year: 2022, startDate: '2022-02-18', endDate: '2022-06-27' },
  { year: 2023, startDate: '2023-02-17', endDate: '2023-06-26' },
  { year: 2024, startDate: '2024-02-16', endDate: '2024-06-24' },
  { year: 2025, startDate: '2025-02-14', endDate: '2025-06-30' }
];

class NCAABaseballTurboCollectorV2 {
  private totalGames = 0;
  private totalPlayers = 0;
  private startTime = Date.now();
  
  // 🔥 IN-MEMORY CACHES (utilizing 32GB RAM!)
  private teamCache = new Map<string, number>(); // external_id -> id
  private gameCache = new Set<string>(); // Track processed games
  private playerCache = new Map<string, number>(); // external_id -> id
  
  // Buffers for batch operations
  private gameBuffer: any[] = [];
  private teamBuffer: any[] = [];
  private playerBuffer: any[] = [];

  async collectAllSeasons() {
    console.log(chalk.cyan('🚀 NCAA Baseball Turbo Collector V2 - MAXIMUM PERFORMANCE!'));
    console.log(chalk.yellow('💪 CPU: Ryzen 5 7600X (24 concurrent HTTP threads)'));
    console.log(chalk.yellow('💾 RAM: 32GB (massive in-memory caching)'));
    console.log(chalk.green('📊 Target: ~55,000+ games across 5 seasons\n'));

    // Pre-load all existing teams into cache
    await this.preloadTeamCache();

    // Process all seasons in parallel!
    const seasonPromises = SEASONS.map(season => 
      this.collectSeasonOptimized(season)
    );

    await Promise.all(seasonPromises);

    // Flush any remaining buffers
    await this.flushAllBuffers();

    await this.printFinalStats();
  }

  async preloadTeamCache() {
    console.log(chalk.blue('📥 Pre-loading team cache...'));
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL');

    if (teams) {
      teams.forEach(team => {
        this.teamCache.set(team.external_id, team.id);
      });
      console.log(chalk.green(`✅ Loaded ${teams.length} teams into cache\n`));
    }
  }

  async collectSeasonOptimized(season: Season) {
    const seasonStart = Date.now();
    console.log(chalk.cyan(`\n🏆 Processing ${season.year} Season`));
    
    const startDate = parseISO(season.startDate);
    const endDate = parseISO(season.endDate);
    const totalDays = differenceInDays(endDate, startDate) + 1;
    
    // Generate all dates for the season
    const allDates: Date[] = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allDates.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    // Process in chunks of PREFETCH_DAYS
    let seasonGames = 0;
    for (let i = 0; i < allDates.length; i += PREFETCH_DAYS) {
      const chunk = allDates.slice(i, Math.min(i + PREFETCH_DAYS, allDates.length));
      
      // Fetch all days in this chunk in parallel
      const gamePromises = chunk.map(date => 
        HTTP_LIMIT(() => this.fetchGamesForDate(date, season.year))
      );

      const results = await Promise.all(gamePromises);
      
      // Process results
      for (const { games, teams } of results) {
        seasonGames += games.length;
        
        // Add to buffers
        this.gameBuffer.push(...games);
        this.teamBuffer.push(...teams);
        
        // Flush buffers if they're getting large
        if (this.gameBuffer.length >= BATCH_SIZE) {
          await this.flushGameBuffer();
        }
        if (this.teamBuffer.length >= BATCH_SIZE) {
          await this.flushTeamBuffer();
        }
      }

      // Progress update
      const progress = Math.min(i + PREFETCH_DAYS, allDates.length);
      const elapsed = (Date.now() - seasonStart) / 1000;
      const gamesPerSec = seasonGames / elapsed;
      console.log(chalk.gray(`  Progress: ${progress}/${totalDays} days | ${seasonGames} games | ${gamesPerSec.toFixed(1)} games/sec | RAM: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`));
    }

    const seasonElapsed = (Date.now() - seasonStart) / 1000;
    console.log(chalk.green(`✅ ${season.year} Complete: ${seasonGames} games in ${seasonElapsed.toFixed(1)}s`));
    this.totalGames += seasonGames;
  }

  async fetchGamesForDate(date: Date, year: number): Promise<{ games: any[], teams: any[] }> {
    const dateStr = format(date, 'yyyyMMdd');
    
    try {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${dateStr}&limit=300`
      );

      if (!response.ok) {
        return { games: [], teams: [] };
      }

      const data = await response.json();
      const events = data.events || [];

      if (events.length === 0) {
        return { games: [], teams: [] };
      }

      const games: any[] = [];
      const teamsSet = new Map<string, any>();

      for (const event of events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        // Extract teams
        for (const competitor of [homeTeam, awayTeam]) {
          const team = competitor.team;
          if (!team) continue;
          
          const externalId = `espn_ncaa_baseball_${team.id}`;
          if (!teamsSet.has(externalId) && !this.teamCache.has(externalId)) {
            teamsSet.set(externalId, {
              external_id: externalId,
              name: team.displayName || team.name,
              abbreviation: team.abbreviation,
              sport: 'NCAA_BASEBALL',
              metadata: {
                location: team.location,
                color: team.color,
                logo: team.logo,
                conference: team.conferenceId || null
              }
            });
          }
        }

        // Create game record
        const gameId = `espn_ncaa_baseball_${event.id}`;
        if (!this.gameCache.has(gameId)) {
          games.push({
            external_id: gameId,
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
              season: year,
              season_type: competition.seasonType?.type || 2,
              attendance: competition.attendance,
              broadcast: competition.broadcasts?.[0]?.names?.[0],
              conference_game: competition.conferenceCompetition || false
            }
          });
          this.gameCache.add(gameId);
        }
      }

      return { games, teams: Array.from(teamsSet.values()) };
    } catch (error) {
      console.error(`Error fetching ${dateStr}:`, error);
      return { games: [], teams: [] };
    }
  }

  async flushTeamBuffer() {
    if (this.teamBuffer.length === 0) return;

    const teams = [...this.teamBuffer];
    this.teamBuffer = [];

    await DB_LIMIT(async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .upsert(teams, { onConflict: 'external_id' })
          .select('id, external_id');

        if (error) {
          console.error('Error inserting teams:', error);
        } else if (data) {
          // Update cache with new team IDs
          data.forEach(team => {
            this.teamCache.set(team.external_id, team.id);
          });
        }
      } catch (error) {
        console.error('Error in flushTeamBuffer:', error);
      }
    });
  }

  async flushGameBuffer() {
    if (this.gameBuffer.length === 0) return;

    const games = [...this.gameBuffer];
    this.gameBuffer = [];

    await DB_LIMIT(async () => {
      try {
        // Map games to include team IDs from cache
        const gamesWithIds = games.map(game => ({
          external_id: game.external_id,
          sport: game.sport,
          league: game.league,
          start_time: game.start_time,
          home_team_id: this.teamCache.get(game.home_team_external_id) || null,
          away_team_id: this.teamCache.get(game.away_team_external_id) || null,
          home_score: game.home_score,
          away_score: game.away_score,
          venue: game.venue,
          status: game.status,
          metadata: game.metadata
        }));

        const { error } = await supabase
          .from('games')
          .upsert(gamesWithIds, { onConflict: 'external_id' });

        if (error) {
          console.error('Error inserting games:', error);
        }
      } catch (error) {
        console.error('Error in flushGameBuffer:', error);
      }
    });
  }

  async flushAllBuffers() {
    console.log(chalk.blue('\n💾 Flushing remaining buffers...'));
    await Promise.all([
      this.flushTeamBuffer(),
      this.flushGameBuffer()
    ]);
  }

  async printFinalStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const gamesPerSec = this.totalGames / elapsed;
    const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;

    console.log(chalk.cyan('\n🎉 COLLECTION COMPLETE!'));
    console.log('═══════════════════════════════════════════════════════');
    console.log(chalk.green(`📊 Total Games Collected: ${this.totalGames.toLocaleString()}`));
    console.log(chalk.yellow(`⚡ Performance: ${gamesPerSec.toFixed(1)} games/sec`));
    console.log(chalk.yellow(`⏱️  Total Time: ${elapsed.toFixed(1)} seconds`));
    console.log(chalk.yellow(`💾 Peak RAM Usage: ${memoryUsed.toFixed(1)}MB`));
    console.log(chalk.gray(`💻 CPU: Ryzen 5 7600X (24 threads utilized)`));
    console.log(chalk.gray(`🗄️  Cache Stats: ${this.teamCache.size} teams, ${this.gameCache.size} games`));
    console.log('═══════════════════════════════════════════════════════');

    // Verify in database
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL');

    const { count: teamCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL');

    console.log(chalk.cyan('\n📈 Database Verification:'));
    console.log(chalk.green(`   Total NCAA Baseball Games: ${gameCount || 0}`));
    console.log(chalk.green(`   Total NCAA Baseball Teams: ${teamCount || 0}`));
  }
}

// 🚀 RUN IT!
const collector = new NCAABaseballTurboCollectorV2();
collector.collectAllSeasons()
  .then(() => {
    console.log(chalk.green('\n✅ All seasons collected successfully!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });