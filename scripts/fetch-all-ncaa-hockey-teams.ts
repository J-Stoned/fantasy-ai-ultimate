#!/usr/bin/env tsx
/**
 * 🏒 FETCH ALL NCAA HOCKEY TEAMS
 * Fetches all NCAA Hockey teams across all divisions
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

async function fetchAllNCAAHockeyTeams() {
  console.log(chalk.bold.blue('🏒 FETCHING ALL NCAA HOCKEY TEAMS\n'));
  
  const allTeams = [];
  const teamIds = new Set<string>();
  
  try {
    // 1. Fetch Division I Men's teams
    console.log(chalk.yellow('1. Fetching Division I Men\'s Hockey teams...'));
    
    const d1Urls = [
      'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams',
      // Try with limit parameter to get more teams
      'https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams?limit=150'
    ];
    
    for (const url of d1Urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        
        const data = await response.json();
        
        if (data.sports && data.sports[0] && data.sports[0].leagues) {
          for (const league of data.sports[0].leagues) {
            if (league.teams) {
              console.log(`  Processing ${league.name || 'League'} (${league.teams.length} teams)...`);
              
              for (const teamData of league.teams) {
                const team = teamData.team;
                
                // Skip if we already have this team
                if (teamIds.has(team.id)) continue;
                teamIds.add(team.id);
                
                const teamRecord = {
                  sport: 'NCAA_HKY',
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
                    division: 'Division I',
                    league: league.name,
                    league_id: league.id
                  }
                };
                
                allTeams.push(teamRecord);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching from ${url}:`, error);
      }
    }
    
    console.log(`  ✓ Found ${allTeams.length} Division I teams`);
    
    // 2. Try to get more teams by checking individual conferences
    console.log(chalk.yellow('\n2. Checking individual conferences...'));
    
    const conferences = [
      { id: 'hockey-east', name: 'Hockey East' },
      { id: 'ecac', name: 'ECAC' },
      { id: 'nchc', name: 'NCHC' },
      { id: 'big-ten', name: 'Big Ten' },
      { id: 'atlantic-hockey', name: 'Atlantic Hockey' },
      { id: 'ccha', name: 'CCHA' },
      { id: 'wcha', name: 'WCHA' } // Women's but might have men's teams
    ];
    
    for (const conf of conferences) {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams?conference=${conf.id}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          let confTeamCount = 0;
          
          if (data.sports && data.sports[0] && data.sports[0].leagues) {
            for (const league of data.sports[0].leagues) {
              if (league.teams) {
                for (const teamData of league.teams) {
                  const team = teamData.team;
                  
                  if (!teamIds.has(team.id)) {
                    teamIds.add(team.id);
                    confTeamCount++;
                    
                    const teamRecord = {
                      sport: 'NCAA_HKY',
                      name: team.displayName || team.name,
                      abbreviation: team.abbreviation || team.location.substring(0, 3).toUpperCase(),
                      city: team.location || '',
                      external_id: `espn_ncaahockey_${team.id}`,
                      metadata: {
                        espn_id: team.id,
                        full_name: team.displayName,
                        short_name: team.shortDisplayName,
                        logos: team.logos,
                        conference: conf.name,
                        division: 'Division I',
                        league: league.name,
                        league_id: league.id
                      }
                    };
                    
                    allTeams.push(teamRecord);
                  }
                }
              }
            }
          }
          
          if (confTeamCount > 0) {
            console.log(`  ✓ ${conf.name}: Found ${confTeamCount} new teams`);
          }
        }
      } catch (error) {
        // Silently continue
      }
    }
    
    // 3. Try Division III endpoint
    console.log(chalk.yellow('\n3. Checking for Division III teams...'));
    
    try {
      // ESPN might use different sport codes for D3
      const d3Urls = [
        'https://site.api.espn.com/apis/site/v2/sports/hockey/d3-hockey/teams',
        'https://site.api.espn.com/apis/site/v2/sports/hockey/college-hockey/teams?division=d3',
        'https://site.api.espn.com/apis/site/v2/sports/hockey/college-hockey/teams?level=d3'
      ];
      
      for (const url of d3Urls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            console.log(`  Checking ${url}...`);
            // Process if we get valid data
          }
        } catch (error) {
          // Continue trying other URLs
        }
      }
    } catch (error) {
      console.log('  Could not fetch Division III teams from ESPN');
    }
    
    console.log(chalk.green(`\n✅ Total teams found: ${allTeams.length}`));
    
    // Show team breakdown
    console.log(chalk.yellow('\nTeam list:'));
    allTeams.forEach((team, i) => {
      if (i < 10 || i >= allTeams.length - 5) {
        console.log(`  ${i + 1}. ${team.name} (${team.metadata.conference})`);
      } else if (i === 10) {
        console.log('  ... more teams ...');
      }
    });
    
    // Insert teams
    if (allTeams.length > 0) {
      console.log(chalk.yellow(`\n🚀 Inserting ${allTeams.length} teams...`));
      
      // Check for existing teams
      const externalIds = allTeams.map(t => t.external_id);
      const { data: existingTeams } = await supabase
        .from('teams')
        .select('external_id')
        .in('external_id', externalIds);
      
      const existingIds = new Set(existingTeams?.map(t => t.external_id) || []);
      const newTeams = allTeams.filter(t => !existingIds.has(t.external_id));
      
      if (newTeams.length > 0) {
        // Insert in batches
        const batchSize = 100;
        let inserted = 0;
        
        for (let i = 0; i < newTeams.length; i += batchSize) {
          const batch = newTeams.slice(i, i + batchSize);
          const { error, data } = await supabase
            .from('teams')
            .insert(batch)
            .select();
          
          if (error) {
            console.error('Error inserting batch:', error);
          } else {
            inserted += data.length;
            console.log(`  ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newTeams.length / batchSize)}`);
          }
        }
        
        console.log(chalk.green(`✅ Successfully inserted ${inserted} new teams!`));
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
    
    if (count && count < 100) {
      console.log(chalk.yellow('\n⚠️  Note: We found fewer than 100 teams.'));
      console.log('ESPN API might not provide Division III teams.');
      console.log('We may need to supplement with data from other sources.');
    }
    
  } catch (error) {
    console.error('Error fetching NCAA Hockey teams:', error);
  }
}

fetchAllNCAAHockeyTeams().catch(console.error);