#!/usr/bin/env tsx
/**
 * Test different approaches to load all players from Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Test different approaches to get all players
async function testAllApproaches() {
  console.log('Testing different approaches to get all players...\n');
  
  // 1. Get total count first
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null);
    
  console.log('Total players with external_id:', count);
  
  // 2. Try with limit(10000)
  const { data: limitData } = await supabase
    .from('players')
    .select('id, external_id')
    .not('external_id', 'is', null)
    .limit(10000);
    
  console.log('With limit(10000):', limitData?.length, 'players');
  
  // 3. Try with range properly (end is inclusive)
  const { data: rangeData } = await supabase
    .from('players')
    .select('id, external_id')
    .not('external_id', 'is', null)
    .range(0, 9999);
    
  console.log('With range(0, 9999):', rangeData?.length, 'players');
  
  // 4. Try getting all with proper range
  const { data: allData } = await supabase
    .from('players')
    .select('id, external_id')
    .not('external_id', 'is', null)
    .range(0, 25000);
    
  console.log('With range(0, 25000):', allData?.length, 'players');
  
  // 5. Check if pagination is needed
  console.log('\nChecking pagination...');
  const pageSize = 1000;
  let offset = 0;
  let totalFetched = 0;
  
  while (offset < count!) {
    const { data: pageData } = await supabase
      .from('players')
      .select('id, external_id')
      .not('external_id', 'is', null)
      .range(offset, offset + pageSize - 1);
      
    if (!pageData || pageData.length === 0) break;
    
    totalFetched += pageData.length;
    console.log(`Page ${Math.floor(offset/pageSize) + 1}: fetched ${pageData.length} players (total: ${totalFetched})`);
    
    if (pageData.length < pageSize) break;
    offset += pageSize;
  }
  
  console.log('\nTotal fetched with pagination:', totalFetched);
}

testAllApproaches().catch(console.error);