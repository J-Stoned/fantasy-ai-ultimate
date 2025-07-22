#!/usr/bin/env python3
"""
FastAPI Server for Fantasy ML Predictions
Provides REST endpoints for the Node.js frontend
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import pandas as pd
import numpy as np
from datetime import datetime
import asyncio
import json
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from models.xgboost_gpu_trainer import FantasyMLTrainer
from models.monte_carlo_engine import MonteCarloSimulator
from models.leverage_optimizer import LeverageOptimizer, LineupConstraints

# Initialize FastAPI app
app = FastAPI(title="Fantasy ML Prediction API", version="1.0.0")

# Configure CORS for Node.js access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instances
models = {}
simulators = {}

# Request/Response Models
class PlayerData(BaseModel):
    id: int
    name: str
    position: str
    team: str
    salary: int
    # Feature fields
    avg_fp_last_3: float
    avg_fp_last_5: float
    avg_fp_season: float
    usage_rate: float
    vegas_total: float
    team_implied_total: float
    spread: float
    opponent_dvp_rank: int
    is_home: bool
    # Optional fields for different sports
    target_share: Optional[float] = None
    red_zone_touches: Optional[float] = None
    minutes_avg: Optional[float] = None
    shots_per_game: Optional[float] = None
    batting_order: Optional[int] = None

class PredictionRequest(BaseModel):
    sport: str
    players: List[PlayerData]
    
class SimulationRequest(BaseModel):
    sport: str
    players: List[Dict]
    iterations: int = 10000
    
class LineupRequest(BaseModel):
    sport: str
    site: str  # DK or FD
    players: List[Dict]
    num_lineups: int = 150
    objective: str = "leverage"  # leverage, optimal_pct, projection
    constraints: Optional[Dict] = None

class HealthResponse(BaseModel):
    status: str
    models_loaded: List[str]
    gpu_available: bool
    timestamp: str

# Startup event - load models
@app.on_event("startup")
async def startup_event():
    """Load models on server startup"""
    print("🚀 Starting Fantasy ML Prediction Server...")
    
    # Load available models
    sports = ['NFL', 'NBA', 'MLB', 'NHL']
    for sport in sports:
        try:
            trainer = FantasyMLTrainer(sport)
            model_path = f"./models/saved/{sport}_model_latest.json"
            if os.path.exists(model_path):
                trainer.load_model(model_path)
                models[sport] = trainer
                print(f"✅ Loaded {sport} model")
        except Exception as e:
            print(f"⚠️  Could not load {sport} model: {e}")
    
    # Initialize simulators
    for sport in sports:
        simulators[sport] = MonteCarloSimulator(iterations=10000)
    
    print("✅ Server ready!")

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check server health and loaded models"""
    return HealthResponse(
        status="healthy",
        models_loaded=list(models.keys()),
        gpu_available=models[list(models.keys())[0]].base_params.get('tree_method') == 'gpu_hist' if models else False,
        timestamp=datetime.now().isoformat()
    )

# Prediction endpoint
@app.post("/predict")
async def predict(request: PredictionRequest):
    """Generate predictions for a list of players"""
    
    if request.sport not in models:
        raise HTTPException(status_code=404, detail=f"Model for {request.sport} not loaded")
    
    # Convert players to DataFrame
    players_dict = [player.dict() for player in request.players]
    df = pd.DataFrame(players_dict)
    
    # Get predictions
    trainer = models[request.sport]
    results = trainer.predict(df, return_variance=True)
    
    # Combine with player data
    response = []
    for i, player in enumerate(players_dict):
        response.append({
            'id': player['id'],
            'name': player['name'],
            'position': player['position'],
            'team': player['team'],
            'salary': player['salary'],
            'projection': round(results['predictions'][i], 2),
            'std_dev': round(np.sqrt(results['variance'][i]), 2)
        })
    
    return {
        'sport': request.sport,
        'predictions': response,
        'timestamp': datetime.now().isoformat()
    }

# Monte Carlo simulation endpoint
@app.post("/simulate")
async def simulate(request: SimulationRequest):
    """Run Monte Carlo simulations on a player pool"""
    
    if request.sport not in simulators:
        raise HTTPException(status_code=404, detail=f"Simulator for {request.sport} not available")
    
    # Get simulator
    simulator = simulators[request.sport]
    
    # Update iterations if different from default
    if request.iterations != simulator.iterations:
        simulator.iterations = request.iterations
    
    # Run simulation
    results = await asyncio.to_thread(
        simulator.simulate_slate,
        request.players,
        request.sport
    )
    
    return {
        'sport': request.sport,
        'iterations': request.iterations,
        'results': results,
        'timestamp': datetime.now().isoformat()
    }

# Lineup optimization endpoint
@app.post("/optimize")
async def optimize_lineups(request: LineupRequest):
    """Generate optimized lineups using leverage scoring"""
    
    # Create optimizer
    optimizer = LeverageOptimizer(site=request.site, sport=request.sport)
    
    # Convert players to DataFrame
    df = pd.DataFrame(request.players)
    
    # Create constraints if provided
    constraints = None
    if request.constraints:
        constraints = LineupConstraints(**request.constraints)
    
    # Generate lineups (run in thread to avoid blocking)
    lineups = await asyncio.to_thread(
        optimizer.generate_lineup_portfolio,
        df,
        request.num_lineups,
        request.objective,
        constraints
    )
    
    return {
        'sport': request.sport,
        'site': request.site,
        'objective': request.objective,
        'num_lineups': len(lineups),
        'lineups': lineups,
        'timestamp': datetime.now().isoformat()
    }

# Feature importance endpoint
@app.get("/feature-importance/{sport}")
async def get_feature_importance(sport: str, top_n: int = 20):
    """Get feature importance for a specific sport model"""
    
    if sport not in models:
        raise HTTPException(status_code=404, detail=f"Model for {sport} not loaded")
    
    trainer = models[sport]
    importance = trainer.get_feature_importance(top_n)
    
    return {
        'sport': sport,
        'features': [
            {'name': feat, 'importance': round(score, 2)}
            for feat, score in importance
        ]
    }

# Batch prediction endpoint for performance
@app.post("/predict-batch")
async def predict_batch(sports_requests: List[PredictionRequest]):
    """Batch predictions across multiple sports"""
    
    all_results = []
    
    for request in sports_requests:
        try:
            result = await predict(request)
            all_results.append(result)
        except Exception as e:
            all_results.append({
                'sport': request.sport,
                'error': str(e)
            })
    
    return {
        'results': all_results,
        'timestamp': datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    
    # Run the server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )