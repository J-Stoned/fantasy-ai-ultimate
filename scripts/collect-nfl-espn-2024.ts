#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import * as os from 'os';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// ESPN API endpoints
const espnApi = axios.create({
  baseURL: 'https://site.api.espn.com/apis/site/v2/sports',
  timeout: 20000
});

const CPU_CORES = os.cpus().length;

console.log('🏈 NFL 2024 DATA COLLECTOR - ESPN API');
console.log('📊 Collecting REAL NFL games and stats');
console.log(`🖥️  ${CPU_CORES} cores ready\n`);

const CONFIG = {
  YEAR: 2024,
  WEEKS: 18, // Regular season weeks
  CONCURRENT_CALLS: Math.min(CPU_CORES * 2, 16),
  BATCH_SIZE: 100,
  DELAY_MS: 200,
  STATS_LIMIT: 100 // Limit games for stats collection
};

// NFL team mappings
const NFL_TEAMS: Record<string, { id: number, name: string, conference: string }> = {
  'ARI': { id: 15001, name: 'Arizona Cardinals', conference: 'NFC' },
  'ATL': { id: 15002, name: 'Atlanta Falcons', conference: 'NFC' },
  'BAL': { id: 15003, name: 'Baltimore Ravens', conference: 'AFC' },
  'BUF': { id: 15004, name: 'Buffalo Bills', conference: 'AFC' },
  'CAR': { id: 15005, name: 'Carolina Panthers', conference: 'NFC' },
  'CHI': { id: 15006, name: 'Chicago Bears', conference: 'NFC' },
  'CIN': { id: 15007, name: 'Cincinnati Bengals', conference: 'AFC' },
  'CLE': { id: 15008, name: 'Cleveland Browns', conference: 'AFC' },
  'DAL': { id: 15009, name: 'Dallas Cowboys', conference: 'NFC' },
  'DEN': { id: 15010, name: 'Denver Broncos', conference: 'AFC' },
  'DET': { id: 15011, name: 'Detroit Lions', conference: 'NFC' },
  'GB': { id: 15012, name: 'Green Bay Packers', conference: 'NFC' },
  'HOU': { id: 15013, name: 'Houston Texans', conference: 'AFC' },
  'IND': { id: 15014, name: 'Indianapolis Colts', conference: 'AFC' },
  'JAX': { id: 15015, name: 'Jacksonville Jaguars', conference: 'AFC' },
  'KC': { id: 15016, name: 'Kansas City Chiefs', conference: 'AFC' },
  'LV': { id: 15017, name: 'Las Vegas Raiders', conference: 'AFC' },
  'LAC': { id: 15018, name: 'Los Angeles Chargers', conference: 'AFC' },
  'LAR': { id: 15019, name: 'Los Angeles Rams', conference: 'NFC' },
  'MIA': { id: 15020, name: 'Miami Dolphins', conference: 'AFC' },
  'MIN': { id: 15021, name: 'Minnesota Vikings', conference: 'NFC' },
  'NE': { id: 15022, name: 'New England Patriots', conference: 'AFC' },
  'NO': { id: 15023, name: 'New Orleans Saints', conference: 'NFC' },
  'NYG': { id: 15024, name: 'New York Giants', conference: 'NFC' },
  'NYJ': { id: 15025, name: 'New York Jets', conference: 'AFC' },
  'PHI': { id: 15026, name: 'Philadelphia Eagles', conference: 'NFC' },
  'PIT': { id: 15027, name: 'Pittsburgh Steelers', conference: 'AFC' },
  'SF': { id: 15028, name: 'San Francisco 49ers', conference: 'NFC' },
  'SEA': { id: 15029, name: 'Seattle Seahawks', conference: 'NFC' },
  'TB': { id: 15030, name: 'Tampa Bay Buccaneers', conference: 'NFC' },
  'TEN': { id: 15031, name: 'Tennessee Titans', conference: 'AFC' },
  'WSH': { id: 15032, name: 'Washington Commanders', conference: 'NFC' }
};

// Tracking
let gamesCollected = 0;
let statsCollected = 0;
let playersFound = 0;

// Progress bars
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} | {name} | {value}/{total} | {percentage}%'
}, cliProgress.Presets.shades_classic);

async function ensureNFLTeams() {
  console.log('🏟️  Ensuring NFL teams exist...');
  
  const teamsToInsert = Object.entries(NFL_TEAMS).map(([abbr, team]) => ({
    id: team.id,
    name: team.name,
    abbreviation: abbr,
    sport: 'NFL',
    external_id: `espn_nfl_${abbr.toLowerCase()}`,
    metadata: {
      conference: team.conference
    }
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
      
      if (competition.status.type.completed) {
        const homeAbbr = homeTeam.team.abbreviation;
        const awayAbbr = awayTeam.team.abbreviation;
        
        games.push({
          external_id: `espn_nfl_${event.id}`,
          sport: 'NFL',
          start_time: event.date,
          status: 'final',
          home_team_id: NFL_TEAMS[homeAbbr]?.id || 15000,
          away_team_id: NFL_TEAMS[awayAbbr]?.id || 15000,
          home_score: parseInt(homeTeam.score) || 0,
          away_score: parseInt(awayTeam.score) || 0,
          venue: competition.venue?.fullName || 'Unknown',
          metadata: {
            week: week,
            season_type: seasonType === 2 ? 'regular' : 'playoffs',
            weather: event.weather,
            attendance: competition.attendance,
            broadcast: competition.broadcasts?.[0]?.names,
            headlines: competition.headlines
          }
        });
      }
    });
    
    return games;
  } catch (error: any) {
    return [];
  }
}

async function fetchGameStats(gameId: string) {
  try {
    const response = await espnApi.get('/football/nfl/summary', {
      params: { event: gameId }
    });
    
    const stats: any[] = [];
    const players: any[] = [];
    
    // Process boxscore
    const boxscore = response.data.boxscore;
    if (!boxscore?.players) return { stats: [], players: [] };
    
    // Process each team's players
    boxscore.players.forEach((teamData: any) => {
      const teamAbbr = teamData.team.abbreviation;
      const teamId = NFL_TEAMS[teamAbbr]?.id || 15000;
      
      // Process each position group
      Object.entries(teamData.statistics).forEach(([category, playerList]: [string, any]) => {
        if (!Array.isArray(playerList)) return;
        
        playerList.forEach((playerData: any) => {
          const athlete = playerData.athlete;
          if (!athlete) return;
          
          const playerId = 16000 + parseInt(athlete.id);
          
          // Add player
          players.push({
            id: playerId,
            name: athlete.displayName,
            sport: 'NFL',
            position: athlete.position?.abbreviation || 'N/A',
            external_id: `espn_nfl_${athlete.id}`,
            metadata: {
              jersey: athlete.jersey,
              team_id: teamId,
              height: athlete.height,
              weight: athlete.weight
            }
          });
          
          // Parse stats based on category
          if (category === 'passing' && playerData.stats) {
            const [comp_att, yards, avg, td, int, sacks, qbr, rtg] = playerData.stats;
            const [completions, attempts] = comp_att?.split('/').map(Number) || [0, 0];
            
            if (attempts > 0) {
              stats.push(
                { player_id: playerId, stat_type: 'pass_attempts', stat_value: attempts, fantasy_points: 0 },
                { player_id: playerId, stat_type: 'pass_completions', stat_value: completions, fantasy_points: 0 },
                { player_id: playerId, stat_type: 'pass_yards', stat_value: parseFloat(yards) || 0, fantasy_points: (parseFloat(yards) || 0) * 0.04 },
                { player_id: playerId, stat_type: 'pass_td', stat_value: parseFloat(td) || 0, fantasy_points: (parseFloat(td) || 0) * 4 },
                { player_id: playerId, stat_type: 'pass_int', stat_value: parseFloat(int) || 0, fantasy_points: -(parseFloat(int) || 0) * 2 },
                { player_id: playerId, stat_type: 'sacks_taken', stat_value: parseFloat(sacks?.split('-')[0]) || 0, fantasy_points: 0 }
              );
            }
          } else if (category === 'rushing' && playerData.stats) {
            const [carries, yards, avg, td, long] = playerData.stats;
            
            if (parseFloat(carries) > 0) {
              stats.push(
                { player_id: playerId, stat_type: 'rush_attempts', stat_value: parseFloat(carries) || 0, fantasy_points: 0 },
                { player_id: playerId, stat_type: 'rush_yards', stat_value: parseFloat(yards) || 0, fantasy_points: (parseFloat(yards) || 0) * 0.1 },
                { player_id: playerId, stat_type: 'rush_td', stat_value: parseFloat(td) || 0, fantasy_points: (parseFloat(td) || 0) * 6 },
                { player_id: playerId, stat_type: 'rush_long', stat_value: parseFloat(long) || 0, fantasy_points: 0 }
              );
            }
          } else if (category === 'receiving' && playerData.stats) {
            const [receptions, yards, avg, td, long, targets] = playerData.stats;
            
            if (parseFloat(receptions) > 0 || parseFloat(targets) > 0) {
              stats.push(
                { player_id: playerId, stat_type: 'receptions', stat_value: parseFloat(receptions) || 0, fantasy_points: (parseFloat(receptions) || 0) },
                { player_id: playerId, stat_type: 'rec_yards', stat_value: parseFloat(yards) || 0, fantasy_points: (parseFloat(yards) || 0) * 0.1 },
                { player_id: playerId, stat_type: 'rec_td', stat_value: parseFloat(td) || 0, fantasy_points: (parseFloat(td) || 0) * 6 },
                { player_id: playerId, stat_type: 'targets', stat_value: parseFloat(targets) || 0, fantasy_points: 0 }
              );
            }
          } else if (category === 'defensive' && playerData.stats) {
            const [tackles, sacks, tfl, pd, qbHits, td] = playerData.stats;
            
            stats.push(
              { player_id: playerId, stat_type: 'tackles', stat_value: parseFloat(tackles) || 0, fantasy_points: (parseFloat(tackles) || 0) },
              { player_id: playerId, stat_type: 'sacks', stat_value: parseFloat(sacks) || 0, fantasy_points: (parseFloat(sacks) || 0) * 2 },
              { player_id: playerId, stat_type: 'tackle_for_loss', stat_value: parseFloat(tfl) || 0, fantasy_points: (parseFloat(tfl) || 0) * 0.5 },
              { player_id: playerId, stat_type: 'pass_defended', stat_value: parseFloat(pd) || 0, fantasy_points: (parseFloat(pd) || 0) },
              { player_id: playerId, stat_type: 'def_td', stat_value: parseFloat(td) || 0, fantasy_points: (parseFloat(td) || 0) * 6 }
            );
          }
        });
      });
    });
    
    // Add sport and game_id to all stats
    const finalStats = stats
      .filter(s => s.stat_value > 0 || s.stat_type.includes('int'))
      .map(s => ({ ...s, sport: 'NFL', game_id: 0 })); // game_id will be mapped later
    
    return { stats: finalStats, players };
  } catch (error: any) {
    return { stats: [], players: [] };
  }
}

async function collectNFLData() {
  const startTime = Date.now();
  
  await ensureNFLTeams();
  
  // Collect regular season games
  console.log(`📅 Collecting ${CONFIG.YEAR} NFL regular season (${CONFIG.WEEKS} weeks)...\n`);
  
  const weeksBar = multibar.create(CONFIG.WEEKS, 0, { name: 'Weeks' });
  const gamesBar = multibar.create(CONFIG.WEEKS * 16, 0, { name: 'Games' });
  
  const allGames: any[] = [];
  const limit = pLimit(CONFIG.CONCURRENT_CALLS);
  
  // Fetch all weeks
  const weekPromises = Array.from({ length: CONFIG.WEEKS }, (_, i) => i + 1).map(week =>
    limit(async () => {
      const games = await fetchNFLWeek(week);
      allGames.push(...games);
      weeksBar.increment();
      gamesBar.increment(games.length);
      await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
    })
  );
  
  await Promise.all(weekPromises);
  
  // Also get playoff games
  console.log('\n📅 Checking for playoff games...');
  for (let week = 1; week <= 5; week++) {
    const playoffGames = await fetchNFLWeek(week, 3); // seasontype 3 = playoffs
    allGames.push(...playoffGames);
    await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
  }
  
  multibar.stop();
  console.log(`\n📊 Found ${allGames.length} total games`);
  
  // Insert games
  if (allGames.length > 0) {
    console.log('\n💾 Inserting games...');
    
    for (let i = 0; i < allGames.length; i += CONFIG.BATCH_SIZE) {
      const batch = allGames.slice(i, i + CONFIG.BATCH_SIZE);
      const { data } = await supabase
        .from('games')
        .upsert(batch, { onConflict: 'external_id' })
        .select();
        
      if (data) gamesCollected += data.length;
    }
    
    console.log(`✅ Inserted ${gamesCollected} games`);
    
    // Collect stats for first N games
    const gamesToProcess = allGames.slice(0, CONFIG.STATS_LIMIT);
    console.log(`\n📊 Collecting stats for ${gamesToProcess.length} games...`);
    
    const statsBar = new cliProgress.SingleBar({
      format: '📊 Stats |{bar}| {percentage}% | {value}/{total} games',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    
    statsBar.start(gamesToProcess.length, 0);
    
    for (const game of gamesToProcess) {
      const espnGameId = game.external_id.replace('espn_nfl_', '');
      const result = await fetchGameStats(espnGameId);
      
      // Insert players
      if (result.players.length > 0) {
        await supabase
          .from('players')
          .upsert(result.players, { onConflict: 'id' });
        playersFound += result.players.length;
      }
      
      // Map game ID and insert stats
      if (result.stats.length > 0) {
        const { data: ourGame } = await supabase
          .from('games')
          .select('id')
          .eq('external_id', game.external_id)
          .single();
          
        if (ourGame) {
          const mappedStats = result.stats.map(s => ({
            ...s,
            game_id: ourGame.id
          }));
          
          const { data: statsData } = await supabase
            .from('player_stats')
            .insert(mappedStats)
            .select();
            
          if (statsData) statsCollected += statsData.length;
        }
      }
      
      statsBar.increment();
      await new Promise(r => setTimeout(r, CONFIG.DELAY_MS));
    }
    
    statsBar.stop();
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n✅ NFL DATA COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games collected: ${gamesCollected}`);
  console.log(`📊 Stats collected: ${statsCollected}`);
  console.log(`👥 Players found: ${playersFound}`);
  console.log(`⚡ Rate: ${(statsCollected / elapsedTime).toFixed(0)} stats/second`);
  
  // Check totals
  const { count: nflGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');
    
  const { count: nflStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');
    
  console.log('\n📈 NFL Database Totals:');
  console.log(`🏈 Total NFL games: ${nflGames}`);
  console.log(`📊 Total NFL stats: ${nflStats}`);
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
  
  await collectNFLData();
}

main().catch(console.error);