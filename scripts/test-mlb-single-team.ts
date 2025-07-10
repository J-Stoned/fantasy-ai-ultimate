#!/usr/bin/env tsx
/**
 * 🧪 TEST MLB API WITH SINGLE TEAM
 */

import axios from 'axios';
import chalk from 'chalk';

async function testMLBApi() {
  console.log(chalk.bold.blue('⚾ Testing MLB API Endpoints\n'));
  
  const BASE_URL = 'https://statsapi.mlb.com/api/v1';
  
  // Test team endpoint - Yankees
  console.log(chalk.yellow('Testing MLB Stats API...'));
  
  try {
    // Get team info
    const teamId = 147; // Yankees
    const teamUrl = `${BASE_URL}/teams/${teamId}`;
    console.log(chalk.gray(`Team URL: ${teamUrl}`));
    
    const teamResponse = await axios.get(teamUrl);
    const team = teamResponse.data.teams?.[0];
    
    if (team) {
      console.log(chalk.green('✅ Team API works!'));
      console.log(chalk.cyan(`\nTeam: ${team.name}`));
      console.log(`  Full Name: ${team.franchiseName} ${team.teamName}`);
      console.log(`  Location: ${team.locationName}`);
      console.log(`  League: ${team.league.name}`);
      console.log(`  Division: ${team.division.name}`);
    }
    
    // Get roster
    const rosterUrl = `${BASE_URL}/teams/${teamId}/roster`;
    console.log(chalk.gray(`\nRoster URL: ${rosterUrl}`));
    
    const rosterResponse = await axios.get(rosterUrl);
    const roster = rosterResponse.data.roster || [];
    
    console.log(chalk.cyan(`\nFound ${roster.length} players:`));
    
    // Show first few players
    roster.slice(0, 5).forEach((player: any) => {
      const person = player.person;
      console.log(`  - ${person.fullName} (#${player.jerseyNumber || '?'}) - ${player.position.abbreviation}`);
    });
    
    // Check player structure
    if (roster.length > 0) {
      console.log(chalk.yellow('\nSample player structure:'));
      const sample = roster[0].person;
      const pos = roster[0].position;
      console.log('  ID:', sample.id);
      console.log('  Name:', sample.fullName);
      console.log('  First:', sample.firstName);
      console.log('  Last:', sample.lastName);
      console.log('  Jersey:', roster[0].jerseyNumber);
      console.log('  Position:', pos.name, `(${pos.abbreviation})`);
      console.log('  Birth Date:', sample.birthDate);
      console.log('  Height:', sample.height);
      console.log('  Weight:', sample.weight);
    }
    
    // Test all teams endpoint
    console.log(chalk.yellow('\n\nGetting all MLB teams...'));
    const allTeamsUrl = `${BASE_URL}/teams?sportId=1`;
    const allTeamsResponse = await axios.get(allTeamsUrl);
    const allTeams = allTeamsResponse.data.teams || [];
    
    console.log(chalk.cyan(`\nFound ${allTeams.length} teams:`));
    
    // Show AL East teams
    const alEast = allTeams.filter((t: any) => 
      t.league.id === 103 && t.division.id === 201
    );
    
    console.log(chalk.cyan('\nAL East teams:'));
    alEast.forEach((t: any) => {
      console.log(`  ${t.id}: ${t.name} (${t.abbreviation})`);
      console.log(`     Full: ${t.franchiseName} ${t.teamName}`);
      console.log(`     Location: ${t.locationName}`);
    });
    
  } catch (error: any) {
    console.log(chalk.red('❌ MLB API failed:'), error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

testMLBApi().catch(console.error);