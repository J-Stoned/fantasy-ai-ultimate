#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteDuplicates() {
  // Get just the IDs
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .in('sport', ['NCAAF', 'NCAAB']);
    
  if (!teams || teams.length === 0) {
    console.log('No duplicates found');
    return;
  }
  
  console.log('Found', teams.length, 'teams to delete');
  console.log('Deleting in small batches...');
  
  // Delete in batches of 10
  const batchSize = 10;
  let deleted = 0;
  
  for (let i = 0; i < teams.length; i += batchSize) {
    const batch = teams.slice(i, i + batchSize);
    const ids = batch.map(t => t.id);
    
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .in('id', ids);
        
      if (!error) {
        deleted += batch.length;
        process.stdout.write(`\rDeleted: ${deleted}/${teams.length}`);
      } else {
        console.error('Batch error:', error.message);
      }
    } catch (e) {
      console.error('Error:', e);
    }
    
    // Small delay to avoid overwhelming DB
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\nTotal deleted:', deleted);
}

deleteDuplicates().catch(console.error);