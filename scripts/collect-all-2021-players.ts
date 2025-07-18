#!/usr/bin/env tsx
/**
 * 🔥 COLLECT ALL 2021 NFL PLAYERS FROM GAMES
 * Extract every player who appeared in any 2021 game
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limit = pLimit(12);

interface PlayerInfo {
  id: string;
  name: string;
  teams: Set<string>;
  positions: Set<string>;
  games: number;
}

async function collectAll2021Players() {
  console.log(chalk.bold.cyan('🔥 COLLECTING ALL 2021 NFL PLAYERS\n'));

  // Get all 2021 games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .order('start_time');

  if (!games) return;

  console.log(chalk.green(`Processing ${games.length} games to find all players...\n`));

  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Players found: {players}',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  }, cliProgress.Presets.shades_classic);

  progressBar.start(games.length, 0, { players: 0 });

  const allPlayers = new Map<string, PlayerInfo>();
  let processedGames = 0;

  // Process each game
  const gamePromises = games.map(game => 
    limit(async () => {
      try {
        const espnGameId = game.external_id?.split('_').pop();
        if (!espnGameId) return;

        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnGameId}`;
        const response = await axios.get(url, { timeout: 10000 });
        const gameData = response.data;

        if (!gameData.boxscore?.players) return;

        for (const team of gameData.boxscore.players) {
          const teamName = team.team?.abbreviation || team.team?.name || 'Unknown';
          
          for (const statGroup of team.statistics || []) {
            const position = statGroup.name;
            
            for (const athlete of statGroup.athletes || []) {
              const playerId = athlete.athlete?.id;
              const playerName = athlete.athlete?.displayName;
              
              if (!playerId || !playerName) continue;

              if (allPlayers.has(playerId)) {
                const player = allPlayers.get(playerId)!;
                player.teams.add(teamName);
                player.positions.add(position);
                player.games++;
              } else {
                allPlayers.set(playerId, {
                  id: playerId,
                  name: playerName,
                  teams: new Set([teamName]),
                  positions: new Set([position]),
                  games: 1
                });
              }
            }
          }
        }

        processedGames++;
        progressBar.update(processedGames, { players: allPlayers.size });

      } catch (error: any) {
        // Continue on error
      }
    })
  );

  await Promise.all(gamePromises);
  progressBar.stop();

  // Now check which players are missing from DB
  console.log(chalk.yellow('\nChecking against database...'));
  
  const { data: dbPlayers } = await supabase
    .from('players')
    .select('external_id')
    .eq('sport', 'NFL');

  const dbPlayerSet = new Set(dbPlayers?.map(p => p.external_id) || []);
  
  const missingPlayers: any[] = [];
  const positionStats: Record<string, number> = {};

  allPlayers.forEach((player, id) => {
    const externalId = `espn_nfl_${id}`;
    
    if (!dbPlayerSet.has(externalId)) {
      // Get primary position (most common)
      const positions = Array.from(player.positions);
      const primaryPosition = positions[0] || 'Unknown';
      
      positionStats[primaryPosition] = (positionStats[primaryPosition] || 0) + 1;
      
      missingPlayers.push({
        external_id: externalId,
        espn_id: id,
        name: player.name,
        teams: Array.from(player.teams),
        positions: positions,
        games_played: player.games
      });
    }
  });

  // Show results
  console.log(chalk.bold.green(`\n📊 2021 NFL PLAYER ANALYSIS:\n`));
  console.log(chalk.cyan(`Total unique players in 2021: ${allPlayers.size}`));
  console.log(chalk.yellow(`Players in database: ${dbPlayerSet.size}`));
  console.log(chalk.red(`Missing players: ${missingPlayers.length}`));
  
  const coverage = Math.round((dbPlayerSet.size / allPlayers.size) * 100);
  console.log(chalk.green(`Database coverage: ${coverage}%`));

  // Show missing by position
  console.log(chalk.bold.cyan('\nMissing players by primary position:'));
  Object.entries(positionStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pos, count]) => {
      console.log(`  ${pos}: ${count} players`);
    });

  // Show top missing players by games played
  const topMissing = missingPlayers
    .sort((a, b) => b.games_played - a.games_played)
    .slice(0, 10);

  console.log(chalk.bold.yellow('\nTop 10 missing players (by games played):'));
  topMissing.forEach(player => {
    console.log(`  ${player.name} - ${player.games_played} games - ${player.positions.join('/')}`);
  });

  // Save all missing players
  const fs = require('fs');
  fs.writeFileSync(
    'all-missing-2021-players.json', 
    JSON.stringify(missingPlayers, null, 2)
  );
  
  console.log(chalk.green(`\n✅ Saved ${missingPlayers.length} missing players to all-missing-2021-players.json`));
  
  // Calculate impact
  const avgStatsPerPlayer = 1.5; // Average stat groups per player
  const missingStats = missingPlayers.length * avgStatsPerPlayer;
  const missingStatsPerGame = Math.round(missingStats / games.length);
  
  console.log(chalk.bold.red(`\n⚠️  Impact: Missing ~${missingStatsPerGame} stats per game!`));
  console.log(chalk.yellow(`Current: 43 stats/game + Missing: ${missingStatsPerGame} = ${43 + missingStatsPerGame} stats/game`));
  
  return missingPlayers;
}

collectAll2021Players().catch(console.error);