#!/usr/bin/env tsx

import axios from 'axios';

async function testESPNRoster() {
  try {
    console.log('Testing ESPN NFL roster API...');
    
    // Test LA Lakers (ID: 13)
    const teamId = '13';
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;
    
    console.log(`URL: ${url}`);
    
    const response = await axios.get(url);
    console.log('Response structure:');
    console.log('- athletes array length:', response.data.athletes?.length || 0);
    
    if (response.data.athletes && response.data.athletes.length > 0) {
      console.log('First position group:');
      console.log('- name:', response.data.athletes[0].position);
      console.log('- items length:', response.data.athletes[0].items?.length || 0);
      
      if (response.data.athletes[0].items && response.data.athletes[0].items.length > 0) {
        const firstPlayer = response.data.athletes[0].items[0];
        console.log('First player example:');
        console.log('- displayName:', firstPlayer.displayName);
        console.log('- position:', firstPlayer.position?.abbreviation);
        console.log('- jersey:', firstPlayer.jersey);
        console.log('- height:', firstPlayer.height, typeof firstPlayer.height);
        console.log('- weight:', firstPlayer.weight);
      }
    }
    
    // Count total players across all position groups
    let totalPlayers = 0;
    if (response.data.athletes) {
      for (const posGroup of response.data.athletes) {
        totalPlayers += posGroup.items?.length || 0;
      }
    }
    console.log(`Total players found: ${totalPlayers}`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testESPNRoster();