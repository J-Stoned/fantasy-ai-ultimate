/**
 * GPU Configuration for TensorFlow
 * Optimizes RTX 4060 performance
 */

import * as tf from '@tensorflow/tfjs-node-gpu';

export async function configureGPU() {
  console.log('🎮 Configuring GPU for optimal performance...');

  // Enable memory growth to prevent OOM errors
  tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
  tf.env().set('WEBGL_PACK', true);
  tf.env().set('WEBGL_EXP_CONV', true);
  
  // Set backend flags for better performance
  tf.env().set('KEEP_INTERMEDIATE_TENSORS', false);
  tf.env().set('WEBGL_CPU_FORWARD', false);
  
  // Enable mixed precision for RTX 4060
  tf.env().set('WEBGL_RENDER_FLOAT32_CAPABLE', true);
  tf.env().set('WEBGL_RENDER_FLOAT32_ENABLED', true);
  
  // Wait for backend to be ready
  await tf.ready();
  
  const backend = tf.getBackend();
  console.log(`✅ TensorFlow backend: ${backend}`);
  
  // Log GPU info
  if (backend === 'tensorflow') {
    const gpuInfo = await tf.ENV.getAsync('WEBGL_VERSION');
    console.log('🚀 GPU Acceleration Active');
    console.log(`📊 WebGL Version: ${gpuInfo || 'N/A'}`);
    
    // Memory info
    const memInfo = tf.memory();
    console.log(`💾 Initial memory usage: ${Math.round(memInfo.numBytes / 1024 / 1024)}MB`);
  }
  
  return backend;
}

/**
 * Configure training optimizations
 */
export function getTrainingConfig() {
  return {
    // Batch size optimized for RTX 4060 (8GB VRAM)
    batchSize: 64,
    
    // Enable mixed precision training
    useMixedPrecision: true,
    
    // XLA compilation for faster ops
    useXLA: true,
    
    // Gradient accumulation for larger effective batch size
    gradientAccumulationSteps: 4,
    
    // Memory optimization
    gradientCheckpointing: true,
    
    // Multi-GPU settings (future expansion)
    distributed: false,
    
    // TensorFlow specific optimizations
    tfConfig: {
      // Use NCHW format for better GPU performance
      dataFormat: 'channelsFirst',
      
      // Enable TF optimizations
      optimizeCPU: false,
      optimizeGPU: true,
      
      // Thread settings for data loading
      numThreads: 6, // Ryzen 5 7600X has 6 cores
      
      // Prefetch data to GPU
      prefetchToDevice: true,
      prefetchSize: 4
    }
  };
}

/**
 * Monitor GPU memory usage
 */
export async function monitorGPUMemory() {
  const memInfo = tf.memory();
  const numTensors = memInfo.numTensors;
  const numBytes = memInfo.numBytes;
  const numBytesInGPU = memInfo.numBytesInGPU || 0;
  
  const stats = {
    totalMemoryMB: Math.round(numBytes / 1024 / 1024),
    gpuMemoryMB: Math.round(numBytesInGPU / 1024 / 1024),
    numTensors,
    unreliable: memInfo.unreliable || false
  };
  
  // Check if we're approaching memory limits (8GB for RTX 4060)
  const memoryUsagePercent = (numBytesInGPU / (8 * 1024 * 1024 * 1024)) * 100;
  
  if (memoryUsagePercent > 80) {
    console.warn(`⚠️ High GPU memory usage: ${memoryUsagePercent.toFixed(1)}%`);
    // Trigger cleanup
    await tf.disposeVariables();
  }
  
  return stats;
}

/**
 * Benchmark GPU performance
 */
export async function benchmarkGPU() {
  console.log('🏁 Running GPU benchmark...');
  
  const sizes = [128, 256, 512, 1024];
  const results: any[] = [];
  
  for (const size of sizes) {
    // Create random tensors
    const a = tf.randomNormal([size, size]);
    const b = tf.randomNormal([size, size]);
    
    // Warmup
    const warmup = tf.matMul(a, b);
    await warmup.data();
    warmup.dispose();
    
    // Benchmark
    const startTime = performance.now();
    const result = tf.matMul(a, b);
    await result.data();
    const endTime = performance.now();
    
    const time = endTime - startTime;
    const gflops = (2 * size * size * size) / (time * 1e6);
    
    results.push({
      size: `${size}x${size}`,
      timeMs: time.toFixed(2),
      gflops: gflops.toFixed(2)
    });
    
    // Cleanup
    a.dispose();
    b.dispose();
    result.dispose();
  }
  
  console.table(results);
  return results;
}

/**
 * Setup CUDA environment variables
 */
export function setupCUDAEnvironment() {
  // These would be set in the shell, but documenting here
  const cudaEnvVars = {
    CUDA_VISIBLE_DEVICES: '0', // Use first GPU (RTX 4060)
    TF_FORCE_GPU_ALLOW_GROWTH: 'true', // Dynamic memory allocation
    TF_GPU_THREAD_MODE: 'gpu_private', // Better multi-stream performance
    TF_GPU_THREAD_COUNT: '2', // Number of GPU threads
    TF_CUDNN_USE_AUTOTUNE: '1', // Auto-tune cuDNN kernels
    TF_ENABLE_ONEDNN_OPTS: '1', // Enable oneDNN optimizations
    TF_CPP_MIN_LOG_LEVEL: '2' // Reduce logging verbosity
  };
  
  return cudaEnvVars;
}