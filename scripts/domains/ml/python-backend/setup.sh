#!/bin/bash

# Fantasy ML Python Backend Setup Script
# Sets up the complete Python environment with CUDA support

echo "🚀 Fantasy ML Python Backend Setup"
echo "=================================="

# Check Python version
echo "🐍 Checking Python version..."
python_cmd="python3"
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version 2>&1 | awk '{print $2}')
    echo "✅ Python $python_version found"
else
    echo "❌ Python 3 not found. Please install Python 3.8 or higher."
    exit 1
fi

# Create virtual environment
echo -e "\n📦 Creating virtual environment..."
if [ ! -d "venv" ]; then
    $python_cmd -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo -e "\n🔧 Activating virtual environment..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    source venv/Scripts/activate
else
    # Linux/Mac/WSL
    source venv/bin/activate
fi

# Upgrade pip
echo -e "\n📈 Upgrading pip..."
pip install --upgrade pip wheel setuptools

# Check CUDA availability
echo -e "\n🎮 Checking CUDA availability..."
if command -v nvidia-smi &> /dev/null; then
    echo "✅ NVIDIA GPU detected:"
    nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
    
    # Check CUDA version
    if command -v nvcc &> /dev/null; then
        cuda_version=$(nvcc --version | grep "release" | awk '{print $6}' | cut -c2-)
        echo "✅ CUDA $cuda_version detected"
        
        # Install appropriate CuPy version
        if [[ $cuda_version == 11.* ]]; then
            echo "📦 Installing CuPy for CUDA 11.x..."
            pip install cupy-cuda11x==12.2.0
        elif [[ $cuda_version == 12.* ]]; then
            echo "📦 Installing CuPy for CUDA 12.x..."
            pip install cupy-cuda12x==12.2.0
        else
            echo "⚠️  Unknown CUDA version. Installing CPU-only dependencies."
        fi
    else
        echo "⚠️  CUDA toolkit not found. GPU acceleration will be limited."
    fi
else
    echo "⚠️  No NVIDIA GPU detected. Installing CPU-only dependencies."
fi

# Install requirements
echo -e "\n📦 Installing Python dependencies..."
pip install -r requirements.txt

# Install development dependencies
echo -e "\n🔧 Installing development dependencies..."
pip install pytest pytest-asyncio black flake8 mypy

# Run setup verification
echo -e "\n✅ Running setup verification..."
python setup_cuda.py

# Create necessary directories
echo -e "\n📁 Creating directory structure..."
mkdir -p models/saved
mkdir -p data/cache
mkdir -p logs

# Set environment variables
echo -e "\n🔧 Setting environment variables..."
cat > .env << EOF
# Fantasy ML Python Backend Configuration
PYTHONUNBUFFERED=1
XGB_USE_CUDA=1
NVIDIA_TF32_OVERRIDE=1
CUDA_DEVICE_ORDER=PCI_BUS_ID
LOG_LEVEL=INFO
MODEL_DIR=./models/saved
CACHE_DIR=./data/cache
EOF

echo "✅ Environment variables saved to .env"

# Create startup script
echo -e "\n📝 Creating startup script..."
cat > start_server.sh << 'EOF'
#!/bin/bash
source venv/bin/activate
export $(cat .env | xargs)
echo "🚀 Starting Fantasy ML Prediction Server..."
cd api
uvicorn prediction_server:app --host 0.0.0.0 --port 8000 --reload
EOF

chmod +x start_server.sh

# Create Windows startup script
cat > start_server.bat << 'EOF'
@echo off
call venv\Scripts\activate
for /f "delims=" %%x in (.env) do set "%%x"
echo 🚀 Starting Fantasy ML Prediction Server...
cd api
uvicorn prediction_server:app --host 0.0.0.0 --port 8000 --reload
EOF

echo -e "\n✅ Setup complete!"
echo -e "\n📝 Next steps:"
echo "1. To start the Python server: ./start_server.sh (or start_server.bat on Windows)"
echo "2. To run tests: npm run fantasy:test-ml"
echo "3. To train models: python train_models.py"
echo -e "\n🎯 Your RTX 4060 is ready for 10X ML performance!"