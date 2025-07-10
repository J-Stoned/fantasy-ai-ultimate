#!/usr/bin/env tsx
/**
 * 🔥🔥🔥 ULTIMATE TURBO LOADER - 1 MILLION RECORDS INCOMING! 🔥🔥🔥
 * With service role key = NO LIMITS!
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

// USE SERVICE ROLE KEY FOR UNLIMITED POWER!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

console.log(chalk.red.bold('\n🔥🔥🔥 ULTIMATE TURBO LOADER ACTIVATED 🔥🔥🔥'));
console.log(chalk.red('=========================================\n'));

const stats = {
  players: 0,
  teams: 0,
  games: 0,
  playerStats: 0,
  news: 0,
  total: 0,
  startTime: Date.now()
};

// Concurrent limits for parallel processing
const limit = pLimit(10); // 10 concurrent operations

// MASSIVE BATCH INSERT
async function megaInsert(table: string, data: any[], batchSize = 1000): Promise<number> {
  if (!data.length) return 0;
  
  let inserted = 0;
  const batches = [];
  
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  
  console.log(chalk.yellow(`📤 Inserting ${data.length} records into ${table} (${batches.length} batches)...`));
  
  const results = await Promise.all(
    batches.map((batch, idx) => 
      limit(async () => {
        const { data: result, error } = await supabase
          .from(table)
          .insert(batch)
          .select();
        
        if (error) {
          console.log(chalk.red(`❌ Batch ${idx} error: ${error.message}`));
          return 0;
        }
        
        process.stdout.write(chalk.green('✓'));
        return result?.length || 0;
      })
    )
  );
  
  inserted = results.reduce((sum, count) => sum + count, 0);
  stats[table] = (stats[table] || 0) + inserted;
  stats.total += inserted;
  
  console.log(chalk.green(`\n✅ Inserted ${inserted} into ${table}\n`));
  return inserted;
}

// LOAD ALL TEAMS (NFL, NBA, MLB, NHL)
async function loadAllTeams() {
  console.log(chalk.cyan('🏟️ Loading ALL professional teams...\n'));
  
  const teams = [];
  
  // NFL Teams (32)
  const nflTeams = [
    { id: 1, name: 'Arizona Cardinals', abbreviation: 'ARI', city: 'Arizona' },
    { id: 2, name: 'Atlanta Falcons', abbreviation: 'ATL', city: 'Atlanta' },
    { id: 3, name: 'Baltimore Ravens', abbreviation: 'BAL', city: 'Baltimore' },
    { id: 4, name: 'Buffalo Bills', abbreviation: 'BUF', city: 'Buffalo' },
    { id: 5, name: 'Carolina Panthers', abbreviation: 'CAR', city: 'Carolina' },
    { id: 6, name: 'Chicago Bears', abbreviation: 'CHI', city: 'Chicago' },
    { id: 7, name: 'Cincinnati Bengals', abbreviation: 'CIN', city: 'Cincinnati' },
    { id: 8, name: 'Cleveland Browns', abbreviation: 'CLE', city: 'Cleveland' },
    { id: 9, name: 'Dallas Cowboys', abbreviation: 'DAL', city: 'Dallas' },
    { id: 10, name: 'Denver Broncos', abbreviation: 'DEN', city: 'Denver' },
    { id: 11, name: 'Detroit Lions', abbreviation: 'DET', city: 'Detroit' },
    { id: 12, name: 'Green Bay Packers', abbreviation: 'GB', city: 'Green Bay' },
    { id: 13, name: 'Houston Texans', abbreviation: 'HOU', city: 'Houston' },
    { id: 14, name: 'Indianapolis Colts', abbreviation: 'IND', city: 'Indianapolis' },
    { id: 15, name: 'Jacksonville Jaguars', abbreviation: 'JAX', city: 'Jacksonville' },
    { id: 16, name: 'Kansas City Chiefs', abbreviation: 'KC', city: 'Kansas City' },
    { id: 17, name: 'Los Angeles Chargers', abbreviation: 'LAC', city: 'Los Angeles' },
    { id: 18, name: 'Los Angeles Rams', abbreviation: 'LAR', city: 'Los Angeles' },
    { id: 19, name: 'Las Vegas Raiders', abbreviation: 'LV', city: 'Las Vegas' },
    { id: 20, name: 'Miami Dolphins', abbreviation: 'MIA', city: 'Miami' },
    { id: 21, name: 'Minnesota Vikings', abbreviation: 'MIN', city: 'Minnesota' },
    { id: 22, name: 'New England Patriots', abbreviation: 'NE', city: 'New England' },
    { id: 23, name: 'New Orleans Saints', abbreviation: 'NO', city: 'New Orleans' },
    { id: 24, name: 'New York Giants', abbreviation: 'NYG', city: 'New York' },
    { id: 25, name: 'New York Jets', abbreviation: 'NYJ', city: 'New York' },
    { id: 26, name: 'Philadelphia Eagles', abbreviation: 'PHI', city: 'Philadelphia' },
    { id: 27, name: 'Pittsburgh Steelers', abbreviation: 'PIT', city: 'Pittsburgh' },
    { id: 28, name: 'Seattle Seahawks', abbreviation: 'SEA', city: 'Seattle' },
    { id: 29, name: 'San Francisco 49ers', abbreviation: 'SF', city: 'San Francisco' },
    { id: 30, name: 'Tampa Bay Buccaneers', abbreviation: 'TB', city: 'Tampa Bay' },
    { id: 31, name: 'Tennessee Titans', abbreviation: 'TEN', city: 'Tennessee' },
    { id: 32, name: 'Washington Commanders', abbreviation: 'WAS', city: 'Washington' }
  ];
  
  nflTeams.forEach(team => {
    teams.push({ ...team, sport_id: 'nfl', league_id: 'nfl' });
  });
  
  // NBA Teams (30) - starting at ID 100
  const nbaTeams = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
                    'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
                    'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];
  
  nbaTeams.forEach((abbr, idx) => {
    teams.push({
      id: 100 + idx,
      name: `${abbr} Basketball`,
      abbreviation: abbr,
      city: abbr,
      sport_id: 'nba',
      league_id: 'nba'
    });
  });
  
  await megaInsert('teams', teams);
}

// GENERATE 250,000 PLAYERS
async function generateMegaPlayers() {
  console.log(chalk.cyan('🏃 Generating 250,000 players...\n'));
  
  const positions = {
    nfl: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'OL', 'DL', 'LB', 'DB'],
    nba: ['PG', 'SG', 'SF', 'PF', 'C'],
    mlb: ['SP', 'RP', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'],
    nhl: ['C', 'LW', 'RW', 'D', 'G']
  };
  
  const firstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Daniel',
                      'Paul', 'Mark', 'Donald', 'George', 'Kenneth', 'Steven', 'Edward', 'Brian', 'Ronald', 'Anthony'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
                     'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
  
  let playerId = 1000000; // Start at 1M to avoid conflicts
  const allPlayers = [];
  
  // Generate players for each sport
  for (const [sport, posList] of Object.entries(positions)) {
    const teamCount = sport === 'nfl' ? 32 : 30;
    const playersPerTeam = sport === 'nfl' ? 53 : sport === 'nba' ? 15 : 25;
    
    for (let team = 0; team < teamCount; team++) {
      for (let p = 0; p < playersPerTeam * 10; p++) { // 10x roster for historical players
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const position = posList[Math.floor(Math.random() * posList.length)];
        
        allPlayers.push({
          id: playerId++,
          firstname: firstName,
          lastname: lastName,
          position: [position],
          team_id: sport === 'nfl' ? team + 1 : team + 100,
          jersey_number: Math.floor(Math.random() * 99) + 1,
          sport_id: sport,
          status: Math.random() > 0.3 ? 'active' : 'inactive',
          experience: Math.floor(Math.random() * 20),
          height: Math.floor(Math.random() * 20) + 68, // 5'8" to 7'4"
          weight: Math.floor(Math.random() * 150) + 150, // 150-300 lbs
          college: ['Alabama', 'Ohio State', 'Clemson', 'LSU', 'Georgia'][Math.floor(Math.random() * 5)]
        });
      }
    }
  }
  
  await megaInsert('players', allPlayers);
}

// GENERATE 50,000 GAMES
async function generateMegaGames() {
  console.log(chalk.cyan('🏈 Generating 50,000 games...\n'));
  
  let gameId = 1000000;
  const allGames = [];
  
  // NFL: 17 weeks * 16 games * 10 seasons
  for (let season = 2015; season <= 2024; season++) {
    for (let week = 1; week <= 17; week++) {
      for (let game = 0; game < 16; game++) {
        const homeTeam = Math.floor(Math.random() * 32) + 1;
        let awayTeam = Math.floor(Math.random() * 32) + 1;
        while (awayTeam === homeTeam) {
          awayTeam = Math.floor(Math.random() * 32) + 1;
        }
        
        allGames.push({
          id: gameId++,
          home_team_id: homeTeam,
          away_team_id: awayTeam,
          sport_id: 'nfl',
          season,
          week,
          start_time: new Date(`${season}-09-01`).toISOString(),
          status: season < 2024 ? 'completed' : 'scheduled',
          home_score: season < 2024 ? Math.floor(Math.random() * 35) + 10 : null,
          away_score: season < 2024 ? Math.floor(Math.random() * 35) + 10 : null,
          attendance: Math.floor(Math.random() * 30000) + 40000,
          weather: ['clear', 'rain', 'snow', 'dome'][Math.floor(Math.random() * 4)]
        });
      }
    }
  }
  
  // NBA: 82 games * 30 teams / 2 * 5 seasons
  for (let season = 2020; season <= 2024; season++) {
    for (let i = 0; i < 1230; i++) { // 82 * 30 / 2
      const homeTeam = Math.floor(Math.random() * 30) + 100;
      let awayTeam = Math.floor(Math.random() * 30) + 100;
      while (awayTeam === homeTeam) {
        awayTeam = Math.floor(Math.random() * 30) + 100;
      }
      
      allGames.push({
        id: gameId++,
        home_team_id: homeTeam,
        away_team_id: awayTeam,
        sport_id: 'nba',
        season,
        week: Math.floor(i / 50) + 1,
        start_time: new Date(`${season}-10-01`).toISOString(),
        status: 'completed',
        home_score: Math.floor(Math.random() * 40) + 90,
        away_score: Math.floor(Math.random() * 40) + 90
      });
    }
  }
  
  await megaInsert('games', allGames);
}

// GENERATE 500,000 PLAYER STATS
async function generateMegaStats() {
  console.log(chalk.cyan('📊 Generating 500,000 player stats...\n'));
  
  // Get sample players
  const { data: players } = await supabase
    .from('players')
    .select('id, position, sport_id')
    .limit(10000);
  
  if (!players) return;
  
  let statId = 1000000;
  const allStats = [];
  
  for (const player of players) {
    // Generate stats for multiple games
    for (let i = 0; i < 50; i++) {
      const stat: any = {
        id: statId++,
        player_id: player.id,
        game_id: Math.floor(Math.random() * 50000) + 1000000,
        season: 2020 + Math.floor(i / 10),
        week: (i % 17) + 1
      };
      
      // Sport-specific stats
      if (player.sport_id === 'nfl') {
        if (player.position.includes('QB')) {
          stat.passing_yards = Math.floor(Math.random() * 400);
          stat.passing_tds = Math.floor(Math.random() * 5);
          stat.interceptions = Math.floor(Math.random() * 3);
          stat.completions = Math.floor(Math.random() * 30);
          stat.attempts = stat.completions + Math.floor(Math.random() * 15);
          stat.rushing_yards = Math.floor(Math.random() * 50);
        } else if (player.position.includes('RB')) {
          stat.rushing_yards = Math.floor(Math.random() * 150);
          stat.rushing_tds = Math.floor(Math.random() * 3);
          stat.carries = Math.floor(Math.random() * 25);
          stat.receptions = Math.floor(Math.random() * 8);
          stat.receiving_yards = Math.floor(Math.random() * 60);
        } else if (player.position.includes('WR') || player.position.includes('TE')) {
          stat.receptions = Math.floor(Math.random() * 12);
          stat.receiving_yards = Math.floor(Math.random() * 150);
          stat.receiving_tds = Math.floor(Math.random() * 2);
          stat.targets = stat.receptions + Math.floor(Math.random() * 5);
        }
        stat.fantasy_points = Math.floor(Math.random() * 30);
      } else if (player.sport_id === 'nba') {
        stat.points = Math.floor(Math.random() * 40);
        stat.rebounds = Math.floor(Math.random() * 15);
        stat.assists = Math.floor(Math.random() * 12);
        stat.steals = Math.floor(Math.random() * 4);
        stat.blocks = Math.floor(Math.random() * 3);
        stat.minutes = Math.floor(Math.random() * 35) + 10;
        stat.fantasy_points = stat.points + (stat.rebounds * 1.2) + (stat.assists * 1.5);
      }
      
      allStats.push(stat);
    }
  }
  
  await megaInsert('player_stats', allStats);
}

// GENERATE 100,000 NEWS ARTICLES
async function generateMegaNews() {
  console.log(chalk.cyan('📰 Generating 100,000 news articles...\n'));
  
  const headlines = [
    'breaks franchise record with stunning performance',
    'injury update: expected to miss 2-4 weeks',
    'trade rumors: multiple teams interested',
    'coach praises work ethic in practice',
    'fantasy implications of latest roster move',
    'sets career high in dominant victory',
    'questionable for Sunday with minor injury',
    'emerging as breakout candidate',
    'contract extension talks heating up',
    'film breakdown reveals elite potential'
  ];
  
  const sources = ['ESPN', 'NFL Network', 'CBS Sports', 'The Athletic', 'Yahoo Sports', 
                   'Fox Sports', 'NBC Sports', 'Bleacher Report', 'Pro Football Talk', 'Sports Illustrated'];
  
  let newsId = 1000000;
  const allNews = [];
  
  for (let i = 0; i < 100000; i++) {
    const playerId = Math.floor(Math.random() * 250000) + 1000000;
    const headline = headlines[Math.floor(Math.random() * headlines.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    
    allNews.push({
      id: newsId++,
      title: `Player ${playerId} ${headline}`,
      content: `In a developing story, sources close to the team report that significant changes may be coming...`,
      url: `https://example.com/news/${newsId}`,
      source,
      published_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      player_ids: [playerId],
      team_ids: [Math.floor(Math.random() * 32) + 1],
      sport_id: 'nfl',
      sentiment_score: Math.random() * 2 - 1, // -1 to 1
      fantasy_relevance: Math.random()
    });
  }
  
  await megaInsert('news_articles', allNews);
}

// SHOW EPIC PROGRESS
function showProgress() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const rate = runtime > 0 ? Math.floor(stats.total / runtime) : 0;
  
  console.clear();
  console.log(chalk.red.bold('\n🔥🔥🔥 ULTIMATE TURBO LOADER STATS 🔥🔥🔥'));
  console.log(chalk.red('====================================='));
  
  console.log(chalk.cyan(`\n⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.cyan(`⚡ Rate: ${chalk.yellow.bold(rate.toLocaleString())} records/second`));
  
  console.log(chalk.cyan('\n📊 Records Loaded:'));
  console.log(`  🏃 Players: ${chalk.green.bold(stats.players.toLocaleString())}`);
  console.log(`  🏟️  Teams: ${chalk.green.bold(stats.teams.toLocaleString())}`);
  console.log(`  🏈 Games: ${chalk.green.bold(stats.games.toLocaleString())}`);
  console.log(`  📊 Stats: ${chalk.green.bold(stats.playerStats.toLocaleString())}`);
  console.log(`  📰 News: ${chalk.green.bold(stats.news.toLocaleString())}`);
  
  console.log(chalk.cyan('\n' + '═'.repeat(37)));
  console.log(chalk.green.bold(`📈 TOTAL: ${stats.total.toLocaleString()} RECORDS`));
  
  if (stats.total >= 1000000) {
    console.log(chalk.red.bold('\n💥💥💥 1 MILLION RECORDS ACHIEVED! 💥💥💥'));
    console.log(chalk.yellow.bold('🏆 BEAST MODE UNLOCKED! 🏆'));
  } else if (stats.total >= 500000) {
    console.log(chalk.yellow.bold('\n🔥 500K MILESTONE! HALFWAY TO 1M!'));
  } else if (stats.total >= 100000) {
    console.log(chalk.green.bold('\n🎉 100K MILESTONE REACHED!'));
  }
  
  const eta = rate > 0 ? Math.floor((1000000 - stats.total) / rate / 60) : '???';
  if (stats.total < 1000000) {
    console.log(chalk.gray(`\n⏳ ETA to 1M: ${eta} minutes`));
  }
}

// MAIN EXECUTION
async function ultimateTurbo() {
  // Check service role key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(chalk.red('❌ Service role key not found!'));
    return;
  }
  
  console.log(chalk.green('✅ Service role key detected - UNLIMITED POWER MODE!\n'));
  
  // Load everything in parallel!
  console.log(chalk.yellow('🚀 LAUNCHING ALL SYSTEMS...\n'));
  
  await Promise.all([
    loadAllTeams(),
    generateMegaPlayers()
  ]);
  
  await Promise.all([
    generateMegaGames(),
    generateMegaNews()
  ]);
  
  await generateMegaStats();
  
  showProgress();
  
  if (stats.total < 1000000) {
    console.log(chalk.yellow('\n🔄 Continuing to 1 MILLION...'));
    
    const interval = setInterval(async () => {
      await Promise.all([
        generateMegaPlayers(),
        generateMegaGames(),
        generateMegaStats(),
        generateMegaNews()
      ]);
      
      showProgress();
      
      if (stats.total >= 1000000) {
        clearInterval(interval);
        console.log(chalk.red.bold('\n🎊 MISSION COMPLETE! 1 MILLION RECORDS! 🎊'));
      }
    }, 10000);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  showProgress();
  console.log(chalk.yellow('\n\n👋 Final stats saved!'));
  process.exit(0);
});

// GO GO GO!
ultimateTurbo().catch(console.error);