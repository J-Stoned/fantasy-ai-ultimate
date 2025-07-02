#!/bin/bash
# 🚀 Direct GPU Training with Docker

echo "🔥 FANTASY AI GPU TRAINING (Direct Docker)"
echo "=========================================="

# Simple approach - use pre-built TensorFlow GPU image
echo "🏃 Running training with NVIDIA GPU..."

# Pull the latest TensorFlow GPU image
docker pull tensorflow/tensorflow:latest-gpu

# Run training directly
docker run --gpus all --rm -it \
    -v "$(pwd)":/workspace \
    -w /workspace \
    -e CUDA_VISIBLE_DEVICES=0 \
    -e TF_FORCE_GPU_ALLOW_GROWTH=true \
    tensorflow/tensorflow:latest-gpu \
    bash -c "
        # Install Node.js
        apt-get update && apt-get install -y curl
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        
        # Install dependencies
        npm ci
        
        # Run training
        echo '🚀 Starting GPU-accelerated training...'
        npx tsx scripts/train-ml-ultimate.ts
    "

echo "✅ Training complete!"