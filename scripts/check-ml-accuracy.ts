#!/usr/bin/env tsx
/**
 * 🎯 CHECK CURRENT ML MODEL ACCURACY
 * Quick script to verify what accuracy we're actually getting
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import path from 'path';
import { promises as fs } from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkAccuracy() {
  console.log(chalk.blue.bold('\n🎯 CHECKING ML MODEL ACCURACY\n'));

  try {
    // 1. Check what models exist
    console.log(chalk.yellow('📁 Available models:'));
    const modelsDir = path.join(process.cwd(), 'models');
    const modelDirs = await fs.readdir(modelsDir);
    
    for (const dir of modelDirs) {
      const modelPath = path.join(modelsDir, dir);
      const stats = await fs.stat(modelPath);
      if (stats.isDirectory()) {
        console.log(`  - ${dir}`);
        
        // Check for metadata
        try {
          const metadataPath = path.join(modelPath, 'metadata.json');
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          if (metadata.test_accuracy) {
            console.log(chalk.gray(`    Accuracy: ${(metadata.test_accuracy * 100).toFixed(2)}%`));
          }
        } catch {
          // No metadata
        }
      }
    }

    // 2. Load production model
    console.log(chalk.yellow('\n🔧 Loading production model...'));
    const productionModelPath = path.join(modelsDir, 'production_ultimate', 'model.json');
    
    try {
      const model = await tf.loadLayersModel(`file://${productionModelPath}`);
      console.log(chalk.green('✅ Model loaded successfully'));
      
      // Get model info
      const totalParams = model.countParams();
      console.log(chalk.gray(`   Parameters: ${totalParams.toLocaleString()}`));
      console.log(chalk.gray(`   Input shape: ${JSON.stringify(model.inputs[0].shape)}`));
    } catch (error) {
      console.log(chalk.red('❌ Could not load production model'));
    }

    // 3. Check recent predictions
    console.log(chalk.yellow('\n📊 Recent predictions:'));
    const { data: predictions, error } = await supabase
      .from('ml_predictions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (predictions && predictions.length > 0) {
      let correct = 0;
      let total = 0;
      
      for (const pred of predictions) {
        if (pred.actual_outcome !== null) {
          total++;
          if (pred.predicted_outcome === pred.actual_outcome) {
            correct++;
          }
        }
      }
      
      if (total > 0) {
        const accuracy = (correct / total) * 100;
        console.log(chalk.green(`   Live accuracy: ${accuracy.toFixed(2)}% (${correct}/${total})`));
      } else {
        console.log(chalk.gray('   No predictions with outcomes yet'));
      }
    } else {
      console.log(chalk.gray('   No predictions found'));
    }

    // 4. Summary
    console.log(chalk.blue.bold('\n📈 SUMMARY:'));
    console.log(chalk.white('━'.repeat(50)));
    console.log(chalk.cyan('Expected Accuracy: ~51% (team data limit)'));
    console.log(chalk.cyan('Best Possible: 55-60% (with player data)'));
    console.log(chalk.cyan('Vegas Accuracy: ~65% (with insider info)'));
    console.log(chalk.cyan('Your Target: 75% (unrealistic)'));
    console.log(chalk.white('━'.repeat(50)));
    
    console.log(chalk.yellow('\n💡 RECOMMENDATIONS:'));
    console.log('1. Accept 51% as baseline - it\'s respectable!');
    console.log('2. Focus on UX, real-time updates, voice features');
    console.log('3. Add confidence scores to predictions');
    console.log('4. Consider predicting point totals instead of win/loss');
    console.log('5. Market as "AI insights" not "AI predictions"');

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

checkAccuracy().catch(console.error);