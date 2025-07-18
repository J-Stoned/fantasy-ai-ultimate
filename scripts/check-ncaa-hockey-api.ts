#!/usr/bin/env tsx
import axios from 'axios';
import chalk from 'chalk';

async function checkNCAAHockeyAPI() {
  console.log(chalk.cyan('\n🏒 Checking NCAA Hockey API...\n'));
  
  // Try different date formats and endpoints
  const tests = [
    {
      name: 'Scoreboard with specific date',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/college-hockey/scoreboard?dates=20220101'
    },
    {
      name: 'Current scoreboard',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/college-hockey/scoreboard'
    },
    {
      name: 'Calendar/Schedule',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/college-hockey/calendar'
    },
    {
      name: 'Teams endpoint',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/college-hockey/teams?limit=5'
    }
  ];
  
  for (const test of tests) {
    console.log(chalk.yellow(`\nTesting: ${test.name}`));
    console.log(chalk.gray(`URL: ${test.url}`));
    
    try {
      const response = await axios.get(test.url, { timeout: 5000 });
      
      if (response.data.events) {
        console.log(chalk.green(`✅ Found ${response.data.events.length} events`));
        if (response.data.events.length > 0) {
          const firstEvent = response.data.events[0];
          console.log(chalk.gray(`  First event: ${firstEvent.name}`));
          console.log(chalk.gray(`  Date: ${firstEvent.date}`));
          console.log(chalk.gray(`  Season: ${firstEvent.season?.year}`));
        }
      } else if (response.data.calendar) {
        console.log(chalk.green('✅ Calendar data found'));
        console.log(chalk.gray(`  Sections: ${response.data.calendar.length}`));
        response.data.calendar.forEach((section: any) => {
          console.log(chalk.gray(`  - ${section.label}: ${section.startDate} to ${section.endDate}`));
        });
      } else if (response.data.sports) {
        console.log(chalk.green('✅ Teams data found'));
        const teams = response.data.sports[0]?.leagues[0]?.teams;
        console.log(chalk.gray(`  Teams count: ${teams?.length || 0}`));
      } else {
        console.log(chalk.yellow('⚠️  Unknown response format'));
        console.log(JSON.stringify(Object.keys(response.data), null, 2));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }
  
  // Try a specific date we know had games
  console.log(chalk.cyan('\n\nTrying specific dates from 2021-22 season...'));
  const dates = [
    '20211008', // Early October
    '20211015',
    '20211022',
    '20211105', // November
    '20211112',
    '20211203', // December
    '20220114', // January
    '20220211', // February
    '20220318', // March
    '20220408'  // April (Frozen Four)
  ];
  
  for (const date of dates) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/college-hockey/scoreboard?dates=${date}`;
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.data.events && response.data.events.length > 0) {
        console.log(chalk.green(`✅ ${date}: ${response.data.events.length} games found`));
      } else {
        console.log(chalk.gray(`   ${date}: No games`));
      }
    } catch (error) {
      console.log(chalk.red(`   ${date}: Error`));
    }
  }
}

checkNCAAHockeyAPI().catch(console.error);