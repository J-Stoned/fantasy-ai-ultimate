#!/usr/bin/env tsx
/**
 * Debug unmatched NFL players
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

function normalizePlayerName(name: string): string {
  return name.toLowerCase()
    .replace(/['']/g, '')
    .replace(/\./g, '')
    .replace(/jr$/i, '')
    .replace(/sr$/i, '')
    .replace(/iii$/i, '')
    .replace(/ii$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function debugUnmatchedPlayers() {
  console.log(chalk.bold.red('🔍 DEBUGGING NFL UNMATCHED PLAYERS\n'));
  
  // Get a sample game
  const { data: game } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport_id.eq.nfl,sport_id.eq.NFL')
    .eq('status', 'completed')
    .limit(1)
    .single();
    
  if (!game || !game.external_id?.startsWith('espn_nfl_')) return;
  
  const gameId = game.external_id.replace('espn_nfl_', '');
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;
  
  const response = await axios.get(url);
  
  // Get all NFL players from our DB
  const { data: ourPlayers } = await supabase
    .from('players')
    .select('name, external_id')
    .or('sport_id.eq.nfl,sport_id.eq.NFL');
    
  const playerNameMap = new Map();
  ourPlayers?.forEach(p => {
    if (p.name) {
      playerNameMap.set(normalizePlayerName(p.name), p);
    }
  });
  
  console.log(`Total NFL players in DB: ${ourPlayers?.length}`);
  
  // Check ESPN players
  const unmatchedPlayers: string[] = [];
  
  if (response.data.boxscore?.players) {
    for (const teamData of response.data.boxscore.players) {
      if (teamData.statistics) {
        for (const statGroup of teamData.statistics) {
          if (statGroup.athletes) {
            for (const athlete of statGroup.athletes) {
              const displayName = athlete.athlete?.displayName;
              if (displayName) {
                const normalized = normalizePlayerName(displayName);
                if (!playerNameMap.has(normalized)) {
                  unmatchedPlayers.push(displayName);
                }
              }
            }
          }
        }
      }
    }
  }
  
  console.log(`\nUnmatched players in this game: ${unmatchedPlayers.length}`);
  
  if (unmatchedPlayers.length > 0) {
    console.log('\nSample unmatched players:');
    unmatchedPlayers.slice(0, 10).forEach(name => {
      console.log(`  ESPN: "${name}"`);
      
      // Try to find similar names
      const normalized = normalizePlayerName(name);
      const similar: string[] = [];
      
      ourPlayers?.forEach(p => {
        if (p.name) {
          const ourNormalized = normalizePlayerName(p.name);
          // Check if last names match
          const espnLast = normalized.split(' ').pop();
          const ourLast = ourNormalized.split(' ').pop();
          if (espnLast === ourLast && p.name !== name) {
            similar.push(p.name);
          }
        }
      });
      
      if (similar.length > 0) {
        console.log(`    Possible matches: ${similar.join(', ')}`);
      }
    });
  }
  
  // Check for common patterns
  console.log('\n📊 Common mismatch patterns:');
  console.log('- Names with suffixes (Jr., Sr., II, III)');
  console.log('- Players recently signed/traded');
  console.log('- Practice squad/roster changes');
  console.log('- Special characters in names');
  
  // Check external IDs
  console.log('\n🔍 Checking external ID formats:');
  const samplePlayers = ourPlayers?.slice(0, 5);
  samplePlayers?.forEach(p => {
    console.log(`  ${p.name}: ${p.external_id}`);
  });
}

debugUnmatchedPlayers().catch(console.error);