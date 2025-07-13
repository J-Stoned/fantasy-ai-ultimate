#!/usr/bin/env tsx
/**
 * Fix all NCAA team ESPN IDs with comprehensive mappings
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Comprehensive NCAA team name to ESPN ID mappings
const NCAA_ESPN_IDS: Record<string, string> = {
  // A
  'American University Eagles': '44',
  'Alabama Crimson Tide': '333',
  'Arizona Wildcats': '12',
  'Arizona State Sun Devils': '9',
  'Auburn Tigers': '2',
  'Arkansas Razorbacks': '8',
  
  // B
  'Bellarmine Knights': '2057',
  'Boise State Broncos': '68',
  'Bradley Braves': '71',
  'Baylor Bears': '239',
  'Boston College Eagles': '103',
  'Butler Bulldogs': '2086',
  
  // C
  'Colorado Buffaloes': '38',
  'Colorado State Rams': '36',
  'Connecticut Huskies': '41',
  'UConn Huskies': '41',
  'Creighton Bluejays': '156',
  'Cincinnati Bearcats': '2132',
  'Clemson Tigers': '228',
  
  // D
  'Delaware Blue Hens': '48',
  'Duke Blue Devils': '150',
  'Dayton Flyers': '2166',
  'DePaul Blue Demons': '305',
  
  // F
  'Florida A&M Rattlers': '50',
  'Florida State Seminoles': '52',
  'Florida Gators': '57',
  
  // G
  'Georgetown Hoyas': '46',
  'George Washington Revolutionaries': '45',
  'Georgia Bulldogs': '61',
  'Georgia Tech Yellow Jackets': '59',
  'Gonzaga Bulldogs': '2250',
  
  // H
  'Hawai\'i Rainbow Warriors': '62',
  'Hawaii Rainbow Warriors': '62',
  'Howard Bison': '47',
  'Houston Cougars': '248',
  
  // I
  'Idaho Vandals': '70',
  'Iowa State Cyclones': '66',
  'IU Indianapolis Jaguars': '88',  // Formerly IUPUI
  'Indiana Hoosiers': '84',
  'Illinois Fighting Illini': '356',
  'Iowa Hawkeyes': '2294',
  
  // J
  'Jacksonville State Gamecocks': '2663',
  
  // K
  'Kansas Jayhawks': '2305',
  'Kentucky Wildcats': '96',
  'Kansas State Wildcats': '2306',
  
  // L
  'Louisville Cardinals': '97',
  'LSU Tigers': '99',
  'Liberty Flames': '2335',
  
  // M
  'Murray State Racers': '93',
  'Michigan State Spartans': '127',
  'Michigan Wolverines': '130',
  'Maryland Terrapins': '120',
  'Memphis Tigers': '235',
  'Miami Hurricanes': '2390',
  'Minnesota Golden Gophers': '135',
  'Missouri Tigers': '142',
  
  // N
  'Northern Kentucky Norse': '94',
  'Northwestern Wildcats': '77',
  'Notre Dame Fighting Irish': '87',
  'North Carolina Tar Heels': '153',
  'NC State Wolfpack': '152',
  'Nebraska Cornhuskers': '158',
  
  // O
  'Ohio State Buckeyes': '194',
  'Oklahoma Sooners': '201',
  'Oklahoma State Cowboys': '197',
  'Oregon Ducks': '2483',
  'Oregon State Beavers': '204',
  
  // P
  'Purdue Boilermakers': '2509',
  'Penn State Nittany Lions': '213',
  'Pittsburgh Panthers': '221',
  'Providence Friars': '2507',
  
  // S
  'Southern Illinois Salukis': '79',
  'South Florida Bulls': '58',
  'Stetson Hatters': '56',
  'Syracuse Orange': '183',
  'Stanford Cardinal': '24',
  'South Carolina Gamecocks': '2579',
  'SMU Mustangs': '2567',
  
  // T
  'Texas Longhorns': '251',
  'Tennessee Volunteers': '2633',
  'Texas A&M Aggies': '245',
  'Texas Tech Red Raiders': '2641',
  'TCU Horned Frogs': '2628',
  
  // U
  'UIC Flames': '82',  // University of Illinois Chicago
  'UCLA Bruins': '26',
  'USC Trojans': '30',
  'Utah Utes': '254',
  'UNLV Rebels': '2439',
  
  // V
  'Villanova Wildcats': '222',
  'Virginia Cavaliers': '258',
  'Virginia Tech Hokies': '259',
  'Vanderbilt Commodores': '238',
  'VCU Rams': '2670',
  
  // W
  'Western Kentucky Hilltoppers': '98',
  'Wisconsin Badgers': '275',
  'West Virginia Mountaineers': '277',
  'Wake Forest Demon Deacons': '154',
  'Washington Huskies': '264',
  'Washington State Cougars': '265',
  'Wichita State Shockers': '2724',
  
  // X
  'Xavier Musketeers': '2752',
  
  // Y
  'Yale Bulldogs': '43'
};

async function fixAllNCAATeamIds() {
  console.log(chalk.bold.blue('🏀 FIXING ALL NCAA TEAM ESPN IDS\n'));
  
  // Get all NCAA teams
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport_id', 'ncaab')
    .order('name');
    
  if (error) {
    console.error('Error fetching teams:', error);
    return;
  }
  
  console.log(`Found ${teams?.length || 0} total NCAA teams\n`);
  
  let updated = 0;
  let alreadyCorrect = 0;
  let notFound = [];
  
  for (const team of teams || []) {
    const espnId = NCAA_ESPN_IDS[team.name];
    
    if (espnId) {
      if (team.external_id === espnId) {
        alreadyCorrect++;
      } else {
        const { error: updateError } = await supabase
          .from('teams')
          .update({ external_id: espnId })
          .eq('id', team.id);
          
        if (!updateError) {
          console.log(chalk.green(`✅ Updated ${team.name} with ESPN ID: ${espnId}`));
          updated++;
        } else {
          console.error(chalk.red(`Failed to update ${team.name}:`, updateError));
        }
      }
    } else {
      notFound.push(team);
      console.log(chalk.yellow(`⚠️  No mapping found for: ${team.name}`));
    }
  }
  
  console.log(chalk.bold.cyan(`\n📊 Final Summary:`));
  console.log(`- Total teams: ${teams?.length || 0}`);
  console.log(`- Already correct: ${alreadyCorrect}`);
  console.log(`- Updated: ${updated}`);
  console.log(`- Not found: ${notFound.length}`);
  
  if (notFound.length > 0) {
    console.log(chalk.red('\nTeams without ESPN ID mapping:'));
    notFound.forEach(team => {
      console.log(`  - ${team.name} (DB ID: ${team.id})`);
    });
  }
  
  console.log(chalk.bold.green('\n✅ Done!'));
}

fixAllNCAATeamIds();