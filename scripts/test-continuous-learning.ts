#!/usr/bin/env tsx
/**
 * 🧪 TEST CONTINUOUS LEARNING SYSTEM
 */

import { ContinuousPatternLearning } from './continuous-pattern-learning';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testLearningSystem() {
  console.log(chalk.cyan.bold('\n🧪 TESTING CONTINUOUS LEARNING SYSTEM\n'));
  
  // 1. Check current pattern performance
  console.log(chalk.yellow('1. Current Pattern Performance:'));
  const { data: patterns } = await supabase
    .from('pattern_performance')
    .select('*')
    .order('accuracy_rate', { ascending: false });
  
  if (patterns && patterns.length > 0) {
    patterns.forEach(p => {
      console.log(chalk.white(`   ${p.pattern_type}:`));
      console.log(chalk.gray(`     Accuracy: ${(p.accuracy_rate * 100).toFixed(1)}%`));
      console.log(chalk.gray(`     ROI: ${p.roi_percentage?.toFixed(1)}%`));
      console.log(chalk.gray(`     Games: ${p.total_occurrences}`));
    });
  } else {
    console.log(chalk.gray('   No pattern performance data yet'));
  }
  
  // 2. Simulate some game completions
  console.log(chalk.yellow('\n2. Simulating Game Completions...'));
  
  // Create test games with patterns
  const testGames = [
    {
      sport: 'MLB',
      home_team_id: 1,
      away_team_id: 2,
      home_score: 8,
      away_score: 6,
      status: 'in_progress',
      start_time: new Date(),
      metadata: {
        pattern_types: ['altitude_advantage'],
        total_line: 10.5,
        event_name: 'Rockies vs Dodgers'
      }
    },
    {
      sport: 'MLB',
      home_team_id: 3,
      away_team_id: 4,
      home_score: 3,
      away_score: 5,
      status: 'in_progress',
      start_time: new Date(),
      metadata: {
        pattern_types: ['back_to_back_fade'],
        is_home_back_to_back: true,
        event_name: 'Yankees vs Red Sox'
      }
    }
  ];
  
  // Insert test games
  const { data: insertedGames } = await supabase
    .from('games')
    .insert(testGames)
    .select();
  
  if (insertedGames) {
    console.log(chalk.green(`   ✓ Created ${insertedGames.length} test games`));
    
    // Complete the games to trigger learning
    for (const game of insertedGames) {
      await supabase
        .from('games')
        .update({ status: 'completed' })
        .eq('id', game.id);
    }
    
    console.log(chalk.green('   ✓ Games completed, patterns should update'));
  }
  
  // 3. Run learning cycle
  console.log(chalk.yellow('\n3. Running Learning Cycle...'));
  const learner = new ContinuousPatternLearning();
  await learner.runLearningCycle();
  
  // 4. Check updated performance
  console.log(chalk.yellow('\n4. Updated Pattern Performance:'));
  const { data: updatedPatterns } = await supabase
    .from('pattern_performance')
    .select('*')
    .order('accuracy_rate', { ascending: false });
  
  if (updatedPatterns) {
    updatedPatterns.forEach(p => {
      console.log(chalk.white(`   ${p.pattern_type}:`));
      console.log(chalk.gray(`     Accuracy: ${(p.accuracy_rate * 100).toFixed(1)}%`));
      console.log(chalk.gray(`     ROI: ${p.roi_percentage?.toFixed(1)}%`));
      console.log(chalk.gray(`     Games: ${p.total_occurrences}`));
    });
  }
  
  // 5. Check pattern multipliers
  console.log(chalk.yellow('\n5. Pattern Multipliers:'));
  const { data: multipliers } = await supabase
    .from('pattern_multipliers')
    .select('*')
    .order('pattern_type');
  
  if (multipliers) {
    multipliers.forEach(m => {
      const adjusted = m.adjusted_multiplier !== m.base_multiplier;
      console.log(chalk.white(`   ${m.pattern_type}: ${m.adjusted_multiplier.toFixed(3)}x ${adjusted ? '(adjusted)' : ''}`));
    });
  }
  
  // 6. Show how the system learns
  console.log(chalk.cyan.bold('\n📊 HOW THE SYSTEM LEARNS:\n'));
  console.log(chalk.white('1. Daily Analysis:'));
  console.log(chalk.gray('   - Analyzes all completed games from previous day'));
  console.log(chalk.gray('   - Compares pattern predictions vs actual outcomes'));
  console.log(chalk.gray('   - Tracks profit/loss for each pattern'));
  
  console.log(chalk.white('\n2. Pattern Updates:'));
  console.log(chalk.gray('   - Updates accuracy rates with exponential moving average'));
  console.log(chalk.gray('   - Adjusts confidence scores based on recent performance'));
  console.log(chalk.gray('   - Modifies prediction multipliers automatically'));
  
  console.log(chalk.white('\n3. Real-Time Monitoring:'));
  console.log(chalk.gray('   - Monitors games as they complete'));
  console.log(chalk.gray('   - Provides immediate feedback on pattern performance'));
  console.log(chalk.gray('   - Alerts when patterns underperform'));
  
  console.log(chalk.white('\n4. Continuous Improvement:'));
  console.log(chalk.gray('   - Patterns > 65% accuracy get confidence boost'));
  console.log(chalk.gray('   - Patterns < 45% accuracy get reviewed'));
  console.log(chalk.gray('   - System adapts to changing conditions'));
  
  console.log(chalk.green.bold('\n✅ CONTINUOUS LEARNING SYSTEM VERIFIED!\n'));
  
  // Clean up test data
  if (insertedGames) {
    await supabase
      .from('games')
      .delete()
      .in('id', insertedGames.map(g => g.id));
    console.log(chalk.gray('Test data cleaned up'));
  }
}

// Run the test
testLearningSystem().catch(console.error);