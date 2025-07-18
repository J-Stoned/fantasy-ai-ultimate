#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPlayerSchema() {
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('sport', 'NFL')
    .limit(1)
    .single();
    
  console.log('Sample NFL player schema:');
  console.log(JSON.stringify(player, null, 2));
}

checkPlayerSchema().catch(console.error);