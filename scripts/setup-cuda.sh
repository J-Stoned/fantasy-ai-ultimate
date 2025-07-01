#!/bin/bash
# CUDA Setup Script for WSL2 with RTX 4060
# This helps configure CUDA libraries for TensorFlow GPU support

echo "🚀 CUDA Setup for Fantasy AI GPU Acceleration"
echo "==========================================="
echo ""

# Check if running in WSL
if grep -qi microsoft /proc/version; then
    echo "✅ Detected WSL environment"
else
    echo "⚠️  Not running in WSL - this script is designed for WSL2"
fi

# Check NVIDIA GPU
echo ""
echo "🎮 Checking GPU..."
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader || {
    echo "❌ nvidia-smi not found. Please ensure NVIDIA drivers are installed on Windows."
    exit 1
}

# Check current CUDA paths
echo ""
echo "📂 Current CUDA environment:"
echo "CUDA_HOME: ${CUDA_HOME:-Not set}"
echo "LD_LIBRARY_PATH: ${LD_LIBRARY_PATH:-Not set}"
echo "PATH contains cuda: $(echo $PATH | grep -o cuda || echo 'No')"

# Instructions for fixing CUDA
echo ""
echo "📋 To fix CUDA for TensorFlow GPU in WSL2:"
echo ""
echo "1. Install CUDA Toolkit in WSL2 (not Windows!):"
echo "   wget https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-wsl-ubuntu.pin"
echo "   sudo mv cuda-wsl-ubuntu.pin /etc/apt/preferences.d/cuda-repository-pin-600"
echo "   wget https://developer.download.nvidia.com/compute/cuda/11.8.0/local_installers/cuda-repo-wsl-ubuntu-11-8-local_11.8.0-1_amd64.deb"
echo "   sudo dpkg -i cuda-repo-wsl-ubuntu-11-8-local_11.8.0-1_amd64.deb"
echo "   sudo cp /var/cuda-repo-wsl-ubuntu-11-8-local/cuda-*-keyring.gpg /usr/share/keyrings/"
echo "   sudo apt-get update"
echo "   sudo apt-get -y install cuda-11-8"
echo ""
echo "2. Install cuDNN 8.6 for CUDA 11.8:"
echo "   # Download from https://developer.nvidia.com/cudnn (requires NVIDIA account)"
echo "   # Then install the .deb packages"
echo ""
echo "3. Add to ~/.bashrc:"
echo "   export CUDA_HOME=/usr/local/cuda-11.8"
echo "   export LD_LIBRARY_PATH=\$LD_LIBRARY_PATH:\$CUDA_HOME/lib64"
echo "   export PATH=\$PATH:\$CUDA_HOME/bin"
echo ""
echo "4. Install Python GPU packages:"
echo "   pip install nvidia-cudnn-cu11==8.6.0.163"
echo "   pip install tensorrt"
echo ""
echo "5. Verify installation:"
echo "   python -c \"import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))\""
echo ""

# Alternative: Use CPU-optimized version for now
echo "🔄 Alternative: Use CPU-optimized TensorFlow for immediate progress:"
echo "   npm uninstall @tensorflow/tfjs-node-gpu"
echo "   npm install @tensorflow/tfjs-node"
echo ""
echo "This will use CPU with AVX512 optimizations while we set up CUDA properly."
echo ""

# Create environment check script
cat > check-gpu-env.js << 'EOF'
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
EOF

echo "✅ Created check-gpu-env.js - Run with: node check-gpu-env.js"
echo ""
echo "📌 For production use, we MUST have proper CUDA installation."
echo "   Maheswaran's systems require real GPU acceleration, not CPU fallback!"