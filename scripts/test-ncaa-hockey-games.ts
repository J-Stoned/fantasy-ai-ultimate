#!/usr/bin/env tsx
/**
 * 🏒 TEST NCAA HOCKEY GAMES FETCH
 * Test fetching a few NCAA Hockey games
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testNCAAHockeyGames() {
  console.log(chalk.bold.blue('🏒 TESTING NCAA HOCKEY GAMES FETCH\n'));
  
  try {
    // Test with a specific date we know has games
    const testDate = '20241101'; // November 1, 2024
    
    console.log(`Testing with date: ${testDate}`);
    
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/scoreboard?dates=${testDate}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(chalk.red(`API returned ${response.status}: ${response.statusText}`));
      return;
    }
    
    const data = await response.json();
    
    console.log(`\nAPI Response:`);
    console.log(`- Events found: ${data.events?.length || 0}`);
    console.log(`- Day: ${data.day?.date}`);
    
    if (data.events && data.events.length > 0) {
      console.log(`\nSample games:`);
      
      data.events.slice(0, 3).forEach((event: any, i: number) => {
        const competition = event.competitions[0];
        const home = competition.competitors.find((c: any) => c.homeAway === 'home');
        const away = competition.competitors.find((c: any) => c.homeAway === 'away');
        
        console.log(`\n${i + 1}. ${away?.team.displayName} @ ${home?.team.displayName}`);
        console.log(`   ID: ${event.id}`);
        console.log(`   Date: ${event.date}`);
        console.log(`   Status: ${event.status.type.description}`);
        
        if (event.status.type.completed) {
          console.log(`   Score: ${away?.score} - ${home?.score}`);
        }
      });
    }
    
    // Test team mapping
    console.log(chalk.yellow('\n\nChecking team mapping...'));
    
    const { data: teams } = await supabase
      .from('teams')
      .select('name, external_id')
      .eq('sport', 'NCAA_HKY')
      .limit(5);
    
    console.log('\nSample NCAA Hockey teams in DB:');
    teams?.forEach(team => {
      const espnId = team.external_id?.split('_').pop();
      console.log(`- ${team.name} (ESPN ID: ${espnId})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testNCAAHockeyGames().catch(console.error);