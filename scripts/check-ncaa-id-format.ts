#!/usr/bin/env tsx
/**
 * Check NCAA ID formats
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNcaaFormats() {
  console.log(chalk.bold.cyan('🔍 CHECKING NCAA ID FORMATS\n'));

  // Check NCAA_FB
  console.log(chalk.yellow('NCAA_FB External IDs:'));
  const { data: ncaaFbGames } = await supabase
    .from('games')
    .select('external_id')
    .eq('sport', 'NCAA_FB')
    .limit(5);

  ncaaFbGames?.forEach(g => {
    console.log(`  ${g.external_id}`);
  });

  // Check NCAA_BB
  console.log(chalk.yellow('\nNCAA_BB External IDs:'));
  const { data: ncaaBbGames } = await supabase
    .from('games')
    .select('external_id')
    .eq('sport', 'NCAA_BB')
    .limit(5);

  ncaaBbGames?.forEach(g => {
    console.log(`  ${g.external_id}`);
  });

  // Check teams
  console.log(chalk.yellow('\nNCAA_FB Teams:'));
  const { data: ncaaFbTeams } = await supabase
    .from('teams')
    .select('external_id, sport')
    .eq('sport', 'NCAA_FB')
    .limit(5);

  ncaaFbTeams?.forEach(t => {
    console.log(`  ${t.external_id}`);
  });

  // Check players
  console.log(chalk.yellow('\nNCAA_BB Players:'));
  const { data: ncaaBbPlayers } = await supabase
    .from('players')
    .select('external_id, sport')
    .eq('sport', 'NCAA_BB')
    .limit(5);

  ncaaBbPlayers?.forEach(p => {
    console.log(`  ${p.external_id}`);
  });

  // Check the issue
  console.log(chalk.red('\n⚠️  ISSUE IDENTIFIED:'));
  console.log('NCAA sports are using "ncaaf" and "ncaabb" in external IDs');
  console.log('But the sport field uses "NCAA_FB" and "NCAA_BB"');
  console.log('The analyzer expects: espn_ncaa_fb_* and espn_ncaa_bb_*');
}

checkNcaaFormats().catch(console.error);