#!/usr/bin/env tsx
/**
 * Find NCAA Hockey games that have actual stats
 */

import chalk from 'chalk';

async function findNCAAHockeyGamesWithStats() {
  console.log(chalk.bold.blue('🏒 FINDING NCAA HOCKEY GAMES WITH STATS\n'));
  
  // Try recent dates
  const dates = [
    '20241201', // Dec 1, 2024
    '20241130', // Nov 30, 2024
    '20241129', // Nov 29, 2024
    '20241115', // Nov 15, 2024
    '20240316', // March 16, 2024 (near tournament time)
  ];
  
  for (const date of dates) {
    console.log(chalk.yellow(`\nChecking ${date}...`));
    
    try {
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard?dates=${date}`);
      const data = await response.json();
      
      if (data.events && data.events.length > 0) {
        console.log(`Found ${data.events.length} games`);
        
        // Check first few games for stats
        for (let i = 0; i < Math.min(3, data.events.length); i++) {
          const game = data.events[i];
          console.log(`\n  Game: ${game.shortName}`);
          console.log(`  Status: ${game.status.type.description}`);
          console.log(`  Game ID: ${game.id}`);
          
          // Fetch summary for this game
          try {
            const summaryResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/summary?event=${game.id}`);
            const summary = await summaryResponse.json();
            
            let hasStats = false;
            
            // Check if boxscore has actual player data
            if (summary.boxscore?.players) {
              for (const team of summary.boxscore.players) {
                for (const statCategory of team.statistics || []) {
                  if (statCategory.athletes && statCategory.athletes.length > 0) {
                    hasStats = true;
                    console.log(chalk.green(`    ✓ Has ${statCategory.athletes.length} ${statCategory.name}`));
                    
                    // Show sample player stats
                    const player = statCategory.athletes[0];
                    if (player.athlete) {
                      console.log(`      Sample: ${player.athlete.displayName}`);
                      console.log(`      Stats: ${JSON.stringify(player.stats)}`);
                    }
                  }
                }
              }
            }
            
            if (!hasStats) {
              console.log(chalk.red('    ✗ No player stats found'));
            } else {
              // Save a game with stats
              const fs = await import('fs/promises');
              await fs.writeFile('ncaa-hockey-game-with-stats.json', JSON.stringify(summary, null, 2));
              console.log(chalk.green('    ✓ Saved game with stats to ncaa-hockey-game-with-stats.json'));
              return; // Found one with stats
            }
            
          } catch (error) {
            console.error(`    Error fetching summary: ${error}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching games for ${date}: ${error}`);
    }
  }
  
  console.log(chalk.red('\n❌ Could not find games with player stats'));
  console.log(chalk.yellow('This might be a limitation of the ESPN API for college hockey'));
}

findNCAAHockeyGamesWithStats().catch(console.error);