#!/usr/bin/env tsx
import axios from 'axios';
import chalk from 'chalk';

async function testMensCollegeHockeyAPI() {
  console.log(chalk.cyan('\n🏒 Testing mens-college-hockey API endpoint...\n'));
  
  // Try the mens-college-hockey endpoint
  const tests = [
    {
      name: 'Teams endpoint',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams?limit=5'
    },
    {
      name: 'Current scoreboard',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard'
    },
    {
      name: 'Specific date (Jan 2022)',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard?dates=20220115'
    },
    {
      name: 'Calendar',
      url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/calendar'
    }
  ];
  
  for (const test of tests) {
    console.log(chalk.yellow(`Testing: ${test.name}`));
    console.log(chalk.gray(`URL: ${test.url}`));
    
    try {
      const response = await axios.get(test.url, { timeout: 5000 });
      
      if (response.data.events) {
        console.log(chalk.green(`✅ Success! Found ${response.data.events.length} events`));
        if (response.data.events.length > 0) {
          const firstEvent = response.data.events[0];
          console.log(chalk.gray(`  Event: ${firstEvent.name}`));
          console.log(chalk.gray(`  Date: ${firstEvent.date}`));
          console.log(chalk.gray(`  Season: ${firstEvent.season?.year}`));
          console.log(chalk.gray(`  Sport: ${firstEvent.sport || 'not specified'}`));
        }
      } else if (response.data.calendar) {
        console.log(chalk.green('✅ Calendar found!'));
        response.data.calendar.forEach((section: any, idx: number) => {
          if (idx < 3) {
            console.log(chalk.gray(`  ${section.label}: ${section.startDate} to ${section.endDate}`));
          }
        });
      } else if (response.data.sports) {
        console.log(chalk.green('✅ Teams found!'));
        const teams = response.data.sports[0]?.leagues[0]?.teams;
        console.log(chalk.gray(`  Total teams: ${teams?.length || 0}`));
        if (teams && teams.length > 0) {
          console.log(chalk.gray(`  First team: ${teams[0].team.displayName}`));
        }
      } else {
        console.log(chalk.yellow('⚠️  Unknown response'));
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
    
    console.log();
  }
  
  // Try specific 2021-22 season dates
  console.log(chalk.cyan('Testing 2021-22 season dates...'));
  const dates2122 = [
    '20211009', // Early October 2021
    '20211120', // November 2021
    '20211218', // December 2021
    '20220115', // January 2022
    '20220219', // February 2022
    '20220326', // March 2022 (tournament time)
    '20220409'  // April 2022 (Frozen Four)
  ];
  
  for (const date of dates2122) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard?dates=${date}`;
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.data.events && response.data.events.length > 0) {
        console.log(chalk.green(`✅ ${date}: ${response.data.events.length} games`));
        const season = response.data.events[0].season?.year;
        if (season) {
          console.log(chalk.gray(`   Season: ${season}`));
        }
      } else {
        console.log(chalk.gray(`   ${date}: No games`));
      }
    } catch (error) {
      console.log(chalk.red(`   ${date}: Error`));
    }
  }
}

testMensCollegeHockeyAPI().catch(console.error);