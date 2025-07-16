#!/usr/bin/env tsx
/**
 * 🏒 FETCH NCAA HOCKEY TEAMS
 * Fetches all NCAA Division I Hockey teams from ESPN
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ESPNTeam {
  id: string;
  location: string;
  name: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  logos?: Array<{ href: string }>;
}

async function fetchNCAAHockeyTeams() {
  console.log(chalk.bold.blue('🏒 NCAA HOCKEY TEAMS FETCHER\n'));
  
  const teamsToInsert = [];
  
  try {
    // ESPN's college hockey endpoint
    const url = 'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams';
    
    console.log('Fetching NCAA Hockey teams from ESPN...');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.sports && data.sports[0] && data.sports[0].leagues) {
      for (const league of data.sports[0].leagues) {
        if (league.teams) {
          console.log(`\nProcessing ${league.name || 'League'}...`);
          
          for (const teamData of league.teams) {
            const team = teamData.team;
            
            const teamRecord = {
              sport: 'NCAA_HKY', // Using NCAA_HKY for NCAA Hockey
              name: team.displayName || team.name,
              abbreviation: team.abbreviation || team.location.substring(0, 3).toUpperCase(),
              city: team.location || '',
              external_id: `espn_ncaahockey_${team.id}`,
              metadata: {
                espn_id: team.id,
                full_name: team.displayName,
                short_name: team.shortDisplayName,
                logos: team.logos,
                conference: league.abbreviation || league.name || 'NCAA',
                league: league.name,
                league_id: league.id
              }
            };
            
            teamsToInsert.push(teamRecord);
            console.log(`  ✓ ${team.displayName}`);
          }
        }
      }
    }
    
    console.log(`\n✅ Found ${teamsToInsert.length} NCAA Hockey teams`);
    
    if (teamsToInsert.length > 0) {
      // Check for existing teams
      const externalIds = teamsToInsert.map(t => t.external_id);
      const { data: existingTeams } = await supabase
        .from('teams')
        .select('external_id')
        .in('external_id', externalIds);
      
      const existingIds = new Set(existingTeams?.map(t => t.external_id) || []);
      const newTeams = teamsToInsert.filter(t => !existingIds.has(t.external_id));
      
      if (newTeams.length > 0) {
        console.log(`\n🚀 Inserting ${newTeams.length} new teams...`);
        
        const { error, data } = await supabase
          .from('teams')
          .insert(newTeams)
          .select();
        
        if (error) {
          console.error('Error inserting teams:', error);
        } else {
          console.log(chalk.green(`✅ Successfully inserted ${data.length} NCAA Hockey teams!`));
        }
      } else {
        console.log(chalk.yellow('✓ All teams already in database'));
      }
    }
    
    // Verify final count
    const { count } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_HKY');
    
    console.log(chalk.bold.green(`\n🏒 Total NCAA Hockey teams in database: ${count}`));
    
  } catch (error) {
    console.error('Error fetching NCAA Hockey teams:', error);
  }
}

fetchNCAAHockeyTeams().catch(console.error);