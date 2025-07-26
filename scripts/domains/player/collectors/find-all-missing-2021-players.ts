#!/usr/bin/env tsx
/**
 * 🔍 FIND ALL MISSING 2021 NFL PLAYERS
 * Check every game to see which players we're missing
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(12);

async function findAllMissingPlayers() {
  console.log(chalk.bold.cyan('🔍 FINDING ALL MISSING 2021 NFL PLAYERS\n'));

  // Get all 2021 games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .order('start_time');

  if (!games) return;

  console.log(chalk.green(`Checking ${games.length} NFL games...\n`));

  // Load existing players
  const { data: existingPlayers } = await supabase
    .from('players')
    .select('external_id')
    .eq('sport', 'NFL');

  const playerSet = new Set(existingPlayers?.map(p => p.external_id) || []);
  console.log(chalk.yellow(`Current NFL players in DB: ${playerSet.size}\n`));

  const missingPlayers = new Map<string, { name: string; count: number; positions: Set<string> }>();
  let totalPlayersFound = 0;
  let gamesProcessed = 0;

  // Check each game
  const gamePromises = games.map(game => 
    limit(async () => {
      try {
        const espnGameId = game.external_id?.split('_').pop();
        if (!espnGameId) return;

        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
        const response = await axios.get(url, { timeout: 10000 });
        const gameData = response.data;

        if (!gameData.boxscore?.players) return;

        let gamePlayerCount = 0;

        for (const team of gameData.boxscore.players) {
          for (const statGroup of team.statistics || []) {
            for (const athlete of statGroup.athletes || []) {
              const playerId = athlete.athlete?.id;
              const playerName = athlete.athlete?.displayName;
              
              if (!playerId || !playerName) continue;
              
              totalPlayersFound++;
              gamePlayerCount++;

              const playerExternalId = `espn_nfl_${playerId}`;
              
              if (!playerSet.has(playerExternalId)) {
                if (missingPlayers.has(playerId)) {
                  const existing = missingPlayers.get(playerId)!;
                  existing.count++;
                  existing.positions.add(statGroup.name);
                } else {
                  missingPlayers.set(playerId, {
                    name: playerName,
                    count: 1,
                    positions: new Set([statGroup.name])
                  });
                }
              }
            }
          }
        }

        gamesProcessed++;
        if (gamesProcessed % 10 === 0) {
          console.log(chalk.gray(`Processed ${gamesProcessed}/${games.length} games... Found ${missingPlayers.size} missing players`));
        }

      } catch (error: any) {
        console.error(chalk.red(`Error processing game: ${error.message}`));
      }
    })
  );

  await Promise.all(gamePromises);

  // Show results
  console.log(chalk.bold.green(`\n📊 ANALYSIS COMPLETE!\n`));
  console.log(chalk.cyan(`Total player appearances: ${totalPlayersFound}`));
  console.log(chalk.cyan(`Average players per game: ${Math.round(totalPlayersFound / games.length)}`));
  console.log(chalk.red(`Missing players: ${missingPlayers.size}`));
  console.log(chalk.yellow(`Players in DB: ${playerSet.size}`));
  console.log(chalk.green(`Total unique players needed: ${playerSet.size + missingPlayers.size}`));

  // Show top missing players
  const sortedMissing = Array.from(missingPlayers.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);

  console.log(chalk.bold.yellow('\nTop 20 missing players (by game appearances):'));
  sortedMissing.forEach(([id, data]) => {
    const positions = Array.from(data.positions).join(', ');
    console.log(`  ${data.name} (ID: ${id}) - ${data.count} games - ${positions}`);
  });

  // Group by position
  const positionCounts: Record<string, number> = {};
  missingPlayers.forEach(player => {
    player.positions.forEach(pos => {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
  });

  console.log(chalk.bold.cyan('\nMissing players by position:'));
  Object.entries(positionCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pos, count]) => {
      console.log(`  ${pos}: ${count} players`);
    });

  return missingPlayers;
}

findAllMissingPlayers().catch(console.error);