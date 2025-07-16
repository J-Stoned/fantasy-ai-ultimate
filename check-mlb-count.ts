#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkPlayers() {
  const { count: mlbCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
  
  const { count: nflCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');
  
  const { count: nhlCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL');
  
  const { count: nbaCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
  
  console.log('✅ MLB players:', mlbCount || 0);
  console.log('✅ NFL players:', nflCount || 0);
  console.log('⚠️ NHL players:', nhlCount || 0);
  console.log('⚠️ NBA players:', nbaCount || 0);
  console.log('🎯 Total Phase 1 players:', (mlbCount || 0) + (nflCount || 0) + (nhlCount || 0) + (nbaCount || 0));
}

checkPlayers().then(() => process.exit(0)).catch(console.error);