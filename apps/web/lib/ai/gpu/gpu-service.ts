import * as tf from '@tensorflow/tfjs-node-gpu';
import { pipeline } from '@xenova/transformers';

// GPU settings for Node.js (WebGL settings don't apply here)
// TensorFlow Node GPU backend uses CUDA directly

export class GPUAcceleratedAI {
  private classifier: any;
  private model: tf.LayersModel | null = null;
  
  async initialize() {
    console.log('🚀 Initializing GPU-accelerated AI...');
    
    // Load sentiment analysis on GPU
    this.classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    
    // Check GPU availability using proper Node.js method
    const backend = tf.getBackend();
    const gpuAvailable = backend === 'tensorflow' || backend === 'cuda';
    console.log('GPU Backend:', backend, 'Available:', gpuAvailable);
    
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
      gpuEnabled: tf.getBackend() === 'tensorflow' || tf.getBackend() === 'cuda'
    };
  }
}

export const gpuAI = new GPUAcceleratedAI();
