import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTrueTotal() {
  console.log(chalk.cyan('🔍 Checking TRUE stats total...\n'));
  
  // Get all unique sports from players
  const { data: sports } = await supabase
    .from('players')
    .select('sport')
    .not('sport', 'is', null);
    
  const uniqueSports = [...new Set(sports?.map(s => s.sport) || [])];
  console.log(chalk.yellow(`Found ${uniqueSports.length} sports\n`));
  
  let grandTotal = 0;
  const sportTotals: any = {};
  
  for (const sport of uniqueSports) {
    // Get ALL player IDs for this sport
    let allPlayerIds: number[] = [];
    let offset = 0;
    
    while (true) {
      const { data: batch } = await supabase
        .from('players')
        .select('id')
        .eq('sport', sport)
        .range(offset, offset + 999);
        
      if (!batch || batch.length === 0) break;
      allPlayerIds = allPlayerIds.concat(batch.map(p => p.id));
      offset += 1000;
    }
    
    // Count stats for these players
    let sportTotal = 0;
    for (let i = 0; i < allPlayerIds.length; i += 500) {
      const batch = allPlayerIds.slice(i, i + 500);
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('player_id', batch);
        
      sportTotal += count || 0;
    }
    
    sportTotals[sport] = sportTotal;
    grandTotal += sportTotal;
    console.log(`${sport}: ${sportTotal.toLocaleString()} stats (${allPlayerIds.length} players)`);
  }
  
  console.log(chalk.green(`\nGRAND TOTAL: ${grandTotal.toLocaleString()}`));
  
  // Double check with direct count
  const { count: dbTotal } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.yellow(`Database total: ${dbTotal?.toLocaleString()}`));
  
  if (dbTotal !== grandTotal) {
    const difference = (dbTotal || 0) - grandTotal;
    console.log(chalk.red(`\n⚠️  MISMATCH: ${difference.toLocaleString()} stats unaccounted for`));
    console.log('Possible reasons:');
    console.log('- Stats with player_id = NULL');
    console.log('- Stats for deleted players');
    console.log('- Data integrity issues');
    
    // Check for null player_ids
    const { count: nullCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .is('player_id', null);
      
    if (nullCount) {
      console.log(chalk.red(`\nFound ${nullCount} stats with NULL player_id!`));
    }
  } else {
    console.log(chalk.green('\n✅ Counts match perfectly!'));
  }
  
  // Show what we collected for MiLB
  console.log(chalk.cyan('\n📊 MiLB Collection Summary:'));
  console.log(`MiLB stats: ${sportTotals['MILB']?.toLocaleString() || 0}`);
  
  // NCAA Baseball check
  console.log(chalk.cyan('\n📊 NCAA Baseball Check:'));
  console.log(`NCAA_BASEBALL stats: ${sportTotals['NCAA_BASEBALL']?.toLocaleString() || 0}`);
  if (sportTotals['NCAA_BASEBALL'] === 0) {
    console.log(chalk.red('⚠️  NCAA Baseball stats missing! They may have been deleted.'));
  }
}

checkTrueTotal().catch(console.error);