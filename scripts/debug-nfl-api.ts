#!/usr/bin/env tsx
import axios from 'axios';

async function debugNFL() {
  try {
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/1/roster`;
    const response = await axios.get(rosterUrl);
    
    console.log('NFL Roster API Response:');
    console.log('Athletes count:', response.data.athletes?.length || 0);
    
    if (response.data.athletes && response.data.athletes.length > 0) {
      const athlete = response.data.athletes[0];
      console.log('\nFirst athlete full object:');
      console.log(JSON.stringify(athlete, null, 2));
    }
    
    // Check structure
    console.log('\nAPI structure keys:', Object.keys(response.data));
    
    // Maybe it's in a different structure?
    if (response.data.teams) {
      console.log('Teams structure found');
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

debugNFL();