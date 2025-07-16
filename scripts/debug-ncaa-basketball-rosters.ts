#!/usr/bin/env tsx
/**
 * 🔍 DEBUG NCAA BASKETBALL ROSTERS
 * Test ESPN API roster structure for NCAA Basketball
 */

import axios from 'axios';
import chalk from 'chalk';

async function debugNCAABasketballRosters() {
  console.log(chalk.bold.blue('🔍 DEBUG NCAA BASKETBALL ROSTERS\n'));
  
  try {
    // First, get a sample team
    const teamsUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=10';
    const teamsResponse = await axios.get(teamsUrl);
    
    const teams = teamsResponse.data?.sports?.[0]?.leagues?.[0]?.teams;
    if (!teams || teams.length === 0) {
      console.log('❌ No teams found');
      return;
    }
    
    console.log(`Found ${teams.length} teams to test`);
    
    // Test roster API for first few teams
    for (let i = 0; i < Math.min(5, teams.length); i++) {
      const team = teams[i];
      console.log(`\n📊 Testing team: ${team.name} (ID: ${team.id})`);
      
      try {
        const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${team.id}/roster`;
        const rosterResponse = await axios.get(rosterUrl);
        
        console.log('✅ Roster API response structure:');
        console.log(`- athletes: ${rosterResponse.data?.athletes ? 'EXISTS' : 'MISSING'}`);
        console.log(`- athletes length: ${rosterResponse.data?.athletes?.length || 0}`);
        
        if (rosterResponse.data?.athletes) {
          console.log('- athletes is array:', Array.isArray(rosterResponse.data.athletes));
          
          if (Array.isArray(rosterResponse.data.athletes) && rosterResponse.data.athletes.length > 0) {
            console.log('- First athlete structure:');
            console.log('  Keys:', Object.keys(rosterResponse.data.athletes[0]));
            console.log('  Sample:', JSON.stringify(rosterResponse.data.athletes[0], null, 2));
          }
        }
        
        // Check other possible structures
        if (rosterResponse.data?.roster) {
          console.log('- roster field exists');
          console.log('- roster structure:', Object.keys(rosterResponse.data.roster));
        }
        
        if (rosterResponse.data?.team) {
          console.log('- team field exists');
          console.log('- team structure:', Object.keys(rosterResponse.data.team));
        }
        
        console.log('- Full response keys:', Object.keys(rosterResponse.data));
        
      } catch (error) {
        console.log(`❌ Error fetching roster for ${team.name}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugNCAABasketballRosters();