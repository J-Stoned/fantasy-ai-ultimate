#!/usr/bin/env tsx
/**
 * 🔥 ADD ALL 2021 PLAYERS PROPERLY
 * Skip duplicates and add only missing ones
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addAll2021Players() {
  console.log(chalk.bold.cyan('🔥 ADDING ALL 2021 NFL PLAYERS PROPERLY\n'));

  // Load the missing players file
  const missingPlayersData = fs.readFileSync('all-missing-2021-players.json', 'utf-8');
  const missingPlayers = JSON.parse(missingPlayersData);

  console.log(chalk.yellow(`Processing ${missingPlayers.length} players from 2021 games...\n`));

  // Get ALL current players to check for duplicates
  let allExistingPlayers: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('external_id')
      .eq('sport', 'NFL')
      .range(offset, offset + limit - 1);
    
    if (!batch || batch.length === 0) break;
    allExistingPlayers = allExistingPlayers.concat(batch);
    offset += limit;
    
    if (batch.length < limit) break;
  }

  const existingSet = new Set(allExistingPlayers.map(p => p.external_id));
  console.log(chalk.blue(`Current NFL players: ${existingSet.size}\n`));

  // Get teams for mapping
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NFL');

  const teamMap = new Map<string, number>();
  teams?.forEach(t => {
    const abbr = t.external_id.split('_').pop()?.toUpperCase();
    if (abbr) teamMap.set(abbr, t.id);
  });

  // Filter out duplicates and prepare for insert
  const playersToInsert: any[] = [];
  let skippedCount = 0;

  for (const player of missingPlayers) {
    if (existingSet.has(player.external_id)) {
      skippedCount++;
      continue;
    }

    // Get team ID
    let teamId = null;
    if (player.teams && player.teams.length > 0) {
      teamId = teamMap.get(player.teams[0]);
    }
    if (!teamId) {
      teamId = teams?.[0]?.id || 1;
    }

    // Parse name
    const nameParts = player.name.split(' ');
    const firstname = nameParts[0] || 'Unknown';
    const lastname = nameParts.slice(1).join(' ') || 'Player';

    // Get primary position
    const position = player.positions[0] || 'Unknown';

    playersToInsert.push({
      external_id: player.external_id,
      name: player.name,
      firstname: firstname,
      lastname: lastname,
      position: [position],
      team_id: teamId,
      sport: 'NFL',
      metadata: {
        espn_id: player.espn_id,
        games_2021: player.games_played,
        all_positions: player.positions
      }
    });
  }

  console.log(chalk.yellow(`Skipped ${skippedCount} duplicates`));
  console.log(chalk.green(`Ready to insert ${playersToInsert.length} new players\n`));

  // Insert in batches
  const batchSize = 50;
  let insertedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < playersToInsert.length; i += batchSize) {
    const batch = playersToInsert.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from('players')
        .insert(batch)
        .select();
        
      if (error) {
        console.error(chalk.red(`Batch error: ${error.message}`));
        errorCount += batch.length;
      } else if (data) {
        insertedCount += data.length;
        process.stdout.write(chalk.green('.'));
      }
    } catch (err) {
      console.error(chalk.red(`Exception: ${err}`));
      errorCount += batch.length;
    }
  }

  console.log(chalk.bold.green(`\n\n✅ RESULTS:`));
  console.log(chalk.green(`Successfully inserted: ${insertedCount} players`));
  if (errorCount > 0) {
    console.log(chalk.red(`Failed: ${errorCount} players`));
  }

  // Check new total
  const { count: totalNFL } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');
    
  console.log(chalk.cyan(`\nTotal NFL players now: ${totalNFL}`));
  
  // Test with sample game
  console.log(chalk.bold.yellow('\n🔍 Testing with sample game...'));
  
  const { data: sampleGame } = await supabase
    .from('games')
    .select('external_id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .limit(1)
    .single();
    
  if (sampleGame) {
    const { data: gameStats } = await supabase
      .from('player_game_logs')
      .select('id')
      .eq('game_id', sampleGame.id);
      
    console.log(chalk.green(`Sample game has ${gameStats?.length || 0} stats`));
  }
}

addAll2021Players().catch(console.error);