#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  console.log(chalk.blue('\n🔍 Checking player_stats schema...\n'));
  
  // Get IDs for testing
  const { data: player } = await supabase.from('players').select('id').limit(1).single();
  const { data: game } = await supabase.from('games').select('id').limit(1).single();
  
  if (!player || !game) {
    console.log(chalk.red('Could not find player or game'));
    return;
  }
  
  // Try different schemas
  const schemas = [
    {
      name: 'Simple numeric columns',
      data: {
        player_id: player.id,
        game_id: game.id,
        points: 15.5,
        assists: 5,
        rebounds: 8
      }
    },
    {
      name: 'With stat_type',
      data: {
        player_id: player.id,
        game_id: game.id,
        stat_type: 'game',
        value: 20.5
      }
    },
    {
      name: 'Fantasy points only',
      data: {
        player_id: player.id,
        game_id: game.id,
        fantasy_points: 25.5
      }
    },
    {
      name: 'All stats columns',
      data: {
        player_id: player.id,
        game_id: game.id,
        passing_yards: 250,
        passing_tds: 2,
        rushing_yards: 30,
        rushing_tds: 0,
        receiving_yards: 0,
        receiving_tds: 0,
        fantasy_points: 22.0
      }
    }
  ];
  
  for (const schema of schemas) {
    console.log(chalk.yellow(`\nTrying: ${schema.name}`));
    console.log('Data:', JSON.stringify(schema.data, null, 2));
    
    const { data, error } = await supabase
      .from('player_stats')
      .insert(schema.data)
      .select();
      
    if (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
      if (error.details) console.log('Details:', error.details);
    } else {
      console.log(chalk.green('✅ Success!'));
      console.log('Inserted:', data);
      
      // Delete the test record
      if (data && data[0]) {
        await supabase.from('player_stats').delete().eq('id', data[0].id);
      }
      break;
    }
  }
  
  // If all failed, try to select to see what columns exist
  console.log(chalk.yellow('\n📋 Checking existing records...'));
  const { data: existing, error: selectError } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1);
    
  if (!selectError && existing) {
    if (existing.length > 0) {
      console.log('Existing record structure:', Object.keys(existing[0]));
    } else {
      console.log('No existing records to check structure');
    }
  }
}

checkSchema().catch(console.error);