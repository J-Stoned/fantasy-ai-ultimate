#!/usr/bin/env tsx
/**
 * TEST DATA COLLECTION - Shows what data we can collect
 * Works without database connection
 */

import axios from 'axios';
import chalk from 'chalk';

console.log(chalk.blue.bold(`
🚀 FANTASY AI ULTIMATE - DATA COLLECTION TEST
============================================
`));

// Test ESPN RSS Feed
async function testESPNNews() {
  console.log(chalk.yellow('📰 Testing ESPN NFL News Feed...'));
  try {
    const response = await axios.get('https://www.espn.com/espn/rss/nfl/news', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const titles = response.data.match(/<title>(.*?)<\/title>/g) || [];
    console.log(chalk.green(`✅ Found ${titles.length} news items!`));
    console.log('\nLatest 3 headlines:');
    titles.slice(1, 4).forEach((title, i) => {
      const clean = title.replace(/<\/?title>|<!\[CDATA\[|\]\]>/g, '');
      console.log(`  ${i + 1}. ${clean}`);
    });
  } catch (error) {
    console.log(chalk.red('❌ ESPN feed error:'), error.message);
  }
}

// Test Free NBA API
async function testNBAPlayers() {
  console.log(chalk.yellow('\n🏀 Testing NBA Players API...'));
  try {
    const response = await axios.get('https://www.balldontlie.io/api/v1/players?per_page=5');
    const players = response.data.data;
    
    console.log(chalk.green(`✅ Found ${players.length} players!`));
    console.log('\nSample players:');
    players.forEach(player => {
      console.log(`  - ${player.first_name} ${player.last_name} (${player.position || 'N/A'})`);
    });
  } catch (error) {
    console.log(chalk.red('❌ NBA API error:'), error.message);
  }
}

// Test Free Football API
async function testNFLData() {
  console.log(chalk.yellow('\n🏈 Testing NFL Data Sources...'));
  try {
    // ESPN NFL RSS
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    const games = response.data.events || [];
    
    console.log(chalk.green(`✅ Found ${games.length} NFL games!`));
    if (games.length > 0) {
      console.log('\nUpcoming/Recent games:');
      games.slice(0, 3).forEach(game => {
        const competition = game.competitions[0];
        const home = competition.competitors.find(t => t.homeAway === 'home');
        const away = competition.competitors.find(t => t.homeAway === 'away');
        console.log(`  - ${away.team.displayName} @ ${home.team.displayName}`);
      });
    }
  } catch (error) {
    console.log(chalk.red('❌ NFL data error:'), error.message);
  }
}

// Show what we would store
async function showDataStructure() {
  console.log(chalk.blue.bold('\n📊 DATA WE CAN COLLECT:'));
  console.log(chalk.white(`
1. SPORTS NEWS (Every 15 min)
   - NFL/NBA/MLB/NHL news from ESPN
   - Player updates and injuries
   - Trade rumors and analysis

2. PLAYER DATA (Every hour)
   - NBA: Full rosters via balldontlie API
   - NFL: Players from ESPN data
   - Stats and performance metrics

3. GAME SCORES (Real-time)
   - Live scores from all major sports
   - Game schedules and results
   - Team standings

4. WEATHER DATA (Game days)
   - Stadium weather conditions
   - Impact on outdoor games

5. INJURY REPORTS (2x daily)
   - Official injury designations
   - Practice participation
`));
}

// Main test
async function runTest() {
  await testESPNNews();
  await testNBAPlayers();
  await testNFLData();
  await showDataStructure();
  
  console.log(chalk.green.bold('\n✅ DATA COLLECTION TEST COMPLETE!'));
  console.log(chalk.yellow('\nTo start actual collection:'));
  console.log('1. Run the SQL script in Supabase to disable RLS');
  console.log('2. Run: tsx scripts/simple-data-collector.ts');
  console.log('\nThe collector will then populate your database automatically! 🚀\n');
}

// Run the test
runTest().catch(console.error);