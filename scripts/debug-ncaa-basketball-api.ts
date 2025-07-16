#!/usr/bin/env tsx
/**
 * 🔍 DEBUG NCAA BASKETBALL API
 * Understand the actual API structure
 */

import axios from 'axios';
import chalk from 'chalk';

async function debugNCAABasketballAPI() {
  console.log(chalk.bold.blue('🔍 DEBUG NCAA BASKETBALL API\n'));
  
  try {
    // Test teams API
    const teamsUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=10';
    const teamsResponse = await axios.get(teamsUrl);
    
    console.log('📊 Teams API response structure:');
    console.log('- Response keys:', Object.keys(teamsResponse.data));
    console.log('- Response data:', JSON.stringify(teamsResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugNCAABasketballAPI();