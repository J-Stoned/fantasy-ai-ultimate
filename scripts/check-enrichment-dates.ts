#!/usr/bin/env tsx
/**
 * Check what years the ML enrichment data is from
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkEnrichmentDates() {
  console.log(chalk.blue.bold('🔍 CHECKING ML ENRICHMENT DATA DATES\n'));

  // Check weather data game dates
  console.log(chalk.yellow('Weather Data:'));
  const { data: weatherSample } = await supabase
    .from('weather_data')
    .select('game_id')
    .limit(10);
    
  if (weatherSample && weatherSample.length > 0) {
    // Get the games these weather records are for
    const gameIds = weatherSample.map(w => w.game_id);
    const { data: games } = await supabase
      .from('games')
      .select('start_time, sport, metadata')
      .in('id', gameIds);
      
    if (games) {
      const years = new Set<string>();
      games.forEach(g => {
        const year = new Date(g.start_time).getFullYear();
        const season = g.metadata?.season || year;
        years.add(`${g.sport} ${season}`);
      });
      console.log(`  Sample years: ${Array.from(years).join(', ')}`);
    }
  }
  
  // Check betting lines
  console.log(chalk.yellow('\nBetting Lines:'));
  const { data: bettingSample } = await supabase
    .from('betting_lines')
    .select('game_id')
    .limit(10);
    
  if (bettingSample && bettingSample.length > 0) {
    const gameIds = bettingSample.map(b => b.game_id).filter(id => id !== null);
    const { data: games } = await supabase
      .from('games')
      .select('start_time, sport, metadata')
      .in('id', gameIds);
      
    if (games) {
      const years = new Set<string>();
      games.forEach(g => {
        const year = new Date(g.start_time).getFullYear();
        const season = g.metadata?.season || year;
        years.add(`${g.sport} ${season}`);
      });
      console.log(`  Sample years: ${Array.from(years).join(', ')}`);
    }
  }
  
  // Count 2021 enrichment specifically
  console.log(chalk.cyan('\n2021 Enrichment Data Check:'));
  
  // Get all 2021 game IDs
  const { data: games2021 } = await supabase
    .from('games')
    .select('id')
    .eq('metadata->>season', '2021');
    
  if (games2021) {
    const gameIds2021 = games2021.map(g => g.id);
    
    const { count: weatherCount2021 } = await supabase
      .from('weather_data')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds2021);
      
    const { count: bettingCount2021 } = await supabase
      .from('betting_lines')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds2021);
      
    console.log(`  Weather records for 2021 games: ${weatherCount2021 || 0}`);
    console.log(`  Betting lines for 2021 games: ${bettingCount2021 || 0}`);
    
    if ((weatherCount2021 || 0) === 0 && (bettingCount2021 || 0) === 0) {
      console.log(chalk.red('\n❌ No ML enrichment data found for 2021 games!'));
      console.log(chalk.yellow('The enrichment data appears to be from other seasons.'));
    }
  }
}

checkEnrichmentDates().catch(console.error);