#!/usr/bin/env tsx
/**
 * 🏀 NCAA BASKETBALL TEAMS COLLECTOR
 * Applies ALL lessons learned from NCAA Football collection
 * - Uses espn_ncaabb_ external ID prefix
 * - Validates roster availability before inserting
 * - Uses 900-record insert batches
 * - Proper error handling and concurrent requests
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Team {
  id: string;
  name: string;
  displayName: string;
  abbreviation: string;
  logos: any[];
  location: string;
  conference?: string;
  division?: string;
}

async function testRosterAvailability(teamId: string): Promise<boolean> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/roster`;
    const response = await axios.get(url);
    
    // Check if roster has athletes
    const hasAthletes = response.data?.athletes && 
                       Array.isArray(response.data.athletes) && 
                       response.data.athletes.length > 0;
    
    return hasAthletes;
  } catch (error) {
    return false;
  }
}

async function collectNCAABasketballTeams() {
  console.log(chalk.bold.blue('🏀 NCAA BASKETBALL TEAMS COLLECTOR'));
  console.log(chalk.blue('==================================\n'));
  
  // Check existing teams
  const { data: existingTeams } = await supabase
    .from('teams')
    .select('external_id')
    .eq('sport', 'NCAA_BB');
  
  console.log(`Found ${existingTeams?.length || 0} existing NCAA Basketball teams\n`);
  
  try {
    // Get all Division I teams from ESPN
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=500';
    const response = await axios.get(url);
    
    if (!response.data?.sports?.[0]?.leagues?.[0]?.teams) {
      throw new Error('No teams found in ESPN response');
    }
    
    const allTeams = response.data.sports[0].leagues[0].teams;
    console.log(`Found ${allTeams.length} Division I teams from ESPN\n`);
    
    // Test roster availability with concurrent requests (learned from NCAA Football)
    console.log('🔍 Testing roster availability for all teams...');
    const teamsToInsert = [];
    const batchSize = 25; // Concurrent request limit
    
    for (let i = 0; i < allTeams.length; i += batchSize) {
      const batch = allTeams.slice(i, i + batchSize);
      
      const rosterTests = batch.map(async (teamWrapper: any) => {
        const team = teamWrapper.team; // Teams are wrapped in {team: {...}}
        const hasRoster = await testRosterAvailability(team.id);
        
        if (hasRoster) {
          // Check if team already exists
          const externalId = `espn_ncaabb_${team.id}`;
          const exists = existingTeams?.some(t => t.external_id === externalId);
          
          if (!exists) {
            return {
              external_id: externalId,
              name: team.name,
              sport: 'NCAA_BB',
              metadata: {
                display_name: team.displayName,
                abbreviation: team.abbreviation,
                location: team.location,
                logos: team.logos,
                conference: team.conference || 'Unknown',
                division: team.division || 'Division I'
              }
            };
          }
        }
        return null;
      });
      
      const batchResults = await Promise.all(rosterTests);
      const validTeams = batchResults.filter(team => team !== null);
      teamsToInsert.push(...validTeams);
      
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allTeams.length / batchSize)}: ${validTeams.length} valid teams found (${teamsToInsert.length} total)`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n✅ Found ${teamsToInsert.length} teams with roster data`);
    
    if (teamsToInsert.length > 0) {
      // Insert in batches of 900 (lesson learned from NCAA Football)
      const insertBatchSize = 900;
      let insertedCount = 0;
      
      for (let i = 0; i < teamsToInsert.length; i += insertBatchSize) {
        const batch = teamsToInsert.slice(i, i + insertBatchSize);
        
        const { error: insertError } = await supabase
          .from('teams')
          .insert(batch);
        
        if (insertError) {
          console.error(`❌ Error inserting batch: ${insertError.message}`);
        } else {
          insertedCount += batch.length;
          console.log(`✅ Inserted batch ${Math.floor(i / insertBatchSize) + 1}/${Math.ceil(teamsToInsert.length / insertBatchSize)} (${insertedCount}/${teamsToInsert.length})`);
        }
      }
      
      console.log(`\n🎉 Successfully added ${insertedCount} NCAA Basketball teams!`);
    } else {
      console.log('\n✅ All NCAA Basketball teams already in database!');
    }
    
    // Final verification
    const { count: finalCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BB');
    
    console.log(`\n📊 Total NCAA Basketball teams in database: ${finalCount}`);
    
    // Sample teams for verification
    const { data: sampleTeams } = await supabase
      .from('teams')
      .select('name, external_id, metadata')
      .eq('sport', 'NCAA_BB')
      .limit(5);
    
    console.log('\n🏀 Sample teams:');
    sampleTeams?.forEach((team, i) => {
      const metadata = team.metadata as any;
      console.log(`${i + 1}. ${team.name} (${team.external_id}) - ${metadata?.conference || 'Unknown'} Conference`);
    });
    
    console.log('\n' + chalk.bold.green('✅ NCAA Basketball teams collection complete!'));
    console.log(chalk.green('📊 Ready for player collection with validated teams!'));
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

collectNCAABasketballTeams();