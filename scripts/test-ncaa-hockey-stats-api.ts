#!/usr/bin/env tsx
/**
 * Test different NCAA Hockey stats endpoints
 */

import chalk from 'chalk';

async function testNCAAHockeyStatsAPI() {
  console.log(chalk.bold.blue('🏒 TESTING NCAA HOCKEY STATS ENDPOINTS\n'));
  
  const gameId = '401711843'; // Army @ Canisius game
  
  // Try different endpoints
  const endpoints = [
    {
      name: 'Summary',
      url: `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/summary?event=${gameId}`
    },
    {
      name: 'Boxscore',
      url: `https://sports.core.api.espn.com/v2/sports/hockey/leagues/mens-college-hockey/events/${gameId}/competitions/${gameId}/competitors/349/statistics`
    },
    {
      name: 'Play by Play',
      url: `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/playbyplay?event=${gameId}`
    },
    {
      name: 'Event Detail',
      url: `https://sports.core.api.espn.com/v2/sports/hockey/leagues/mens-college-hockey/events/${gameId}`
    }
  ];
  
  for (const endpoint of endpoints) {
    console.log(chalk.yellow(`\nTesting ${endpoint.name}:`));
    console.log(`URL: ${endpoint.url}`);
    
    try {
      const response = await fetch(endpoint.url);
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Look for player stats
        const checkForStats = (obj: any, path = ''): void => {
          if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
              if (path.includes('athlete') || path.includes('player') || path.includes('stat')) {
                console.log(chalk.green(`  ✓ Found array at ${path}: ${obj.length} items`));
              }
            } else {
              Object.keys(obj).forEach(key => {
                if (key.toLowerCase().includes('stat') || 
                    key.toLowerCase().includes('athlete') || 
                    key.toLowerCase().includes('player')) {
                  console.log(chalk.green(`  ✓ Found key: ${path}.${key}`));
                }
                checkForStats(obj[key], `${path}.${key}`);
              });
            }
          }
        };
        
        checkForStats(data);
        
        // Save the event detail response if it has useful data
        if (endpoint.name === 'Event Detail' && data) {
          const fs = await import('fs/promises');
          await fs.writeFile('ncaa-hockey-event-detail.json', JSON.stringify(data, null, 2));
          console.log(chalk.green('  ✓ Saved event detail response'));
        }
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
  }
}

testNCAAHockeyStatsAPI().catch(console.error);