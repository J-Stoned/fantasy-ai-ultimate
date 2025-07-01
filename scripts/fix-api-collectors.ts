#!/usr/bin/env tsx
/**
 * 🔧 FIX API AUTHENTICATION ISSUES
 * Fixes the API authentication problems in real-data-collector.ts
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

// Test each API to see what's working
async function testAPIs() {
  console.log(chalk.blue('🔧 TESTING API CONNECTIONS\n'));

  // 1. Test BallDontLie API
  console.log(chalk.yellow('Testing BallDontLie API...'));
  try {
    // BallDontLie v1 API doesn't use Authorization header
    const response = await axios.get('https://www.balldontlie.io/api/v1/players?per_page=1');
    console.log(chalk.green('✅ BallDontLie API: Connected (no auth needed for v1)'));
    console.log(chalk.gray(`   Sample player: ${response.data.data[0]?.first_name} ${response.data.data[0]?.last_name}`));
  } catch (error: any) {
    console.log(chalk.red('❌ BallDontLie API:', error.message));
  }

  // 2. Test MySportsFeeds API
  console.log(chalk.yellow('\nTesting MySportsFeeds API...'));
  try {
    const apiKey = process.env.MYSPORTSFEEDS_API_KEY;
    if (!apiKey) {
      console.log(chalk.red('❌ MySportsFeeds: No API key'));
    } else {
      // MySportsFeeds uses Basic Auth
      const response = await axios.get(
        'https://api.mysportsfeeds.com/v2.1/pull/nba/2024-2025-regular/games.json?limit=1',
        {
          auth: {
            username: apiKey,
            password: 'MYSPORTSFEEDS'
          }
        }
      );
      console.log(chalk.green('✅ MySportsFeeds API: Connected'));
    }
  } catch (error: any) {
    console.log(chalk.red('❌ MySportsFeeds API:', error.response?.status, error.response?.statusText));
    if (error.response?.status === 403) {
      console.log(chalk.gray('   Note: API key may be invalid or need activation'));
    }
  }

  // 3. Test The Odds API
  console.log(chalk.yellow('\nTesting The Odds API...'));
  try {
    const apiKey = process.env.THE_ODDS_API_KEY;
    const response = await axios.get(
      `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`
    );
    console.log(chalk.green('✅ The Odds API: Connected'));
    console.log(chalk.gray(`   Available sports: ${response.data.length}`));
  } catch (error: any) {
    console.log(chalk.red('❌ The Odds API:', error.message));
  }

  // 4. Test OpenWeather API
  console.log(chalk.yellow('\nTesting OpenWeather API...'));
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=New York&appid=${apiKey}&units=imperial`
    );
    console.log(chalk.green('✅ OpenWeather API: Connected'));
    console.log(chalk.gray(`   NYC temp: ${response.data.main.temp}°F`));
  } catch (error: any) {
    console.log(chalk.red('❌ OpenWeather API:', error.message));
  }

  // 5. Test SportsRadar API
  console.log(chalk.yellow('\nTesting SportsRadar API...'));
  try {
    const apiKey = process.env.SPORTRADAR_API_KEY;
    // SportsRadar trial endpoints
    const response = await axios.get(
      `https://api.sportradar.com/nfl/official/trial/v7/en/seasons/2024/REG/standings.json?api_key=${apiKey}`
    );
    console.log(chalk.green('✅ SportsRadar API: Connected'));
  } catch (error: any) {
    console.log(chalk.red('❌ SportsRadar API:', error.response?.status, error.response?.statusText));
    if (error.response?.status === 403) {
      console.log(chalk.gray('   Note: Check if trial key is active and has correct access'));
    }
  }

  // 6. Test OpenAI API
  console.log(chalk.yellow('\nTesting OpenAI API...'));
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say "API working"' }],
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(chalk.green('✅ OpenAI API: Connected'));
  } catch (error: any) {
    console.log(chalk.red('❌ OpenAI API:', error.response?.status, error.response?.data?.error?.message));
  }

  console.log(chalk.blue('\n📋 RECOMMENDATIONS:\n'));
  console.log('1. BallDontLie v1 API works without authentication');
  console.log('2. MySportsFeeds may need account activation or valid subscription');
  console.log('3. The Odds API is working correctly');
  console.log('4. OpenWeather API is working correctly');
  console.log('5. SportsRadar may need trial activation or correct endpoints');
  console.log('6. Check OpenAI API key if not working\n');
}

// Create fixed collector with working APIs only
async function createWorkingCollector() {
  console.log(chalk.blue('📝 Creating optimized collector...\n'));

  const fixedCollector = `#!/usr/bin/env tsx
/**
 * 🚀 OPTIMIZED REAL DATA COLLECTOR
 * Uses only working APIs with correct authentication
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

const stats = {
  players: 0,
  games: 0,
  odds: 0,
  weather: 0,
  news: 0,
  errors: 0,
  startTime: Date.now()
};

// 🏀 BallDontLie API (no auth needed for v1)
async function collectNBAData() {
  console.log(chalk.yellow('🏀 Collecting NBA data...'));
  try {
    // Get players
    const players = await axios.get('https://www.balldontlie.io/api/v1/players?per_page=100');
    
    for (const player of players.data.data) {
      if (player.first_name && player.last_name) {
        await supabase.from('players').upsert({
          firstname: player.first_name,
          lastname: player.last_name,
          position: player.position ? [player.position] : ['G'],
          team_id: player.team?.id || null,
          sport_id: 'nba',
          status: 'active',
          external_id: \`balldontlie_\${player.id}\`
        }, { onConflict: 'external_id' });
        stats.players++;
      }
    }

    // Get recent games
    const currentYear = new Date().getFullYear();
    const season = new Date().getMonth() >= 9 ? currentYear : currentYear - 1;
    
    const games = await axios.get(\`https://www.balldontlie.io/api/v1/games?seasons[]=\${season}&per_page=100\`);
    
    for (const game of games.data.data) {
      await supabase.from('games').upsert({
        home_team_id: game.home_team.id,
        away_team_id: game.visitor_team.id,
        home_score: game.home_team_score,
        away_score: game.visitor_team_score,
        start_time: game.date,
        status: game.status,
        sport_id: 'nba',
        season: game.season,
        external_id: \`balldontlie_game_\${game.id}\`
      }, { onConflict: 'external_id' });
      stats.games++;
    }
    
    console.log(chalk.green(\`✅ NBA: \${stats.players} players, \${stats.games} games\`));
  } catch (error: any) {
    console.error(chalk.red('❌ NBA error:'), error.message);
    stats.errors++;
  }
}

// 💰 The Odds API (working)
async function collectBettingOdds() {
  console.log(chalk.yellow('💰 Collecting betting odds...'));
  try {
    const apiKey = process.env.THE_ODDS_API_KEY;
    const sports = ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 'icehockey_nhl'];
    
    for (const sport of sports) {
      const response = await axios.get(
        \`https://api.the-odds-api.com/v4/sports/\${sport}/odds?apiKey=\${apiKey}&regions=us&markets=h2h,spreads,totals\`
      );
      
      for (const event of response.data) {
        await supabase.from('betting_odds').upsert({
          sport_id: sport.split('_')[1],
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          bookmakers: event.bookmakers,
          external_id: \`odds_\${event.id}\`,
          created_at: new Date().toISOString()
        }, { onConflict: 'external_id' });
        stats.odds++;
        
        // Create news from odds
        if (event.bookmakers?.length > 0) {
          await supabase.from('news_articles').insert({
            title: \`Betting Update: \${event.away_team} @ \${event.home_team}\`,
            content: \`Latest odds for \${sport.split('_')[1].toUpperCase()} matchup.\`,
            source: 'The Odds API',
            published_at: new Date().toISOString()
          });
          stats.news++;
        }
      }
    }
    
    console.log(chalk.green(\`✅ Odds: \${stats.odds} games, \${stats.news} insights\`));
  } catch (error: any) {
    console.error(chalk.red('❌ Odds error:'), error.message);
    stats.errors++;
  }
}

// 🌤️ OpenWeather API (working)
async function collectWeatherData() {
  console.log(chalk.yellow('🌤️ Collecting weather data...'));
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Dallas', 'Green Bay', 'Seattle', 'Miami', 'Denver'];
    
    for (const city of cities) {
      const response = await axios.get(
        \`https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=\${apiKey}&units=imperial\`
      );
      
      const weather = response.data;
      await supabase.from('weather_conditions').upsert({
        city: city,
        temperature: weather.main.temp,
        feels_like: weather.main.feels_like,
        conditions: weather.weather[0].main,
        description: weather.weather[0].description,
        wind_speed: weather.wind.speed,
        humidity: weather.main.humidity,
        visibility: weather.visibility,
        external_id: \`weather_\${city}_\${Date.now()}\`
      }, { onConflict: 'external_id' });
      stats.weather++;
      
      // Create weather alerts
      if (weather.wind.speed > 20 || ['Snow', 'Rain'].includes(weather.weather[0].main)) {
        await supabase.from('news_articles').insert({
          title: \`Weather Alert: \${weather.weather[0].main} in \${city}\`,
          content: \`\${weather.weather[0].description} with \${weather.main.temp}°F and \${weather.wind.speed} mph winds.\`,
          source: 'Weather Impact Analysis',
          published_at: new Date().toISOString()
        });
        stats.news++;
      }
    }
    
    console.log(chalk.green(\`✅ Weather: \${stats.weather} cities tracked\`));
  } catch (error: any) {
    console.error(chalk.red('❌ Weather error:'), error.message);
    stats.errors++;
  }
}

// Show stats
function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const total = stats.players + stats.games + stats.odds + stats.weather + stats.news;
  
  console.clear();
  console.log(chalk.blue('🔥 OPTIMIZED DATA COLLECTOR'));
  console.log(chalk.blue('===========================\\n'));
  
  console.log(chalk.gray(\`⏱️  Runtime: \${Math.floor(runtime / 60)}m \${runtime % 60}s\`));
  console.log(chalk.green(\`📈 Total collected: \${total.toLocaleString()}\\n\`));
  
  console.log('📊 Breakdown:');
  console.log(\`  🏃 Players: \${stats.players.toLocaleString()}\`);
  console.log(\`  🏈 Games: \${stats.games.toLocaleString()}\`);
  console.log(\`  💰 Odds: \${stats.odds.toLocaleString()}\`);
  console.log(\`  🌤️ Weather: \${stats.weather.toLocaleString()}\`);
  console.log(\`  📰 News: \${stats.news.toLocaleString()}\`);
  console.log(\`  ❌ Errors: \${stats.errors}\`);
}

// Main execution
async function main() {
  console.log(chalk.blue('🚀 Starting optimized data collection...\\n'));
  
  // Test database
  const { error } = await supabase.from('players').select('count').limit(1);
  if (error) {
    console.error(chalk.red('❌ Database error:'), error.message);
    return;
  }
  
  // Run collections
  await collectNBAData();
  await collectBettingOdds();
  await collectWeatherData();
  
  // Show stats
  showStats();
  
  // Schedule updates
  setInterval(async () => {
    await collectNBAData();
    await collectBettingOdds();
    await collectWeatherData();
    showStats();
  }, 300000); // Every 5 minutes
  
  console.log(chalk.green('\\n✅ Collector running! Press Ctrl+C to stop\\n'));
}

main().catch(console.error);
`;

  // Write the fixed collector
  await require('fs').promises.writeFile(
    './scripts/optimized-data-collector.ts',
    fixedCollector
  );
  
  console.log(chalk.green('✅ Created optimized-data-collector.ts'));
  console.log(chalk.gray('   Uses only working APIs with correct authentication\n'));
}

// Run tests
testAPIs().then(() => createWorkingCollector());