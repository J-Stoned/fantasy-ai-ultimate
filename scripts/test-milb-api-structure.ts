import axios from 'axios';
import chalk from 'chalk';
import * as fs from 'fs';

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

// MiLB Sport IDs
const MILB_LEVELS = {
  'Triple-A': 11,
  'Double-A': 12,
  'High-A': 13,
  'Single-A': 14,
  'Rookie': 16
};

async function exploreMiLBAPI() {
  console.log(chalk.cyan('⚾ Exploring Minor League Baseball API Structure\n'));
  
  // 1. Test getting MiLB leagues
  console.log(chalk.yellow('1. Testing MiLB League Structure...'));
  try {
    const leaguesUrl = `${MLB_API_BASE}/sports`;
    const leaguesResponse = await axios.get(leaguesUrl);
    
    console.log(chalk.green('✅ Sports/Leagues endpoint works!'));
    
    // Filter for MiLB sports
    const milbSports = leaguesResponse.data.sports.filter((sport: any) => 
      Object.values(MILB_LEVELS).includes(sport.id)
    );
    
    console.log(`Found ${milbSports.length} MiLB levels:`);
    milbSports.forEach((sport: any) => {
      console.log(`  - ${sport.name} (ID: ${sport.id})`);
    });
    
    await fs.promises.writeFile(
      'milb-sports-structure.json',
      JSON.stringify(milbSports, null, 2)
    );
  } catch (error: any) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
  
  // 2. Test getting teams for Triple-A
  console.log(chalk.yellow('\n2. Testing Triple-A Teams...'));
  try {
    const teamsUrl = `${MLB_API_BASE}/teams?sportId=11&season=2024`;
    const teamsResponse = await axios.get(teamsUrl);
    
    console.log(chalk.green(`✅ Found ${teamsResponse.data.teams.length} Triple-A teams`));
    
    // Show first few teams
    const sampleTeams = teamsResponse.data.teams.slice(0, 3);
    console.log('\nSample team structure:');
    sampleTeams.forEach((team: any) => {
      console.log(`  ${team.name} (ID: ${team.id})`);
      console.log(`    - Location: ${team.locationName}`);
      console.log(`    - League: ${team.league?.name}`);
      console.log(`    - Parent Org: ${team.parentOrgName || 'N/A'}`);
    });
    
    await fs.promises.writeFile(
      'milb-teams-structure.json',
      JSON.stringify(teamsResponse.data.teams, null, 2)
    );
  } catch (error: any) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
  
  // 3. Test getting a roster
  console.log(chalk.yellow('\n3. Testing Team Roster...'));
  try {
    // Use Sacramento River Cats (AAA Athletics) as example
    const rosterUrl = `${MLB_API_BASE}/teams/552/roster?rosterType=active`;
    const rosterResponse = await axios.get(rosterUrl);
    
    console.log(chalk.green(`✅ Found ${rosterResponse.data.roster.length} players`));
    
    // Show sample player structure
    if (rosterResponse.data.roster.length > 0) {
      const samplePlayer = rosterResponse.data.roster[0];
      console.log('\nSample player structure:');
      console.log(`  ${samplePlayer.person.fullName} (#${samplePlayer.jerseyNumber})`);
      console.log(`  - ID: ${samplePlayer.person.id}`);
      console.log(`  - Position: ${samplePlayer.position.name}`);
      console.log(`  - Status: ${samplePlayer.status.description}`);
    }
    
    await fs.promises.writeFile(
      'milb-roster-structure.json',
      JSON.stringify(rosterResponse.data, null, 2)
    );
  } catch (error: any) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
  
  // 4. Test getting schedule/games
  console.log(chalk.yellow('\n4. Testing MiLB Schedule...'));
  try {
    const scheduleUrl = `${MLB_API_BASE}/schedule?sportId=11&startDate=2024-07-01&endDate=2024-07-07`;
    const scheduleResponse = await axios.get(scheduleUrl);
    
    const totalGames = scheduleResponse.data.dates.reduce((sum: number, date: any) => 
      sum + (date.games?.length || 0), 0
    );
    
    console.log(chalk.green(`✅ Found ${totalGames} games in date range`));
    
    // Show sample game
    if (scheduleResponse.data.dates[0]?.games?.[0]) {
      const sampleGame = scheduleResponse.data.dates[0].games[0];
      console.log('\nSample game structure:');
      console.log(`  ${sampleGame.teams.away.team.name} @ ${sampleGame.teams.home.team.name}`);
      console.log(`  - Game ID: ${sampleGame.gamePk}`);
      console.log(`  - Date: ${sampleGame.gameDate}`);
      console.log(`  - Status: ${sampleGame.status.detailedState}`);
    }
    
    await fs.promises.writeFile(
      'milb-schedule-structure.json',
      JSON.stringify(scheduleResponse.data, null, 2)
    );
  } catch (error: any) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
  
  // 5. Test getting game boxscore
  console.log(chalk.yellow('\n5. Testing Game Boxscore...'));
  try {
    // Use a specific game ID (you'd need a real one)
    const boxscoreUrl = `${MLB_API_BASE}/game/745895/boxscore`;
    const boxscoreResponse = await axios.get(boxscoreUrl);
    
    console.log(chalk.green('✅ Boxscore endpoint works!'));
    
    // Check structure
    const teams = boxscoreResponse.data.teams;
    console.log('\nBoxscore structure:');
    console.log(`  - Has team stats: ${!!teams}`);
    console.log(`  - Has players: ${!!(teams?.away?.players || teams?.home?.players)}`);
    
    await fs.promises.writeFile(
      'milb-boxscore-structure.json',
      JSON.stringify(boxscoreResponse.data, null, 2)
    );
  } catch (error: any) {
    console.log(chalk.red(`❌ Error fetching boxscore: ${error.message}`));
  }
  
  // 6. Test player stats endpoint
  console.log(chalk.yellow('\n6. Testing Player Stats...'));
  try {
    // Get stats for a specific player
    const statsUrl = `${MLB_API_BASE}/people/669257/stats?stats=season&season=2024&group=hitting`;
    const statsResponse = await axios.get(statsUrl);
    
    console.log(chalk.green('✅ Player stats endpoint works!'));
    
    if (statsResponse.data.stats?.[0]?.splits?.[0]) {
      const stats = statsResponse.data.stats[0].splits[0].stat;
      console.log('\nSample hitting stats:');
      console.log(`  - AVG: ${stats.avg}`);
      console.log(`  - HR: ${stats.homeRuns}`);
      console.log(`  - RBI: ${stats.rbi}`);
      console.log(`  - Hits: ${stats.hits}`);
    }
    
    await fs.promises.writeFile(
      'milb-player-stats-structure.json',
      JSON.stringify(statsResponse.data, null, 2)
    );
  } catch (error: any) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
  
  console.log(chalk.cyan('\n\n📊 Summary:'));
  console.log('- MLB Stats API has comprehensive MiLB coverage');
  console.log('- Free access, no authentication required');
  console.log('- Covers all minor league levels (AAA to Rookie)');
  console.log('- Includes teams, rosters, games, and player stats');
  console.log('- Response structures saved to JSON files for analysis');
}

exploreMiLBAPI()
  .then(() => {
    console.log(chalk.cyan('\n✅ API exploration complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });