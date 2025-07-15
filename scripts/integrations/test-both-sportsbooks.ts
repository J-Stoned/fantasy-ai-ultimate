#!/usr/bin/env tsx
/**
 * 🎰🎲 TEST BOTH SPORTSBOOKS TOGETHER
 * 
 * Demonstrates DraftKings + FanDuel integration with:
 * - Pattern matching
 * - Arbitrage detection  
 * - Kelly Criterion betting
 */

import { DraftKingsAPI } from './draftkings-real-api';
import { FanDuelAPI } from './fanduel-real-api';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findArbitrageOpportunities(dkOdds: any[], fdOdds: any[]) {
  console.log('\n💎 SEARCHING FOR ARBITRAGE OPPORTUNITIES...');
  console.log('=' .repeat(80));
  
  const arbitrageOpps = [];
  
  // Match games between sportsbooks
  for (const dk of dkOdds) {
    const fd = fdOdds.find(f => 
      f.eventName.includes(dk.eventName.split(' @ ')[0]) ||
      f.eventName.includes(dk.eventName.split(' @ ')[1])
    );
    
    if (!fd) continue;
    
    // Check moneyline arbitrage
    const dkHomeML = dk.markets.moneyline.home;
    const dkAwayML = dk.markets.moneyline.away;
    const fdHomeML = fd.markets?.moneyline?.outcomes?.[0]?.price?.american || fd.markets?.moneyline?.home || -110;
    const fdAwayML = fd.markets?.moneyline?.outcomes?.[1]?.price?.american || fd.markets?.moneyline?.away || -110;
    
    // Convert to implied probabilities
    const getImpliedProb = (odds: number) => {
      return odds < 0 ? -odds / (-odds + 100) : 100 / (odds + 100);
    };
    
    // Check if sum of best odds < 100% (arbitrage exists)
    const bestHomeProb = Math.min(getImpliedProb(dkHomeML), getImpliedProb(fdHomeML));
    const bestAwayProb = Math.min(getImpliedProb(dkAwayML), getImpliedProb(fdAwayML));
    
    if (bestHomeProb + bestAwayProb < 0.98) { // 2% profit margin
      const profit = (1 - (bestHomeProb + bestAwayProb)) * 100;
      
      arbitrageOpps.push({
        event: dk.eventName,
        type: 'moneyline',
        book1: bestHomeProb === getImpliedProb(dkHomeML) ? 'DraftKings' : 'FanDuel',
        book1Bet: 'Home',
        book1Odds: bestHomeProb === getImpliedProb(dkHomeML) ? dkHomeML : fdHomeML,
        book2: bestAwayProb === getImpliedProb(dkAwayML) ? 'DraftKings' : 'FanDuel', 
        book2Bet: 'Away',
        book2Odds: bestAwayProb === getImpliedProb(dkAwayML) ? dkAwayML : fdAwayML,
        profitPercent: profit,
        stake1: (bestAwayProb * 1000).toFixed(2),
        stake2: (bestHomeProb * 1000).toFixed(2)
      });
    }
    
    // Check totals arbitrage
    const dkOver = dk.markets.total.over.odds;
    const dkUnder = dk.markets.total.under.odds;
    const fdOver = fd.markets?.total?.outcomes?.[0]?.price?.american || fd.markets?.total?.over?.odds || -110;
    const fdUnder = fd.markets?.total?.outcomes?.[1]?.price?.american || fd.markets?.total?.under?.odds || -110;
    
    const bestOverProb = Math.min(getImpliedProb(dkOver), getImpliedProb(fdOver));
    const bestUnderProb = Math.min(getImpliedProb(dkUnder), getImpliedProb(fdUnder));
    
    if (bestOverProb + bestUnderProb < 0.98) {
      const profit = (1 - (bestOverProb + bestUnderProb)) * 100;
      
      arbitrageOpps.push({
        event: dk.eventName,
        type: 'total',
        line: dk.markets.total.over.line,
        book1: bestOverProb === getImpliedProb(dkOver) ? 'DraftKings' : 'FanDuel',
        book1Bet: 'Over',
        book1Odds: bestOverProb === getImpliedProb(dkOver) ? dkOver : fdOver,
        book2: bestUnderProb === getImpliedProb(dkUnder) ? 'DraftKings' : 'FanDuel',
        book2Bet: 'Under', 
        book2Odds: bestUnderProb === getImpliedProb(dkUnder) ? dkUnder : fdUnder,
        profitPercent: profit,
        stake1: (bestUnderProb * 1000).toFixed(2),
        stake2: (bestOverProb * 1000).toFixed(2)
      });
    }
  }
  
  return arbitrageOpps;
}

async function main() {
  console.log('🚀 TESTING DRAFTKINGS + FANDUEL INTEGRATION');
  console.log('=' .repeat(80));
  
  // Initialize APIs
  const dk = new DraftKingsAPI();
  const fd = new FanDuelAPI();
  
  try {
    // Fetch odds from both sportsbooks
    console.log('\n📊 Fetching odds from both sportsbooks...\n');
    
    const [dkOdds, fdEvents] = await Promise.all([
      dk.fetchLiveOdds('MLB'),
      fd.fetchMLBOdds()
    ]);
    
    console.log(`\nDraftKings: ${dkOdds.length} games`);
    console.log(`FanDuel: ${fdEvents.length} games`);
    
    // Convert FanDuel format for comparison
    const fdOdds = fdEvents.map(event => ({
      eventId: event.eventId,
      eventName: event.eventName,
      sport: 'MLB',
      startTime: event.startTime,
      markets: {
        moneyline: {
          home: event.markets.moneyline.outcomes[0].price.american,
          away: event.markets.moneyline.outcomes[1].price.american
        },
        total: {
          over: { 
            line: parseFloat(event.markets.total.outcomes[0].name.split(' ')[1]),
            odds: event.markets.total.outcomes[0].price.american
          },
          under: {
            line: parseFloat(event.markets.total.outcomes[1].name.split(' ')[1]),
            odds: event.markets.total.outcomes[1].price.american
          }
        },
        spread: {
          home: {
            line: parseFloat(event.markets.spread.outcomes[0].name.split(' ')[2]),
            odds: event.markets.spread.outcomes[0].price.american
          },
          away: {
            line: parseFloat(event.markets.spread.outcomes[1].name.split(' ')[2]),
            odds: event.markets.spread.outcomes[1].price.american
          }
        }
      },
      lastUpdate: new Date()
    }));
    
    // Find arbitrage opportunities
    const arbitrage = await findArbitrageOpportunities(dkOdds, fdOdds);
    
    if (arbitrage.length > 0) {
      console.log(`\n💰 Found ${arbitrage.length} ARBITRAGE opportunities!\n`);
      
      arbitrage.forEach((arb, idx) => {
        console.log(`${idx + 1}. ${arb.event}`);
        console.log(`   Type: ${arb.type.toUpperCase()}${arb.line ? ` ${arb.line}` : ''}`);
        console.log(`   Bet 1: ${arb.book1} - ${arb.book1Bet} @ ${arb.book1Odds > 0 ? '+' : ''}${arb.book1Odds}`);
        console.log(`   Bet 2: ${arb.book2} - ${arb.book2Bet} @ ${arb.book2Odds > 0 ? '+' : ''}${arb.book2Odds}`);
        console.log(`   Profit: ${arb.profitPercent.toFixed(2)}%`);
        console.log(`   Stakes: $${arb.stake1} / $${arb.stake2} = $${(parseFloat(arb.stake1) + parseFloat(arb.stake2)).toFixed(2)} total`);
        console.log(`   Guaranteed Profit: $${(arb.profitPercent * 10).toFixed(2)}\n`);
      });
    } else {
      console.log('\n❌ No arbitrage opportunities found at current odds');
    }
    
    // Find pattern-based opportunities from DraftKings
    console.log('\n🎯 Finding pattern-based opportunities...\n');
    const dkOpportunities = await dk.findBettingOpportunities(dkOdds);
    
    if (dkOpportunities.length > 0) {
      dk.displayOpportunities(dkOpportunities);
    } else {
      console.log('No pattern-based opportunities found');
    }
    
    // Summary
    console.log('\n' + '=' .repeat(80));
    console.log('📊 INTEGRATION SUMMARY:');
    console.log(`✅ DraftKings Integration: Working (${dkOdds.length} games)`);
    console.log(`✅ FanDuel Integration: Working (${fdEvents.length} games)`);
    console.log(`✅ Arbitrage Detection: ${arbitrage.length} opportunities found`);
    console.log(`✅ Pattern Matching: ${dkOpportunities.length} opportunities found`);
    console.log('=' .repeat(80));
    
  } catch (error) {
    console.error('❌ Error in integration test:', error);
  }
}

if (require.main === module) {
  main();
}

export { findArbitrageOpportunities };