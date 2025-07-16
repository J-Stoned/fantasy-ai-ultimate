#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE NCAA HOCKEY API RESPONSES
 * Deep dive into what ESPN's API actually returns
 */

import * as dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

async function investigateNCAAHockeyAPI() {
  console.log(chalk.bold.blue('🔍 INVESTIGATING NCAA HOCKEY API RESPONSES\n'));
  
  // 1. Test teams endpoint
  console.log(chalk.yellow('1. Testing Teams Endpoint...'));
  
  try {
    const teamsUrl = 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams?limit=150';
    console.log(`Fetching: ${teamsUrl}`);
    
    const response = await fetch(teamsUrl);
    const data = await response.json();
    
    // Save full response for analysis
    await fs.writeFile('ncaa-hockey-teams-response.json', JSON.stringify(data, null, 2));
    console.log(chalk.green('✓ Saved full teams response to ncaa-hockey-teams-response.json'));
    
    // Analyze structure
    console.log('\nResponse structure:');
    console.log(`- sports: ${data.sports?.length || 0} sports`);
    
    if (data.sports?.[0]) {
      const sport = data.sports[0];
      console.log(`  - name: ${sport.name}`);
      console.log(`  - slug: ${sport.slug}`);
      console.log(`  - leagues: ${sport.leagues?.length || 0} leagues`);
      
      if (sport.leagues) {
        sport.leagues.forEach((league: any, i: number) => {
          console.log(`\n  League ${i + 1}:`);
          console.log(`    - id: ${league.id}`);
          console.log(`    - name: ${league.name}`);
          console.log(`    - abbreviation: ${league.abbreviation}`);
          console.log(`    - teams: ${league.teams?.length || 0} teams`);
          
          // Show first few teams
          if (league.teams?.length > 0) {
            console.log('    Sample teams:');
            league.teams.slice(0, 3).forEach((teamData: any) => {
              const team = teamData.team;
              console.log(`      - ${team.displayName} (ID: ${team.id})`);
              console.log(`        Location: ${team.location}`);
              console.log(`        Abbreviation: ${team.abbreviation}`);
              console.log(`        Conference: ${team.groups?.length > 0 ? team.groups[0].name : 'N/A'}`);
            });
          }
        });
      }
    }
  } catch (error) {
    console.error('Error fetching teams:', error);
  }
  
  // 2. Test games/scoreboard endpoint
  console.log(chalk.yellow('\n\n2. Testing Games/Scoreboard Endpoint...'));
  
  try {
    const testDate = '20241115'; // November 15, 2024
    const gamesUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard?dates=${testDate}`;
    console.log(`Fetching: ${gamesUrl}`);
    
    const response = await fetch(gamesUrl);
    const data = await response.json();
    
    // Save response
    await fs.writeFile('ncaa-hockey-games-response.json', JSON.stringify(data, null, 2));
    console.log(chalk.green('✓ Saved full games response to ncaa-hockey-games-response.json'));
    
    console.log('\nResponse structure:');
    console.log(`- events: ${data.events?.length || 0} games`);
    console.log(`- day: ${data.day?.date || 'N/A'}`);
    
    if (data.events?.length > 0) {
      console.log('\nSample game structure:');
      const game = data.events[0];
      console.log(`- id: ${game.id}`);
      console.log(`- date: ${game.date}`);
      console.log(`- name: ${game.name}`);
      console.log(`- shortName: ${game.shortName}`);
      console.log(`- competitions: ${game.competitions?.length || 0}`);
      
      if (game.competitions?.[0]) {
        const comp = game.competitions[0];
        console.log('\n  Competition details:');
        console.log(`  - competitors: ${comp.competitors?.length || 0}`);
        
        comp.competitors?.forEach((competitor: any) => {
          console.log(`\n  ${competitor.homeAway} team:`);
          console.log(`    - id: ${competitor.id}`);
          console.log(`    - team.id: ${competitor.team.id}`);
          console.log(`    - team.name: ${competitor.team.displayName}`);
          console.log(`    - score: ${competitor.score || 'N/A'}`);
        });
        
        console.log(`\n  - venue: ${comp.venue?.fullName || 'N/A'}`);
      }
    }
  } catch (error) {
    console.error('Error fetching games:', error);
  }
  
  // 3. Test team roster endpoint
  console.log(chalk.yellow('\n\n3. Testing Team Roster Endpoint...'));
  
  try {
    // Use a known team ID (e.g., Minnesota)
    const teamId = '135'; // Minnesota Golden Gophers
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams/${teamId}/roster`;
    console.log(`Fetching: ${rosterUrl}`);
    
    const response = await fetch(rosterUrl);
    const data = await response.json();
    
    // Save response
    await fs.writeFile('ncaa-hockey-roster-response.json', JSON.stringify(data, null, 2));
    console.log(chalk.green('✓ Saved full roster response to ncaa-hockey-roster-response.json'));
    
    console.log('\nRoster structure:');
    console.log(`- team: ${data.team?.displayName || 'N/A'}`);
    console.log(`- athletes: ${data.athletes?.length || 0} players`);
    
    if (data.athletes?.length > 0) {
      console.log('\nSample player:');
      const player = data.athletes[0];
      console.log(`- id: ${player.id}`);
      console.log(`- fullName: ${player.fullName}`);
      console.log(`- displayName: ${player.displayName}`);
      console.log(`- jersey: ${player.jersey || 'N/A'}`);
      console.log(`- position: ${player.position?.displayName || 'N/A'}`);
      console.log(`- height: ${player.displayHeight || 'N/A'}`);
      console.log(`- weight: ${player.displayWeight || 'N/A'}`);
    }
  } catch (error) {
    console.error('Error fetching roster:', error);
  }
  
  // 4. Test game boxscore endpoint
  console.log(chalk.yellow('\n\n4. Testing Game Boxscore Endpoint...'));
  
  try {
    // Use a completed game ID
    const gameId = '401711843'; // From our earlier test
    const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/summary?event=${gameId}`;
    console.log(`Fetching: ${boxscoreUrl}`);
    
    const response = await fetch(boxscoreUrl);
    const data = await response.json();
    
    // Save response
    await fs.writeFile('ncaa-hockey-boxscore-response.json', JSON.stringify(data, null, 2));
    console.log(chalk.green('✓ Saved full boxscore response to ncaa-hockey-boxscore-response.json'));
    
    console.log('\nBoxscore structure:');
    console.log(`- boxscore: ${data.boxscore ? 'Present' : 'Missing'}`);
    console.log(`- players: ${data.boxscore?.players?.length || 0} teams with players`);
    
    if (data.boxscore?.players?.[0]) {
      const teamPlayers = data.boxscore.players[0];
      console.log(`\nTeam: ${teamPlayers.team?.displayName || 'N/A'}`);
      console.log(`Statistics available: ${teamPlayers.statistics?.length || 0} stat categories`);
      
      if (teamPlayers.statistics?.[0]) {
        console.log('\nStat categories:');
        teamPlayers.statistics.forEach((stat: any) => {
          console.log(`- ${stat.name} (${stat.athletes?.length || 0} players)`);
        });
      }
    }
  } catch (error) {
    console.error('Error fetching boxscore:', error);
  }
  
  console.log(chalk.bold.green('\n\n✅ Investigation complete! Check the JSON files for full details.'));
}

investigateNCAAHockeyAPI().catch(console.error);