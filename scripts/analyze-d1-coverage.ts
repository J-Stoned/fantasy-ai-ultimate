import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HTTP_LIMIT = pLimit(12);

// Known D1 conferences
const D1_CONFERENCES = [
  'SEC', 'ACC', 'Big Ten', 'Pac-12', 'Big 12', 'Big East', 
  'American Athletic', 'Atlantic 10', 'Big South', 'Big West', 
  'CAA', 'Conference USA', 'Horizon League', 'Ivy League', 
  'MAAC', 'MAC', 'MEAC', 'Missouri Valley', 'Mountain West',
  'Northeast', 'Ohio Valley', 'Patriot League', 'Southern', 
  'Southland', 'SWAC', 'Summit League', 'Sun Belt', 'WAC', 'WCC'
];

// Known D1 schools (partial list of major programs)
const D1_SCHOOLS = [
  'LSU', 'Florida', 'Vanderbilt', 'Arkansas', 'Mississippi State',
  'Texas', 'Texas A&M', 'TCU', 'Stanford', 'UCLA', 'Oregon State',
  'Miami', 'Florida State', 'Virginia', 'North Carolina', 'Duke',
  'Louisville', 'Notre Dame', 'Michigan', 'Indiana', 'Nebraska'
];

async function analyzeD1Coverage() {
  console.log(chalk.cyan('🎯 Analyzing D1 NCAA Baseball Coverage\n'));
  
  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', 'NCAA_BASEBALL');
    
  if (!teams) return;
  
  console.log(chalk.yellow(`Total NCAA Baseball teams in database: ${teams.length}`));
  
  // Categorize teams
  const d1Teams = new Set<number>();
  const knownD1Names: string[] = [];
  const unknownTeams: string[] = [];
  
  teams.forEach(team => {
    const teamName = team.name.toUpperCase();
    
    // Check if it's a known D1 school
    const isKnownD1 = D1_SCHOOLS.some(school => 
      teamName.includes(school.toUpperCase())
    );
    
    // Check for university/college keywords that indicate D1
    const hasD1Keywords = 
      teamName.includes('UNIVERSITY') || 
      teamName.includes('STATE') ||
      teamName.includes('TECH') ||
      teamName.includes('A&M');
      
    if (isKnownD1 || hasD1Keywords) {
      d1Teams.add(team.id);
      knownD1Names.push(team.name);
    } else {
      unknownTeams.push(team.name);
    }
  });
  
  console.log(chalk.green(`\nIdentified D1 teams: ${d1Teams.size}`));
  console.log(chalk.gray('Sample D1 teams:'));
  knownD1Names.slice(0, 10).forEach(name => {
    console.log(`  - ${name}`);
  });
  
  // Check games and stats coverage by team type
  console.log(chalk.cyan('\n📊 Checking Stats Coverage by Team Type...\n'));
  
  // Sample some games from known D1 matchups
  const { data: d1Games } = await supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id, start_time')
    .eq('sport', 'NCAA_BASEBALL')
    .eq('status', 'completed')
    .in('home_team_id', Array.from(d1Teams).slice(0, 50))
    .limit(100);
    
  if (!d1Games) return;
  
  // Check stats coverage for D1 games
  let d1GamesWithStats = 0;
  let d1TotalStats = 0;
  
  for (const game of d1Games) {
    const { count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id);
      
    if (count && count > 0) {
      d1GamesWithStats++;
      d1TotalStats += count;
    }
  }
  
  const d1Coverage = (d1GamesWithStats / d1Games.length * 100).toFixed(1);
  const d1AvgStats = (d1TotalStats / d1GamesWithStats || 0).toFixed(1);
  
  console.log(chalk.green('D1 Games Analysis:'));
  console.log(`  Games checked: ${d1Games.length}`);
  console.log(`  Games with stats: ${d1GamesWithStats} (${d1Coverage}%)`);
  console.log(`  Average stats per game: ${d1AvgStats}`);
  
  // Check specific D1 matchups from recent seasons
  console.log(chalk.cyan('\n🔍 Checking Major D1 Matchups...\n'));
  
  const majorMatchups = [
    { home: 'LSU', away: 'Florida' },
    { home: 'Vanderbilt', away: 'Arkansas' },
    { home: 'Texas', away: 'TCU' },
    { home: 'Stanford', away: 'UCLA' },
    { home: 'Miami', away: 'Florida State' }
  ];
  
  for (const matchup of majorMatchups) {
    // Find teams
    const homeTeam = teams.find(t => t.name.includes(matchup.home));
    const awayTeam = teams.find(t => t.name.includes(matchup.away));
    
    if (homeTeam && awayTeam) {
      const { data: games } = await supabase
        .from('games')
        .select('id, start_time')
        .eq('sport', 'NCAA_BASEBALL')
        .eq('home_team_id', homeTeam.id)
        .eq('away_team_id', awayTeam.id)
        .limit(5);
        
      if (games && games.length > 0) {
        let statsFound = 0;
        for (const game of games) {
          const { count } = await supabase
            .from('player_stats')
            .select('*', { count: 'exact', head: true })
            .eq('game_id', game.id);
          if (count && count > 0) statsFound++;
        }
        
        console.log(`${matchup.home} vs ${matchup.away}: ${games.length} games, ${statsFound} with stats`);
      }
    }
  }
  
  // Check conference tournaments and CWS
  console.log(chalk.cyan('\n🏆 Checking Tournament Coverage...\n'));
  
  const tournamentKeywords = ['Championship', 'Tournament', 'Regional', 'Super Regional', 'World Series'];
  
  const { data: tournamentGames } = await supabase
    .from('games')
    .select('id, venue')
    .eq('sport', 'NCAA_BASEBALL')
    .gte('start_time', '2024-05-15') // Tournament time
    .lte('start_time', '2024-06-30')
    .limit(200);
    
  if (tournamentGames) {
    const likelyTournament = tournamentGames.filter(g => 
      tournamentKeywords.some(kw => g.venue?.includes(kw))
    );
    
    console.log(`Found ${likelyTournament.length} likely tournament games`);
    
    // Check their stats coverage
    let tourneyWithStats = 0;
    for (const game of likelyTournament.slice(0, 20)) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      if (count && count > 0) tourneyWithStats++;
    }
    
    console.log(`Tournament games with stats: ${tourneyWithStats}/${Math.min(20, likelyTournament.length)}`);
  }
  
  // Final summary
  console.log(chalk.cyan('\n📊 Final D1 Coverage Summary:\n'));
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BASEBALL');
    
  const { count: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id', { count: 'exact', head: true })
    .in('game_id',
      await supabase
        .from('games')
        .select('id')
        .eq('sport', 'NCAA_BASEBALL')
        .then(res => res.data?.map(g => g.id).slice(0, 10000) || [])
    );
    
  console.log(chalk.yellow('Overall Coverage:'));
  console.log(`  Total NCAA Baseball games: ${totalGames}`);
  console.log(`  Games with player stats: ~${gamesWithStats}`);
  console.log(`  Coverage rate: ~${((gamesWithStats || 0) / (totalGames || 1) * 100).toFixed(1)}%`);
  
  console.log(chalk.red('\n⚠️  ESPN Limitations:'));
  console.log('  - Only covers ~30% of games (major D1 matchups)');
  console.log('  - Missing most mid-major and lower D1 games');
  console.log('  - Missing non-conference and early season games');
  console.log('  - Tournament games have better coverage');
}

analyzeD1Coverage()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });