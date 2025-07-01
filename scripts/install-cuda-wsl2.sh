#!/bin/bash
# Script to install CUDA 12.8 for WSL2 with RTX 4060 support

echo "🚀 Installing CUDA Toolkit 12.8 for WSL2..."

# Install CUDA keyring
echo "📦 Installing CUDA keyring..."
sudo dpkg -i cuda-keyring_1.1-1_all.deb

# Update package list
echo "🔄 Updating package list..."
sudo apt-get update

# Install CUDA toolkit
echo "🎮 Installing CUDA Toolkit 12.8..."
sudo apt-get -y install cuda-toolkit-12-8

# Install cuDNN for deep learning
echo "🧠 Installing cuDNN for deep learning..."
sudo apt-get -y install libcudnn9 libcudnn9-dev libcudnn9-cuda-12

# Install additional CUDA libraries for TensorFlow compatibility
echo "📚 Installing CUDA libraries for TensorFlow..."
sudo apt-get install -y \
    cuda-cudart-12-8 \
    cuda-cublas-12-8 \
    cuda-cufft-12-8 \
    cuda-curand-12-8 \
    cuda-cusolver-12-8 \
    cuda-cusparse-12-8

# Create symbolic links for TensorFlow compatibility (expects CUDA 11)
echo "🔗 Creating compatibility links..."
sudo ln -sf /usr/local/cuda-12/lib64/libcudart.so.12 /usr/local/cuda-12/lib64/libcudart.so.11.0
sudo ln -sf /usr/local/cuda-12/lib64/libcublas.so.12 /usr/local/cuda-12/lib64/libcublas.so.11
sudo ln -sf /usr/local/cuda-12/lib64/libcublasLt.so.12 /usr/local/cuda-12/lib64/libcublasLt.so.11
sudo ln -sf /usr/local/cuda-12/lib64/libcufft.so.11 /usr/local/cuda-12/lib64/libcufft.so.10
sudo ln -sf /usr/local/cuda-12/lib64/libcurand.so.10 /usr/local/cuda-12/lib64/libcurand.so.10
sudo ln -sf /usr/local/cuda-12/lib64/libcusolver.so.11 /usr/local/cuda-12/lib64/libcusolver.so.11
sudo ln -sf /usr/local/cuda-12/lib64/libcusparse.so.12 /usr/local/cuda-12/lib64/libcusparse.so.11

# Add CUDA to PATH and LD_LIBRARY_PATH
echo "🛠️ Setting up environment variables..."
echo '' >> ~/.bashrc
echo '# CUDA Configuration for RTX 4060' >> ~/.bashrc
echo 'export PATH=/usr/local/cuda-12/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda-12/lib64:/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc

# Verify installation
echo "✅ Verifying CUDA installation..."
/usr/local/cuda-12/bin/nvcc --version

echo ""
echo "🎉 CUDA installation complete!"
echo "🔄 Please run: source ~/.bashrc"
echo "🚀 Then test with: nvcc --version"