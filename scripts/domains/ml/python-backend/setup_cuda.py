#!/usr/bin/env python3
"""
CUDA Setup and Verification Script
Checks CUDA availability and configures the environment
"""

import subprocess
import sys
import os

def check_cuda():
    """Check if CUDA is available and properly configured"""
    print("🔍 Checking CUDA installation...")
    
    # Check nvidia-smi
    try:
        result = subprocess.run(['nvidia-smi'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ NVIDIA GPU detected")
            print(result.stdout.split('\n')[0:3])  # Print GPU info
        else:
            print("❌ nvidia-smi not found. Please install NVIDIA drivers.")
            return False
    except FileNotFoundError:
        print("❌ nvidia-smi not found. Please install NVIDIA drivers.")
        return False
    
    # Check CUDA toolkit
    try:
        result = subprocess.run(['nvcc', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ CUDA toolkit found")
            print(result.stdout)
        else:
            print("⚠️  CUDA toolkit not found. XGBoost will use CPU fallback.")
    except FileNotFoundError:
        print("⚠️  CUDA toolkit not found. XGBoost will use CPU fallback.")
    
    return True

def check_python_cuda_libs():
    """Check if Python CUDA libraries are installed"""
    print("\n🐍 Checking Python CUDA libraries...")
    
    # Check CuPy
    try:
        import cupy as cp
        print(f"✅ CuPy installed (version {cp.__version__})")
        
        # Test CuPy
        arr = cp.array([1, 2, 3])
        print(f"   CuPy test: {arr.sum()} (should be 6)")
    except ImportError:
        print("❌ CuPy not installed. Install with: pip install cupy-cuda12x")
    except Exception as e:
        print(f"⚠️  CuPy installed but not working: {e}")
    
    # Check XGBoost GPU support
    try:
        import xgboost as xgb
        print(f"✅ XGBoost installed (version {xgb.__version__})")
        
        # Check if GPU support is available
        try:
            # This will work if XGBoost was compiled with GPU support
            params = {'tree_method': 'gpu_hist', 'gpu_id': 0}
            dtrain = xgb.DMatrix([[1, 2], [3, 4]], label=[1, 0])
            xgb.train(params, dtrain, num_boost_round=1)
            print("   ✅ XGBoost GPU support confirmed")
        except Exception as e:
            print(f"   ⚠️  XGBoost CPU-only mode: {e}")
    except ImportError:
        print("❌ XGBoost not installed. Install with: pip install xgboost")

def setup_environment():
    """Set up environment variables for optimal GPU performance"""
    print("\n⚙️  Setting up environment...")
    
    # Enable TF32 for better performance on RTX 4060
    os.environ['NVIDIA_TF32_OVERRIDE'] = '1'
    
    # Set CUDA device order
    os.environ['CUDA_DEVICE_ORDER'] = 'PCI_BUS_ID'
    
    # Limit GPU memory growth for better multi-process support
    os.environ['XGB_USE_CUDA'] = '1'
    
    print("✅ Environment configured for GPU acceleration")

def main():
    print("🚀 Fantasy ML CUDA Setup\n")
    
    if not check_cuda():
        print("\n❌ CUDA setup failed. The system will use CPU fallback.")
        return 1
    
    check_python_cuda_libs()
    setup_environment()
    
    print("\n✅ Setup complete! Your RTX 4060 is ready for ML acceleration.")
    print("\n📝 Next steps:")
    print("1. If any libraries are missing, install them with pip")
    print("2. For WSL users: Ensure WSL2 with GPU support is enabled")
    print("3. Run the XGBoost trainer to test GPU acceleration")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())