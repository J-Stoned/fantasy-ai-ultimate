#!/usr/bin/env tsx
/**
 * 🎯 BALANCED FINAL MODEL
 * Using all learnings for best accuracy
 */

import chalk from 'chalk';
import { RandomForestClassifier } from 'ml-random-forest';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trainBalancedFinal() {
  console.log(chalk.bold.cyan('🎯 BALANCED FINAL MODEL'));
  console.log(chalk.yellow('Combining all learnings for best accuracy'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // Load significant sample from each sport
    console.log(chalk.cyan('1️⃣ Loading balanced data...'));
    
    const queries = [
      { sport: 'nfl', limit: 5000 },
      { sport: 'nba', limit: 1000 },
      { sport: 'mlb', limit: 1000 },
      { sport: 'nhl', limit: 500 },
      { sport: 'football', limit: 500 },
      { sport: 'basketball', limit: 500 },
      { sport: 'baseball', limit: 500 }
    ];
    
    const allGames: any[] = [];
    
    for (const q of queries) {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('sport_id', q.sport)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(q.limit);
      
      if (data && data.length > 0) {
        allGames.push(...data);
        console.log(chalk.gray(`  ${q.sport}: ${data.length} games`));
      }
    }
    
    console.log(chalk.green(`✅ Total: ${allGames.length} games`));
    
    // Sort chronologically
    allGames.sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    
    // Build features
    console.log(chalk.cyan('\n2️⃣ Building balanced features...'));
    
    const features: number[][] = [];
    const labels: number[] = [];
    const teamStats = new Map();
    
    for (const game of allGames) {
      const sport = game.sport_id || 'nfl';
      const homeId = game.home_team_id;
      const awayId = game.away_team_id;
      
      // Sport config
      const cfg = {
        nfl: { avg: 45, ha: 0.57, min: 5 },
        football: { avg: 45, ha: 0.57, min: 5 },
        nba: { avg: 110, ha: 0.60, min: 5 },
        basketball: { avg: 110, ha: 0.60, min: 5 },
        mlb: { avg: 9, ha: 0.54, min: 10 },
        baseball: { avg: 9, ha: 0.54, min: 10 },
        nhl: { avg: 6, ha: 0.55, min: 5 },
        hockey: { avg: 6, ha: 0.55, min: 5 }
      }[sport] || { avg: 50, ha: 0.55, min: 5 };
      
      // Init teams
      [homeId, awayId].forEach(id => {
        if (!teamStats.has(id)) {
          teamStats.set(id, {
            g: 0, w: 0, hg: 0, hw: 0, ag: 0, aw: 0,
            pf: 0, pa: 0, last: [], elo: 1500, mom: 0.5
          });
        }
      });
      
      const h = teamStats.get(homeId);
      const a = teamStats.get(awayId);
      
      // Need minimum games
      if (h.g >= cfg.min && a.g >= cfg.min) {
        // Calculate features
        const hwr = h.w / h.g;
        const awr = a.w / a.g;
        const hhwr = h.hg > 0 ? h.hw / h.hg : hwr;
        const aawr = a.ag > 0 ? a.aw / a.ag : awr;
        const hpf = h.pf / h.g;
        const apf = a.pf / a.g;
        const hpa = h.pa / h.g;
        const apa = a.pa / a.g;
        const hform = h.last.slice(-10).reduce((x, y) => x + y, 0) / Math.min(h.last.length, 10);
        const aform = a.last.slice(-10).reduce((x, y) => x + y, 0) / Math.min(a.last.length, 10);
        
        features.push([
          // Differentials
          hwr - awr,
          hhwr - aawr,
          (hpf - apf) / cfg.avg,
          (apa - hpa) / cfg.avg,
          hform - aform,
          (h.elo - a.elo) / 400,
          h.mom - a.mom,
          // Absolutes
          hwr, awr, hhwr, aawr,
          hform, aform,
          h.elo / 1500, a.elo / 1500,
          // Scoring
          hpf / cfg.avg, apf / cfg.avg,
          hpa / cfg.avg, apa / cfg.avg,
          // Context
          cfg.ha,
          // Sport
          sport === 'nfl' || sport === 'football' ? 1 : 0,
          sport === 'nba' || sport === 'basketball' ? 1 : 0,
          sport === 'mlb' || sport === 'baseball' ? 1 : 0
        ]);
        
        labels.push(game.home_score > game.away_score ? 1 : 0);
      }
      
      // Update stats
      const hw = game.home_score > game.away_score;
      h.g++; a.g++;
      h.hg++; a.ag++;
      h.pf += game.home_score;
      h.pa += game.away_score;
      a.pf += game.away_score;
      a.pa += game.home_score;
      
      if (hw) {
        h.w++; h.hw++;
        h.last.push(1); a.last.push(0);
      } else {
        a.w++; a.aw++;
        h.last.push(0); a.last.push(1);
      }
      
      // Update ELO
      const exp = 1 / (1 + Math.pow(10, (a.elo - h.elo) / 400));
      h.elo += 20 * ((hw ? 1 : 0) - exp);
      a.elo += 20 * ((hw ? 0 : 1) - (1 - exp));
      
      // Momentum
      h.mom = h.mom * 0.7 + (hw ? 1 : 0) * 0.3;
      a.mom = a.mom * 0.7 + (hw ? 0 : 1) * 0.3;
      
      // Trim lists
      if (h.last.length > 20) h.last.shift();
      if (a.last.length > 20) a.last.shift();
    }
    
    console.log(chalk.green(`✅ Built ${features.length} features`));
    
    // Check balance
    const homeWins = labels.filter(l => l === 1).length;
    console.log(chalk.yellow(`Balance: ${(homeWins/labels.length*100).toFixed(1)}% home wins`));
    
    // Ensure balanced training
    if (homeWins / labels.length < 0.45 || homeWins / labels.length > 0.55) {
      console.log(chalk.yellow('Balancing dataset...'));
      
      // Separate home/away wins
      const homeIdxs: number[] = [];
      const awayIdxs: number[] = [];
      labels.forEach((l, i) => {
        if (l === 1) homeIdxs.push(i);
        else awayIdxs.push(i);
      });
      
      // Balance by undersampling majority class
      const minSize = Math.min(homeIdxs.length, awayIdxs.length);
      const balancedIdxs = [
        ...homeIdxs.slice(0, minSize),
        ...awayIdxs.slice(0, minSize)
      ].sort(() => Math.random() - 0.5);
      
      const balancedFeatures = balancedIdxs.map(i => features[i]);
      const balancedLabels = balancedIdxs.map(i => labels[i]);
      
      features.length = 0;
      labels.length = 0;
      features.push(...balancedFeatures);
      labels.push(...balancedLabels);
      
      console.log(chalk.green(`✅ Balanced to ${features.length} samples (50/50)`));
    }
    
    // Split data
    console.log(chalk.cyan('\n3️⃣ Splitting data...'));
    const split = Math.floor(features.length * 0.8);
    
    const xTrain = features.slice(0, split);
    const yTrain = labels.slice(0, split);
    const xTest = features.slice(split);
    const yTest = labels.slice(split);
    
    console.log(chalk.yellow(`Train: ${xTrain.length}, Test: ${xTest.length}`));
    
    // Train model
    console.log(chalk.cyan('\n4️⃣ Training balanced model...'));
    
    const model = new RandomForestClassifier({
      nEstimators: 200,
      maxDepth: 15,
      minSamplesLeaf: 5,
      maxFeatures: 0.8,
      seed: 42
    });
    
    model.train(xTrain, yTrain);
    console.log(chalk.green('✅ Training complete'));
    
    // Test
    console.log(chalk.cyan('\n5️⃣ Testing...'));
    const preds = model.predict(xTest);
    
    let correct = 0, hc = 0, ht = 0, ac = 0, at = 0;
    
    for (let i = 0; i < preds.length; i++) {
      if (preds[i] === yTest[i]) correct++;
      if (yTest[i] === 1) {
        ht++;
        if (preds[i] === 1) hc++;
      } else {
        at++;
        if (preds[i] === 0) ac++;
      }
    }
    
    const acc = correct / preds.length;
    const hacc = ht > 0 ? hc / ht : 0;
    const aacc = at > 0 ? ac / at : 0;
    
    console.log(chalk.bold.green('\n📊 BALANCED PERFORMANCE:'));
    console.log(chalk.green(`Accuracy: ${(acc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Home: ${(hacc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Away: ${(aacc * 100).toFixed(1)}%`));
    console.log(chalk.green(`Balance: ${(2 * hacc * aacc / (hacc + aacc)).toFixed(3)}`));
    
    // Save
    if (acc >= 0.58) {
      console.log(chalk.cyan('\n6️⃣ Saving model...'));
      
      const modelData = {
        model: model.toJSON(),
        metadata: {
          accuracy: acc,
          homeAccuracy: hacc,
          awayAccuracy: aacc,
          features: 22,
          samples: features.length,
          games: allGames.length,
          balanced: true
        }
      };
      
      fs.writeFileSync('./models/balanced-final-model.json', JSON.stringify(modelData, null, 2));
      console.log(chalk.green('✅ Saved!'));
      
      // Update production
      fs.copyFileSync('./models/balanced-final-model.json', './models/production-model.json');
      console.log(chalk.green('✅ Updated production model'));
    }
    
    console.log(chalk.bold.cyan(`\n\n🎯 BALANCED MODEL: ${(acc * 100).toFixed(1)}%`));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

trainBalancedFinal().catch(console.error);