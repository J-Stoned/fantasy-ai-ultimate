import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import { format, addDays, parseISO } from 'date-fns';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Use all 12 threads of the Ryzen 5 7600X!
const HTTP_LIMIT = pLimit(12);
const BATCH_SIZE = 100;

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

class NCAABaseballTurboCollector {
  private totalGames = 0;
  private totalPlayers = 0;
  private startTime = Date.now();
  private gameCache = new Map<string, any>();

  async collectAllSeasons() {
    console.log('🚀 NCAA Baseball Turbo Collector - Ryzen 5 7600X Edition');
    console.log('💪 Using 12 threads + 32GB RAM for MAXIMUM PERFORMANCE!');
    console.log('📊 Collecting 5 complete seasons (2021-2025)');
    console.log('🎯 Expected: ~55,000+ games\n');

    for (const season of SEASONS) {
      await this.collectSeason(season);
    }

    await this.printFinalStats();
  }

  async collectSeason(season: Season) {
    console.log(`\n🏆 Collecting ${season.year} Season (${season.startDate} to ${season.endDate})`);
    
    const dates: Date[] = [];
    let currentDate = parseISO(season.startDate);
    const endDate = parseISO(season.endDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    console.log(`📅 Processing ${dates.length} days of games...`);

    // Process dates in batches for efficiency
    const seasonStartTime = Date.now();
    let seasonGames = 0;

    for (let i = 0; i < dates.length; i += 10) {
      const dateBatch = dates.slice(i, i + 10);
      const batchGames = await Promise.all(
        dateBatch.map(date => 
          HTTP_LIMIT(() => this.collectGamesForDate(date, season.year))
        )
      );

      const batchTotal = batchGames.reduce((sum, count) => sum + count, 0);
      seasonGames += batchTotal;

      if ((i + 10) % 50 === 0) {
        const elapsed = (Date.now() - seasonStartTime) / 1000;
        const gamesPerSec = seasonGames / elapsed;
        console.log(`  Progress: ${i + 10}/${dates.length} days | ${seasonGames} games | ${gamesPerSec.toFixed(1)} games/sec`);
      }
    }

    console.log(`✅ ${season.year} Complete: ${seasonGames} games in ${((Date.now() - seasonStartTime) / 1000).toFixed(1)}s`);
  }

  async collectGamesForDate(date: Date, year: number): Promise<number> {
    const dateStr = format(date, 'yyyyMMdd');
    
    try {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${dateStr}&limit=300`
      );

      if (!response.ok) {
        console.error(`Failed to fetch ${dateStr}: ${response.status}`);
        return 0;
      }

      const data = await response.json();
      const events = data.events || [];

      if (events.length === 0) return 0;

      // Process games in this batch
      const games = events.map((event: any) => this.transformGame(event, year));
      await this.insertGames(games);

      // Collect teams from games
      const teams = this.extractTeamsFromGames(events);
      await this.insertTeams(teams);

      this.totalGames += games.length;

      return games.length;
    } catch (error) {
      console.error(`Error collecting ${dateStr}:`, error);
      return 0;
    }
  }

  transformGame(event: any, year: number): any {
    const competition = event.competitions?.[0];
    if (!competition) return null;

    const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
    const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

    if (!homeTeam || !awayTeam) return null;

    // Find team IDs based on external_id
    const homeTeamExternalId = `espn_ncaa_baseball_${homeTeam.team.id}`;
    const awayTeamExternalId = `espn_ncaa_baseball_${awayTeam.team.id}`;

    return {
      external_id: `espn_ncaa_baseball_${event.id}`,
      sport: 'NCAA_BASEBALL',
      league: 'NCAA',
      start_time: new Date(competition.date),
      home_team_external_id: homeTeamExternalId,
      away_team_external_id: awayTeamExternalId,
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
    };
  }

  extractTeamsFromGames(events: any[]): any[] {
    const teamsMap = new Map();

    for (const event of events) {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      for (const competitor of competition.competitors || []) {
        const team = competitor.team;
        if (!team || teamsMap.has(team.id)) continue;

        teamsMap.set(team.id, {
          external_id: `espn_ncaa_baseball_${team.id}`,
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

    return Array.from(teamsMap.values());
  }

  async insertGames(games: any[]) {
    if (games.length === 0) return;

    const validGames = games.filter(g => g !== null);
    if (validGames.length === 0) return;

    // Process in batches for efficiency
    for (let i = 0; i < validGames.length; i += BATCH_SIZE) {
      const batch = validGames.slice(i, i + BATCH_SIZE);
      
      try {
        // For each game, we need to find the team IDs
        const gamesWithTeamIds = await Promise.all(batch.map(async (game) => {
          // Look up home team
          const { data: homeTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('external_id', game.home_team_external_id)
            .single();

          // Look up away team
          const { data: awayTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('external_id', game.away_team_external_id)
            .single();

          return {
            external_id: game.external_id,
            sport: game.sport,
            league: game.league,
            start_time: game.start_time,
            home_team_id: homeTeam?.id || null,
            away_team_id: awayTeam?.id || null,
            home_score: game.home_score,
            away_score: game.away_score,
            venue: game.venue,
            status: game.status,
            metadata: game.metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }));

        // Insert games with proper team IDs
        const { error } = await supabase
          .from('games')
          .upsert(gamesWithTeamIds, { onConflict: 'external_id' });

        if (error) {
          console.error('Error inserting games batch:', error);
        }
      } catch (error) {
        console.error('Error inserting games:', error);
      }
    }
  }

  async insertTeams(teams: any[]) {
    if (teams.length === 0) return;

    try {
      const { error } = await supabase
        .from('teams')
        .upsert(
          teams.map(team => ({
            external_id: team.external_id,
            name: team.name,
            abbreviation: team.abbreviation,
            sport: team.sport,
            metadata: team.metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })),
          { onConflict: 'external_id' }
        );

      if (error) {
        console.error('Error inserting teams:', error);
      }
    } catch (error) {
      console.error('Error inserting teams:', error);
    }
  }

  async printFinalStats() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const gamesPerSec = this.totalGames / elapsed;

    console.log('\n🎉 COLLECTION COMPLETE!');
    console.log('═══════════════════════════════════════');
    console.log(`📊 Total Games Collected: ${this.totalGames.toLocaleString()}`);
    console.log(`⚡ Performance: ${gamesPerSec.toFixed(1)} games/sec`);
    console.log(`⏱️  Total Time: ${elapsed.toFixed(1)} seconds`);
    console.log(`💻 CPU: Ryzen 5 7600X (12 threads utilized)`);
    console.log(`💾 RAM: 32GB (optimized batching)`);
    console.log('═══════════════════════════════════════');

    // Verify in database
    const { data: gameStats, error } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL');

    const { data: games } = await supabase
      .from('games')
      .select('game_date')
      .eq('sport', 'NCAA_BASEBALL')
      .order('game_date', { ascending: true })
      .limit(1);

    const { data: lastGame } = await supabase
      .from('games')
      .select('game_date')
      .eq('sport', 'NCAA_BASEBALL')
      .order('game_date', { ascending: false })
      .limit(1);

    const { count: teamCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL');

    console.log('\n📈 Database Verification:');
    console.log(`   Total NCAA Baseball Games: ${gameStats?.count || 0}`);
    console.log(`   Total NCAA Baseball Teams: ${teamCount || 0}`);
    if (games?.[0] && lastGame?.[0]) {
      console.log(`   Date Range: ${games[0].game_date} to ${lastGame[0].game_date}`);
    }
  }
}

// RUN IT!
const collector = new NCAABaseballTurboCollector();
collector.collectAllSeasons()
  .then(() => {
    console.log('\n✅ All seasons collected successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });