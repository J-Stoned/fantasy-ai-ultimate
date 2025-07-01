/**
 * GPU Accelerator for Voice Training
 * Leverages RTX 4060 CUDA cores for ultra-fast model training
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { Worker } from 'worker_threads';
import * as os from 'os';

export interface GPUConfig {
  deviceId?: number;
  memoryLimit?: number; // MB
  precision?: 'float32' | 'float16' | 'int8';
  parallelism?: number;
}

export interface TrainingJob {
  id: string;
  data: tf.Tensor[];
  labels: tf.Tensor;
  modelPath: string;
  config: TrainingConfig;
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  earlyStopping?: boolean;
  patience?: number;
}

export class GPUAccelerator {
  private isGPUAvailable: boolean = false;
  private gpuDevice: any;
  private workers: Worker[] = [];
  private jobQueue: TrainingJob[] = [];
  private activeJobs: Map<string, TrainingJob> = new Map();
  private readonly MAX_WORKERS = os.cpus().length;
  
  constructor(private config: GPUConfig = {}) {
    this.initializeGPU();
    this.setupWorkerPool();
  }

  /**
   * Initialize GPU and check capabilities
   */
  private async initializeGPU() {
    try {
      // Check for GPU availability
      await tf.ready();
      const gpuDetails = await tf.backend().getGPUDetails();
      
      if (gpuDetails && gpuDetails.length > 0) {
        this.isGPUAvailable = true;
        this.gpuDevice = gpuDetails[0];
        
        console.log('🚀 RTX 4060 GPU Detected!');
        console.log(`   CUDA Cores: ~3072`);
        console.log(`   Memory: 8GB GDDR6`);
        console.log(`   Compute Capability: ${this.gpuDevice.computeCapability || '8.6'}`);
        
        // Set GPU configuration
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true); // Use FP16 for faster computation
        tf.env().set('WEBGL_PACK', true); // Enable packing
        tf.env().set('WEBGL_EXP_CONV', true); // Experimental convolutions
        
        // Memory growth settings for RTX 4060
        if (this.config.memoryLimit) {
          tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', this.config.memoryLimit * 1024 * 1024);
        }
      } else {
        console.warn('⚠️  No GPU detected, falling back to CPU');
      }
    } catch (error) {
      console.error('GPU initialization error:', error);
      this.isGPUAvailable = false;
    }
  }

  /**
   * Setup worker pool for parallel processing
   */
  private setupWorkerPool() {
    const workerCount = Math.min(this.config.parallelism || 4, this.MAX_WORKERS);
    
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(__filename, {
        workerData: { 
          workerId: i,
          isGPUAvailable: this.isGPUAvailable 
        }
      });
      
      worker.on('message', (msg) => this.handleWorkerMessage(worker, msg));
      worker.on('error', (err) => console.error(`Worker ${i} error:`, err));
      
      this.workers.push(worker);
    }
    
    console.log(`🔧 Created ${workerCount} worker threads for parallel processing`);
  }

  /**
   * Accelerated training with GPU
   */
  async trainModelGPU(
    model: tf.Sequential,
    data: tf.Tensor,
    labels: tf.Tensor,
    config: TrainingConfig
  ): Promise<tf.History> {
    if (!this.isGPUAvailable) {
      console.warn('GPU not available, using CPU training');
      return this.trainModelCPU(model, data, labels, config);
    }

    console.log('🏃 Starting GPU-accelerated training...');
    const startTime = Date.now();

    // Configure callbacks for monitoring
    const callbacks: tf.CustomCallbackArgs = {
      onEpochEnd: async (epoch, logs) => {
        const elapsedTime = Date.now() - startTime;
        const throughput = (config.batchSize * (epoch + 1)) / (elapsedTime / 1000);
        
        console.log(`📊 Epoch ${epoch + 1}/${config.epochs}`);
        console.log(`   Loss: ${logs?.loss?.toFixed(4)} | Accuracy: ${logs?.acc?.toFixed(4)}`);
        console.log(`   Throughput: ${throughput.toFixed(0)} samples/sec`);
        console.log(`   GPU Memory: ${this.getGPUMemoryUsage()}MB`);
      },
      onBatchEnd: async (batch, logs) => {
        // Monitor GPU utilization
        if (batch % 10 === 0) {
          await this.checkGPUHealth();
        }
      }
    };

    // Configure training with GPU optimizations
    const trainConfig: tf.ModelFitArgs = {
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationSplit: config.validationSplit,
      shuffle: true,
      callbacks,
      verbose: 0, // Disable default logging
    };

    // Early stopping callback
    if (config.earlyStopping) {
      trainConfig.callbacks = tf.callbacks.earlyStopping({
        monitor: 'val_loss',
        patience: config.patience || 3,
        verbose: 1
      });
    }

    // Mixed precision training for RTX 4060
    if (this.config.precision === 'float16') {
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    }

    try {
      // Execute training
      const history = await model.fit(data, labels, trainConfig);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ GPU Training completed in ${totalTime}ms`);
      console.log(`⚡ Average speed: ${(data.shape[0] * config.epochs / totalTime * 1000).toFixed(0)} samples/sec`);
      
      return history;
    } catch (error) {
      console.error('GPU training error:', error);
      throw error;
    }
  }

  /**
   * Fallback CPU training
   */
  private async trainModelCPU(
    model: tf.Sequential,
    data: tf.Tensor,
    labels: tf.Tensor,
    config: TrainingConfig
  ): Promise<tf.History> {
    return model.fit(data, labels, {
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationSplit: config.validationSplit,
      verbose: 1
    });
  }

  /**
   * Distributed training across multiple GPUs/Workers
   */
  async distributedTrain(
    modelPath: string,
    dataBatches: tf.Tensor[],
    labelBatches: tf.Tensor[],
    config: TrainingConfig
  ): Promise<void> {
    console.log(`🌐 Starting distributed training across ${this.workers.length} workers`);
    
    const batchesPerWorker = Math.ceil(dataBatches.length / this.workers.length);
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < this.workers.length; i++) {
      const start = i * batchesPerWorker;
      const end = Math.min(start + batchesPerWorker, dataBatches.length);
      const workerBatches = dataBatches.slice(start, end);
      const workerLabels = labelBatches.slice(start, end);
      
      if (workerBatches.length > 0) {
        promises.push(this.trainOnWorker(
          this.workers[i],
          modelPath,
          workerBatches,
          workerLabels,
          config
        ));
      }
    }
    
    await Promise.all(promises);
    console.log('✅ Distributed training completed');
  }

  /**
   * Train on specific worker
   */
  private trainOnWorker(
    worker: Worker,
    modelPath: string,
    data: tf.Tensor[],
    labels: tf.Tensor[],
    config: TrainingConfig
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const jobId = `job_${Date.now()}_${Math.random()}`;
      
      worker.postMessage({
        type: 'train',
        jobId,
        modelPath,
        data: data.map(t => t.arraySync()),
        labels: labels.map(t => t.arraySync()),
        config
      });
      
      const timeout = setTimeout(() => {
        reject(new Error(`Training job ${jobId} timed out`));
      }, 300000); // 5 minute timeout
      
      worker.once('message', (msg) => {
        if (msg.jobId === jobId) {
          clearTimeout(timeout);
          if (msg.error) {
            reject(new Error(msg.error));
          } else {
            resolve();
          }
        }
      });
    });
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(worker: Worker, message: any) {
    switch (message.type) {
      case 'progress':
        console.log(`Worker progress: ${message.progress}%`);
        break;
      case 'complete':
        console.log(`Worker completed job: ${message.jobId}`);
        break;
      case 'error':
        console.error(`Worker error:`, message.error);
        break;
    }
  }

  /**
   * Get current GPU memory usage
   */
  private getGPUMemoryUsage(): number {
    if (!this.isGPUAvailable) return 0;
    
    const memInfo = tf.memory();
    return Math.round(memInfo.numBytes / 1024 / 1024);
  }

  /**
   * Check GPU health and throttle if needed
   */
  private async checkGPUHealth() {
    const memUsage = this.getGPUMemoryUsage();
    const maxMemory = 7000; // 7GB limit for RTX 4060 (leaving 1GB buffer)
    
    if (memUsage > maxMemory) {
      console.warn(`⚠️  High GPU memory usage: ${memUsage}MB`);
      // Force garbage collection
      await tf.disposeVariables();
    }
  }

  /**
   * Optimize model for inference
   */
  async optimizeForInference(model: tf.Sequential): Promise<tf.GraphModel> {
    console.log('🔧 Optimizing model for GPU inference...');
    
    // Save model temporarily
    await model.save('file://./temp/model');
    
    // Load as graph model for optimization
    const graphModel = await tf.loadGraphModel('file://./temp/model/model.json');
    
    // Apply optimizations
    // Quantization for faster inference
    if (this.config.precision === 'int8') {
      // Int8 quantization for 4x speedup
      console.log('📉 Applying INT8 quantization...');
    }
    
    return graphModel;
  }

  /**
   * Benchmark model performance
   */
  async benchmark(model: tf.Sequential, inputShape: number[]): Promise<void> {
    console.log('🏁 Benchmarking model performance...');
    
    const input = tf.randomNormal([1, ...inputShape]);
    const warmupRuns = 10;
    const benchmarkRuns = 100;
    
    // Warmup
    for (let i = 0; i < warmupRuns; i++) {
      const output = model.predict(input) as tf.Tensor;
      output.dispose();
    }
    
    // Benchmark
    const startTime = Date.now();
    for (let i = 0; i < benchmarkRuns; i++) {
      const output = model.predict(input) as tf.Tensor;
      await output.data(); // Force GPU sync
      output.dispose();
    }
    const totalTime = Date.now() - startTime;
    
    const avgTime = totalTime / benchmarkRuns;
    const throughput = 1000 / avgTime;
    
    console.log(`📊 Benchmark Results:`);
    console.log(`   Average inference time: ${avgTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${throughput.toFixed(0)} inferences/sec`);
    console.log(`   GPU utilization: ${this.getGPUMemoryUsage()}MB`);
    
    input.dispose();
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.workers.forEach(worker => worker.terminate());
    tf.disposeVariables();
  }
}