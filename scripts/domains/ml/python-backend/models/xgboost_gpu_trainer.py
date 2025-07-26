#!/usr/bin/env python3
"""
GPU-Accelerated XGBoost Trainer for Fantasy Sports ML
Optimized for RTX 4060 with 8GB VRAM
"""

import xgboost as xgb
import numpy as np
import pandas as pd
from typing import Dict, Tuple, List, Optional
import json
import joblib
from datetime import datetime
import os

# Try to import CuPy for GPU operations, fall back to NumPy
try:
    import cupy as cp
    GPU_AVAILABLE = True
    print("✅ CuPy available - GPU acceleration enabled")
except ImportError:
    cp = np
    GPU_AVAILABLE = False
    print("⚠️  CuPy not available - using CPU fallback")

class FantasyMLTrainer:
    """GPU-accelerated XGBoost trainer for fantasy sports predictions"""
    
    def __init__(self, sport: str, model_dir: str = "./models/saved"):
        self.sport = sport
        self.model_dir = model_dir
        self.model = None
        self.feature_names = None
        self.training_metrics = {}
        
        # Ensure model directory exists
        os.makedirs(self.model_dir, exist_ok=True)
        
        # Define sport-specific features
        self.sport_features = {
            'NFL': [
                'avg_fp_last_3', 'avg_fp_last_5', 'avg_fp_season',
                'usage_rate', 'target_share', 'red_zone_touches',
                'vegas_total', 'team_implied_total', 'spread',
                'opponent_dvp_rank', 'opponent_pace', 
                'days_rest', 'is_home', 'dome_game',
                'salary', 'salary_change', 'value_rating'
            ],
            'NBA': [
                'avg_fp_last_3', 'avg_fp_last_5', 'avg_fp_season',
                'usage_rate', 'minutes_avg', 'pace_impact',
                'vegas_total', 'team_implied_total', 'spread',
                'opponent_dvp_rank', 'opponent_pace',
                'days_rest', 'is_home', 'back_to_back',
                'salary', 'salary_change', 'value_rating'
            ],
            'MLB': [
                'avg_fp_last_5', 'avg_fp_last_10', 'avg_fp_season',
                'batting_order', 'park_factor', 'weather_score',
                'vegas_total', 'team_implied_total',
                'pitcher_rating', 'bullpen_rating',
                'is_home', 'day_game',
                'salary', 'salary_change', 'value_rating'
            ],
            'NHL': [
                'avg_fp_last_3', 'avg_fp_last_5', 'avg_fp_season',
                'shots_per_game', 'powerplay_share', 'minutes_avg',
                'vegas_total', 'team_implied_total', 'spread',
                'opponent_save_pct', 'opponent_pk_rank',
                'days_rest', 'is_home',
                'salary', 'salary_change', 'value_rating'
            ]
        }
        
        # XGBoost parameters optimized for RTX 4060
        self.base_params = {
            'objective': 'reg:squarederror',
            'eval_metric': 'rmse',
            'tree_method': 'gpu_hist' if GPU_AVAILABLE else 'hist',
            'predictor': 'gpu_predictor' if GPU_AVAILABLE else 'cpu_predictor',
            'gpu_id': 0,
            'max_depth': 6,
            'learning_rate': 0.05,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'min_child_weight': 3,
            'gamma': 0.1,
            'reg_alpha': 0.1,
            'reg_lambda': 1.0,
            'random_state': 42
        }
    
    def prepare_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """Prepare features for training, using GPU if available"""
        features = self.sport_features.get(self.sport, self.sport_features['NFL'])
        self.feature_names = features
        
        # Ensure all required features exist
        missing_features = [f for f in features if f not in df.columns]
        if missing_features:
            raise ValueError(f"Missing features: {missing_features}")
        
        X = df[features].values
        
        # Get target if it exists
        y = None
        if 'actual_fp' in df.columns:
            y = df['actual_fp'].values
        
        # Convert to GPU arrays if available
        if GPU_AVAILABLE:
            X = cp.asarray(X, dtype=cp.float32)
            if y is not None:
                y = cp.asarray(y, dtype=cp.float32)
        
        return X, y
    
    def train(self, train_data: pd.DataFrame, val_data: Optional[pd.DataFrame] = None,
              num_boost_round: int = 1000, early_stopping_rounds: int = 50) -> Dict:
        """Train XGBoost model with GPU acceleration"""
        
        print(f"🚀 Training {self.sport} model on {'GPU' if GPU_AVAILABLE else 'CPU'}...")
        
        # Prepare training data
        X_train, y_train = self.prepare_features(train_data)
        
        # Create DMatrix (XGBoost's internal data structure)
        dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=self.feature_names)
        
        # Prepare validation data if provided
        evals = [(dtrain, 'train')]
        if val_data is not None:
            X_val, y_val = self.prepare_features(val_data)
            dval = xgb.DMatrix(X_val, label=y_val, feature_names=self.feature_names)
            evals.append((dval, 'val'))
        
        # Training callbacks
        callbacks = []
        if val_data is not None:
            callbacks.append(xgb.callback.EarlyStopping(
                rounds=early_stopping_rounds,
                metric_name='val-rmse',
                save_best=True
            ))
        
        # Train the model
        start_time = datetime.now()
        
        self.model = xgb.train(
            params=self.base_params,
            dtrain=dtrain,
            num_boost_round=num_boost_round,
            evals=evals,
            callbacks=callbacks,
            verbose_eval=100
        )
        
        training_time = (datetime.now() - start_time).total_seconds()
        
        # Calculate feature importance
        importance = self.model.get_score(importance_type='gain')
        
        # Store training metrics
        self.training_metrics = {
            'sport': self.sport,
            'training_time': training_time,
            'num_trees': self.model.best_iteration if val_data else num_boost_round,
            'feature_importance': importance,
            'gpu_used': GPU_AVAILABLE,
            'timestamp': datetime.now().isoformat()
        }
        
        print(f"✅ Training complete in {training_time:.2f} seconds")
        print(f"   Best iteration: {self.model.best_iteration if val_data else 'N/A'}")
        
        # Save model
        self.save_model()
        
        return self.training_metrics
    
    def predict(self, features_df: pd.DataFrame, return_variance: bool = True) -> Dict:
        """Generate predictions with optional variance estimation"""
        if self.model is None:
            raise ValueError("Model not trained yet. Call train() first.")
        
        # Prepare features
        X, _ = self.prepare_features(features_df)
        
        # Create DMatrix
        dtest = xgb.DMatrix(X, feature_names=self.feature_names)
        
        # Generate predictions
        predictions = self.model.predict(dtest)
        
        # Convert back to CPU if needed
        if GPU_AVAILABLE and hasattr(predictions, 'get'):
            predictions = predictions.get()
        
        result = {
            'predictions': predictions.tolist()
        }
        
        if return_variance:
            # Estimate variance using prediction intervals
            # For a more sophisticated approach, use multiple models or quantile regression
            # Here we use a simple heuristic based on prediction magnitude
            variance = np.abs(predictions) * 0.15 + 2.0  # Base variance of 2.0
            result['variance'] = variance.tolist()
        
        return result
    
    def save_model(self):
        """Save model and metadata"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_path = os.path.join(self.model_dir, f"{self.sport}_model_{timestamp}.json")
        metrics_path = os.path.join(self.model_dir, f"{self.sport}_metrics_{timestamp}.json")
        
        # Save XGBoost model
        self.model.save_model(model_path)
        
        # Save training metrics
        with open(metrics_path, 'w') as f:
            json.dump(self.training_metrics, f, indent=2)
        
        # Create symlink to latest model
        latest_model = os.path.join(self.model_dir, f"{self.sport}_model_latest.json")
        latest_metrics = os.path.join(self.model_dir, f"{self.sport}_metrics_latest.json")
        
        # Remove old symlinks if they exist
        for link in [latest_model, latest_metrics]:
            if os.path.islink(link) or os.path.exists(link):
                os.remove(link)
        
        # Create new symlinks
        os.symlink(os.path.basename(model_path), latest_model)
        os.symlink(os.path.basename(metrics_path), latest_metrics)
        
        print(f"💾 Model saved to {model_path}")
    
    def load_model(self, model_path: Optional[str] = None):
        """Load a saved model"""
        if model_path is None:
            model_path = os.path.join(self.model_dir, f"{self.sport}_model_latest.json")
        
        self.model = xgb.Booster()
        self.model.load_model(model_path)
        
        # Load feature names from metrics
        metrics_path = model_path.replace('_model_', '_metrics_').replace('.json', '.json')
        if os.path.exists(metrics_path):
            with open(metrics_path, 'r') as f:
                metrics = json.load(f)
                self.feature_names = list(metrics.get('feature_importance', {}).keys())
        
        print(f"✅ Model loaded from {model_path}")
    
    def get_feature_importance(self, top_n: int = 20) -> List[Tuple[str, float]]:
        """Get top feature importances"""
        if self.model is None:
            raise ValueError("Model not trained yet.")
        
        importance = self.model.get_score(importance_type='gain')
        sorted_importance = sorted(importance.items(), key=lambda x: x[1], reverse=True)
        
        return sorted_importance[:top_n]

# Example usage
if __name__ == "__main__":
    # Test the trainer
    print("🧪 Testing GPU-accelerated XGBoost trainer...")
    
    # Create sample data
    n_samples = 1000
    n_features = 16
    
    # Generate synthetic training data
    np.random.seed(42)
    feature_names = ['avg_fp_last_3', 'avg_fp_last_5', 'avg_fp_season',
                     'usage_rate', 'target_share', 'red_zone_touches',
                     'vegas_total', 'team_implied_total', 'spread',
                     'opponent_dvp_rank', 'opponent_pace', 
                     'days_rest', 'is_home', 'dome_game',
                     'salary', 'salary_change']
    
    train_data = pd.DataFrame(
        np.random.randn(n_samples, n_features),
        columns=feature_names
    )
    train_data['value_rating'] = np.random.rand(n_samples)
    train_data['actual_fp'] = (
        train_data['avg_fp_season'] * 0.5 +
        train_data['vegas_total'] * 0.3 +
        np.random.randn(n_samples) * 5
    )
    
    # Initialize and train
    trainer = FantasyMLTrainer('NFL')
    metrics = trainer.train(train_data, num_boost_round=100)
    
    print("\n📊 Top 5 important features:")
    for feat, score in trainer.get_feature_importance(5):
        print(f"  {feat}: {score:.2f}")