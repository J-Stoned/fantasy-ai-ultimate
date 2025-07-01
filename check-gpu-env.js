const tf = require('@tensorflow/tfjs-node-gpu');

async function checkGPU() {
  console.log('TensorFlow version:', tf.version.tfjs);
  console.log('Backend:', tf.getBackend());
  
  const gpus = await tf.backend().getGPUDevice();
  console.log('GPU Device:', gpus);
  
  // Test computation
  const a = tf.randomNormal([1000, 1000]);
  const b = tf.randomNormal([1000, 1000]);
  const startTime = Date.now();
  const c = tf.matMul(a, b);
  await c.data();
  const endTime = Date.now();
  
  console.log(`Matrix multiplication (1000x1000): ${endTime - startTime}ms`);
  
  a.dispose();
  b.dispose();
  c.dispose();
}

checkGPU().catch(console.error);
