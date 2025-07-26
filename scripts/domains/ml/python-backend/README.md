# 🚀 Fantasy ML Python Backend

GPU-accelerated ML system for Daily Fantasy Sports predictions using the "10X Developer" approach.

## 🎯 Overview

This Python backend implements the advanced DFS techniques from "The Quantified Athlete" and "QuantEdge DFS Engine", focusing on:

- **Probabilistic Thinking**: Monte Carlo simulations instead of simple projections
- **Leverage Optimization**: Finding low-owned, high-upside plays
- **GPU Acceleration**: RTX 4060 optimized for 10X performance
- **Three Pillars**: Prediction → Simulation → Leverage

## 🛠️ Setup

### Prerequisites
- Python 3.8+
- NVIDIA GPU with CUDA support (RTX 4060 recommended)
- CUDA Toolkit 11.x or 12.x
- 32GB RAM for optimal performance

### Installation

1. **Windows Setup**:
```bash
# Run from fantasy-ai-ultimate root
npm run ml:setup-win

# Or manually:
cd scripts/fantasy-ml/python-backend
setup.bat
```

2. **Linux/WSL Setup**:
```bash
# Run from fantasy-ai-ultimate root
npm run ml:setup

# Or manually:
cd scripts/fantasy-ml/python-backend
./setup.sh
```

3. **Verify CUDA Setup**:
```bash
npm run ml:cuda
```

## 🏃 Running the System

### 1. Start the Python ML Server
```bash
# Windows
npm run ml:server-win

# Linux/WSL
npm run ml:server
```

The server will start on http://localhost:8000

### 2. Test the Pipeline
```bash
# Test with real NFL data
npm run ml:test
```

### 3. Train Models
```bash
# Train NFL model with your data
npm run ml:train-nfl

# Train all sports (coming soon)
npm run ml:train-all
```

## 📊 Architecture

### Components

1. **XGBoost GPU Trainer** (`models/xgboost_gpu_trainer.py`)
   - GPU-accelerated gradient boosting
   - Sport-specific feature engineering
   - Automatic GPU/CPU fallback

2. **Monte Carlo Engine** (`models/monte_carlo_engine.py`)
   - 10,000 simulations standard
   - GPU random number generation
   - CPU parallel lineup optimization
   - Correlation handling (QB-WR stacks)

3. **Leverage Optimizer** (`models/leverage_optimizer.py`)
   - Linear programming for lineup generation
   - Game theory optimization
   - Multi-lineup portfolio generation
   - DraftKings & FanDuel support

4. **Prediction Server** (`api/prediction_server.py`)
   - FastAPI REST endpoints
   - Real-time predictions
   - Batch processing support
   - WebSocket ready

5. **Node.js Bridge** (`services/python-bridge.ts`)
   - TypeScript interface
   - Automatic server management
   - Data transformation utilities

## 🎮 API Endpoints

### Health Check
```bash
GET /health
```

### Predictions
```bash
POST /predict
{
  "sport": "NFL",
  "players": [...]
}
```

### Monte Carlo Simulation
```bash
POST /simulate
{
  "sport": "NFL",
  "players": [...],
  "iterations": 10000
}
```

### Lineup Optimization
```bash
POST /optimize
{
  "sport": "NFL",
  "site": "DK",
  "players": [...],
  "num_lineups": 150,
  "objective": "leverage"
}
```

### Feature Importance
```bash
GET /feature-importance/NFL?top_n=20
```

## 📈 Performance Metrics

With RTX 4060 + Ryzen 5 7600X:

- **XGBoost Training**: ~5-10x faster than CPU
- **Monte Carlo**: 10K iterations in <2 seconds
- **Lineup Generation**: 150 lineups in <5 seconds
- **Predictions**: 1000 players in <100ms

## 🧪 Testing

### Unit Tests
```bash
cd scripts/fantasy-ml/python-backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
pytest
```

### Integration Test
```bash
npm run ml:test
```

## 📊 Key Metrics

### Leverage Score
```
Leverage = Optimal Lineup % - Projected Ownership %
```

### Optimal Lineup %
Percentage of simulations where player appears in the optimal lineup

### Boom/Bust %
- **Boom**: Scoring 3x value (e.g., $5K salary → 15+ points)
- **Bust**: Scoring <1x value

## 🔧 Configuration

### Environment Variables (.env)
```env
PYTHONUNBUFFERED=1
XGB_USE_CUDA=1
NVIDIA_TF32_OVERRIDE=1
CUDA_DEVICE_ORDER=PCI_BUS_ID
LOG_LEVEL=INFO
MODEL_DIR=./models/saved
CACHE_DIR=./data/cache
```

### GPU Memory Management
The system automatically manages GPU memory to prevent OOM errors:
- Batch processing for large datasets
- Automatic CPU fallback
- Memory-efficient data structures

## 🚀 Advanced Usage

### Custom Feature Engineering
Edit sport-specific features in `xgboost_gpu_trainer.py`:
```python
self.sport_features = {
    'NFL': [
        'avg_fp_last_3', 'avg_fp_last_5', 'avg_fp_season',
        'usage_rate', 'target_share', 'red_zone_touches',
        # Add your custom features here
    ]
}
```

### Hyperparameter Tuning
Modify XGBoost parameters in `xgboost_gpu_trainer.py`:
```python
self.base_params = {
    'max_depth': 6,
    'learning_rate': 0.05,
    'subsample': 0.8,
    # Adjust for your needs
}
```

### Custom Correlations
Add sport-specific correlations in `monte_carlo_engine.py`:
```python
# Example: Add RB-DEF negative correlation
correlations.append({
    'type': 'rb_def_negative',
    'primary': rb_idx,
    'secondary': opposing_def_idx,
    'coefficient': -0.2
})
```

## 🐛 Troubleshooting

### CUDA Not Found
1. Install CUDA Toolkit: https://developer.nvidia.com/cuda-downloads
2. Verify with: `nvidia-smi` and `nvcc --version`
3. Reinstall CuPy: `pip install cupy-cuda12x`

### Out of Memory
1. Reduce batch size in training
2. Lower Monte Carlo iterations
3. Use CPU fallback mode

### Server Won't Start
1. Check if port 8000 is available
2. Verify Python environment is activated
3. Check logs in `logs/` directory

## 📚 References

- [XGBoost GPU Documentation](https://xgboost.readthedocs.io/en/latest/gpu/)
- [CuPy Documentation](https://docs.cupy.dev/en/stable/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## 🎯 Next Steps

1. **Collect More Data**: Weather, injuries, referee tendencies
2. **Advanced Models**: Neural networks for player embeddings
3. **Real-time Updates**: Live odds and ownership projections
4. **Multi-Sport Models**: NBA, MLB, NHL implementations
5. **Production Deployment**: Docker, Kubernetes, monitoring

---

Built with 💪 by a 10X Developer approach!