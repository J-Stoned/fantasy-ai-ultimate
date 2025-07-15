#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// ESPN API
const espnApi = axios.create({
  baseURL: 'https://site.api.espn.com/apis/site/v2/sports',
  timeout: 15000
});

console.log('🏈 NFL 2024 GAMES COLLECTOR');
console.log('📊 Collecting NFL games from ESPN (no stats)\n');

const CONFIG = {
  YEAR: 2024,
  WEEKS: 18,
  CONCURRENT_CALLS: 5,
  BATCH_SIZE: 100,
  DELAY_MS: 300
};

// NFL team mappings
const NFL_TEAMS: Record<string, { id: number, name: string }> = {
  'ARI': { id: 15001, name: 'Arizona Cardinals' },
  'ATL': { id: 15002, name: 'Atlanta Falcons' },
  'BAL': { id: 15003, name: 'Baltimore Ravens' },
  'BUF': { id: 15004, name: 'Buffalo Bills' },
  'CAR': { id: 15005, name: 'Carolina Panthers' },
  'CHI': { id: 15006, name: 'Chicago Bears' },
  'CIN': { id: 15007, name: 'Cincinnati Bengals' },
  'CLE': { id: 15008, name: 'Cleveland Browns' },
  'DAL': { id: 15009, name: 'Dallas Cowboys' },
  'DEN': { id: 15010, name: 'Denver Broncos' },
  'DET': { id: 15011, name: 'Detroit Lions' },
  'GB': { id: 15012, name: 'Green Bay Packers' },
  'HOU': { id: 15013, name: 'Houston Texans' },
  'IND': { id: 15014, name: 'Indianapolis Colts' },
  'JAX': { id: 15015, name: 'Jacksonville Jaguars' },
  'KC': { id: 15016, name: 'Kansas City Chiefs' },
  'LV': { id: 15017, name: 'Las Vegas Raiders' },
  'LAC': { id: 15018, name: 'Los Angeles Chargers' },
  'LAR': { id: 15019, name: 'Los Angeles Rams' },
  'MIA': { id: 15020, name: 'Miami Dolphins' },
  'MIN': { id: 15021, name: 'Minnesota Vikings' },
  'NE': { id: 15022, name: 'New England Patriots' },
  'NO': { id: 15023, name: 'New Orleans Saints' },
  'NYG': { id: 15024, name: 'New York Giants' },
  'NYJ': { id: 15025, name: 'New York Jets' },
  'PHI': { id: 15026, name: 'Philadelphia Eagles' },
  'PIT': { id: 15027, name: 'Pittsburgh Steelers' },
  'SF': { id: 15028, name: 'San Francisco 49ers' },
  'SEA': { id: 15029, name: 'Seattle Seahawks' },
  'TB': { id: 15030, name: 'Tampa Bay Buccaneers' },
  'TEN': { id: 15031, name: 'Tennessee Titans' },
  'WSH': { id: 15032, name: 'Washington Commanders' }
};

let gamesCollected = 0;
let newGames = 0;

async function ensureNFLTeams() {
  console.log('🏟️  Ensuring NFL teams exist...');
  
  const teamsToInsert = Object.entries(NFL_TEAMS).map(([abbr, team]) => ({
    id: team.id,
    name: team.name,
    abbreviation: abbr,
    sport: 'NFL',
    external_id: `espn_nfl_${abbr.toLowerCase()}`
  }));
  
  const { error } = await supabase
    .from('teams')
    .upsert(teamsToInsert, { onConflict: 'id' });
    
  if (!error) {
    console.log(`✅ ${teamsToInsert.length} NFL teams ready\n`);
  }
}

async function fetchNFLWeek(week: number, seasonType: number = 2) {
  try {
    const response = await espnApi.get('/football/nfl/scoreboard', {
      params: {
        week: week,
        seasontype: seasonType,
        dates: CONFIG.YEAR
      }
    });
    
    const games: any[] = [];
    
    response.data.events?.forEach((event: any) => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
      
      const homeAbbr = homeTeam.team.abbreviation;
      const awayAbbr = awayTeam.team.abbreviation;
      
      games.push({
        external_id: `espn_nfl_${event.id}`,
        sport: 'NFL',
        start_time: event.date,
        status: competition.status.type.completed ? 'final' : 'scheduled',
        home_team_id: NFL_TEAMS[homeAbbr]?.id || 15000,
        away_team_id: NFL_TEAMS[awayAbbr]?.id || 15000,
        home_score: parseInt(homeTeam.score) || null,
        away_score: parseInt(awayTeam.score) || null,
        venue: competition.venue?.fullName || 'Unknown',
        metadata: {
          week: week,
          season_type: seasonType === 2 ? 'regular' : seasonType === 3 ? 'playoffs' : 'preseason',
          weather: event.weather,
          attendance: competition.attendance,
          broadcast: competition.broadcasts?.[0]?.names,
          odds: competition.odds?.[0]
        }
      });
    });
    
    return games;
  } catch (error: any) {
    console.error(`Error fetching week ${week}:`, error.message);
    return [];
  }
}

async function collectNFLGames() {
  const startTime = Date.now();
  
  await ensureNFLTeams();
  
  console.log(`📅 Collecting ${CONFIG.YEAR} NFL season...\n`);
  
  const progressBar = new cliProgress.SingleBar({
    format: '🏈 Progress |{bar}| {percentage}% | Week {value}/{total} | {games} games',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(CONFIG.WEEKS + 5, 0, { games: 0 }); // +5 for playoffs
  
  const allGames: any[] = [];
  const limit = pLimit(CONFIG.CONCURRENT_CALLS);
  
  // Regular season
  const regularPromises = Array.from({ length: CONFIG.WEEKS }, (_, i) => i + 1).map(week =>
    limit(async () => {
      const games = await fetchNFLWeek(week, 2);
      allGames.push(...games);
      progressBar.increment(1, { games: allGames.length });
      await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
    })
  );
  
  await Promise.all(regularPromises);
  
  // Playoffs
  console.log('\n📅 Getting playoff games...');
  for (let week = 1; week <= 5; week++) {
    const playoffGames = await fetchNFLWeek(week, 3);
    allGames.push(...playoffGames);
    progressBar.increment(1, { games: allGames.length });
    await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
  }
  
  progressBar.stop();
  
  console.log(`\n📊 Found ${allGames.length} total games`);
  
  // Check existing
  const externalIds = allGames.map(g => g.external_id);
  const { data: existing } = await supabase
    .from('games')
    .select('external_id')
    .in('external_id', externalIds);
    
  const existingSet = new Set(existing?.map(g => g.external_id) || []);
  const newGamesToInsert = allGames.filter(g => !existingSet.has(g.external_id));
  
  console.log(`✅ Already have: ${existing?.length || 0} games`);
  console.log(`🆕 New games to add: ${newGamesToInsert.length}`);
  
  // Insert new games
  if (newGamesToInsert.length > 0) {
    console.log('\n💾 Inserting new games...');
    
    for (let i = 0; i < newGamesToInsert.length; i += CONFIG.BATCH_SIZE) {
      const batch = newGamesToInsert.slice(i, i + CONFIG.BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('games')
        .insert(batch)
        .select();
        
      if (error) {
        console.error('Insert error:', error.message);
      } else if (data) {
        newGames += data.length;
      }
      
      process.stdout.write(`\r💾 Inserted ${newGames} / ${newGamesToInsert.length} games`);
    }
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ NFL GAME COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Total games found: ${allGames.length}`);
  console.log(`🆕 New games added: ${newGames}`);
  console.log(`📊 Already existed: ${allGames.length - newGames}`);
  
  // Check totals
  const { count: nflGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');
    
  console.log(`\n📈 Total NFL games in database: ${nflGames}`);
  
  // Analysis
  const { data: completedGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .eq('status', 'final');
    
  const { data: upcomingGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL')
    .eq('status', 'scheduled');
    
  console.log('\n📊 Game Status:');
  console.log(`✅ Completed games: ${completedGames?.length || 0}`);
  console.log(`📅 Upcoming games: ${upcomingGames?.length || 0}`);
  
  console.log('\n💡 Next steps:');
  console.log('1. Get a RapidAPI key for player stats');
  console.log('2. Or wait for better free NFL API options');
}

// Main
async function main() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
  
  await collectNFLGames();
}

main().catch(console.error);