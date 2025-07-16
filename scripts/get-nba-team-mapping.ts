#!/usr/bin/env tsx
/**
 * Get NBA team mapping from database
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getTeamMapping() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id')
    .eq('sport', 'NBA')
    .order('name');
  
  console.log('// Team mapping (ESPN ID to our database ID)');
  console.log('const TEAM_MAPPING: Record<string, number> = {');
  
  teams?.forEach(team => {
    if (team.external_id) {
      const espnId = team.external_id.replace('espn_nba_', '');
      console.log(`  '${espnId}': ${team.id}, // ${team.name}`);
    }
  });
  
  console.log('};');
}

getTeamMapping().catch(console.error);