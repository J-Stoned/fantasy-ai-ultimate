#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeTeams() {
  // Check different external_id patterns
  const patterns = [
    { pattern: 'espn_ncaa_fb_%', sport: 'NCAA_FB' },
    { pattern: 'espn_ncaa_bb_%', sport: 'NCAA_BB' },
    { pattern: 'espn_ncaa_baseball_%', sport: 'NCAA_BASEBALL' },
    { pattern: 'espn_%', sport: 'ALL' }
  ];
  
  console.log(chalk.cyan('\n🔍 Analyzing NCAA team external_id patterns:\n'));
  
  for (const p of patterns) {
    const { count } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .ilike('external_id', p.pattern);
      
    console.log(chalk.yellow(p.pattern + ':'), count || 0);
  }
  
  // Check teams that might be NCAA but have wrong format
  const { data: wrongFormat } = await supabase
    .from('teams')
    .select('external_id, sport, name')
    .in('sport', ['NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL'])
    .not('external_id', 'ilike', 'espn_ncaa_%')
    .limit(10);
    
  console.log(chalk.red('\n❌ Teams with wrong external_id format:'));
  wrongFormat?.forEach(t => console.log('  ', t.external_id, '-', t.sport, '-', t.name));
  
  // Count total wrong format
  const { count: wrongCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .in('sport', ['NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL'])
    .not('external_id', 'ilike', 'espn_ncaa_%');
    
  console.log(chalk.red('\nTotal wrong format:'), wrongCount || 0);
  
  // Check if we have NCAA_FB teams with correct format
  const { data: correctFB } = await supabase
    .from('teams')
    .select('external_id, name')
    .eq('sport', 'NCAA_FB')
    .ilike('external_id', 'espn_ncaa_fb_%')
    .limit(5);
    
  console.log(chalk.green('\n✅ NCAA_FB teams with correct format:'));
  correctFB?.forEach(t => console.log('  ', t.external_id, '-', t.name));
}

analyzeTeams().catch(console.error);