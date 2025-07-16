#!/usr/bin/env tsx
/**
 * 🔍 TEST BASKETBALL ROSTER
 * Test specific team roster API
 */

import axios from 'axios';
import chalk from 'chalk';

async function testBasketballRoster() {
  console.log(chalk.bold.blue('🔍 TEST BASKETBALL ROSTER\n'));
  
  // Test with Arizona State (ID: 9)
  const teamId = '9';
  console.log(`Testing roster for team ID: ${teamId}`);
  
  try {
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/roster`;
    const rosterResponse = await axios.get(rosterUrl);
    
    console.log('✅ Roster API response:');
    console.log('Response keys:', Object.keys(rosterResponse.data));
    
    if (rosterResponse.data.athletes) {
      console.log(`Athletes count: ${rosterResponse.data.athletes.length}`);
      console.log('First athlete:', JSON.stringify(rosterResponse.data.athletes[0], null, 2));
    }
    
    if (rosterResponse.data.team) {
      console.log('Team info:', rosterResponse.data.team.displayName);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Response:', error.response?.data);
  }
}

testBasketballRoster();