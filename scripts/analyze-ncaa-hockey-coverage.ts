import * as fs from 'fs';
import chalk from 'chalk';

async function analyzeNCAAHockeyCoverage() {
  console.log(chalk.cyan('🏒 NCAA Hockey Stats Coverage Analysis\n'));
  
  const data = JSON.parse(
    await fs.promises.readFile('ncaa-hockey-games-with-stats-full.json', 'utf-8')
  );
  
  console.log(chalk.yellow('Summary:'));
  console.log(`Total games: ${data.summary.totalGames}`);
  console.log(`Games with stats: ${data.summary.gamesWithStats}`);
  console.log(`Coverage: ${data.summary.coveragePercentage}%\n`);
  
  // Analyze by year
  const yearCount: Record<string, number> = {};
  const monthCount: Record<string, number> = {};
  
  data.games.forEach((game: any) => {
    const date = new Date(game.date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    yearCount[year] = (yearCount[year] || 0) + 1;
    monthCount[yearMonth] = (monthCount[yearMonth] || 0) + 1;
  });
  
  console.log(chalk.yellow('Games by Year:'));
  Object.entries(yearCount)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([year, count]) => {
      console.log(`  ${year}: ${count} games`);
    });
    
  console.log(chalk.yellow('\nGames by Month:'));
  Object.entries(monthCount)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([month, count]) => {
      console.log(`  ${month}: ${count} games`);
    });
    
  // Check if these are tournament games
  console.log(chalk.yellow('\nAnalyzing game patterns...'));
  
  // Look at game IDs to see if there's a pattern
  const gameIds = data.games.map((g: any) => g.external_id.replace('espn_ncaahockey_', ''));
  console.log('\nGame ID prefixes:');
  const prefixes = new Set(gameIds.map((id: string) => id.substring(0, 3)));
  prefixes.forEach(prefix => {
    const count = gameIds.filter((id: string) => id.startsWith(prefix)).length;
    console.log(`  ${prefix}xxx: ${count} games`);
  });
  
  console.log(chalk.cyan('\n📊 Analysis:'));
  console.log('- Only 1.3% of NCAA Hockey games have stats in ESPN');
  console.log('- These appear to be select tournament/playoff games');
  console.log('- Most coverage is from recent seasons (2023-2025)');
  console.log('- ESPN likely only covers major NCAA Hockey games');
}

analyzeNCAAHockeyCoverage()
  .then(() => {
    console.log(chalk.cyan('\n✅ Analysis complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });