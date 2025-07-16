#!/usr/bin/env tsx
/**
 * 🧪 NBA CONFIGURATION TESTER
 * 
 * Tests our database setup and team mappings before running collection
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

async function checkNBATeams() {
  console.log(chalk.bold.blue('\n🏀 NBA Configuration Test\n'));
  
  // 1. Check what NBA teams we have in database
  console.log(chalk.yellow('1. Checking NBA teams in database...'));
  
  const { data: dbTeams, error } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id, sport')
    .or('sport.eq.nba,sport.eq.NBA,name.ilike.%NBA%')
    .order('id');
  
  if (error) {
    console.error(chalk.red('Error fetching teams:'), error);
    return;
  }
  
  console.log(chalk.white(`\nFound ${dbTeams?.length || 0} NBA-related teams in database:\n`));
  
  if (dbTeams && dbTeams.length > 0) {
    console.table(dbTeams.slice(0, 10).map(t => ({
      ID: t.id,
      Name: t.name,
      Abbr: t.abbreviation,
      Sport: t.sport,
      ExternalID: t.external_id
    })));
    
    if (dbTeams.length > 10) {
      console.log(chalk.gray(`... and ${dbTeams.length - 10} more teams`));
    }
  }
  
  // 2. Test ESPN API to see team IDs
  console.log(chalk.yellow('\n2. Testing ESPN API for team data...'));
  
  try {
    const response = await axios.get(`${ESPN_BASE}/teams`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const espnTeams = response.data?.sports?.[0]?.leagues?.[0]?.teams || [];
    
    console.log(chalk.white(`\nESPN API returned ${espnTeams.length} teams:\n`));
    
    const teamMapping: any[] = [];
    
    espnTeams.slice(0, 5).forEach((team: any) => {
      const t = team.team;
      teamMapping.push({
        'ESPN ID': t.id,
        'Name': t.displayName,
        'Abbr': t.abbreviation,
        'Location': t.location
      });
    });
    
    console.table(teamMapping);
    
    // 3. Test a sample game fetch
    console.log(chalk.yellow('\n3. Testing game fetch from ESPN...'));
    
    const testDate = '2024-11-01';
    const gameResponse = await axios.get(`${ESPN_BASE}/scoreboard`, {
      params: {
        dates: testDate.replace(/-/g, ''),
        limit: 1
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const games = gameResponse.data?.events || [];
    if (games.length > 0) {
      const game = games[0];
      const competition = game.competitions?.[0];
      const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');
      
      console.log(chalk.white('\nSample game structure:'));
      console.log(chalk.white(`  Game ID: ${game.id}`));
      console.log(chalk.white(`  Date: ${game.date}`));
      console.log(chalk.white(`  Home: ${homeTeam?.team?.displayName} (ID: ${homeTeam?.team?.id})`));
      console.log(chalk.white(`  Away: ${awayTeam?.team?.displayName} (ID: ${awayTeam?.team?.id})`));
    }
    
  } catch (error: any) {
    console.error(chalk.red('ESPN API Error:'), error.message);
  }
  
  // 4. Show recommendation
  console.log(chalk.green('\n4. Recommendation:'));
  console.log(chalk.white('   We need to either:'));
  console.log(chalk.white('   a) Use the existing team IDs from our database'));
  console.log(chalk.white('   b) Create proper NBA teams with correct external_id mappings'));
  console.log(chalk.white('   c) Use the master collectors that handle team creation'));
  
  // 5. Check if we have the NBA master collector
  console.log(chalk.yellow('\n5. Checking for NBA master collector...'));
  const fs = require('fs');
  const path = require('path');
  
  const collectorPath = path.join(__dirname, 'collectors/nba-master-collector-v2.ts');
  if (fs.existsSync(collectorPath)) {
    console.log(chalk.green('✅ Found NBA Master Collector V2 - this handles team creation!'));
    console.log(chalk.white('   Path: scripts/collectors/nba-master-collector-v2.ts'));
    console.log(chalk.white('   This collector includes proper team mappings and creation'));
  }
}

// Run the test
checkNBATeams().catch(console.error);