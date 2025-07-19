#!/usr/bin/env tsx
/**
 * Direct ID standardization updates using Supabase admin client
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

// Create admin client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log(chalk.bold.cyan('🏆 DIRECT ID STANDARDIZATION\n'));

  try {
    // 1. Fix misclassified college teams
    console.log(chalk.yellow('📚 Step 1: Fixing misclassified college teams...'));
    
    // Fix specific teams we know are wrong
    const updates = [
      { external_id: '26', sport: 'NCAA_BB' },     // UCLA Bruins
      { external_id: '2', sport: 'NCAA_BB' },      // Auburn Tigers  
      { external_id: '8', sport: 'NCAA_BB' },      // Arkansas Razorbacks
    ];

    for (const update of updates) {
      const { data, error } = await supabase
        .from('teams')
        .update({ sport: update.sport })
        .eq('external_id', update.external_id)
        .eq('sport', 'NBA')
        .select();
      
      if (data && data.length > 0) {
        console.log(`  ✅ Fixed ${data[0].name} -> ${update.sport}`);
      }
    }

    // Fix all remaining college teams
    const { data: collegeFix } = await supabase
      .from('teams')
      .update({ sport: 'NCAA_BB' })
      .eq('sport', 'NBA')
      .or('name.ilike.%University%,name.ilike.%College%,name.ilike.%State%')
      .select();
    
    console.log(`  ✅ Fixed ${collegeFix?.length || 0} additional college teams`);

    // 2. Check current state
    console.log(chalk.yellow('\n📊 Step 2: Checking current state...'));
    
    const { data: numericTeams } = await supabase
      .from('teams')
      .select('id, name, sport, external_id')
      .filter('external_id', 'match', '^[0-9]+$');
    
    console.log(`Found ${numericTeams?.length || 0} teams with numeric IDs`);
    if (numericTeams && numericTeams.length > 0) {
      console.table(numericTeams.slice(0, 10));
    }

    // 3. Fix numeric IDs one by one to handle conflicts
    console.log(chalk.yellow('\n🔧 Step 3: Fixing numeric IDs...'));
    
    let fixedCount = 0;
    let conflictCount = 0;
    
    for (const team of numericTeams || []) {
      if (!team.sport) continue;
      
      const newId = `espn_${team.sport.toLowerCase()}_${team.external_id}`;
      
      // Check if new ID already exists
      const { data: existing } = await supabase
        .from('teams')
        .select('id')
        .eq('external_id', newId)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('teams')
          .update({ external_id: newId })
          .eq('id', team.id);
        
        if (!error) {
          fixedCount++;
        } else {
          console.error(`  ❌ Error fixing team ${team.id}: ${error.message}`);
        }
      } else {
        conflictCount++;
      }
    }
    
    console.log(`  ✅ Fixed ${fixedCount} team IDs`);
    console.log(`  ⚠️  ${conflictCount} conflicts skipped`);

    // 4. NCAA Baseball fixes
    console.log(chalk.yellow('\n⚾ Step 4: Fixing NCAA Baseball IDs...'));
    
    // Count how many need fixing
    const { count: ncaaCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%');
    
    console.log(`Found ${ncaaCount || 0} NCAA Baseball players to fix`);
    
    if (ncaaCount && ncaaCount > 0) {
      // Process in batches
      const batchSize = 100;
      let processedCount = 0;
      
      for (let offset = 0; offset < ncaaCount; offset += batchSize) {
        const { data: batch } = await supabase
          .from('players')
          .select('id, external_id')
          .eq('sport', 'NCAA_BASEBALL')
          .like('external_id', 'espn_ncaa_%')
          .not('external_id', 'like', 'espn_ncaa_baseball_%')
          .range(offset, offset + batchSize - 1);
        
        if (!batch || batch.length === 0) break;
        
        for (const player of batch) {
          const newId = player.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_');
          
          // Check for conflict
          const { data: existing } = await supabase
            .from('players')
            .select('id')
            .eq('external_id', newId)
            .single();
          
          if (!existing) {
            await supabase
              .from('players')
              .update({ external_id: newId })
              .eq('id', player.id);
            
            processedCount++;
          }
        }
        
        // Show progress
        if (processedCount % 500 === 0) {
          console.log(`  Processed ${processedCount}/${ncaaCount} players...`);
        }
      }
      
      console.log(`  ✅ Fixed ${processedCount} NCAA Baseball player IDs`);
    }

    // 5. Final summary
    console.log(chalk.yellow('\n📊 Final Summary:'));
    
    const { count: remainingNumeric } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .filter('external_id', 'match', '^[0-9]+$');
    
    const { count: remainingNcaa } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%');
    
    console.log(`  Remaining numeric team IDs: ${remainingNumeric || 0}`);
    console.log(`  Remaining NCAA Baseball fixes needed: ${remainingNcaa || 0}`);
    
    console.log(chalk.green('\n✅ ID standardization complete!'));

  } catch (error: any) {
    console.error(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

main();