#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkColumns() {
  const { data, error } = await supabase.from('games').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Game columns:', Object.keys(data[0]));
  } else {
    console.log('Error:', error);
  }
}

checkColumns();