import * as fs from 'fs';
import chalk from 'chalk';

async function deepDiveNCAAHockey() {
  console.log(chalk.cyan('🏒 Deep Dive into NCAA Hockey Response\n'));
  
  const data = JSON.parse(
    await fs.promises.readFile('ncaa-hockey-successful-response.json', 'utf-8')
  );
  
  // 1. Check all top-level keys
  console.log(chalk.yellow('Top-level keys:'));
  Object.keys(data).forEach(key => {
    console.log(`- ${key}`);
  });
  
  // 2. Look for player data in other sections
  console.log(chalk.yellow('\n🔍 Searching for player/athlete data in all sections...\n'));
  
  function searchForPlayers(obj: any, path: string = ''): void {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Look for interesting keys
      if (key.toLowerCase().includes('player') || 
          key.toLowerCase().includes('athlete') ||
          key.toLowerCase().includes('roster') ||
          key.toLowerCase().includes('stat') ||
          key.toLowerCase().includes('leader') ||
          key.toLowerCase().includes('scorer')) {
        console.log(chalk.green(`Found interesting key: ${currentPath}`));
        
        // Check if it has data
        if (Array.isArray(value) && value.length > 0) {
          console.log(chalk.green(`  ✅ Has ${value.length} items!`));
          console.log(chalk.gray(`  Sample: ${JSON.stringify(value[0], null, 2).substring(0, 200)}...`));
        } else if (value && typeof value === 'object' && Object.keys(value).length > 0) {
          console.log(chalk.green(`  ✅ Has data!`));
          console.log(chalk.gray(`  Keys: ${Object.keys(value).join(', ')}`));
        } else {
          console.log(chalk.red(`  ❌ Empty`));
        }
      }
      
      // Recursively search
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          searchForPlayers(item, `${currentPath}[${index}]`);
        });
      } else if (value && typeof value === 'object') {
        searchForPlayers(value, currentPath);
      }
    }
  }
  
  searchForPlayers(data);
  
  // 3. Check specific sections that might have hidden data
  console.log(chalk.yellow('\n📊 Checking specific sections...\n'));
  
  // Check plays
  if (data.plays) {
    console.log(chalk.blue('Plays section:'));
    console.log(`- Has plays: ${!!data.plays}`);
    console.log(`- Number of periods: ${data.plays.length || 0}`);
    
    if (data.plays && data.plays.length > 0) {
      const firstPeriod = data.plays[0];
      console.log(`- First period has ${firstPeriod.plays?.length || 0} plays`);
      
      if (firstPeriod.plays && firstPeriod.plays.length > 0) {
        const firstPlay = firstPeriod.plays[0];
        console.log(chalk.gray(`  Sample play: ${JSON.stringify(firstPlay).substring(0, 200)}...`));
        
        // Check if plays mention player names
        if (firstPlay.text && firstPlay.text.includes(' ')) {
          console.log(chalk.green('  ✅ Plays contain player names in text!'));
        }
      }
    }
  }
  
  // Check gameInfo
  if (data.gameInfo) {
    console.log(chalk.blue('\nGameInfo section:'));
    console.log(`- Keys: ${Object.keys(data.gameInfo).join(', ')}`);
  }
  
  // Check standings
  if (data.standings) {
    console.log(chalk.blue('\nStandings section:'));
    console.log(`- Has standings: ${!!data.standings}`);
  }
  
  // Check header for hidden data
  if (data.header) {
    console.log(chalk.blue('\nHeader section:'));
    if (data.header.competitions && data.header.competitions[0]) {
      const comp = data.header.competitions[0];
      console.log(`- Competition keys: ${Object.keys(comp).join(', ')}`);
      
      // Check for competitors with stats
      if (comp.competitors) {
        console.log(`- Competitors: ${comp.competitors.length}`);
        const firstCompetitor = comp.competitors[0];
        console.log(`- First competitor keys: ${Object.keys(firstCompetitor).join(', ')}`);
        
        // Check for statistics in competitors
        if (firstCompetitor.statistics) {
          console.log(chalk.green('  ✅ Found statistics in competitor!'));
          console.log(`  Stats: ${JSON.stringify(firstCompetitor.statistics)}`);
        }
        
        // Check for leaders
        if (firstCompetitor.leaders) {
          console.log(chalk.green('  ✅ Found leaders in competitor!'));
          console.log(`  Leaders: ${JSON.stringify(firstCompetitor.leaders)}`);
        }
      }
    }
  }
  
  // 4. Check for any arrays with player-like objects
  console.log(chalk.yellow('\n🎯 Looking for any arrays that might contain player data...\n'));
  
  function findArraysWithObjects(obj: any, path: string = ''): void {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value) && value.length > 0) {
        const firstItem = value[0];
        if (firstItem && typeof firstItem === 'object') {
          // Check if it looks like player data
          const hasName = 'name' in firstItem || 'displayName' in firstItem || 'athlete' in firstItem;
          const hasStats = 'stats' in firstItem || 'statistics' in firstItem;
          const hasId = 'id' in firstItem || 'playerId' in firstItem;
          
          if (hasName || hasStats || hasId) {
            console.log(chalk.green(`Potential player array at: ${currentPath}`));
            console.log(`  Length: ${value.length}`);
            console.log(`  Keys: ${Object.keys(firstItem).join(', ')}`);
            console.log(chalk.gray(`  Sample: ${JSON.stringify(firstItem, null, 2).substring(0, 300)}...`));
          }
        }
      } else if (value && typeof value === 'object') {
        findArraysWithObjects(value, currentPath);
      }
    }
  }
  
  findArraysWithObjects(data);
  
  // 5. Save a pretty-printed version for manual inspection
  await fs.promises.writeFile(
    'ncaa-hockey-response-formatted.json',
    JSON.stringify(data, null, 2)
  );
  console.log(chalk.cyan('\n✅ Formatted response saved to ncaa-hockey-response-formatted.json'));
}

deepDiveNCAAHockey()
  .then(() => {
    console.log(chalk.cyan('\n✅ Deep dive complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });