#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BettingOdds {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  overUnder: number;
  spread: number;
  source: string;
  timestamp: Date;
}

async function scrapeBettingOdds() {
  console.log('\n💰 BETTING ODDS SCRAPER - 10X MODE!');
  console.log('==================================================\n');

  try {
    // Get upcoming games without odds
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .is('home_score', null)
      .gte('game_date', new Date().toISOString())
      .order('game_date', { ascending: true })
      .limit(50);

    if (error) throw error;

    console.log(`Found ${games?.length || 0} upcoming games to get odds for\n`);

    let oddsAdded = 0;

    for (const game of games || []) {
      try {
        // ESPN API endpoint (publicly accessible)
        const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`;
        const response = await axios.get(espnUrl);
        
        // Find matching game in ESPN data
        const espnGames = response.data.events || [];
        const matchingGame = espnGames.find((g: any) => {
          const competitors = g.competitions[0].competitors;
          return competitors.some((c: any) => c.team.displayName === game.home_team) &&
                 competitors.some((c: any) => c.team.displayName === game.away_team);
        });

        if (matchingGame) {
          const competition = matchingGame.competitions[0];
          const odds = competition.odds?.[0];
          
          if (odds) {
            // Extract betting data
            const homeTeamData = competition.competitors.find((c: any) => c.homeAway === 'home');
            const awayTeamData = competition.competitors.find((c: any) => c.homeAway === 'away');
            
            const bettingData = {
              game_id: game.id,
              home_moneyline: parseFloat(homeTeamData?.odds?.moneyLine || '0'),
              away_moneyline: parseFloat(awayTeamData?.odds?.moneyLine || '0'),
              spread: parseFloat(odds.details || '0'),
              over_under: parseFloat(odds.overUnder || '0'),
              home_win_probability: parseFloat(homeTeamData?.probabilities?.homeWinPercentage || '0'),
              away_win_probability: parseFloat(awayTeamData?.probabilities?.awayWinPercentage || '0'),
              source: 'ESPN',
              created_at: new Date().toISOString()
            };

            // Store in new betting_odds table
            const { error: insertError } = await supabase
              .from('betting_odds')
              .upsert(bettingData, { onConflict: 'game_id' });

            if (!insertError) {
              oddsAdded++;
              console.log(`✅ Added odds for ${game.home_team} vs ${game.away_team}`);
              console.log(`   Spread: ${bettingData.spread}, O/U: ${bettingData.over_under}`);
              console.log(`   Win Prob: Home ${bettingData.home_win_probability}% Away ${bettingData.away_win_probability}%`);
            }
          }
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`Error getting odds for game ${game.id}:`, err);
      }
    }

    console.log(`\n🎯 BETTING ODDS RESULTS:`);
    console.log(`==============================`);
    console.log(`Games processed: ${games?.length || 0}`);
    console.log(`Odds added: ${oddsAdded}`);
    console.log(`Success rate: ${((oddsAdded / (games?.length || 1)) * 100).toFixed(1)}%`);

    // Now update predictions with betting data
    if (oddsAdded > 0) {
      console.log('\n🔄 Updating predictions with betting insights...');
      await updatePredictionsWithOdds();
    }

  } catch (error) {
    console.error('Scraper error:', error);
  }
}

async function updatePredictionsWithOdds() {
  // Get recent predictions
  const { data: predictions } = await supabase
    .from('ml_predictions')
    .select(`
      *,
      games!inner(
        id,
        home_team,
        away_team
      ),
      betting_odds!inner(
        spread,
        home_win_probability,
        away_win_probability
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  let updated = 0;
  
  for (const pred of predictions || []) {
    if (pred.betting_odds) {
      // Combine ML prediction with Vegas odds
      const mlConfidence = pred.confidence / 100;
      const vegasProb = pred.prediction === 'home' 
        ? pred.betting_odds.home_win_probability / 100
        : pred.betting_odds.away_win_probability / 100;
      
      // Weight: 60% Vegas, 40% ML (Vegas knows better)
      const combinedConfidence = (vegasProb * 0.6 + mlConfidence * 0.4) * 100;
      
      // Update prediction with enhanced confidence
      const { error } = await supabase
        .from('ml_predictions')
        .update({ 
          confidence: combinedConfidence,
          features_used: [...(pred.features_used || []), 'vegas_odds']
        })
        .eq('id', pred.id);
        
      if (!error) {
        updated++;
        console.log(`📈 Enhanced ${pred.games.home_team} vs ${pred.games.away_team}: ${combinedConfidence.toFixed(1)}%`);
      }
    }
  }
  
  console.log(`\n✅ Updated ${updated} predictions with Vegas insights!`);
}

// Create betting_odds table if it doesn't exist
async function ensureBettingOddsTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS betting_odds (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      game_id TEXT UNIQUE NOT NULL,
      home_moneyline FLOAT,
      away_moneyline FLOAT,
      spread FLOAT,
      over_under FLOAT,
      home_win_probability FLOAT,
      away_win_probability FLOAT,
      source TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  console.log('📊 Ensuring betting_odds table exists...');
  // Note: In production, run this via Supabase dashboard
}

// RUN IT!
scrapeBettingOdds().catch(console.error);