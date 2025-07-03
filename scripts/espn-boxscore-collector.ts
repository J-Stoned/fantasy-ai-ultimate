import chalk from 'chalk';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ESPN doesn't require API key for public data
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports';

let stats = {
  games: 0,
  playerStats: 0,
  errors: 0,
  runtime: Date.now()
};

// Get recent NFL games with scores
async function getRecentGames() {
  try {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'football')
      .not('home_score', 'is', null)
      .not('external_id', 'is', null)
      .order('game_date', { ascending: false })
      .limit(50);
    
    return games || [];
  } catch (error) {
    console.error(chalk.red('Error fetching games:'), error);
    return [];
  }
}

// Extract ESPN game ID from external_id
function getESPNGameId(externalId: string): string | null {
  // ESPN IDs are typically like "espn_401547652"
  const match = externalId.match(/espn_(\d+)/);
  return match ? match[1] : null;
}

// Collect player stats from ESPN boxscore
async function collectBoxscoreStats(game: any) {
  const espnId = getESPNGameId(game.external_id);
  if (!espnId) return;
  
  try {
    // ESPN boxscore endpoint for NFL
    const url = `${ESPN_API}/football/nfl/summary?event=${espnId}`;
    const response = await axios.get(url);
    const data = response.data;
    
    if (!data.boxscore?.players) {
      return;
    }
    
    let statsCollected = 0;
    
    // Process each team's player stats
    for (const teamIndex in data.boxscore.players) {
      const team = data.boxscore.players[teamIndex];
      const teamName = team.team.displayName;
      
      // Process each stat category (passing, rushing, receiving, etc.)
      for (const statCategory of team.statistics || []) {
        const categoryName = statCategory.name.toLowerCase();
        
        for (const athlete of statCategory.athletes || []) {
          const playerStats = {
            external_id: `espn_${game.id}_${athlete.athlete.id}_${categoryName}`,
            player_name: athlete.athlete.displayName,
            game_id: game.id,
            team: teamName,
            game_date: game.game_date,
            stat_category: categoryName,
            // Store raw stats as JSONB
            raw_stats: athlete.stats,
            metadata: {
              player_id: athlete.athlete.id,
              jersey: athlete.athlete.jersey,
              position: athlete.athlete.position?.abbreviation,
              game_external_id: game.external_id
            }
          };
          
          // Parse specific stats based on category
          if (categoryName === 'passing' && athlete.stats.length >= 5) {
            playerStats.metadata.completions = parseInt(athlete.stats[0]) || 0;
            playerStats.metadata.attempts = parseInt(athlete.stats[1]) || 0;
            playerStats.metadata.yards = parseInt(athlete.stats[2]) || 0;
            playerStats.metadata.touchdowns = parseInt(athlete.stats[3]) || 0;
            playerStats.metadata.interceptions = parseInt(athlete.stats[4]) || 0;
          } else if (categoryName === 'rushing' && athlete.stats.length >= 4) {
            playerStats.metadata.carries = parseInt(athlete.stats[0]) || 0;
            playerStats.metadata.yards = parseInt(athlete.stats[1]) || 0;
            playerStats.metadata.avg = parseFloat(athlete.stats[2]) || 0;
            playerStats.metadata.touchdowns = parseInt(athlete.stats[3]) || 0;
          } else if (categoryName === 'receiving' && athlete.stats.length >= 4) {
            playerStats.metadata.receptions = parseInt(athlete.stats[0]) || 0;
            playerStats.metadata.yards = parseInt(athlete.stats[1]) || 0;
            playerStats.metadata.avg = parseFloat(athlete.stats[2]) || 0;
            playerStats.metadata.touchdowns = parseInt(athlete.stats[3]) || 0;
          }
          
          // Calculate fantasy points (standard scoring)
          let fantasyPoints = 0;
          if (categoryName === 'passing') {
            fantasyPoints = (playerStats.metadata.yards / 25) + 
                          (playerStats.metadata.touchdowns * 4) - 
                          (playerStats.metadata.interceptions * 2);
          } else if (categoryName === 'rushing') {
            fantasyPoints = (playerStats.metadata.yards / 10) + 
                          (playerStats.metadata.touchdowns * 6);
          } else if (categoryName === 'receiving') {
            fantasyPoints = (playerStats.metadata.receptions * 1) + 
                          (playerStats.metadata.yards / 10) + 
                          (playerStats.metadata.touchdowns * 6);
          }
          
          playerStats.metadata.fantasy_points = Math.round(fantasyPoints * 10) / 10;
          
          // Insert into player_stats table
          const { error } = await supabase
            .from('player_stats')
            .upsert(playerStats, { onConflict: 'external_id' });
          
          if (!error) {
            statsCollected++;
          } else {
            console.error(chalk.red('Insert error:'), error.message);
          }
        }
      }
    }
    
    stats.playerStats += statsCollected;
    console.log(chalk.green(`  ✅ Collected ${statsCollected} player stats for ${game.home_team} vs ${game.away_team}`));
    
  } catch (error: any) {
    console.error(chalk.red(`  ❌ Error for game ${game.external_id}:`), error.message);
    stats.errors++;
  }
}

// Collect NBA boxscores
async function collectNBABoxscores() {
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'basketball')
    .not('home_score', 'is', null)
    .not('external_id', 'is', null)
    .order('game_date', { ascending: false })
    .limit(20);
  
  if (!games) return;
  
  for (const game of games) {
    const espnId = getESPNGameId(game.external_id);
    if (!espnId) continue;
    
    try {
      const url = `${ESPN_API}/basketball/nba/summary?event=${espnId}`;
      const response = await axios.get(url);
      const data = response.data;
      
      if (!data.boxscore?.players) continue;
      
      for (const teamIndex in data.boxscore.players) {
        const team = data.boxscore.players[teamIndex];
        const teamName = team.team.displayName;
        
        // NBA has different stat structure
        const athletes = team.statistics?.[0]?.athletes || [];
        
        for (const athlete of athletes) {
          if (!athlete.stats || athlete.stats.length < 10) continue;
          
          const playerStats = {
            external_id: `espn_${game.id}_${athlete.athlete.id}_box`,
            player_name: athlete.athlete.displayName,
            game_id: game.id,
            team: teamName,
            game_date: game.game_date,
            stat_category: 'box_score',
            raw_stats: athlete.stats,
            metadata: {
              player_id: athlete.athlete.id,
              position: athlete.athlete.position?.abbreviation,
              minutes: athlete.stats[0] || '0',
              points: parseInt(athlete.stats[1]) || 0,
              rebounds: parseInt(athlete.stats[2]) || 0,
              assists: parseInt(athlete.stats[3]) || 0,
              steals: parseInt(athlete.stats[4]) || 0,
              blocks: parseInt(athlete.stats[5]) || 0,
              fg_made: parseInt(athlete.stats[6]?.split('-')[0]) || 0,
              fg_att: parseInt(athlete.stats[6]?.split('-')[1]) || 0,
              three_made: parseInt(athlete.stats[7]?.split('-')[0]) || 0,
              three_att: parseInt(athlete.stats[7]?.split('-')[1]) || 0,
              ft_made: parseInt(athlete.stats[8]?.split('-')[0]) || 0,
              ft_att: parseInt(athlete.stats[8]?.split('-')[1]) || 0
            }
          };
          
          const { error } = await supabase
            .from('player_stats')
            .upsert(playerStats, { onConflict: 'external_id' });
          
          if (!error) {
            stats.playerStats++;
          }
        }
      }
      
      console.log(chalk.blue(`  ✅ Collected NBA stats for ${game.home_team} vs ${game.away_team}`));
      
    } catch (error: any) {
      console.error(chalk.red(`  ❌ NBA error for ${game.external_id}:`), error.message);
      stats.errors++;
    }
    
    await delay(500); // Rate limiting
  }
}

// Display progress
function displayStats() {
  const runtime = Math.floor((Date.now() - stats.runtime) / 1000);
  const minutes = Math.floor(runtime / 60);
  const seconds = runtime % 60;
  
  console.log(chalk.bold.yellow('\n📊 ESPN BOXSCORE COLLECTOR'));
  console.log(chalk.gray('=' .repeat(40)));
  console.log(chalk.white(`⏱️  Runtime: ${minutes}m ${seconds}s`));
  console.log(chalk.green(`📈 Player Stats: ${stats.playerStats.toLocaleString()}`));
  console.log(chalk.blue(`🏈 Games Processed: ${stats.games}`));
  console.log(chalk.red(`❌ Errors: ${stats.errors}`));
}

// Main collection function
async function runCollection() {
  console.log(chalk.green('🚀 Starting ESPN Boxscore Collection...'));
  console.log(chalk.yellow('📡 Using ESPN public API (no key required)\n'));
  
  // Get recent games
  const games = await getRecentGames();
  console.log(chalk.blue(`Found ${games.length} recent NFL games to process\n`));
  
  // Process each game
  for (const game of games) {
    await collectBoxscoreStats(game);
    stats.games++;
    await delay(1000); // Rate limiting between games
  }
  
  // Also collect NBA stats
  console.log(chalk.blue('\n🏀 Collecting NBA boxscores...'));
  await collectNBABoxscores();
  
  // Display final stats
  displayStats();
  
  console.log(chalk.green('\n✨ Collection complete!'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log('1. Check player_stats table for new records');
  console.log('2. Update ML feature engineering to use these stats');
  console.log('3. Retrain models with player-level features');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down collector...'));
  displayStats();
  process.exit(0);
});

// Start collection
runCollection().catch(console.error);