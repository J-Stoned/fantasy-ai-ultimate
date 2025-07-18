#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugDatabaseError() {
  try {
    // Get a valid team_id first
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('sport', 'NFL')
      .limit(1)
      .single();
      
    console.log('Found team:', team);
    
    if (!team) {
      console.log('No NFL teams found!');
      return;
    }
    
    const testPlayer = {
      external_id: 'espn_nfl_test123',
      name: 'Test Player',
      position: 'RB',
      team_id: team.id,
      sport: 'NFL',
      metadata: { test: true }
    };
    
    console.log('Attempting insert with:', testPlayer);
    
    const { error, data } = await supabase
      .from('players')
      .upsert([testPlayer], { 
        onConflict: 'external_id',
        ignoreDuplicates: true 
      });
      
    if (error) {
      console.log('Database error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('Test insert successful:', data);
      // Clean up test record
      await supabase.from('players').delete().eq('external_id', 'espn_nfl_test123');
      console.log('Cleanup complete');
    }
  } catch (e) {
    console.log('Caught error:', e);
  }
}

debugDatabaseError().catch(console.error);