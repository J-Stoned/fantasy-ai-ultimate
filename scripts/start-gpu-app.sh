#!/bin/bash
# START GPU-ACCELERATED APP

echo "🔥 STARTING GPU-ACCELERATED FANTASY AI ULTIMATE"
echo "=============================================="
echo ""

# Show GPU status
echo "🎮 RTX 4060 Status:"
nvidia-smi --query-gpu=name,memory.used,memory.total,temperature.gpu --format=csv,noheader
echo ""

# Start the app
echo "🚀 Starting Next.js with GPU acceleration..."
echo "Visit: http://localhost:3000"
echo ""
echo "Key GPU-Powered Features:"
echo "  📊 ML Predictions: http://localhost:3000/ml-predictions"
echo "  🎙️ Voice Assistant: http://localhost:3000/voice-assistant"
echo "  🏈 Live Analysis: http://localhost:3000/live-test"
echo "  📱 AR Stats: http://localhost:3000/ar-stats"
echo ""

# Set environment for GPU
export TF_FORCE_GPU_ALLOW_GROWTH=true
export CUDA_VISIBLE_DEVICES=0

# Start the development server
cd /mnt/c/Users/st0ne/Hey\ Fantasy/fantasy-ai-ultimate
npx nx dev web