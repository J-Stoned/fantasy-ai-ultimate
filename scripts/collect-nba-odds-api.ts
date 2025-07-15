#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// The Odds API - Free tier: 500 requests/month
const oddsApi = axios.create({
  baseURL: 'https://api.the-odds-api.com/v4',
  timeout: 15000,
  params: {
    apiKey: process.env.ODDS_API_KEY || '', // Get free at https://the-odds-api.com
  }
});

console.log('🏀 NBA DATA COLLECTOR - The Odds API');
console.log('📊 Collecting NBA games and scores\n');
console.log('⚠️  Note: This API provides games/scores but not detailed player stats\n');

const CONFIG = {
  SPORT_KEY: 'basketball_nba',
  DAYS_BACK: 30, // Get last 30 days of games
  CONCURRENT_CALLS: 3,
  BATCH_SIZE: 100,
};

// NBA team name mappings
const TEAM_MAPPINGS: Record<string, { id: number, abbreviation: string }> = {
  'Atlanta Hawks': { id: 13001, abbreviation: 'ATL' },
  'Boston Celtics': { id: 13002, abbreviation: 'BOS' },
  'Brooklyn Nets': { id: 13003, abbreviation: 'BKN' },
  'Charlotte Hornets': { id: 13004, abbreviation: 'CHA' },
  'Chicago Bulls': { id: 13005, abbreviation: 'CHI' },
  'Cleveland Cavaliers': { id: 13006, abbreviation: 'CLE' },
  'Dallas Mavericks': { id: 13007, abbreviation: 'DAL' },
  'Denver Nuggets': { id: 13008, abbreviation: 'DEN' },
  'Detroit Pistons': { id: 13009, abbreviation: 'DET' },
  'Golden State Warriors': { id: 13010, abbreviation: 'GSW' },
  'Houston Rockets': { id: 13011, abbreviation: 'HOU' },
  'Indiana Pacers': { id: 13012, abbreviation: 'IND' },
  'LA Clippers': { id: 13013, abbreviation: 'LAC' },
  'Los Angeles Lakers': { id: 13014, abbreviation: 'LAL' },
  'Memphis Grizzlies': { id: 13015, abbreviation: 'MEM' },
  'Miami Heat': { id: 13016, abbreviation: 'MIA' },
  'Milwaukee Bucks': { id: 13017, abbreviation: 'MIL' },
  'Minnesota Timberwolves': { id: 13018, abbreviation: 'MIN' },
  'New Orleans Pelicans': { id: 13019, abbreviation: 'NOP' },
  'New York Knicks': { id: 13020, abbreviation: 'NYK' },
  'Oklahoma City Thunder': { id: 13021, abbreviation: 'OKC' },
  'Orlando Magic': { id: 13022, abbreviation: 'ORL' },
  'Philadelphia 76ers': { id: 13023, abbreviation: 'PHI' },
  'Phoenix Suns': { id: 13024, abbreviation: 'PHX' },
  'Portland Trail Blazers': { id: 13025, abbreviation: 'POR' },
  'Sacramento Kings': { id: 13026, abbreviation: 'SAC' },
  'San Antonio Spurs': { id: 13027, abbreviation: 'SAS' },
  'Toronto Raptors': { id: 13028, abbreviation: 'TOR' },
  'Utah Jazz': { id: 13029, abbreviation: 'UTA' },
  'Washington Wizards': { id: 13030, abbreviation: 'WAS' }
};

let gamesCollected = 0;
let apiRequestsUsed = 0;

async function ensureNBATeams() {
  console.log('🏟️  Ensuring NBA teams exist...');
  
  const teamsToInsert = Object.entries(TEAM_MAPPINGS).map(([name, data]) => ({
    id: data.id,
    name: name,
    abbreviation: data.abbreviation,
    sport: 'NBA',
    external_id: `odds_api_${data.id}`
  }));
  
  const { error } = await supabase
    .from('teams')
    .upsert(teamsToInsert, { onConflict: 'id' });
    
  if (!error) {
    console.log(`✅ ${teamsToInsert.length} NBA teams ready\n`);
  }
}

async function checkAPIStatus() {
  console.log('🔌 Checking API status...');
  try {
    const response = await oddsApi.get('/sports', {
      params: { all: false }
    });
    
    const remaining = response.headers['x-requests-remaining'];
    const used = response.headers['x-requests-used'];
    
    console.log(`✅ API Status: ${used || 0} used, ${remaining || 'unknown'} remaining this month\n`);
    apiRequestsUsed++;
    
    return true;
  } catch (error: any) {
    console.error('❌ API connection failed!');
    console.error('Please get a free API key at: https://the-odds-api.com\n');
    console.error('Then update line 16 with your API key.\n');
    return false;
  }
}

async function fetchHistoricalScores() {
  try {
    console.log('📊 Fetching historical NBA scores...');
    
    const response = await oddsApi.get(`/sports/${CONFIG.SPORT_KEY}/scores`, {
      params: {
        daysFrom: CONFIG.DAYS_BACK
      }
    });
    
    apiRequestsUsed++;
    
    if (!response.data || response.data.length === 0) {
      console.log('No games found');
      return [];
    }
    
    const games = response.data
      .filter((game: any) => game.completed)
      .map((game: any) => {
        const homeTeam = TEAM_MAPPINGS[game.home_team];
        const awayTeam = TEAM_MAPPINGS[game.away_team];
        
        if (!homeTeam || !awayTeam) {
          console.warn(`Unknown team: ${game.home_team} or ${game.away_team}`);
          return null;
        }
        
        const homeScore = game.scores?.find((s: any) => s.name === game.home_team)?.score || 0;
        const awayScore = game.scores?.find((s: any) => s.name === game.away_team)?.score || 0;
        
        return {
          external_id: `odds_api_${game.id}`,
          sport: 'NBA',
          start_time: game.commence_time,
          status: 'final',
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          home_score: parseInt(homeScore),
          away_score: parseInt(awayScore),
          venue: homeTeam.abbreviation === 'LAC' || homeTeam.abbreviation === 'LAL' ? 
            'Crypto.com Arena' : `${game.home_team} Arena`,
          metadata: {
            odds_api_id: game.id,
            sport_title: game.sport_title
          }
        };
      })
      .filter((game: any) => game !== null);
    
    console.log(`Found ${games.length} completed games`);
    return games;
  } catch (error: any) {
    console.error('Error fetching scores:', error.message);
    return [];
  }
}

async function fetchUpcomingGames() {
  try {
    console.log('\n📅 Fetching upcoming NBA games (with odds)...');
    
    const response = await oddsApi.get(`/sports/${CONFIG.SPORT_KEY}/odds`, {
      params: {
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american'
      }
    });
    
    apiRequestsUsed++;
    
    if (!response.data || response.data.length === 0) {
      console.log('No upcoming games found');
      return [];
    }
    
    const games = response.data.map((game: any) => {
      const homeTeam = TEAM_MAPPINGS[game.home_team];
      const awayTeam = TEAM_MAPPINGS[game.away_team];
      
      if (!homeTeam || !awayTeam) {
        return null;
      }
      
      // Extract odds from bookmakers
      const bookmakerOdds = game.bookmakers?.map((book: any) => ({
        bookmaker: book.title,
        markets: book.markets
      })) || [];
      
      return {
        external_id: `odds_api_upcoming_${game.id}`,
        sport: 'NBA',
        start_time: game.commence_time,
        status: 'scheduled',
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        home_score: null,
        away_score: null,
        venue: `${game.home_team} Arena`,
        metadata: {
          odds_api_id: game.id,
          sport_title: game.sport_title,
          bookmaker_odds: bookmakerOdds
        }
      };
    })
    .filter((game: any) => game !== null);
    
    console.log(`Found ${games.length} upcoming games with odds`);
    return games;
  } catch (error: any) {
    console.error('Error fetching upcoming games:', error.message);
    return [];
  }
}

async function collectNBAData() {
  const startTime = Date.now();
  
  // Check API connection
  const apiConnected = await checkAPIStatus();
  if (!apiConnected) {
    console.log('\n⚠️  Get your free API key:');
    console.log('1. Go to https://the-odds-api.com');
    console.log('2. Sign up for free (500 requests/month)');
    console.log('3. Copy your API key');
    console.log('4. Update line 16 of this script\n');
    return;
  }
  
  await ensureNBATeams();
  
  // Fetch historical scores
  const historicalGames = await fetchHistoricalScores();
  
  // Fetch upcoming games with odds
  const upcomingGames = await fetchUpcomingGames();
  
  const allGames = [...historicalGames, ...upcomingGames];
  
  if (allGames.length === 0) {
    console.log('\nNo games found to process.');
    return;
  }
  
  // Insert games
  console.log(`\n💾 Inserting ${allGames.length} games...`);
  
  for (let i = 0; i < allGames.length; i += CONFIG.BATCH_SIZE) {
    const batch = allGames.slice(i, i + CONFIG.BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('games')
      .upsert(batch, { onConflict: 'external_id' })
      .select();
      
    if (data) {
      gamesCollected += data.length;
    }
    
    if (error && !error.message.includes('duplicate')) {
      console.error('Insert error:', error.message);
    }
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n✅ NBA DATA COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games collected: ${gamesCollected}`);
  console.log(`📊 API requests used: ${apiRequestsUsed}`);
  
  // Check totals
  const { count: nbaGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  console.log('\n📈 NBA Database Totals:');
  console.log(`🏀 Total NBA games: ${nbaGames}`);
  
  console.log('\n📝 Notes:');
  console.log('- This API provides game scores but not player statistics');
  console.log('- It includes betting odds data for upcoming games');
  console.log('- For player stats, try the RapidAPI collector instead');
  
  const remaining = 500 - apiRequestsUsed;
  console.log(`\n📊 API Usage: ${apiRequestsUsed}/500 requests used this month`);
  console.log(`   Remaining: ${remaining} requests`);
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
  
  await collectNBAData();
}

main().catch(console.error);