#!/usr/bin/env tsx
/**
 * 🏀 NBA GAMES COLLECTOR (2023-2025)
 * 
 * Collects all NBA games for:
 * - 2023-24 season (complete)
 * - 2024-25 season (in progress)
 * 
 * Uses ESPN API for reliable game data
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { format, addDays, parseISO } from 'date-fns';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configuration
const SEASONS = [
  { 
    name: '2022-23',
    startDate: '2022-10-18',
    endDate: '2023-06-12' // Including finals
  },
  { 
    name: '2023-24',
    startDate: '2023-10-24',
    endDate: '2024-06-17' // Including finals
  },
  {
    name: '2024-25',
    startDate: '2024-10-22',
    endDate: '2025-01-15' // Current date - season in progress
  }
];

// ESPN NBA API endpoints
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// Rate limiting
const limit = pLimit(5); // 5 concurrent requests
const API_DELAY = 1000; // 1 second between requests

// Progress tracking
let totalGamesFound = 0;
let gamesInserted = 0;
let gamesSkipped = 0;
let errors = 0;

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'Progress |{bar}| {percentage}% | {value}/{total} days | Games: {games}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

// Team mapping (ESPN ID to our database ID)
const TEAM_MAPPING: Record<string, number> = {
  '1': 1,   // Atlanta Hawks
  '2': 2,   // Boston Celtics
  '3': 3,   // Brooklyn Nets
  '4': 4,   // Charlotte Hornets
  '5': 5,   // Chicago Bulls
  '6': 6,   // Cleveland Cavaliers
  '7': 7,   // Dallas Mavericks
  '8': 8,   // Denver Nuggets
  '9': 9,   // Detroit Pistons
  '10': 10, // Golden State Warriors
  '11': 11, // Houston Rockets
  '12': 12, // Indiana Pacers
  '13': 13, // LA Clippers
  '14': 14, // Los Angeles Lakers
  '15': 15, // Memphis Grizzlies
  '16': 16, // Miami Heat
  '17': 17, // Milwaukee Bucks
  '18': 18, // Minnesota Timberwolves
  '19': 19, // New Orleans Pelicans
  '20': 20, // New York Knicks
  '21': 21, // Oklahoma City Thunder
  '22': 22, // Orlando Magic
  '23': 23, // Philadelphia 76ers
  '24': 24, // Phoenix Suns
  '25': 25, // Portland Trail Blazers
  '26': 26, // Sacramento Kings
  '27': 27, // San Antonio Spurs
  '28': 28, // Toronto Raptors
  '29': 29, // Utah Jazz
  '30': 30  // Washington Wizards
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGamesForDate(date: string) {
  try {
    await delay(API_DELAY);
    
    const response = await axios.get(`${ESPN_BASE}/scoreboard`, {
      params: {
        dates: date.replace(/-/g, ''),
        limit: 50
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const games = response.data?.events || [];
    return games;
  } catch (error: any) {
    console.error(chalk.red(`\nError fetching games for ${date}:`), error.message);
    errors++;
    return [];
  }
}

function parseESPNGame(game: any, date: string) {
  try {
    const competition = game.competitions?.[0];
    if (!competition) return null;

    const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
    const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

    if (!homeTeam || !awayTeam) return null;

    const homeTeamId = TEAM_MAPPING[homeTeam.team.id];
    const awayTeamId = TEAM_MAPPING[awayTeam.team.id];

    if (!homeTeamId || !awayTeamId) {
      console.warn(chalk.yellow(`\nUnmapped teams: ${homeTeam.team.displayName} vs ${awayTeam.team.displayName}`));
      return null;
    }

    // Parse scores
    const homeScore = competition.status?.type?.completed ? parseInt(homeTeam.score || '0') : null;
    const awayScore = competition.status?.type?.completed ? parseInt(awayTeam.score || '0') : null;

    // Determine status
    let status = 'scheduled';
    if (competition.status?.type?.completed) {
      status = 'completed';
    } else if (competition.status?.type?.state === 'in') {
      status = 'in_progress';
    }

    return {
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      sport: 'nba',
      sport_id: 'nba',
      league: 'NBA',
      start_time: parseISO(game.date),
      venue: competition.venue?.fullName || homeTeam.team.location,
      home_score: homeScore,
      away_score: awayScore,
      status: status,
      external_id: `espn_nba_${game.id}`,
      metadata: {
        espn_game_id: game.id,
        season: game.season?.year,
        season_type: game.season?.type?.name || 'Regular Season',
        week: game.week?.number,
        attendance: competition.attendance,
        broadcast: competition.broadcasts?.[0]?.names || []
      }
    };
  } catch (error: any) {
    console.error(chalk.red('\nError parsing game:'), error.message);
    return null;
  }
}

async function insertGames(games: any[]) {
  if (games.length === 0) return;

  try {
    // Check for existing games
    const externalIds = games.map(g => g.external_id);
    const { data: existing } = await supabase
      .from('games')
      .select('external_id')
      .in('external_id', externalIds);

    const existingIds = new Set(existing?.map(g => g.external_id) || []);
    const newGames = games.filter(g => !existingIds.has(g.external_id));

    if (newGames.length > 0) {
      const { error } = await supabase
        .from('games')
        .insert(newGames);

      if (error) {
        console.error(chalk.red('\nError inserting games:'), error);
        errors++;
      } else {
        gamesInserted += newGames.length;
      }
    }

    gamesSkipped += games.length - newGames.length;
  } catch (error: any) {
    console.error(chalk.red('\nError in insertGames:'), error.message);
    errors++;
  }
}

async function collectSeason(season: typeof SEASONS[0]) {
  console.log(chalk.cyan(`\n📅 Collecting ${season.name} season...`));
  
  const startDate = parseISO(season.startDate);
  const endDate = parseISO(season.endDate);
  let currentDate = startDate;
  
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  let processedDays = 0;
  
  progressBar.start(totalDays, 0, { games: totalGamesFound });
  
  const gameBatches: any[] = [];
  
  while (currentDate <= endDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    await limit(async () => {
      const espnGames = await fetchGamesForDate(dateStr);
      const parsedGames = espnGames
        .map((g: any) => parseESPNGame(g, dateStr))
        .filter(Boolean);
      
      if (parsedGames.length > 0) {
        totalGamesFound += parsedGames.length;
        gameBatches.push(...parsedGames);
        
        // Insert in batches of 50
        if (gameBatches.length >= 50) {
          await insertGames(gameBatches.splice(0, 50));
        }
      }
      
      processedDays++;
      progressBar.update(processedDays, { games: totalGamesFound });
    });
    
    currentDate = addDays(currentDate, 1);
  }
  
  // Insert remaining games
  if (gameBatches.length > 0) {
    await insertGames(gameBatches);
  }
  
  progressBar.stop();
}

async function main() {
  console.log(chalk.bold.blue('\n🏀 NBA GAMES COLLECTOR (2023-2025)\n'));
  console.log(chalk.white('Collecting games from ESPN API...'));
  
  const startTime = Date.now();
  
  try {
    // Collect each season
    for (const season of SEASONS) {
      await collectSeason(season);
    }
    
    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(chalk.green('\n✅ Collection Complete!\n'));
    console.log(chalk.white(`📊 Summary:`));
    console.log(chalk.white(`   Total games found: ${totalGamesFound}`));
    console.log(chalk.white(`   Games inserted: ${gamesInserted}`));
    console.log(chalk.white(`   Games skipped (duplicates): ${gamesSkipped}`));
    console.log(chalk.white(`   Errors: ${errors}`));
    console.log(chalk.white(`   Duration: ${duration}s`));
    
    // Verify in database
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'nba');
    
    console.log(chalk.cyan(`\n🗄️  Total NBA games in database: ${count}`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  }
}

// Run the collector
main().catch(console.error);