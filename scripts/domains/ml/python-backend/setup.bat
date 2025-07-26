@echo off
setlocal EnableDelayedExpansion

echo.
echo 🚀 Fantasy ML Python Backend Setup (Windows)
echo ==========================================

:: Check Python version
echo.
echo 🐍 Checking Python version...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found. Please install Python 3.8 or higher.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

python --version
echo ✅ Python found

:: Create virtual environment
echo.
echo 📦 Creating virtual environment...
if not exist "venv" (
    python -m venv venv
    if errorlevel 1 (
        echo ❌ Failed to create virtual environment
        pause
        exit /b 1
    )
    echo ✅ Virtual environment created
) else (
    echo ✅ Virtual environment already exists
)

:: Activate virtual environment
echo.
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ❌ Failed to activate virtual environment
    pause
    exit /b 1
)

:: Upgrade pip
echo.
echo 📈 Upgrading pip...
python -m pip install --upgrade pip wheel setuptools

:: Check CUDA availability
echo.
echo 🎮 Checking CUDA availability...
where nvidia-smi >nul 2>&1
if errorlevel 1 (
    echo ⚠️  No NVIDIA GPU detected. Installing CPU-only dependencies.
    goto :install_requirements
)

:: GPU detected
echo ✅ NVIDIA GPU detected:
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader

:: Check CUDA version
where nvcc >nul 2>&1
if errorlevel 1 (
    echo ⚠️  CUDA toolkit not found. GPU acceleration will be limited.
    echo Download CUDA from: https://developer.nvidia.com/cuda-downloads
    goto :install_requirements
)

:: CUDA found
for /f "tokens=5" %%i in ('nvcc --version ^| findstr /C:"release"') do set cuda_version=%%i
set cuda_version=%cuda_version:,=%
echo ✅ CUDA %cuda_version% detected

:: Install appropriate CuPy version
echo 📦 Installing CuPy for CUDA %cuda_version%...
if "%cuda_version:~0,2%"=="11" (
    python -m pip install cupy-cuda11x==12.2.0
) else if "%cuda_version:~0,2%"=="12" (
    python -m pip install cupy-cuda12x==12.2.0
) else (
    echo ⚠️  Unknown CUDA version. Installing CPU-only dependencies.
)

:install_requirements
:: Install requirements
echo.
echo 📦 Installing Python dependencies...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

:: Install development dependencies
echo.
echo 🔧 Installing development dependencies...
python -m pip install pytest pytest-asyncio black flake8 mypy

:: Run setup verification
echo.
echo ✅ Running setup verification...
python setup_cuda.py

:: Create necessary directories
echo.
echo 📁 Creating directory structure...
if not exist "models\saved" mkdir models\saved
if not exist "data\cache" mkdir data\cache
if not exist "logs" mkdir logs

:: Create environment file
echo.
echo 🔧 Creating environment configuration...
(
echo # Fantasy ML Python Backend Configuration
echo PYTHONUNBUFFERED=1
echo XGB_USE_CUDA=1
echo NVIDIA_TF32_OVERRIDE=1
echo CUDA_DEVICE_ORDER=PCI_BUS_ID
echo LOG_LEVEL=INFO
echo MODEL_DIR=./models/saved
echo CACHE_DIR=./data/cache
) > .env

echo ✅ Environment variables saved to .env

:: Success message
echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo 1. To start the Python server: start_server.bat
echo 2. To run tests: npm run ml:test
echo 3. To check CUDA: npm run ml:cuda
echo.
echo 🎯 Your RTX 4060 is ready for 10X ML performance!
echo.
pause