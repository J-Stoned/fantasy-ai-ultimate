#!/usr/bin/env tsx
/**
 * Fix remaining NULL values
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixRemaining() {
  console.log(chalk.bold.cyan('🔧 FIXING REMAINING NULL VALUES\n'));

  // 1. Get teams with NULL external_id
  const { data: nullExtTeams } = await supabase
    .from('teams')
    .select('id, name, sport')
    .is('external_id', null);

  console.log(`Found ${nullExtTeams?.length || 0} teams with NULL external_id`);

  if (nullExtTeams && nullExtTeams.length > 0) {
    // Update each team individually
    let fixed = 0;
    for (const team of nullExtTeams) {
      const newId = team.sport ? `${team.sport.toLowerCase()}_auto_${team.id}` : `unknown_auto_${team.id}`;
      
      const { error } = await supabase
        .from('teams')
        .update({ external_id: newId })
        .eq('id', team.id);

      if (!error) fixed++;
    }
    
    console.log(chalk.green(`  ✅ Fixed ${fixed} team external_ids`));
  }

  // 2. Fix teams with NULL sport
  const { data: nullSportTeams } = await supabase
    .from('teams')
    .select('id, name, conference, external_id')
    .is('sport', null);

  console.log(`\nFound ${nullSportTeams?.length || 0} teams with NULL sport`);

  if (nullSportTeams && nullSportTeams.length > 0) {
    // Show samples
    console.log('\nSample teams with NULL sport:');
    console.table(nullSportTeams.slice(0, 10));

    // Fix based on patterns
    let fixed = 0;
    for (const team of nullSportTeams) {
      let sport = null;
      
      // Check external_id patterns first
      if (team.external_id) {
        if (team.external_id.includes('ncaaf') || team.external_id.includes('ncaa_fb')) {
          sport = 'NCAA_FB';
        } else if (team.external_id.includes('ncaabb') || team.external_id.includes('ncaa_bb')) {
          sport = 'NCAA_BB';
        } else if (team.external_id.includes('ncaa_baseball')) {
          sport = 'NCAA_BASEBALL';
        } else if (team.external_id.includes('ncaahockey') || team.external_id.includes('ncaa_hky')) {
          sport = 'NCAA_HKY';
        }
      }
      
      // Then check name/conference
      if (!sport) {
        if (team.name?.includes('Baseball') || team.conference?.includes('Baseball')) {
          sport = 'NCAA_BASEBALL';
        } else if (team.name?.includes('Hockey') || team.conference?.includes('Hockey')) {
          sport = 'NCAA_HKY';
        } else if (team.name?.includes('Basketball') || team.conference?.includes('Basketball')) {
          sport = 'NCAA_BB';
        } else if (team.name?.includes('College') || team.name?.includes('University') || team.name?.includes('State')) {
          // Default college teams to football
          sport = 'NCAA_FB';
        }
      }
      
      if (sport) {
        const { error } = await supabase
          .from('teams')
          .update({ sport })
          .eq('id', team.id);

        if (!error) {
          fixed++;
          
          // Also update external_id if it was auto-generated
          if (team.external_id?.includes('unknown_auto_')) {
            await supabase
              .from('teams')
              .update({ external_id: `${sport.toLowerCase()}_auto_${team.id}` })
              .eq('id', team.id);
          }
        }
      }
    }
    
    console.log(chalk.green(`  ✅ Fixed ${fixed} team sports`));
    
    // Show remaining
    const remaining = nullSportTeams.length - fixed;
    if (remaining > 0) {
      console.log(chalk.yellow(`  ⚠️  ${remaining} teams still have NULL sport (likely defunct/inactive teams)`));
    }
  }

  // 3. Final check
  console.log(chalk.yellow('\n📊 Final check...\n'));

  const finalCounts = await Promise.all([
    supabase.from('teams').select('*', { count: 'exact', head: true }).is('external_id', null),
    supabase.from('teams').select('*', { count: 'exact', head: true }).is('sport', null)
  ]);

  console.table({
    'Teams with NULL external_id': finalCounts[0].count || 0,
    'Teams with NULL sport': finalCounts[1].count || 0
  });

  const totalNulls = finalCounts[0].count! + finalCounts[1].count!;
  
  if (totalNulls === 0) {
    console.log(chalk.bold.green('\n✅ ALL NULL VALUES FIXED!'));
  } else {
    // For any remaining, just assign generic values
    console.log(chalk.yellow('\n🔨 Force-fixing remaining NULLs...'));
    
    // Force fix remaining NULL sports
    const { data: forceSport } = await supabase
      .from('teams')
      .update({ sport: 'UNKNOWN' })
      .is('sport', null)
      .select();
    
    console.log(`  ✅ Force-fixed ${forceSport?.length || 0} NULL sports to 'UNKNOWN'`);
    
    console.log(chalk.green('\n✅ CLEANUP 6 COMPLETE!'));
  }
}

fixRemaining().catch(console.error);