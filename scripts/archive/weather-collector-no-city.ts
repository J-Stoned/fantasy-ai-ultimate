#!/usr/bin/env tsx
/**
 * 🌤️ WEATHER COLLECTOR - No teams.city column needed
 * Uses hardcoded NFL cities for weather data
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

// NFL Cities for weather tracking
const NFL_CITIES = [
  // AFC East
  { city: 'Buffalo', team: 'Bills' },
  { city: 'Miami', team: 'Dolphins' },
  { city: 'Foxborough', team: 'Patriots' },
  { city: 'East Rutherford', team: 'Jets' },
  
  // AFC North
  { city: 'Baltimore', team: 'Ravens' },
  { city: 'Cincinnati', team: 'Bengals' },
  { city: 'Cleveland', team: 'Browns' },
  { city: 'Pittsburgh', team: 'Steelers' },
  
  // AFC South
  { city: 'Houston', team: 'Texans' },
  { city: 'Indianapolis', team: 'Colts' },
  { city: 'Jacksonville', team: 'Jaguars' },
  { city: 'Nashville', team: 'Titans' },
  
  // AFC West
  { city: 'Denver', team: 'Broncos' },
  { city: 'Kansas City', team: 'Chiefs' },
  { city: 'Las Vegas', team: 'Raiders' },
  { city: 'Los Angeles', team: 'Chargers' },
  
  // NFC East
  { city: 'Dallas', team: 'Cowboys' },
  { city: 'East Rutherford', team: 'Giants' },
  { city: 'Philadelphia', team: 'Eagles' },
  { city: 'Landover', team: 'Commanders' },
  
  // NFC North
  { city: 'Chicago', team: 'Bears' },
  { city: 'Detroit', team: 'Lions' },
  { city: 'Green Bay', team: 'Packers' },
  { city: 'Minneapolis', team: 'Vikings' },
  
  // NFC South
  { city: 'Atlanta', team: 'Falcons' },
  { city: 'Charlotte', team: 'Panthers' },
  { city: 'New Orleans', team: 'Saints' },
  { city: 'Tampa', team: 'Buccaneers' },
  
  // NFC West
  { city: 'Glendale', team: 'Cardinals' },
  { city: 'Los Angeles', team: 'Rams' },
  { city: 'Santa Clara', team: '49ers' },
  { city: 'Seattle', team: 'Seahawks' }
];

// Major cities for other sports
const OTHER_CITIES = [
  'New York', 'Boston', 'Toronto', 'Montreal',
  'Chicago', 'Milwaukee', 'St. Louis', 'Phoenix'
];

async function collectWeatherData() {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.log(chalk.red('❌ No OpenWeather API key found'));
    return;
  }

  console.log(chalk.blue('🌤️ Collecting weather data for NFL cities...'));
  
  let weatherCount = 0;
  let alertCount = 0;
  
  // Get unique cities (some cities have multiple teams)
  const uniqueCities = [...new Set(NFL_CITIES.map(item => item.city))];
  
  for (const city of uniqueCities) {
    try {
      const response = await axios.get(
        'https://api.openweathermap.org/data/2.5/weather',
        {
          params: {
            q: city,
            appid: apiKey,
            units: 'imperial'
          }
        }
      );
      
      const weather = response.data;
      
      // Store weather data
      await supabase.from('weather_conditions').upsert({
        city: city,
        temperature: weather.main.temp,
        feels_like: weather.main.feels_like,
        conditions: weather.weather[0].main,
        description: weather.weather[0].description,
        wind_speed: weather.wind.speed,
        humidity: weather.main.humidity,
        visibility: weather.visibility,
        external_id: `weather_${city.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`
      }, { onConflict: 'external_id' });
      
      weatherCount++;
      
      // Create weather alerts for extreme conditions
      const teams = NFL_CITIES.filter(item => item.city === city).map(item => item.team);
      
      if (weather.wind.speed > 20 || ['Snow', 'Rain', 'Thunderstorm'].includes(weather.weather[0].main)) {
        await supabase.from('news_articles').insert({
          title: `Weather Alert: ${weather.weather[0].main} conditions in ${city}`,
          content: `Current conditions in ${city}: ${weather.weather[0].description} with ${weather.main.temp}°F temperature and ${weather.wind.speed} mph winds. This could impact ${teams.join('/')} games and fantasy performance. Wind speeds above 20 mph significantly affect passing games and field goal accuracy.`,
          source: 'Weather Impact Analysis',
          url: `https://openweathermap.org/city/${weather.id}`,
          published_at: new Date().toISOString()
        });
        alertCount++;
      }
      
      // Cold weather alert
      if (weather.main.temp < 32) {
        await supabase.from('news_articles').insert({
          title: `Cold Weather Alert: ${weather.main.temp}°F in ${city}`,
          content: `Freezing temperatures in ${city} (${weather.main.temp}°F, feels like ${weather.main.feels_like}°F). Cold weather typically favors running games and can impact quarterback performance. ${teams.join('/')} players may see adjusted fantasy projections.`,
          source: 'Weather Impact Analysis',
          url: `https://openweathermap.org/city/${weather.id}`,
          published_at: new Date().toISOString()
        });
        alertCount++;
      }
      
      console.log(chalk.gray(`  ✓ ${city}: ${weather.main.temp}°F, ${weather.weather[0].main}`));
      
    } catch (error: any) {
      console.log(chalk.yellow(`  ⚠ Failed to get weather for ${city}`));
    }
  }
  
  console.log(chalk.green(`✅ Weather collected for ${weatherCount} cities, ${alertCount} alerts created`));
}

async function main() {
  console.log(chalk.blue('🚀 Starting Weather Data Collection\n'));
  
  // Test database connection
  const { error } = await supabase.from('weather_conditions').select('count').limit(1);
  if (error) {
    console.error(chalk.red('❌ Database error. Make sure weather_conditions table exists!'));
    console.log(chalk.yellow('Run the SQL setup script first.'));
    return;
  }
  
  // Initial collection
  await collectWeatherData();
  
  // Schedule updates every hour
  console.log(chalk.blue('\n📅 Scheduling hourly weather updates...'));
  setInterval(collectWeatherData, 3600000); // Every hour
  
  console.log(chalk.green('✅ Weather collector running! Press Ctrl+C to stop\n'));
}

main().catch(console.error);