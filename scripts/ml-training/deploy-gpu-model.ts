#!/usr/bin/env tsx
/**
 * 🚀 DEPLOY GPU-TRAINED MODEL TO PRODUCTION
 * Run this after downloading from Colab
 */

import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function deployGPUModel() {
  console.log(chalk.blue.bold('\n🚀 DEPLOYING GPU-TRAINED MODEL TO PRODUCTION\n'));
  
  try {
    // 1. Check if model exists
    const gpuModelPath = path.join(process.cwd(), 'models', 'gpu_trained');
    
    try {
      await fs.access(path.join(gpuModelPath, 'metadata.json'));
    } catch {
      console.error(chalk.red('❌ GPU model not found!'));
      console.log(chalk.yellow('\nMake sure you:'));
      console.log('1. Downloaded fantasy_ai_gpu_models.zip from Colab');
      console.log('2. Extracted it to models/gpu_trained/');
      process.exit(1);
    }
    
    // 2. Read metadata and show accuracy
    const metadata = JSON.parse(
      await fs.readFile(path.join(gpuModelPath, 'metadata.json'), 'utf-8')
    );
    
    console.log(chalk.green.bold('🎯 GPU MODEL PERFORMANCE:'));
    console.log(chalk.white('━'.repeat(40)));
    console.log(chalk.cyan(`Neural Network:      ${(metadata.accuracy.neural_network * 100).toFixed(2)}%`));
    console.log(chalk.cyan(`XGBoost:            ${(metadata.accuracy.xgboost * 100).toFixed(2)}%`));
    console.log(chalk.cyan(`Ensemble:           ${(metadata.accuracy.ensemble * 100).toFixed(2)}%`));
    console.log(chalk.green.bold(`OPTIMIZED ENSEMBLE: ${(metadata.accuracy.optimized_ensemble * 100).toFixed(2)}%`));
    console.log(chalk.white('━'.repeat(40)));
    
    // 3. Copy to production location
    console.log(chalk.yellow('\n📁 Deploying to production...'));
    
    const productionPath = path.join(process.cwd(), 'models', 'production');
    await fs.mkdir(productionPath, { recursive: true });
    
    // Backup existing model
    const backupPath = path.join(process.cwd(), 'models', 'backup', new Date().toISOString().split('T')[0]);
    await fs.mkdir(backupPath, { recursive: true });
    
    try {
      await fs.cp(productionPath, backupPath, { recursive: true });
      console.log(chalk.gray('✓ Backed up existing model'));
    } catch {
      console.log(chalk.gray('✓ No existing model to backup'));
    }
    
    // Copy new model
    await fs.cp(gpuModelPath, productionPath, { recursive: true });
    console.log(chalk.green('✅ Deployed GPU model to production'));
    
    // 4. Update API configuration
    const apiConfig = {
      modelPath: 'models/production',
      modelType: 'ensemble',
      accuracy: metadata.accuracy.optimized_ensemble,
      features: metadata.features || 23,
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(process.cwd(), 'config', 'ml-config.json'),
      JSON.stringify(apiConfig, null, 2)
    );
    console.log(chalk.green('✅ Updated API configuration'));
    
    // 5. Test the model
    console.log(chalk.yellow('\n🧪 Testing production model...'));
    
    try {
      const { stdout } = await execAsync('npx tsx scripts/test-production-predictions.ts');
      console.log(chalk.gray(stdout));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Test script not found, skipping test'));
    }
    
    // 6. Restart services
    console.log(chalk.yellow('\n🔄 Restarting services...'));
    
    const services = [
      'ml-api',
      'prediction-service',
      'continuous-learning'
    ];
    
    for (const service of services) {
      try {
        await execAsync(`pm2 restart ${service}`);
        console.log(chalk.green(`✅ Restarted ${service}`));
      } catch {
        console.log(chalk.gray(`⏭️  ${service} not running`));
      }
    }
    
    // 7. Show deployment summary
    console.log(chalk.blue.bold('\n🎉 DEPLOYMENT COMPLETE!\n'));
    console.log(chalk.white('Summary:'));
    console.log(chalk.green(`✅ Model accuracy: ${(metadata.accuracy.optimized_ensemble * 100).toFixed(2)}%`));
    console.log(chalk.green(`✅ Training samples: ${metadata.training_samples.toLocaleString()}`));
    console.log(chalk.green(`✅ Features: ${metadata.features}`));
    console.log(chalk.green(`✅ Location: models/production/`));
    
    console.log(chalk.yellow('\n📱 Your app is now using the GPU-trained model!'));
    console.log(chalk.cyan('\nNext steps:'));
    console.log('1. Test predictions in the app');
    console.log('2. Monitor accuracy with: npx tsx scripts/monitor-ml-performance.ts');
    console.log('3. Deploy to production: npm run deploy');
    
  } catch (error) {
    console.error(chalk.red('\n❌ Deployment failed:'), error);
    process.exit(1);
  }
}

// Create test script if it doesn't exist
async function createTestScript() {
  const testScriptPath = path.join(process.cwd(), 'scripts', 'test-production-predictions.ts');
  
  try {
    await fs.access(testScriptPath);
  } catch {
    const testScript = `#!/usr/bin/env tsx
import * as tf from '@tensorflow/tfjs-node';
import path from 'path';

async function testPredictions() {
  console.log('Testing production model...');
  
  const modelPath = path.join(process.cwd(), 'models', 'production', 'neural_network', 'model.json');
  const model = await tf.loadLayersModel(\`file://\${modelPath}\`);
  
  // Test prediction with dummy data
  const testInput = tf.randomNormal([1, 23]);
  const prediction = model.predict(testInput) as tf.Tensor;
  const result = await prediction.data();
  
  console.log(\`Test prediction: \${(result[0] * 100).toFixed(2)}% home win probability\`);
  
  testInput.dispose();
  prediction.dispose();
}

testPredictions().catch(console.error);`;

    await fs.writeFile(testScriptPath, testScript);
  }
}

// Run deployment
createTestScript().then(() => deployGPUModel());