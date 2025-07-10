#!/usr/bin/env tsx
/**
 * Test ESPN API format and response
 */

import chalk from 'chalk';

async function testESPNApi() {
  console.log(chalk.blue('\n=== ESPN API FORMAT TEST ===\n'));

  // Test cases from our database
  const testCases = [
    {
      external_id: 'espn_401671491',
      sport: 'NFL',
      expectedUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401671491'
    },
    {
      external_id: 'espn_nfl_401548631',
      sport: 'NFL',
      expectedUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401548631'
    },
    {
      external_id: 'espn_401772832',
      sport: 'NBA',
      expectedUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401772832'
    }
  ];

  for (const testCase of testCases) {
    console.log(chalk.cyan(`\nTesting: ${testCase.external_id} (${testCase.sport})`));
    console.log(chalk.gray('─'.repeat(50)));

    // Extract ESPN ID - handle different formats
    let espnId = testCase.external_id;
    
    // Remove 'espn_' prefix
    if (espnId.startsWith('espn_')) {
      espnId = espnId.substring(5);
    }
    
    // Remove sport prefix if present (e.g., 'nfl_')
    const sportPrefixMatch = espnId.match(/^(nfl|nba|mlb|nhl)_(.+)$/);
    if (sportPrefixMatch) {
      espnId = sportPrefixMatch[2];
    }

    console.log(`Extracted ESPN ID: ${espnId}`);

    // Construct URL based on sport
    const sportMap: Record<string, string> = {
      'NFL': 'football/nfl',
      'NBA': 'basketball/nba',
      'MLB': 'baseball/mlb',
      'NHL': 'hockey/nhl'
    };

    const sportPath = sportMap[testCase.sport] || 'football/nfl';
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${espnId}`;
    
    console.log(`API URL: ${url}`);

    try {
      const response = await fetch(url);
      console.log(`Response Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        
        // Check structure
        console.log(chalk.green('\n✓ API call successful!'));
        
        // Game info
        const competition = data.header?.competitions?.[0];
        if (competition) {
          const home = competition.competitors.find((c: any) => c.homeAway === 'home');
          const away = competition.competitors.find((c: any) => c.homeAway === 'away');
          
          console.log(`\nGame: ${away?.team?.displayName || 'Unknown'} @ ${home?.team?.displayName || 'Unknown'}`);
          console.log(`Score: ${away?.score || '0'} - ${home?.score || '0'}`);
          console.log(`Status: ${competition.status?.type?.description || 'Unknown'}`);
        }

        // Check for boxscore
        if (data.boxscore) {
          console.log(chalk.green('\n✓ Has boxscore data'));
          
          const teams = data.boxscore.teams;
          if (teams && teams.length > 0) {
            console.log(`\nTeams in boxscore: ${teams.length}`);
            
            // Check first team's players
            const firstTeam = teams[0];
            const playerCategories = Object.keys(firstTeam.statistics || {});
            console.log(`Player stat categories: ${playerCategories.join(', ')}`);

            // Look for actual player data
            if (data.boxscore.players) {
              const playerTeams = data.boxscore.players;
              console.log(`\nPlayer data found for ${playerTeams.length} teams`);
              
              if (playerTeams[0]?.statistics) {
                const statCategories = playerTeams[0].statistics;
                console.log(`Stat categories available:`);
                statCategories.forEach((cat: any) => {
                  console.log(`  - ${cat.name}: ${cat.athletes?.length || 0} players`);
                });

                // Show sample player stats
                const firstCategory = statCategories[0];
                if (firstCategory?.athletes?.length > 0) {
                  const samplePlayer = firstCategory.athletes[0];
                  console.log(`\nSample player data:`);
                  console.log(`  Name: ${samplePlayer.athlete?.displayName}`);
                  console.log(`  Stats: ${samplePlayer.stats.join(', ')}`);
                }
              }
            }
          }
        } else {
          console.log(chalk.yellow('\n⚠ No boxscore data in response'));
        }

      } else {
        const errorText = await response.text();
        console.log(chalk.red('\n✗ API call failed'));
        console.log(`Error: ${errorText.substring(0, 200)}`);
      }

    } catch (error) {
      console.log(chalk.red('\n✗ Network error'));
      console.log(`Error: ${error}`);
    }
  }

  console.log(chalk.blue('\n\n=== API TEST COMPLETE ==='));
}

testESPNApi().catch(console.error);