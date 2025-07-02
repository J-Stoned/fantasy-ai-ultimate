#!/bin/bash
# 🚀 GPU Training Script for Fantasy AI

echo "🔥 FANTASY AI GPU TRAINING SETUP"
echo "================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop with WSL2 backend."
    echo "   Visit: https://docs.docker.com/desktop/windows/wsl/"
    exit 1
fi

# Check if NVIDIA Docker runtime is available
if ! docker info | grep -q "nvidia"; then
    echo "⚠️  NVIDIA Docker runtime not detected."
    echo "   Installing NVIDIA Container Toolkit..."
    echo ""
    echo "   Run these commands in Windows PowerShell (as Admin):"
    echo "   1. Install WSL2 CUDA drivers: https://developer.nvidia.com/cuda/wsl"
    echo "   2. Install Docker Desktop with WSL2 backend"
    echo "   3. Install NVIDIA Container Toolkit:"
    echo "      curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg"
    echo "      curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list"
    echo "      sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit"
    echo "      sudo nvidia-ctk runtime configure --runtime=docker"
    echo "      sudo systemctl restart docker"
    exit 1
fi

# Build the GPU image
echo "🏗️  Building GPU Docker image..."
docker build -t fantasy-ai/ml-gpu:latest -f Dockerfile.ml-gpu .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker image built successfully!"

# Run training with GPU
echo ""
echo "🚀 Starting GPU training..."
echo "   Choose a training script:"
echo "   1) Ultimate (All features)"
echo "   2) Aggressive (Simplified)"
echo "   3) Supreme (Advanced features)"
echo "   4) All scripts (parallel)"
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        docker run --gpus all --rm \
            -v $(pwd)/models:/app/models \
            -v $(pwd)/logs:/app/logs \
            -v $(pwd)/.env.local:/app/.env.local:ro \
            fantasy-ai/ml-gpu:latest \
            npx tsx scripts/train-ml-ultimate.ts
        ;;
    2)
        docker run --gpus all --rm \
            -v $(pwd)/models:/app/models \
            -v $(pwd)/logs:/app/logs \
            -v $(pwd)/.env.local:/app/.env.local:ro \
            fantasy-ai/ml-gpu:latest \
            npx tsx scripts/train-ml-aggressive.ts
        ;;
    3)
        docker run --gpus all --rm \
            -v $(pwd)/models:/app/models \
            -v $(pwd)/logs:/app/logs \
            -v $(pwd)/.env.local:/app/.env.local:ro \
            fantasy-ai/ml-gpu:latest \
            npx tsx scripts/train-ml-supreme.ts
        ;;
    4)
        echo "🔥 Running all training scripts in parallel..."
        docker-compose -f docker-compose.gpu.yml up --build
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

echo ""
echo "✨ Training complete! Check the models/ directory for results."