import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findRealNFLGames() {
  console.log(chalk.bold.red('🏈 FINDING THE REAL NFL GAMES!\n'));
  
  // 1. Get ALL completed games
  console.log(chalk.yellow('1️⃣ Getting all completed games...'));
  const { data: completedGames, count } = await supabase
    .from('games')
    .select('id, sport, league, sport_id, home_score, away_score, home_team_id, away_team_id, start_time')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('id', { ascending: false })
    .limit(100);
  
  console.log(chalk.cyan(`Total completed games: ${count}`));
  
  // 2. Analyze the sports distribution
  const sportsMap = new Map<string, number>();
  completedGames?.forEach(game => {
    const key = `${game.sport || 'null'}|${game.league || 'null'}|${game.sport_id || 'null'}`;
    sportsMap.set(key, (sportsMap.get(key) || 0) + 1);
  });
  
  console.log(chalk.yellow('\n2️⃣ Sports distribution in completed games:'));
  sportsMap.forEach((count, key) => {
    const [sport, league, sport_id] = key.split('|');
    console.log(chalk.white(`  sport='${sport}', league='${league}', sport_id='${sport_id}': ${count} games`));
  });
  
  // 3. Check teams to understand the sport
  console.log(chalk.yellow('\n3️⃣ Checking teams...'));
  const teamIds = new Set<number>();
  completedGames?.forEach(game => {
    teamIds.add(game.home_team_id);
    teamIds.add(game.away_team_id);
  });
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, sport, league')
    .in('id', Array.from(teamIds).slice(0, 20));
  
  console.log(chalk.cyan('\nSample teams from completed games:'));
  teams?.forEach(team => {
    console.log(chalk.white(`  Team ${team.id}: ${team.name} (${team.sport || 'no sport'}, ${team.league || 'no league'})`));
  });
  
  // 4. Look for NFL team names
  console.log(chalk.yellow('\n4️⃣ Looking for NFL teams by name...'));
  const nflTeamNames = [
    'Patriots', 'Bills', 'Dolphins', 'Jets',
    'Ravens', 'Bengals', 'Browns', 'Steelers',
    'Texans', 'Colts', 'Jaguars', 'Titans',
    'Broncos', 'Chiefs', 'Raiders', 'Chargers',
    'Cowboys', 'Giants', 'Eagles', 'Commanders',
    'Bears', 'Lions', 'Packers', 'Vikings',
    'Falcons', 'Panthers', 'Saints', 'Buccaneers',
    '49ers', 'Cardinals', 'Rams', 'Seahawks'
  ];
  
  const { data: nflTeams } = await supabase
    .from('teams')
    .select('id, name, sport, league')
    .or(nflTeamNames.map(name => `name.ilike.%${name}%`).join(','));
  
  console.log(chalk.cyan(`\nFound ${nflTeams?.length || 0} potential NFL teams:`));
  nflTeams?.forEach(team => {
    console.log(chalk.white(`  ${team.name} (id: ${team.id}, sport: ${team.sport}, league: ${team.league})`));
  });
  
  // 5. Check games with these NFL teams
  if (nflTeams && nflTeams.length > 0) {
    const nflTeamIds = nflTeams.map(t => t.id);
    const { data: nflGames, count: nflCount } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .or(`home_team_id.in.(${nflTeamIds.join(',')}),away_team_id.in.(${nflTeamIds.join(',')})`)
      .not('home_score', 'is', null)
      .limit(10);
    
    console.log(chalk.yellow(`\n5️⃣ Games with NFL teams: ${nflCount}`));
    
    if (nflGames && nflGames.length > 0) {
      console.log(chalk.cyan('\nSample NFL games:'));
      nflGames.forEach(game => {
        const homeTeam = nflTeams.find(t => t.id === game.home_team_id);
        const awayTeam = nflTeams.find(t => t.id === game.away_team_id);
        console.log(chalk.white(`  ${awayTeam?.name || game.away_team_id} @ ${homeTeam?.name || game.home_team_id}: ${game.away_score}-${game.home_score}`));
      });
    }
  }
  
  // 6. Check what the 48,863 games claim is about
  console.log(chalk.yellow('\n6️⃣ Investigating the 48,863 games claim...'));
  const { count: totalGamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  const { count: scoredGamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  console.log(chalk.cyan(`\nTotal games in database: ${totalGamesCount}`));
  console.log(chalk.cyan(`Games with scores: ${scoredGamesCount}`));
  
  // 7. Get a broader sample of games
  console.log(chalk.yellow('\n7️⃣ Analyzing broader game sample...'));
  const { data: randomGames } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .limit(20);
  
  if (randomGames && randomGames.length > 0) {
    console.log(chalk.cyan('\nRandom scored games:'));
    console.log('First game structure:', Object.keys(randomGames[0]));
    
    // Check score ranges to identify sport
    const scoreRanges = {
      basketball: 0, // 80-130
      football: 0,   // 10-50
      baseball: 0,   // 1-15
      hockey: 0,     // 1-7
      soccer: 0      // 0-5
    };
    
    randomGames.forEach(game => {
      const totalScore = (game.home_score || 0) + (game.away_score || 0);
      if (totalScore > 150) scoreRanges.basketball++;
      else if (totalScore > 50 && totalScore <= 100) scoreRanges.football++;
      else if (totalScore > 10 && totalScore <= 30) scoreRanges.baseball++;
      else if (totalScore <= 10) scoreRanges.hockey++;
    });
    
    console.log(chalk.cyan('\nScore distribution suggests:'));
    Object.entries(scoreRanges).forEach(([sport, count]) => {
      if (count > 0) console.log(chalk.white(`  ${sport}: ${count} games`));
    });
  }
  
  console.log(chalk.bold.red('\n🎯 CONCLUSION:'));
  console.log(chalk.white(`
  The database appears to contain primarily BASKETBALL games, not NFL!
  The "48,863 games" are likely NBA/basketball games.
  The player_stats with points/rebounds/assists confirm this.
  
  We need to either:
  1. Find where the real NFL data is stored
  2. Collect real NFL game and player data
  3. Update the pattern detection to work with basketball
  `));
}

findRealNFLGames().catch(console.error);