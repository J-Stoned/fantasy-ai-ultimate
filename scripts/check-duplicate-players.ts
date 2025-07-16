#!/usr/bin/env tsx
/**
 * 🔍 Check for duplicate players in database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDuplicatePlayers() {
  console.log('🔍 CHECKING FOR DUPLICATE PLAYERS\n');
  
  // Check for players with duplicate external_ids
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, external_id, name, sport_id, team_id');
  
  if (!allPlayers) {
    console.log('No players found');
    return;
  }
  
  // Group by external_id
  const extIdGroups = new Map<string, any[]>();
  allPlayers.forEach(p => {
    if (!extIdGroups.has(p.external_id)) {
      extIdGroups.set(p.external_id, []);
    }
    extIdGroups.get(p.external_id)!.push(p);
  });
  
  // Find duplicates
  const duplicateExtIds: any[] = [];
  extIdGroups.forEach((players, extId) => {
    if (players.length > 1) {
      duplicateExtIds.push({ extId, players });
    }
  });
  
  if (duplicateExtIds.length > 0) {
    console.log(`❌ Found ${duplicateExtIds.length} duplicate external_ids:\n`);
    duplicateExtIds.slice(0, 10).forEach(({ extId, players }) => {
      console.log(`External ID: ${extId}`);
      players.forEach((p: any) => console.log(` - ${p.name} | ${p.sport_id} | ID: ${p.id}`));
      console.log();
    });
  } else {
    console.log('✅ No duplicate external_ids found!');
  }
  
  // Check for players with same name in same sport
  console.log('\n🔍 Checking for duplicate names within sports...\n');
  
  const sports = ['nba', 'mlb', 'nfl', 'nhl'];
  for (const sport of sports) {
    const { data: sportPlayers } = await supabase
      .from('players')
      .select('id, name, team_id')
      .or(`sport_id.eq.${sport},sport_id.eq.${sport.toUpperCase()}`);
    
    if (!sportPlayers) continue;
    
    // Group by name
    const nameGroups = new Map<string, any[]>();
    sportPlayers.forEach(p => {
      if (!nameGroups.has(p.name)) {
        nameGroups.set(p.name, []);
      }
      nameGroups.get(p.name)!.push(p);
    });
    
    // Find duplicates
    const duplicateNames: any[] = [];
    nameGroups.forEach((players, name) => {
      if (players.length > 1) {
        duplicateNames.push({ name, players });
      }
    });
    
    if (duplicateNames.length > 0) {
      console.log(`❌ ${sport.toUpperCase()}: ${duplicateNames.length} duplicate names`);
      duplicateNames.slice(0, 3).forEach(({ name, players }) => {
        console.log(`   - ${name} (appears ${players.length} times)`);
        players.forEach((p: any) => console.log(`     - Team ID: ${p.team_id}, Player ID: ${p.id}`));
      });
    } else {
      console.log(`✅ ${sport.toUpperCase()}: No duplicate names`);
    }
  }
  
  // Summary
  console.log('\n📊 DUPLICATE CHECK SUMMARY:');
  console.log(`- Total players: ${allPlayers.length}`);
  console.log(`- Duplicate external_ids: ${duplicateExtIds.length}`);
  console.log(`- Unique external_ids: ${extIdGroups.size}`);
}

checkDuplicatePlayers().catch(console.error);