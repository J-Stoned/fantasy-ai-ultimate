import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config(); // Also try .env

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function runCleanup() {
  console.log('🏆 STEP 5: STANDARDIZE ESPN IDS');
  console.log('='.repeat(60));

  try {
    // 1. Find misclassified college teams
    console.log('\n📋 Finding misclassified college teams...');
    const { data: misclassified, error: err1 } = await supabase
      .from('teams')
      .select('id, name, sport, external_id')
      .in('sport', ['NBA', 'NFL', 'MLB', 'NHL'])
      .or(`name.ilike.%University%,name.ilike.%College%,name.ilike.%State%,name.in.(UCLA Bruins,Auburn Tigers,Arkansas Razorbacks,USC Trojans,Arizona State Sun Devils,UAB Blazers,Stanford Cardinal,UC San Diego Tritons,California Golden Bears,Boston College Eagles)`);
    
    if (err1) throw err1;
    
    console.log(`Found ${misclassified?.length || 0} misclassified teams`);
    if (misclassified && misclassified.length > 0) {
      console.table(misclassified.slice(0, 10));
    }

    // 2. Fix misclassified college teams
    console.log('\n🔧 Fixing misclassified college teams...');
    
    // Fix NBA -> NCAA_BB
    const { data: nbaFix, error: err2 } = await supabase
      .from('teams')
      .update({ sport: 'NCAA_BB' })
      .eq('sport', 'NBA')
      .or(`name.ilike.%University%,name.ilike.%College%,name.ilike.%State%,name.in.(UCLA Bruins,Auburn Tigers,Arkansas Razorbacks,USC Trojans,Arizona State Sun Devils,UAB Blazers,Stanford Cardinal,UC San Diego Tritons,California Golden Bears,Boston College Eagles)`)
      .select();
    
    if (err2) throw err2;
    console.log(`Fixed ${nbaFix?.length || 0} NBA -> NCAA_BB teams`);

    // Fix NFL -> NCAA_FB
    const { data: nflFix, error: err3 } = await supabase
      .from('teams')
      .update({ sport: 'NCAA_FB' })
      .eq('sport', 'NFL')
      .or(`name.ilike.%University%,name.ilike.%College%,name.ilike.%State%`)
      .select();
    
    if (err3) throw err3;
    console.log(`Fixed ${nflFix?.length || 0} NFL -> NCAA_FB teams`);

    // 3. Get all numeric team IDs
    console.log('\n🔍 Finding numeric team IDs...');
    const { data: numericTeams, error: err4 } = await supabase
      .from('teams')
      .select('id, name, sport, external_id')
      .not('external_id', 'is', null);
    
    if (err4) throw err4;
    
    const teamsToUpdate = numericTeams?.filter(t => /^\d+$/.test(t.external_id)) || [];
    console.log(`Found ${teamsToUpdate.length} teams with numeric IDs`);

    // Check for conflicts and update
    let updatedCount = 0;
    for (const team of teamsToUpdate) {
      if (!team.sport) continue; // Skip teams with null sport
      const proposedId = `espn_${team.sport.toLowerCase()}_${team.external_id}`;
      
      // Check if proposed ID already exists
      const { data: existing } = await supabase
        .from('teams')
        .select('id')
        .eq('external_id', proposedId)
        .neq('id', team.id)
        .single();
      
      if (!existing) {
        // No conflict, update
        const { error } = await supabase
          .from('teams')
          .update({ external_id: proposedId })
          .eq('id', team.id);
        
        if (!error) updatedCount++;
      }
    }
    console.log(`Updated ${updatedCount} team IDs`);

    // 4. Do the same for players
    console.log('\n🔧 Updating players with numeric IDs...');
    const { data: numericPlayers, error: err5 } = await supabase
      .from('players')
      .select('id, sport, external_id')
      .not('external_id', 'is', null)
      .not('sport', 'is', null);
    
    if (err5) throw err5;
    
    const playersToUpdate = numericPlayers?.filter(p => /^\d+$/.test(p.external_id)) || [];
    console.log(`Found ${playersToUpdate.length} players with numeric IDs`);

    let playerUpdateCount = 0;
    for (const player of playersToUpdate.slice(0, 100)) { // Process first 100 to avoid timeout
      if (!player.sport) continue; // Skip players with null sport
      const proposedId = `espn_${player.sport.toLowerCase()}_${player.external_id}`;
      
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('external_id', proposedId)
        .neq('id', player.id)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('players')
          .update({ external_id: proposedId })
          .eq('id', player.id);
        
        if (!error) playerUpdateCount++;
      }
    }
    console.log(`Updated ${playerUpdateCount} player IDs (first batch)`);

    // 5. NCAA Baseball fixes
    console.log('\n🔧 Fixing NCAA Baseball IDs...');
    const { data: ncaaBaseball, error: err6 } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%');
    
    if (err6) throw err6;
    
    console.log(`Found ${ncaaBaseball?.length || 0} NCAA Baseball players to fix`);

    let ncaaFixCount = 0;
    for (const player of ncaaBaseball || []) {
      const newId = player.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_');
      
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('external_id', newId)
        .neq('id', player.id)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('players')
          .update({ external_id: newId })
          .eq('id', player.id);
        
        if (!error) ncaaFixCount++;
      }
    }
    console.log(`Fixed ${ncaaFixCount} NCAA Baseball player IDs`);

    // 6. Final summary
    console.log('\n📊 ID Standardization Summary:');
    
    // Count standardized IDs
    const { count: standardizedCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .like('external_id', 'espn_%_%');
    
    console.log(`Total standardized team IDs: ${standardizedCount || 0}`);

    // Count remaining numeric IDs
    const { data: remainingNumeric } = await supabase
      .from('teams')
      .select('id, name, sport, external_id')
      .not('external_id', 'is', null);
    
    const stillNumeric = remainingNumeric?.filter(t => /^\d+$/.test(t.external_id)) || [];
    
    if (stillNumeric.length > 0) {
      console.log(`\n⚠️  Still ${stillNumeric.length} teams with numeric IDs (may have conflicts):`);
      console.table(stillNumeric.slice(0, 5));
    }

    console.log('\n✅ ID standardization complete!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.details) console.error('Details:', error.details);
    process.exit(1);
  }
}

runCleanup();