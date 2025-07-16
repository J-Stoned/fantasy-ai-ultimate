#!/usr/bin/env tsx
import axios from 'axios';

async function debugNBA() {
  try {
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/1/roster`;
    const response = await axios.get(rosterUrl);
    
    if (response.data.athletes && response.data.athletes.length > 0) {
      const athlete = response.data.athletes[0];
      console.log('First athlete:', {
        name: athlete.fullName,
        height: athlete.height,
        heightType: typeof athlete.height,
        weight: athlete.weight,
        weightType: typeof athlete.weight
      });
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

debugNBA();