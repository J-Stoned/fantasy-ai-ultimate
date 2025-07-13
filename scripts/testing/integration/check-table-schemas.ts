import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTableSchemas() {
  console.log('🔍 Checking Table Schemas...\n');

  // First, let's get a sample from each key table
  const tables = ['games', 'player_stats', 'teams', 'players'];
  
  for (const table of tables) {
    console.log(`\n📊 Table: ${table}`);
    console.log('='.repeat(50));
    
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.error(`Error fetching from ${table}:`, error);
      continue;
    }

    if (data && data.length > 0) {
      console.log('Columns:');
      Object.keys(data[0]).forEach(key => {
        const value = data[0][key];
        const type = value === null ? 'null' : typeof value;
        console.log(`  - ${key}: ${type}`);
      });
    } else {
      console.log('No data found in table');
    }
  }

  // Now let's check specific relationships
  console.log('\n\n🔗 Checking Relationships:');
  console.log('='.repeat(50));

  // Get a sample player_stat and trace its relationships
  const { data: sampleStat, error: statError } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1)
    .single();

  if (!statError && sampleStat) {
    console.log('\nSample player_stat:');
    console.log(`  ID: ${sampleStat.id}`);
    console.log(`  Game ID: ${sampleStat.game_id}`);
    console.log(`  Player ID: ${sampleStat.player_id}`);
    
    // Check if the game exists
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', sampleStat.game_id)
      .single();

    if (game) {
      console.log('\n✅ Found matching game:');
      console.log(`  Game ID: ${game.id}`);
      console.log(`  Sport: ${game.sport}`);
      console.log(`  Status: ${game.status}`);
    } else {
      console.log(`\n❌ No game found with ID: ${sampleStat.game_id}`);
      console.log(`  Error: ${gameError?.message}`);
    }
  }
}

checkTableSchemas().catch(console.error);