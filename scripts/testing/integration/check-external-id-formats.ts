#!/usr/bin/env tsx
/**
 * Check external_id format patterns to understand the mismatch
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkExternalIdFormats() {
  console.log(chalk.bold.cyan('\n🔍 EXTERNAL ID FORMAT ANALYSIS\n'));

  try {
    // Get sample external_ids from 2024 NFL games
    const { data: sampleIds } = await supabase
      .from('games')
      .select('external_id')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('external_id', 'is', null)
      .limit(20);
    
    console.log(chalk.yellow('Sample 2024 NFL external_ids:'));
    const formatCounts: Record<string, number> = {};
    
    sampleIds?.forEach(game => {
      const id = game.external_id;
      console.log(`  ${id}`);
      
      // Categorize format
      if (id.startsWith('espn_')) {
        formatCounts['espn_'] = (formatCounts['espn_'] || 0) + 1;
      } else if (id.startsWith('nfl_')) {
        formatCounts['nfl_'] = (formatCounts['nfl_'] || 0) + 1;
      } else {
        formatCounts['other'] = (formatCounts['other'] || 0) + 1;
      }
    });
    
    console.log(chalk.yellow('\nFormat distribution:'));
    Object.entries(formatCounts).forEach(([format, count]) => {
      console.log(`  ${format}: ${count} games`);
    });
    
    // Check collector's regex
    console.log(chalk.yellow('\nTesting collector regex:'));
    
    const testIds = ['nfl_401671698', 'espn_401671698', 'espn_nfl_401671698'];
    const regex = /^espn_(?:nfl_|nba_|mlb_|nhl_)?/;
    
    testIds.forEach(id => {
      const extracted = id.replace(regex, '');
      console.log(`  "${id}" → "${extracted}"`);
    });
    
    // Check what the collector should extract
    console.log(chalk.yellow('\nImproved extraction:'));
    
    testIds.concat(['nfl_401671698']).forEach(id => {
      // Better regex that handles both nfl_ and espn_ prefixes
      const extracted = id.replace(/^(?:espn_)?(?:nfl_|nba_|mlb_|nhl_)/, '');
      console.log(`  "${id}" → "${extracted}"`);
    });
    
    console.log(chalk.bold.green('\n💡 SOLUTION:'));
    console.log('Update collector regex from:');
    console.log(chalk.red('  /^espn_(?:nfl_|nba_|mlb_|nhl_)?/'));
    console.log('To:');
    console.log(chalk.green('  /^(?:espn_)?(?:nfl_|nba_|mlb_|nhl_)/'));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

checkExternalIdFormats();