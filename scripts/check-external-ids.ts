#!/usr/bin/env tsx

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';

async function checkExternalIds() {
  // Check external_id format
  const { data } = await enhancedDb.getClient()
    .from('games')
    .select('id, external_id, sport')
    .not('external_id', 'is', null)
    .limit(20);

  console.log(chalk.cyan('Sample external IDs:'));
  data?.forEach(g => {
    console.log(`${g.sport}: ${g.external_id}`);
  });

  // Check for ESPN formatted IDs
  const espnGames = data?.filter(g => g.external_id?.includes('espn_'));
  console.log(chalk.yellow(`\nESPN games found: ${espnGames?.length || 0}`));
}

checkExternalIds().catch(console.error);