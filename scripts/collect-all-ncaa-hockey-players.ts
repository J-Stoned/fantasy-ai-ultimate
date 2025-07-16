#!/usr/bin/env tsx
/**
 * 🏒 COLLECT ALL NCAA HOCKEY PLAYERS
 * Fetches player rosters for all NCAA Hockey teams
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ESPNPlayer {
  id: string;
  uid: string;
  displayName: string;
  fullName: string;
  jersey?: string;
  position?: {
    abbreviation: string;
    displayName: string;
  };
  age?: number;
  displayHeight?: string;
  displayWeight?: string;
  birthPlace?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

async function fetchTeamRoster(teamId: string, teamName: string): Promise<any[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams/${teamId}/roster`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(chalk.red(`  ✗ Failed to fetch roster for ${teamName}`));
      return [];
    }
    
    const data = await response.json();
    const players = [];
    
    // Process each position group
    if (data.athletes) {
      data.athletes.forEach((group: any) => {
        if (group.items) {
          group.items.forEach((player: ESPNPlayer) => {
            players.push({
              name: player.fullName || player.displayName,
              sport: 'NCAA_HKY',
              external_id: `espn_ncaahockey_${player.id}`,
              metadata: {
                espn_id: player.id,
                jersey: player.jersey,
                position: player.position?.abbreviation,
                position_name: player.position?.displayName,
                age: player.age,
                height: player.displayHeight,
                weight: player.displayWeight,
                birth_city: player.birthPlace?.city,
                birth_state: player.birthPlace?.state,
                birth_country: player.birthPlace?.country,
                team_name: teamName
              }
            });
          });
        }
      });
    }
    
    return players;
  } catch (error) {
    console.error(`Error fetching roster for ${teamName}:`, error);
    return [];
  }
}

async function collectAllNCAAHockeyPlayers() {
  console.log(chalk.bold.blue('🏒 COLLECTING ALL NCAA HOCKEY PLAYERS\n'));
  
  try {
    // Get all NCAA Hockey teams
    const { data: teams } = await supabase
      .from('teams')
      .select('id, external_id, name')
      .eq('sport', 'NCAA_HKY')
      .order('name');
    
    if (!teams || teams.length === 0) {
      console.log(chalk.red('No NCAA Hockey teams found!'));
      return;
    }
    
    console.log(chalk.yellow(`Found ${teams.length} NCAA Hockey teams\n`));
    
    // Collect all players with parallel processing
    const allPlayers = [];
    const batchSize = 10; // Process 10 teams at a time
    
    for (let i = 0; i < teams.length; i += batchSize) {
      const batch = teams.slice(i, i + batchSize);
      
      console.log(chalk.cyan(`Processing teams ${i + 1}-${Math.min(i + batchSize, teams.length)}...`));
      
      const batchPromises = batch.map(team => {
        const espnId = team.external_id?.split('_').pop();
        if (!espnId) {
          console.log(chalk.red(`  ✗ No ESPN ID for ${team.name}`));
          return Promise.resolve([]);
        }
        
        return fetchTeamRoster(espnId, team.name).then(players => {
          if (players.length > 0) {
            console.log(chalk.green(`  ✓ ${team.name}: ${players.length} players`));
            // Add team_id to each player
            return players.map(p => ({ ...p, team_id: team.id }));
          } else {
            console.log(chalk.yellow(`  ⚠ ${team.name}: No players found`));
            return [];
          }
        });
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(players => allPlayers.push(...players));
      
      // Small delay between batches
      if (i + batchSize < teams.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(chalk.green(`\n✅ Collected ${allPlayers.length} total players`));
    
    if (allPlayers.length > 0) {
      // Remove existing NCAA Hockey players
      console.log(chalk.yellow('\nRemoving old NCAA Hockey players...'));
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('sport', 'NCAA_HKY');
      
      if (deleteError) {
        console.error('Error deleting old players:', deleteError);
      }
      
      // Insert new players in batches
      console.log(chalk.yellow(`\n🚀 Inserting ${allPlayers.length} players...`));
      
      const insertBatchSize = 500;
      let inserted = 0;
      
      for (let i = 0; i < allPlayers.length; i += insertBatchSize) {
        const batch = allPlayers.slice(i, i + insertBatchSize);
        const { error, data } = await supabase
          .from('players')
          .insert(batch)
          .select();
        
        if (error) {
          console.error('Error inserting batch:', error);
        } else {
          inserted += data.length;
          console.log(`  ✓ Inserted batch ${Math.floor(i / insertBatchSize) + 1}/${Math.ceil(allPlayers.length / insertBatchSize)} (${inserted} total)`);
        }
      }
      
      console.log(chalk.green(`✅ Successfully inserted ${inserted} NCAA Hockey players!`));
    }
    
    // Verify final count
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_HKY');
    
    console.log(chalk.bold.green(`\n🏒 Total NCAA Hockey players in database: ${count}`));
    
    // Show position breakdown
    const { data: playersByPosition } = await supabase
      .from('players')
      .select('metadata')
      .eq('sport', 'NCAA_HKY');
    
    const positionCounts: Record<string, number> = {};
    playersByPosition?.forEach(player => {
      const position = player.metadata?.position || 'Unknown';
      positionCounts[position] = (positionCounts[position] || 0) + 1;
    });
    
    console.log('\nPlayers by position:');
    Object.entries(positionCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([position, count]) => {
        console.log(`  ${position}: ${count} players`);
      });
    
  } catch (error) {
    console.error('Error collecting NCAA Hockey players:', error);
  }
}

collectAllNCAAHockeyPlayers().catch(console.error);