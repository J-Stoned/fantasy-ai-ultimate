#!/usr/bin/env tsx
/**
 * CHECK WHICH 2021 PLAYERS ARE STILL MISSING
 * Compare actual 2021 game players with our current database
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMissing2021Players() {
  console.log(chalk.bold.cyan('🔍 CHECKING WHICH 2021 PLAYERS ARE STILL MISSING\n'));

  // Get current NFL players
  const { data: dbPlayers, count } = await supabase
    .from('players')
    .select('external_id, name', { count: 'exact' })
    .eq('sport', 'NFL');

  const dbPlayerMap = new Map(dbPlayers?.map(p => [p.external_id, p.name]) || []);
  console.log(chalk.yellow(`Current NFL players in DB: ${count}\n`));

  // Check a sample 2021 game
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .limit(1)
    .single();

  if (!sampleGame) return;

  const espnGameId = sampleGame.external_id?.split('_').pop();
  console.log(chalk.blue(`Checking game: ${sampleGame.external_id}\n`));

  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
  const response = await axios.get(url);
  const gameData = response.data;

  let totalPlayers = 0;
  let foundPlayers = 0;
  let missingPlayers = 0;
  const missingList: any[] = [];

  if (gameData.boxscore?.players) {
    for (const team of gameData.boxscore.players) {
      console.log(chalk.cyan(`\n${team.team.displayName}:`));
      
      for (const statGroup of team.statistics || []) {
        let groupFound = 0;
        let groupMissing = 0;
        
        for (const athlete of statGroup.athletes || []) {
          const playerId = athlete.athlete?.id;
          const playerName = athlete.athlete?.displayName;
          
          if (!playerId) continue;
          
          totalPlayers++;
          const externalId = `espn_nfl_${playerId}`;
          
          if (dbPlayerMap.has(externalId)) {
            foundPlayers++;
            groupFound++;
          } else {
            missingPlayers++;
            groupMissing++;
            missingList.push({
              id: playerId,
              name: playerName,
              group: statGroup.name,
              team: team.team.displayName
            });
          }
        }
        
        console.log(`  ${statGroup.name}: ${groupFound} found, ${groupMissing} missing`);
      }
    }
  }

  console.log(chalk.bold.green(`\n📊 GAME ANALYSIS:`));
  console.log(chalk.cyan(`Total players in game: ${totalPlayers}`));
  console.log(chalk.green(`Found in DB: ${foundPlayers}`));
  console.log(chalk.red(`Missing: ${missingPlayers}`));
  console.log(chalk.yellow(`Coverage: ${Math.round((foundPlayers / totalPlayers) * 100)}%`));

  if (missingList.length > 0) {
    console.log(chalk.bold.red('\nMissing players:'));
    missingList.forEach(p => {
      console.log(`  ${p.name} (${p.id}) - ${p.group} - ${p.team}`);
    });
  }

  // Project to all games
  const missingPerGame = missingPlayers;
  const totalMissingFor257Games = missingPerGame * 257;
  
  console.log(chalk.bold.yellow(`\n📈 PROJECTION:`));
  console.log(chalk.yellow(`If each game is missing ~${missingPerGame} players`));
  console.log(chalk.yellow(`Total missing across 257 games: ~${Math.round(totalMissingFor257Games / 20)} unique players`));
}

checkMissing2021Players().catch(console.error);