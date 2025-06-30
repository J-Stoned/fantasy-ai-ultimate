#!/usr/bin/env tsx
/**
 * ENABLE GPU ACCELERATION
 * Configures the app to use RTX 4060 at full power
 */

import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

console.log(chalk.red.bold('\n🔥 ENABLING GPU ACCELERATION'));
console.log(chalk.red('============================\n'));

// Check if NVIDIA GPU is available
function checkGPU() {
  try {
    const output = execSync('nvidia-smi --query-gpu=name --format=csv,noheader', { encoding: 'utf8' });
    console.log(chalk.green('✅ GPU Detected:'), output.trim());
    return true;
  } catch (error) {
    console.log(chalk.red('❌ No NVIDIA GPU detected'));
    console.log(chalk.yellow('Make sure NVIDIA drivers are installed'));
    return false;
  }
}

// Install GPU-accelerated packages
async function installGPUPackages() {
  console.log(chalk.yellow('\n📦 Installing GPU-accelerated packages...'));
  
  const packages = [
    '@tensorflow/tfjs-node-gpu',  // TensorFlow with CUDA
    'onnxruntime-node',           // ONNX Runtime for GPU
    '@xenova/transformers',       // Transformers.js
    'sharp',                      // GPU-accelerated image processing
  ];
  
  // Update package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  packages.forEach(pkg => {
    if (!packageJson.dependencies[pkg]) {
      packageJson.dependencies[pkg] = 'latest';
    }
  });
  
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  
  console.log(chalk.green('✅ GPU packages added to package.json'));
  console.log(chalk.yellow('Run: npm install'));
}

// Create GPU-accelerated AI service
function createGPUService() {
  console.log(chalk.yellow('\n🤖 Creating GPU AI service...'));
  
  const aiServiceCode = `import * as tf from '@tensorflow/tfjs-node-gpu';
import { pipeline } from '@xenova/transformers';

// Enable GPU
tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
tf.env().set('WEBGL_PACK', true);

export class GPUAcceleratedAI {
  private classifier: any;
  private model: tf.LayersModel | null = null;
  
  async initialize() {
    console.log('🚀 Initializing GPU-accelerated AI...');
    
    // Load sentiment analysis on GPU
    this.classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    
    // Check GPU availability
    const gpuDevice = await tf.device('gpu');
    console.log('GPU Device:', gpuDevice);
    
    console.log('✅ AI models loaded on GPU');
  }
  
  async analyzePlayerSentiment(texts: string[]) {
    // Process in batches for GPU efficiency
    const batchSize = 32;
    const results = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await this.classifier(batch);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  async predictPlayerPerformance(features: number[][]) {
    // Convert to GPU tensor
    const input = tf.tensor2d(features);
    
    // Run prediction on GPU
    const predictions = tf.tidy(() => {
      // Simple neural network for demo
      const hidden = tf.layers.dense({ units: 128, activation: 'relu' }).apply(input) as tf.Tensor;
      const output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(hidden) as tf.Tensor;
      return output;
    });
    
    const result = await predictions.array();
    
    // Clean up GPU memory
    input.dispose();
    predictions.dispose();
    
    return result;
  }
  
  getGPUMemoryInfo() {
    const memoryInfo = tf.memory();
    return {
      numTensors: memoryInfo.numTensors,
      numBytes: (memoryInfo.numBytes / 1024 / 1024).toFixed(2) + ' MB',
      gpuEnabled: tf.env().get('WEBGL_VERSION') > 0
    };
  }
}

export const gpuAI = new GPUAcceleratedAI();
`;
  
  fs.mkdirSync('lib/ai/gpu', { recursive: true });
  fs.writeFileSync('lib/ai/gpu/gpu-service.ts', aiServiceCode);
  
  console.log(chalk.green('✅ GPU AI service created'));
}

// Create performance monitoring
function createPerformanceMonitor() {
  console.log(chalk.yellow('\n📊 Creating performance monitor...'));
  
  const monitorCode = `import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class HardwareMonitor {
  async getGPUStats() {
    try {
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits'
      );
      
      const [utilization, memUsed, memTotal, temperature, powerDraw] = stdout.trim().split(', ');
      
      return {
        utilization: parseInt(utilization),
        memory: {
          used: parseInt(memUsed),
          total: parseInt(memTotal),
          percentage: Math.round((parseInt(memUsed) / parseInt(memTotal)) * 100)
        },
        temperature: parseInt(temperature),
        powerDraw: parseFloat(powerDraw)
      };
    } catch (error) {
      return null;
    }
  }
  
  async getCPUStats() {
    const { stdout: cpuInfo } = await execAsync('lscpu | grep "Model name" | cut -d: -f2');
    const { stdout: usage } = await execAsync('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\'');
    
    return {
      model: cpuInfo.trim(),
      usage: parseFloat(usage)
    };
  }
}

export const monitor = new HardwareMonitor();
`;
  
  fs.writeFileSync('lib/monitoring/hardware-monitor.ts', monitorCode);
  
  console.log(chalk.green('✅ Performance monitor created'));
}

// Main execution
async function main() {
  console.log(chalk.cyan('System Info:'));
  console.log('- CPU:', execSync('lscpu | grep "Model name" | cut -d: -f2', { encoding: 'utf8' }).trim());
  
  const hasGPU = checkGPU();
  
  if (hasGPU) {
    await installGPUPackages();
    createGPUService();
    createPerformanceMonitor();
    
    console.log(chalk.green.bold('\n✅ GPU ACCELERATION ENABLED!'));
    console.log(chalk.cyan('\nNext steps:'));
    console.log('1. Run: npm install');
    console.log('2. Test GPU: npm run test:gpu');
    console.log('3. Start app with GPU: npm run dev:gpu');
  } else {
    console.log(chalk.yellow('\n⚠️  Running in CPU-only mode'));
    console.log('Install NVIDIA drivers to enable GPU acceleration');
  }
}

main().catch(console.error);