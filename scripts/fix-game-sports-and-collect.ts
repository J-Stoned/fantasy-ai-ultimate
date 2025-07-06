#!/usr/bin/env tsx
/**
 * 🔧 FIX GAME SPORTS AND COLLECT PLAYER STATS
 * 
 * 1. Identify sport from team names
 * 2. Update games with correct sport
 * 3. Then collect player stats
 */

import chalk from 'chalk';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// NBA Teams
const NBA_TEAMS = [
  'Lakers', 'Warriors', 'Celtics', 'Heat', 'Bucks', 'Suns', 'Nets', 'Clippers',
  '76ers', 'Nuggets', 'Mavericks', 'Trail Blazers', 'Jazz', 'Raptors', 'Hawks',
  'Bulls', 'Cavaliers', 'Pelicans', 'Timberwolves', 'Spurs', 'Kings', 'Wizards',
  'Pacers', 'Hornets', 'Knicks', 'Pistons', 'Thunder', 'Magic', 'Rockets', 'Grizzlies'
];

// NFL Teams
const NFL_TEAMS = [
  'Patriots', 'Cowboys', 'Packers', 'Chiefs', 'Bills', 'Buccaneers', 'Rams',
  'Seahawks', 'Saints', 'Steelers', 'Ravens', 'Browns', 'Bengals', 'Titans',
  'Colts', 'Texans', 'Jaguars', 'Broncos', 'Raiders', 'Chargers', '49ers',
  'Cardinals', 'Bears', 'Lions', 'Vikings', 'Falcons', 'Panthers', 'Eagles',
  'Giants', 'Commanders', 'Dolphins', 'Jets'
];

// NHL Teams  
const NHL_TEAMS = [
  'Avalanche', 'Lightning', 'Rangers', 'Panthers', 'Oilers', 'Maple Leafs',
  'Bruins', 'Penguins', 'Capitals', 'Golden Knights', 'Stars', 'Wild',
  'Hurricanes', 'Blues', 'Flames', 'Kings', 'Predators', 'Jets', 'Canucks',
  'Sharks', 'Ducks', 'Coyotes', 'Kraken', 'Blackhawks', 'Red Wings', 'Sabres',
  'Senators', 'Canadiens', 'Devils', 'Islanders', 'Flyers', 'Blue Jackets'
];

// MLB Teams
const MLB_TEAMS = [
  'Yankees', 'Red Sox', 'Dodgers', 'Giants', 'Cubs', 'Cardinals', 'Braves',
  'Astros', 'Phillies', 'Mets', 'White Sox', 'Tigers', 'Twins', 'Royals',
  'Guardians', 'Brewers', 'Pirates', 'Reds', 'Padres', 'Rockies', 'Diamondbacks',
  'Mariners', 'Athletics', 'Angels', 'Rangers', 'Blue Jays', 'Orioles', 'Rays',
  'Marlins', 'Nationals'
];

async function identifySportFromTeams(teamName: string): string {
  if (!teamName) return 'unknown';
  
  const name = teamName.toLowerCase();
  
  // Check each sport
  if (NBA_TEAMS.some(t => name.includes(t.toLowerCase()))) return 'nba';
  if (NFL_TEAMS.some(t => name.includes(t.toLowerCase()))) return 'nfl';
  if (NHL_TEAMS.some(t => name.includes(t.toLowerCase()))) return 'nhl';
  if (MLB_TEAMS.some(t => name.includes(t.toLowerCase()))) return 'mlb';
  
  // Check for sport-specific keywords
  if (name.includes('fc') || name.includes('united') || name.includes('city')) return 'soccer';
  if (name.includes('college') || name.includes('university') || name.includes('state')) {
    if (name.includes('basketball')) return 'ncaab';
    if (name.includes('football')) return 'ncaaf';
  }
  
  return 'unknown';
}

async function fixGameSports() {
  console.log(chalk.bold.cyan('🔧 FIXING GAME SPORTS...'));
  console.log(chalk.gray('='.repeat(60)));
  
  // Get games with null sport
  const { data: games, count } = await supabase
    .from('games')
    .select(`
      id,
      sport,
      home_team:teams!games_home_team_id_fkey(name),
      away_team:teams!games_away_team_id_fkey(name)
    `)
    .is('sport', null)
    .limit(5000);
    
  console.log(chalk.yellow(`Found ${count} games with null sport`));
  
  if (!games || games.length === 0) return;
  
  const sportCounts: Record<string, number> = {};
  const updates: any[] = [];
  
  for (const game of games) {
    const homeSport = await identifySportFromTeams(game.home_team?.name || '');
    const awaySport = await identifySportFromTeams(game.away_team?.name || '');
    
    // Use the sport if both teams agree
    const sport = homeSport === awaySport ? homeSport : 'unknown';
    
    if (sport !== 'unknown') {
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
      updates.push({
        id: game.id,
        sport: sport
      });
    }
  }
  
  console.log(chalk.cyan('\n📊 IDENTIFIED SPORTS:'));
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(chalk.white(`${sport}: ${count} games`));
  });
  
  // Update in batches
  console.log(chalk.yellow('\n🔄 Updating games...'));
  const batchSize = 100;
  
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    for (const update of batch) {
      await supabase
        .from('games')
        .update({ sport: update.sport })
        .eq('id', update.id);
    }
    
    console.log(chalk.gray(`Updated ${Math.min(i + batchSize, updates.length)}/${updates.length} games`));
  }
  
  console.log(chalk.green('✅ Sports fixed!'));
  
  return sportCounts;
}

async function collectNBAStats() {
  console.log(chalk.bold.red('\n🏀 COLLECTING NBA PLAYER STATS...'));
  console.log(chalk.gray('='.repeat(60)));
  
  // Get NBA games
  const { data: games } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id, start_time, home_score, away_score')
    .eq('sport', 'nba')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(100);
    
  if (!games || games.length === 0) {
    console.log(chalk.red('No NBA games found!'));
    return;
  }
  
  console.log(chalk.green(`Found ${games.length} NBA games`));
  
  let statsCreated = 0;
  
  // Process each game
  for (const game of games) {
    try {
      // Check if we already have stats
      const { count: existingStats } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
        
      if (existingStats && existingStats > 0) {
        console.log(chalk.gray(`Game ${game.id} already has stats`));
        continue;
      }
      
      // Try to get box score from ESPN
      const gameDate = new Date(game.start_time);
      const dateStr = gameDate.toISOString().split('T')[0].replace(/-/g, '');
      
      const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
      const response = await axios.get(scoreboardUrl);
      
      const events = response.data.events || [];
      
      for (const event of events) {
        if (!event.competitions?.[0]) continue;
        
        const homeTeam = event.competitions[0].competitors.find((t: any) => t.homeAway === 'home');
        const awayTeam = event.competitions[0].competitors.find((t: any) => t.homeAway === 'away');
        
        // Match by scores
        if (parseInt(homeTeam?.score) === game.home_score && 
            parseInt(awayTeam?.score) === game.away_score) {
          
          // Get box score
          const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${event.id}`;
          const boxResponse = await axios.get(boxscoreUrl);
          
          if (boxResponse.data.boxscore?.players) {
            // Process player stats
            for (const teamData of boxResponse.data.boxscore.players) {
              const stats = teamData.statistics?.[0];
              if (!stats?.athletes) continue;
              
              for (const athlete of stats.athletes) {
                if (!athlete.stats || athlete.stats.length < 14) continue;
                
                const [min, fg, threes, ft, oreb, dreb, reb, ast, stl, blk, to, pf, plusMinus, pts] = athlete.stats;
                
                // Skip DNPs
                if (min === '--' || pts === '--') continue;
                
                // Create player if needed
                const { data: player } = await supabase
                  .from('players')
                  .upsert({
                    external_id: `espn_${athlete.athlete.id}`,
                    name: athlete.athlete.displayName,
                    position: athlete.athlete.position?.abbreviation || null
                  }, { onConflict: 'external_id' })
                  .select()
                  .single();
                  
                if (!player) continue;
                
                // Insert stats
                const statsToInsert = [
                  { stat_type: 'points', stat_value: parseInt(pts) || 0, fantasy_points: parseInt(pts) || 0 },
                  { stat_type: 'rebounds', stat_value: parseInt(reb) || 0, fantasy_points: (parseInt(reb) || 0) * 1.2 },
                  { stat_type: 'assists', stat_value: parseInt(ast) || 0, fantasy_points: (parseInt(ast) || 0) * 1.5 },
                  { stat_type: 'steals', stat_value: parseInt(stl) || 0, fantasy_points: (parseInt(stl) || 0) * 3 },
                  { stat_type: 'blocks', stat_value: parseInt(blk) || 0, fantasy_points: (parseInt(blk) || 0) * 3 },
                  { stat_type: 'turnovers', stat_value: parseInt(to) || 0, fantasy_points: (parseInt(to) || 0) * -1 },
                ].map(stat => ({
                  player_id: player.id,
                  game_id: game.id,
                  ...stat
                }));
                
                await supabase.from('player_stats').insert(statsToInsert);
                statsCreated += statsToInsert.length;
              }
            }
            
            console.log(chalk.green(`✓ Game ${game.id}: Player stats added`));
            break;
          }
        }
      }
      
      await delay(1000); // Rate limit
      
    } catch (error: any) {
      console.error(chalk.red(`Error processing game ${game.id}:`), error.message);
    }
  }
  
  console.log(chalk.bold.green(`\n✅ Created ${statsCreated} player stats!`));
}

async function main() {
  console.log(chalk.bold.magenta('🚀 FIX SPORTS AND COLLECT PLAYER STATS'));
  console.log(chalk.gray('='.repeat(60)));
  
  // First fix sports
  const sportCounts = await fixGameSports();
  
  // Then collect NBA stats
  if (sportCounts && sportCounts.nba > 0) {
    await collectNBAStats();
  }
  
  // Check new coverage
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  const { data: uniqueGames } = await supabase
    .from('player_stats')
    .select('game_id');
    
  const unique = new Set(uniqueGames?.map(s => s.game_id) || []);
  
  console.log(chalk.bold.yellow('\n📊 FINAL STATS:'));
  console.log(chalk.white(`Total player stats: ${totalStats}`));
  console.log(chalk.white(`Games with stats: ${unique.size}`));
  console.log(chalk.white(`Coverage: ${((unique.size / 48863) * 100).toFixed(2)}%`));
  
  console.log(chalk.bold.green('\n🎯 NEXT: Run pattern enhancement with player data!'));
}

main().catch(console.error);