#!/usr/bin/env tsx
import axios from 'axios';

async function debugNHL() {
  try {
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/1/roster`;
    const response = await axios.get(rosterUrl);
    
    console.log('NHL Roster API Response:');
    console.log('Athletes count:', response.data.athletes?.length || 0);
    console.log('API structure keys:', Object.keys(response.data));
    
    if (response.data.athletes && response.data.athletes.length > 0) {
      const athlete = response.data.athletes[0];
      console.log('\nFirst athlete structure:');
      console.log(JSON.stringify(athlete, null, 2).substring(0, 500) + '...');
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

debugNHL();