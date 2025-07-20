#!/usr/bin/env tsx
/**
 * 🏒 COLLECT SPECIFIC MISSING NHL PLAYERS
 * 
 * Targets the exact players missing from our debug run
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function collectSpecificPlayers() {
  console.log(chalk.bold.cyan('🏒 COLLECTING SPECIFIC MISSING NHL PLAYERS\n'));
  
  // The missing player IDs from debug
  const missingPlayerIds = [
    '3114756', // Sonny Milano
    '4024998', // Sam Steel
    '4565230', // Trevor Zegras
    '4697387', // Jamie Drysdale
    '5495',    // Cam Fowler
    '2590824'  // John Gibson
  ];
  
  // Get Anaheim Ducks team ID
  const { data: ducks } = await supabase
    .from('teams')
    .select('id')
    .eq('external_id', 'espn_nhl_25')
    .single();
    
  if (!ducks) {
    console.error(chalk.red('Anaheim Ducks not found!'));
    return;
  }
  
  const teamId = ducks.id;
  console.log(chalk.green(`Found Anaheim Ducks: ID ${teamId}\n`));
  
  // Create player records
  const playersToInsert = [
    {
      external_id: 'espn_nhl_3114756',
      name: 'Sonny Milano',
      position: ['LW'],
      team_id: teamId,
      sport: 'NHL',
      jersey_number: 12,
      metadata: { espn_id: '3114756', collection_source: 'manual_fix' }
    },
    {
      external_id: 'espn_nhl_4024998',
      name: 'Sam Steel',
      position: ['C'],
      team_id: teamId,
      sport: 'NHL',
      jersey_number: 34,
      metadata: { espn_id: '4024998', collection_source: 'manual_fix' }
    },
    {
      external_id: 'espn_nhl_4565230',
      name: 'Trevor Zegras',
      position: ['C'],
      team_id: teamId,
      sport: 'NHL',
      jersey_number: 11,
      metadata: { espn_id: '4565230', collection_source: 'manual_fix' }
    },
    {
      external_id: 'espn_nhl_4697387',
      name: 'Jamie Drysdale',
      position: ['D'],
      team_id: teamId,
      sport: 'NHL',
      jersey_number: 6,
      metadata: { espn_id: '4697387', collection_source: 'manual_fix' }
    },
    {
      external_id: 'espn_nhl_5495',
      name: 'Cam Fowler',
      position: ['D'],
      team_id: teamId,
      sport: 'NHL',
      jersey_number: 4,
      metadata: { espn_id: '5495', collection_source: 'manual_fix' }
    },
    {
      external_id: 'espn_nhl_2590824',
      name: 'John Gibson',
      position: ['G'],
      team_id: teamId,
      sport: 'NHL',
      jersey_number: 36,
      metadata: { espn_id: '2590824', collection_source: 'manual_fix' }
    }
  ];
  
  console.log(chalk.yellow('Inserting missing players...\n'));
  
  for (const player of playersToInsert) {
    const { error } = await supabase
      .from('players')
      .insert([player]);
      
    if (error) {
      console.error(chalk.red(`Failed to insert ${player.name}:`), error.message);
    } else {
      console.log(chalk.green(`✅ Inserted ${player.name}`));
    }
  }
  
  // Final count
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL');
  
  console.log(chalk.cyan(`\nTotal NHL players in database: ${count}`));
}

collectSpecificPlayers()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });