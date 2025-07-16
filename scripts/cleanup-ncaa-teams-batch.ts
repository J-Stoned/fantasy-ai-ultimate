#!/usr/bin/env tsx
/**
 * Clean up NCAA Football teams in small batches to avoid timeouts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupTeams() {
  let totalDeleted = 0;
  
  while (true) {
    // Get a small batch of teams
    const { data: teams, error: fetchError } = await supabase
      .from('teams')
      .select('id')
      .eq('sport', 'NCAA_FB')
      .limit(50);
    
    if (fetchError) {
      console.error('Error fetching teams:', fetchError);
      break;
    }
    
    if (!teams || teams.length === 0) {
      console.log('No more teams to delete');
      break;
    }
    
    // Delete this batch
    const teamIds = teams.map(t => t.id);
    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .in('id', teamIds);
    
    if (deleteError) {
      console.error('Error deleting batch:', deleteError);
      break;
    }
    
    totalDeleted += teams.length;
    console.log(`Deleted ${teams.length} teams, total: ${totalDeleted}`);
    
    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✅ Cleanup complete! Total teams deleted: ${totalDeleted}`);
}

cleanupTeams().catch(console.error);