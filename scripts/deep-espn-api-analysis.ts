#!/usr/bin/env tsx
/**
 * Deep ESPN API Analysis - Examine Response Structure
 * 
 * Since the API returns 200 responses but 0 players, let's examine
 * the actual response structure to see what's changed
 */

import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs/promises';

async function deepAnalyzeEspnResponse(sport: string, gameId: string) {
  const endpoints = {
    NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary',
    NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary',
    MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary',
    NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary'
  };

  const url = `${endpoints[sport as keyof typeof endpoints]}?event=${gameId}`;
  
  try {
    console.log(chalk.blue(`🔍 Deep analyzing ${sport} game ${gameId}...`));
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    const data = response.data;
    
    console.log(chalk.green(`✅ Response Status: ${response.status}`));
    console.log(chalk.blue(`📊 Root keys: ${Object.keys(data).join(', ')}`));
    
    if (data.boxscore) {
      console.log(chalk.yellow(`📦 Boxscore keys: ${Object.keys(data.boxscore).join(', ')}`));
      
      if (data.boxscore.teams) {
        console.log(chalk.cyan(`🏀 Teams count: ${data.boxscore.teams.length}`));
        
        for (let i = 0; i < data.boxscore.teams.length; i++) {
          const team = data.boxscore.teams[i];
          console.log(chalk.white(`\n  Team ${i} (${team.team?.displayName || 'Unknown'}):`));
          console.log(chalk.gray(`    Keys: ${Object.keys(team).join(', ')}`));
          
          if (team.statistics) {
            console.log(chalk.green(`    📈 Statistics groups: ${team.statistics.length}`));
            
            for (let j = 0; j < team.statistics.length; j++) {
              const statGroup = team.statistics[j];
              console.log(chalk.yellow(`      Group ${j}:`));
              console.log(chalk.gray(`        Keys: ${Object.keys(statGroup).join(', ')}`));
              console.log(chalk.gray(`        Type: ${statGroup.type || 'unknown'}`));
              console.log(chalk.gray(`        Name: ${statGroup.name || 'unknown'}`));
              
              if (statGroup.athletes) {
                console.log(chalk.cyan(`        👥 Athletes: ${statGroup.athletes.length}`));
                
                if (statGroup.athletes.length > 0) {
                  const athlete = statGroup.athletes[0];
                  console.log(chalk.white(`          Sample athlete keys: ${Object.keys(athlete).join(', ')}`));
                  
                  if (athlete.athlete) {
                    console.log(chalk.green(`          Name: ${athlete.athlete.displayName || 'Unknown'}`));
                  }
                  
                  if (athlete.stats) {
                    console.log(chalk.blue(`          Stats type: ${Array.isArray(athlete.stats) ? 'array' : typeof athlete.stats}`));
                    console.log(chalk.blue(`          Stats length: ${Array.isArray(athlete.stats) ? athlete.stats.length : 'N/A'}`));
                    if (Array.isArray(athlete.stats) && athlete.stats.length > 0) {
                      console.log(chalk.blue(`          Sample stats: ${athlete.stats.slice(0, 5).join(', ')}`));
                    }
                  } else {
                    console.log(chalk.red(`          ❌ No stats property found`));
                  }
                }
              } else {
                console.log(chalk.red(`        ❌ No athletes property found`));
              }
            }
          } else {
            console.log(chalk.red(`    ❌ No statistics property found`));
          }
        }
      } else {
        console.log(chalk.red(`❌ No teams property in boxscore`));
      }
      
      // Check for alternative structure
      if (data.boxscore.players) {
        console.log(chalk.magenta(`\n🔄 Alternative structure found: boxscore.players`));
        console.log(chalk.magenta(`   Players count: ${data.boxscore.players.length}`));
        
        for (let i = 0; i < Math.min(data.boxscore.players.length, 2); i++) {
          const playerGroup = data.boxscore.players[i];
          console.log(chalk.white(`   Group ${i} keys: ${Object.keys(playerGroup).join(', ')}`));
          
          if (playerGroup.statistics) {
            for (let j = 0; j < playerGroup.statistics.length; j++) {
              const statGroup = playerGroup.statistics[j];
              console.log(chalk.yellow(`     Stat group ${j}: ${statGroup.type || 'unknown'}`));
              if (statGroup.athletes) {
                console.log(chalk.cyan(`       Athletes: ${statGroup.athletes.length}`));
                if (statGroup.athletes.length > 0) {
                  const athlete = statGroup.athletes[0];
                  console.log(chalk.green(`       Sample: ${athlete.athlete?.displayName || 'Unknown'}`));
                  console.log(chalk.blue(`       Has stats: ${!!athlete.stats} (${Array.isArray(athlete.stats) ? athlete.stats.length : typeof athlete.stats})`));
                }
              }
            }
          }
        }
      }
      
    } else {
      console.log(chalk.red(`❌ No boxscore property found`));
    }
    
    // Save full response for detailed analysis
    const filename = `/tmp/espn_${sport.toLowerCase()}_${gameId}_response.json`;
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(chalk.green(`💾 Full response saved to: ${filename}`));
    
  } catch (error: any) {
    console.log(chalk.red(`❌ Error analyzing ${sport} game ${gameId}: ${error.message}`));
  }
}

async function main() {
  console.log(chalk.bold.cyan('🔬 DEEP ESPN API STRUCTURE ANALYSIS\n'));
  
  // Test one game from each sport that we know returns 200
  const testGames = [
    { sport: 'NBA', gameId: '401766128' },
    { sport: 'NFL', gameId: '401671719' },
    { sport: 'MLB', gameId: '401472105' },
    { sport: 'NHL', gameId: '401559534' }
  ];
  
  for (const { sport, gameId } of testGames) {
    await deepAnalyzeEspnResponse(sport, gameId);
    console.log(chalk.gray('\n' + '='.repeat(80) + '\n'));
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(chalk.bold.green('🎉 Deep analysis complete! Check the saved JSON files for full structure.'));
}

main().catch(console.error);