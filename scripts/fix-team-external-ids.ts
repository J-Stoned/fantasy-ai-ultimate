#!/usr/bin/env tsx
/**
 * 🔧 FIX TEAM EXTERNAL IDS
 * 
 * Updates existing teams with ESPN external IDs so the universal collector can work
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixTeamExternalIds() {
  console.log(chalk.bold.cyan('🔧 FIXING TEAM EXTERNAL IDS'));
  
  const sports = ['NBA', 'NFL', 'MLB', 'NHL'];
  
  for (const sport of sports) {
    console.log(chalk.cyan(`\n📊 Processing ${sport} teams...`));
    
    try {
      // Get ESPN teams for this sport
      const espnSport = getESPNSport(sport);
      const response = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams`);
      
      if (response.data.sports?.[0]?.leagues?.[0]?.teams) {
        const espnTeams = response.data.sports[0].leagues[0].teams;
        
        // Get existing teams from our database
        const { data: dbTeams } = await supabase
          .from('teams')
          .select('id, name, abbreviation, external_id')
          .eq('sport', sport);
        
        if (!dbTeams) continue;
        
        let updated = 0;
        
        for (const dbTeam of dbTeams) {
          if (dbTeam.external_id) continue; // Skip teams that already have external IDs
          
          // Find matching ESPN team
          const espnTeam = espnTeams.find((et: any) => 
            et.team.displayName.toLowerCase().includes(dbTeam.name.toLowerCase()) ||
            et.team.location?.toLowerCase().includes(dbTeam.name.toLowerCase()) ||
            et.team.abbreviation === dbTeam.abbreviation
          );
          
          if (espnTeam) {
            const externalId = `espn_${sport.toLowerCase()}_${espnTeam.team.id}`;
            
            const { error } = await supabase
              .from('teams')
              .update({ external_id: externalId })
              .eq('id', dbTeam.id);
            
            if (!error) {
              console.log(chalk.green(`  ✅ ${dbTeam.name} → ${externalId}`));
              updated++;
            } else {
              console.error(chalk.red(`  ❌ ${dbTeam.name}: ${error.message}`));
            }
          } else {
            console.log(chalk.yellow(`  ⚠️  No match found for ${dbTeam.name}`));
          }
        }
        
        console.log(chalk.green(`  Updated ${updated} ${sport} teams`));
      }
      
    } catch (error) {
      console.error(chalk.red(`Error processing ${sport}:`, error));
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(chalk.bold.green('\n✅ TEAM EXTERNAL IDS FIXED!'));
}

function getESPNSport(sport: string): string {
  const mapping: Record<string, string> = {
    'NFL': 'football/nfl',
    'NBA': 'basketball/nba',
    'MLB': 'baseball/mlb',
    'NHL': 'hockey/nhl'
  };
  return mapping[sport] || sport.toLowerCase();
}

fixTeamExternalIds().catch(console.error);