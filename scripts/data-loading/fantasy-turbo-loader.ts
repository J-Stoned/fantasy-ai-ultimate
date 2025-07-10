#!/usr/bin/env tsx
/**
 * 🔥 FANTASY TURBO LOADER - Loads data with all the new fantasy columns!
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

console.log(chalk.red.bold('\n🔥 FANTASY TURBO LOADER - FANTASY FOCUSED! 🔥'));
console.log(chalk.red('==========================================\n'));

const stats = {
  players: 0,
  games: 0,
  stats: 0,
  projections: 0,
  rankings: 0,
  news: 0,
  total: 0,
  startTime: Date.now()
};

const limit = pLimit(10);

// MEGA INSERT HELPER
async function megaInsert(table: string, data: any[], batchSize = 500): Promise<number> {
  if (!data.length) return 0;
  
  let inserted = 0;
  const batches = [];
  
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  
  console.log(chalk.yellow(`📤 Inserting ${data.length} records into ${table}...`));
  
  const results = await Promise.all(
    batches.map((batch, idx) => 
      limit(async () => {
        const { data: result, error } = await supabase
          .from(table)
          .upsert(batch, { onConflict: 'id' })
          .select();
        
        if (error) {
          console.log(chalk.red(`❌ Error: ${error.message}`));
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
  
  console.log(chalk.green(` Done! Inserted ${inserted}\n`));
  return inserted;
}

// GENERATE FANTASY-FOCUSED PLAYERS
async function generateFantasyPlayers() {
  console.log(chalk.cyan('🏃 Generating 50,000 fantasy-relevant players...\n'));
  
  // NFL positions with fantasy relevance
  const positions = {
    QB: { min: 1, max: 3, adpStart: 1, adpRange: 200 },
    RB: { min: 4, max: 8, adpStart: 1, adpRange: 300 },
    WR: { min: 9, max: 15, adpStart: 2, adpRange: 400 },
    TE: { min: 16, max: 20, adpStart: 5, adpRange: 250 },
    K: { min: 21, max: 22, adpStart: 150, adpRange: 100 },
    DEF: { min: 23, max: 24, adpStart: 120, adpRange: 100 }
  };
  
  const firstNames = ['Josh', 'Justin', 'Patrick', 'Lamar', 'Joe', 'Dak', 'Trevor', 'Tua', 'Jalen', 'Kirk',
                      'Christian', 'Jonathan', 'Saquon', 'Austin', 'Nick', 'Tony', 'Derrick', 'Dalvin', 'Alvin', 'Aaron',
                      'Justin', 'Ja\'Marr', 'Tyreek', 'Stefon', 'CeeDee', 'A.J.', 'Mike', 'Chris', 'DeAndre', 'Amari',
                      'Travis', 'Mark', 'George', 'Darren', 'Kyle', 'T.J.', 'Dallas', 'Evan', 'Cole', 'Zach'];
  
  const lastNames = ['Allen', 'Herbert', 'Mahomes', 'Jackson', 'Burrow', 'Prescott', 'Lawrence', 'Tagovailoa', 'Hurts', 'Cousins',
                     'McCaffrey', 'Taylor', 'Barkley', 'Ekeler', 'Chubb', 'Pollard', 'Henry', 'Cook', 'Kamara', 'Jones',
                     'Jefferson', 'Chase', 'Hill', 'Diggs', 'Lamb', 'Brown', 'Evans', 'Olave', 'Hopkins', 'Cooper',
                     'Kelce', 'Andrews', 'Kittle', 'Waller', 'Pitts', 'Hockenson', 'Goedert', 'Engram', 'Kmet', 'Ertz'];
  
  let playerId = 2000000; // Start at 2M
  const allPlayers = [];
  
  // Generate players for each NFL team
  for (let teamId = 1; teamId <= 32; teamId++) {
    // Starters and backups for each position
    Object.entries(positions).forEach(([pos, config]) => {
      const rostersSize = pos === 'QB' ? 3 : pos === 'RB' ? 5 : pos === 'WR' ? 7 : pos === 'TE' ? 3 : 2;
      
      for (let depth = 0; depth < rostersSize; depth++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const uniqueId = `${teamId}${depth}${Date.now()}`;
        
        // Calculate ADP based on position and depth
        const baseAdp = config.adpStart + (depth * 20) + (Math.random() * config.adpRange);
        const adp = Math.min(baseAdp, 500);
        
        // Calculate fantasy ownership based on ADP
        const ownership = Math.max(0, 100 - (adp * 0.5) + (Math.random() * 20 - 10));
        
        allPlayers.push({
          id: playerId++,
          firstname: firstName,
          lastname: `${lastName}${uniqueId}`,
          position: [pos],
          team_id: teamId,
          jersey_number: config.min + depth,
          sport_id: 'nfl',
          status: depth < 2 ? 'active' : 'reserve',
          experience: Math.floor(Math.random() * 10) + 1,
          
          // Fantasy specific columns
          fantasy_points_2023: Math.max(0, 300 - adp + (Math.random() * 100)),
          fantasy_points_2024: Math.max(0, (300 - adp) * 0.4 + (Math.random() * 50)),
          adp: adp,
          fantasy_ownership: ownership,
          bye_week: [5, 6, 7, 9, 10, 11, 12, 13, 14][Math.floor(Math.random() * 9)],
          injury_status: Math.random() > 0.8 ? ['Questionable', 'Doubtful', 'Out'][Math.floor(Math.random() * 3)] : null,
          projected_points_week: Math.max(0, 25 - (depth * 5) + (Math.random() * 10)),
          salary_dk: Math.max(3000, 10000 - (adp * 15)),
          salary_fd: Math.max(4000, 9500 - (adp * 14)),
          consistency_rating: Math.random() * 0.5 + 0.5,
          upside_rating: Math.random() * 0.5 + 0.5,
          floor_projection: Math.max(0, 15 - (depth * 3)),
          ceiling_projection: Math.max(10, 35 - (depth * 5))
        });
      }
    });
  }
  
  await megaInsert('players', allPlayers);
}

// GENERATE GAMES WITH FANTASY CONTEXT
async function generateFantasyGames() {
  console.log(chalk.cyan('🏈 Generating games with betting/fantasy data...\n'));
  
  let gameId = 2000000;
  const games = [];
  
  // 2024 NFL Season
  for (let week = 1; week <= 18; week++) {
    // Thursday night game
    games.push(createGame(gameId++, week, 'thursday', true));
    
    // Sunday games (13 games)
    for (let i = 0; i < 13; i++) {
      games.push(createGame(gameId++, week, 'sunday', i < 3)); // First 3 are early window
    }
    
    // Sunday night game
    games.push(createGame(gameId++, week, 'sunday_night', true));
    
    // Monday night game
    games.push(createGame(gameId++, week, 'monday', true));
  }
  
  function createGame(id: number, week: number, slot: string, primetime: boolean) {
    const homeTeam = Math.floor(Math.random() * 32) + 1;
    let awayTeam = Math.floor(Math.random() * 32) + 1;
    while (awayTeam === homeTeam) {
      awayTeam = Math.floor(Math.random() * 32) + 1;
    }
    
    const total = 38 + Math.random() * 20; // 38-58 point totals
    const spread = (Math.random() * 14) - 7; // -7 to +7 spread
    
    return {
      id,
      home_team_id: homeTeam,
      away_team_id: awayTeam,
      sport_id: 'nfl',
      season: 2024,
      week,
      start_time: new Date(`2024-09-${5 + week * 7}`).toISOString(),
      status: week < 10 ? 'completed' : 'scheduled',
      home_score: week < 10 ? Math.floor(total/2 + spread/2 + Math.random() * 7) : null,
      away_score: week < 10 ? Math.floor(total/2 - spread/2 + Math.random() * 7) : null,
      weather_conditions: ['dome', 'clear', 'rain', 'wind', 'snow'][Math.floor(Math.random() * 5)],
      betting_total: total,
      betting_line: spread,
      primetime,
      division_game: Math.random() > 0.7,
      pace_factor: 0.9 + Math.random() * 0.2
    };
  }
  
  await megaInsert('games', games);
}

// GENERATE PLAYER STATS WITH FANTASY POINTS
async function generateFantasyStats() {
  console.log(chalk.cyan('📊 Generating player stats with fantasy points...\n'));
  
  // Get sample players
  const { data: players } = await supabase
    .from('players')
    .select('id, position, team_id')
    .gte('id', 2000000)
    .limit(5000);
  
  if (!players) return;
  
  let statId = 2000000;
  const allStats = [];
  
  // Generate stats for weeks 1-9 (completed games)
  for (const player of players) {
    for (let week = 1; week <= 9; week++) {
      const stat = generateStatLine(statId++, player, week);
      if (stat) allStats.push(stat);
    }
  }
  
  function generateStatLine(id: number, player: any, week: number) {
    const pos = player.position[0];
    const stat: any = {
      id,
      player_id: player.id,
      game_id: 2000000 + (week * 16) + Math.floor(Math.random() * 16),
      season: 2024,
      week
    };
    
    // Position-specific stats
    switch(pos) {
      case 'QB':
        stat.passing_attempts = 25 + Math.floor(Math.random() * 20);
        stat.completions = Math.floor(stat.passing_attempts * (0.55 + Math.random() * 0.15));
        stat.passing_yards = 180 + Math.floor(Math.random() * 200);
        stat.passing_tds = Math.floor(Math.random() * 4);
        stat.interceptions = Math.floor(Math.random() * 2);
        stat.rushing_attempts = Math.floor(Math.random() * 8);
        stat.rushing_yards = Math.floor(Math.random() * 40);
        stat.rushing_tds = Math.random() > 0.8 ? 1 : 0;
        break;
        
      case 'RB':
        stat.rushing_attempts = 8 + Math.floor(Math.random() * 20);
        stat.rushing_yards = stat.rushing_attempts * (3 + Math.random() * 3);
        stat.rushing_tds = Math.floor(Math.random() * 2);
        stat.targets = Math.floor(Math.random() * 8);
        stat.receptions = Math.floor(stat.targets * 0.75);
        stat.receiving_yards = stat.receptions * (6 + Math.random() * 8);
        stat.receiving_tds = Math.random() > 0.85 ? 1 : 0;
        break;
        
      case 'WR':
        stat.targets = 4 + Math.floor(Math.random() * 10);
        stat.receptions = Math.floor(stat.targets * (0.5 + Math.random() * 0.3));
        stat.receiving_yards = stat.receptions * (8 + Math.random() * 12);
        stat.receiving_tds = Math.random() > 0.7 ? Math.floor(Math.random() * 2) : 0;
        stat.rushing_attempts = Math.random() > 0.9 ? 1 : 0;
        stat.rushing_yards = stat.rushing_attempts * (5 + Math.random() * 10);
        break;
        
      case 'TE':
        stat.targets = 3 + Math.floor(Math.random() * 8);
        stat.receptions = Math.floor(stat.targets * (0.6 + Math.random() * 0.2));
        stat.receiving_yards = stat.receptions * (7 + Math.random() * 10);
        stat.receiving_tds = Math.random() > 0.8 ? 1 : 0;
        break;
        
      default:
        return null;
    }
    
    // Snap data
    stat.snap_count = 30 + Math.floor(Math.random() * 40);
    stat.snap_percentage = stat.snap_count / 70 * 100;
    stat.red_zone_touches = Math.floor(Math.random() * 5);
    stat.red_zone_targets = Math.floor(Math.random() * 3);
    
    // Fantasy points calculated by trigger
    return stat;
  }
  
  await megaInsert('player_stats', allStats);
}

// GENERATE FANTASY PROJECTIONS
async function generateProjections() {
  console.log(chalk.cyan('🔮 Generating fantasy projections...\n'));
  
  const { data: players } = await supabase
    .from('players')
    .select('id, position, adp')
    .gte('id', 2000000)
    .limit(1000);
  
  if (!players) return;
  
  let projId = 1;
  const projections = [];
  
  // Generate projections for weeks 10-18
  for (const player of players) {
    for (let week = 10; week <= 18; week++) {
      const baseProjection = Math.max(0, 25 - (player.adp * 0.05) + (Math.random() * 10 - 5));
      const floor = baseProjection * 0.7;
      const ceiling = baseProjection * 1.4;
      
      projections.push({
        id: projId++,
        player_id: player.id,
        season: 2024,
        week,
        projection_source: 'system',
        projected_points: baseProjection,
        floor,
        ceiling,
        confidence_score: 0.5 + Math.random() * 0.3
      });
    }
  }
  
  await megaInsert('fantasy_projections', projections);
}

// GENERATE RANKINGS
async function generateRankings() {
  console.log(chalk.cyan('📈 Generating player rankings...\n'));
  
  const { data: players } = await supabase
    .from('players')
    .select('id, position, adp')
    .gte('id', 2000000)
    .order('adp')
    .limit(500);
  
  if (!players) return;
  
  let rankId = 1;
  const rankings = [];
  
  // Current week rankings
  const week = 10;
  let overallRank = 1;
  const positionRanks: any = {};
  
  for (const player of players) {
    const pos = player.position[0];
    positionRanks[pos] = (positionRanks[pos] || 0) + 1;
    
    rankings.push({
      id: rankId++,
      player_id: player.id,
      season: 2024,
      week,
      ranking_type: 'overall',
      rank: overallRank++,
      position_rank: positionRanks[pos],
      tier: Math.ceil(positionRanks[pos] / 6),
      expert_consensus_rank: overallRank + (Math.random() * 10 - 5),
      std_deviation: Math.random() * 5 + 2,
      rising: Math.random() > 0.7
    });
  }
  
  await megaInsert('player_rankings', rankings);
}

// GENERATE FANTASY NEWS
async function generateFantasyNews() {
  console.log(chalk.cyan('📰 Generating fantasy-relevant news...\n'));
  
  let newsId = 2000000;
  const news = [];
  
  const templates = [
    { title: '{player} limited in practice with {injury}', injury: true, relevance: 0.9 },
    { title: '{player} expected to see increased workload', injury: false, relevance: 0.8 },
    { title: 'Coach confirms {player} will start in Week {week}', injury: false, relevance: 0.7 },
    { title: '{player} questionable for Sunday', injury: true, relevance: 0.95 },
    { title: 'Beat reporter: {player} looking explosive in practice', injury: false, relevance: 0.6 },
    { title: '{team} considering workload split at {position}', injury: false, relevance: 0.7 },
    { title: '{player} officially ruled out for Week {week}', injury: true, relevance: 1.0 },
    { title: 'Fantasy alert: Start {player} with confidence', injury: false, relevance: 0.8 },
    { title: '{player} trending toward playing despite injury', injury: true, relevance: 0.85 },
    { title: 'DFS GPP play: {player} at low ownership', injury: false, relevance: 0.7 }
  ];
  
  const injuries = ['hamstring', 'ankle', 'shoulder', 'knee', 'back', 'illness'];
  const positions = ['RB', 'WR', 'TE', 'QB'];
  
  // Generate 1000 news articles
  for (let i = 0; i < 1000; i++) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    const playerId = 2000000 + Math.floor(Math.random() * 5000);
    const teamId = Math.floor(Math.random() * 32) + 1;
    const week = Math.floor(Math.random() * 9) + 10;
    
    let title = template.title
      .replace('{player}', `Player${playerId}`)
      .replace('{injury}', injuries[Math.floor(Math.random() * injuries.length)])
      .replace('{week}', week.toString())
      .replace('{team}', `Team${teamId}`)
      .replace('{position}', positions[Math.floor(Math.random() * positions.length)]);
    
    news.push({
      id: newsId++,
      title,
      content: `${title}. Fantasy managers should monitor this situation closely...`,
      url: `https://fantasynews.com/article/${newsId}`,
      source: ['ESPN Fantasy', 'Yahoo Sports', 'CBS Sports', 'The Athletic', 'Rotoworld'][Math.floor(Math.random() * 5)],
      published_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      fantasy_relevance: template.relevance,
      player_ids: [playerId],
      team_ids: [teamId],
      injury_report: template.injury,
      lineup_news: !template.injury,
      beat_writer: Math.random() > 0.7,
      verified_source: Math.random() > 0.5
    });
  }
  
  await megaInsert('news_articles', news);
}

// SHOW PROGRESS
function showProgress() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const rate = runtime > 0 ? Math.floor(stats.total / runtime) : 0;
  
  console.clear();
  console.log(chalk.red.bold('\n🔥 FANTASY TURBO LOADER PROGRESS 🔥'));
  console.log(chalk.red('==================================='));
  
  console.log(chalk.cyan(`\n⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.cyan(`⚡ Rate: ${chalk.yellow.bold(rate.toLocaleString())} records/second`));
  
  console.log(chalk.cyan('\n📊 Fantasy Data Loaded:'));
  Object.entries(stats).forEach(([key, value]) => {
    if (key !== 'total' && key !== 'startTime' && value > 0) {
      console.log(`  ${key}: ${chalk.green.bold(value.toLocaleString())}`);
    }
  });
  
  console.log(chalk.cyan('\n' + '═'.repeat(35)));
  console.log(chalk.green.bold(`📈 TOTAL: ${stats.total.toLocaleString()} RECORDS`));
  
  if (stats.total >= 1000000) {
    console.log(chalk.red.bold('\n💥 1 MILLION FANTASY RECORDS! 💥'));
    console.log(chalk.yellow.bold('🏆 FANTASY DATABASE COMPLETE! 🏆'));
  } else if (stats.total >= 500000) {
    console.log(chalk.yellow.bold('\n🔥 500K MILESTONE!'));
  } else if (stats.total >= 100000) {
    console.log(chalk.green.bold('\n✨ 100K MILESTONE!'));
  }
}

// MAIN EXECUTION
async function runFantasyTurbo() {
  console.log(chalk.green('✅ Using service role key for unlimited power!\n'));
  
  // First, ensure tables have new columns
  console.log(chalk.yellow('📋 Make sure you\'ve run add-fantasy-columns.sql in Supabase!\n'));
  console.log(chalk.gray('If not, run it now and press Ctrl+C to stop.\n'));
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Load all fantasy data
  await generateFantasyPlayers();
  await generateFantasyGames();
  await generateFantasyStats();
  await generateProjections();
  await generateRankings();
  await generateFantasyNews();
  
  showProgress();
  
  // Continue loading if under 1M
  if (stats.total < 1000000) {
    console.log(chalk.yellow('\n🔄 Continuing to 1 MILLION...'));
    
    const interval = setInterval(async () => {
      await Promise.all([
        generateFantasyPlayers(),
        generateFantasyStats(),
        generateProjections(),
        generateFantasyNews()
      ]);
      
      showProgress();
      
      if (stats.total >= 1000000) {
        clearInterval(interval);
        console.log(chalk.red.bold('\n🎊 1 MILLION FANTASY RECORDS ACHIEVED! 🎊'));
      }
    }, 30000);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  showProgress();
  console.log(chalk.yellow('\n\n👋 Fantasy data saved!'));
  process.exit(0);
});

// GO!
runFantasyTurbo().catch(console.error);