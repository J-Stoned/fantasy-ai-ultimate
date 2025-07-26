#!/usr/bin/env python3
"""
🎯 Quantile Regression Service for Median-Centric Predictions

Implements Dmochowski (2023) optimal betting theory using statsmodels.
This service provides the core quantile regression functionality for all sports.
"""

import pandas as pd
import numpy as np
import statsmodels.api as sm
from statsmodels.regression.quantile_regression import QuantReg
from typing import Dict, List, Tuple, Optional
import json
import sys
from dataclasses import dataclass


@dataclass
class QuantileModelConfig:
    """Configuration for sport-specific quantile models"""
    sport: str
    target_column: str
    feature_columns: List[str]
    quantiles: List[float] = None
    
    def __post_init__(self):
        if self.quantiles is None:
            # Default quantiles including Dmochowski critical values
            self.quantiles = [0.10, 0.25, 0.476, 0.50, 0.524, 0.75, 0.90]


class QuantileRegressionService:
    """
    Core service for quantile regression predictions.
    Replaces mean-based predictions with median-centric approach.
    """
    
    def __init__(self, config: QuantileModelConfig):
        self.config = config
        self.models = {}
        self.is_trained = False
        
    def train(self, X: pd.DataFrame, y: pd.Series, verbose: bool = True) -> Dict[float, any]:
        """
        Train quantile regression models for all specified quantiles.
        
        Args:
            X: Feature matrix
            y: Target variable
            verbose: Print training progress
            
        Returns:
            Dictionary of trained models by quantile
        """
        # Add constant for intercept
        X_with_const = sm.add_constant(X)
        
        for q in self.config.quantiles:
            if verbose:
                print(f"Training quantile {q:.3f} for {self.config.sport}...")
            
            # Create and fit quantile regression model
            model = QuantReg(y, X_with_const)
            try:
                result = model.fit(q=q, max_iter=1000, p_tol=1e-6)
                self.models[q] = result
                
                if verbose and q == 0.5:  # Show median model stats
                    print(f"\nMedian Model Summary:")
                    print(f"Pseudo R-squared: {result.prsquared:.4f}")
                    print(f"Number of iterations: {result.iterations}")
                    
            except Exception as e:
                print(f"Error training quantile {q}: {e}")
                # Use OLS as fallback for problematic quantiles
                ols_model = sm.OLS(y, X_with_const)
                self.models[q] = ols_model.fit()
                
        self.is_trained = True
        return self.models
    
    def predict_all_quantiles(self, X: pd.DataFrame) -> pd.DataFrame:
        """
        Generate predictions for all trained quantiles.
        
        Returns DataFrame with columns for each quantile prediction.
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before prediction")
            
        X_with_const = sm.add_constant(X)
        predictions = {}
        
        for q, model in self.models.items():
            predictions[f'p{int(q*100)}'] = model.predict(X_with_const)
            
        # Calculate traditional mean for comparison
        if 0.5 in self.models:
            # Approximate mean as weighted average of quantiles
            # This is more robust than training separate OLS
            quantile_values = [predictions[f'p{int(q*100)}'] for q in sorted(self.models.keys())]
            predictions['mean_approx'] = np.mean(quantile_values, axis=0)
            predictions['median'] = predictions['p50']
            predictions['mean_median_gap'] = predictions['mean_approx'] - predictions['median']
            
        return pd.DataFrame(predictions)
    
    def calculate_betting_decision(self, 
                                 our_median: float, 
                                 market_line: float,
                                 home_odds: float = -110,
                                 away_odds: float = -110) -> Dict:
        """
        Implement Dmochowski optimal betting decision rule.
        
        Args:
            our_median: Our predicted median outcome
            market_line: Sportsbook line (spread or total)
            home_odds: American odds for home team
            away_odds: American odds for away team
            
        Returns:
            Dictionary with betting recommendation and expected value
        """
        # Convert American odds to profit multipliers
        phi_h = 100/110 if home_odds == -110 else (
            home_odds/100 if home_odds > 0 else 100/abs(home_odds)
        )
        phi_v = 100/110 if away_odds == -110 else (
            away_odds/100 if away_odds > 0 else 100/abs(away_odds)
        )
        
        # Calculate critical quantile (Dmochowski equation 9)
        critical_quantile = (1 + phi_h) / (2 + phi_h + phi_v)
        
        # For symmetric odds, this simplifies to 0.5 (median)
        if abs(phi_h - phi_v) < 0.001:
            decision_point = our_median
        else:
            # For asymmetric odds, we need the specific quantile
            # This would require having trained that exact quantile
            decision_point = self._interpolate_quantile(critical_quantile)
            
        # Make betting decision
        edge = abs(our_median - market_line)
        
        if market_line < decision_point:
            recommendation = 'bet_home'
        else:
            recommendation = 'bet_away'
            
        # Calculate expected ROI based on edge magnitude
        expected_roi = self._calculate_expected_roi(edge)
        
        return {
            'recommendation': recommendation,
            'edge': edge,
            'expected_roi': expected_roi,
            'critical_quantile': critical_quantile,
            'decision_point': decision_point,
            'confidence': self._get_confidence_level(edge)
        }
    
    def _interpolate_quantile(self, q: float) -> float:
        """Interpolate prediction for quantiles not directly trained"""
        # Find nearest trained quantiles
        trained_quantiles = sorted(self.models.keys())
        
        if q in trained_quantiles:
            return self.models[q].predict(sm.add_constant(self.last_X))[0]
            
        # Linear interpolation between nearest quantiles
        lower_q = max([tq for tq in trained_quantiles if tq <= q], default=trained_quantiles[0])
        upper_q = min([tq for tq in trained_quantiles if tq >= q], default=trained_quantiles[-1])
        
        if lower_q == upper_q:
            return self.models[lower_q].predict(sm.add_constant(self.last_X))[0]
            
        # Weighted average
        weight = (q - lower_q) / (upper_q - lower_q)
        lower_pred = self.models[lower_q].predict(sm.add_constant(self.last_X))[0]
        upper_pred = self.models[upper_q].predict(sm.add_constant(self.last_X))[0]
        
        return lower_pred * (1 - weight) + upper_pred * weight
    
    def _calculate_expected_roi(self, edge: float) -> float:
        """
        Calculate expected ROI based on edge magnitude.
        Based on Dmochowski empirical NFL analysis.
        """
        if edge <= 1.0:
            return 0.021 * edge  # 2.1% per point up to 1
        elif edge <= 2.0:
            return 0.021 + 0.073 * (edge - 1.0)  # 7.3% for second point
        elif edge <= 3.0:
            return 0.094 + 0.072 * (edge - 2.0)  # 7.2% for third point
        else:
            # Diminishing returns beyond 3 points
            return 0.166 + 0.05 * (edge - 3.0)
    
    def _get_confidence_level(self, edge: float) -> str:
        """Categorize confidence based on edge magnitude"""
        if edge >= 3.0:
            return 'high'
        elif edge >= 2.0:
            return 'medium'
        elif edge >= 1.0:
            return 'low'
        else:
            return 'minimal'
    
    def find_outlier_prone_players(self, 
                                  player_stats: pd.DataFrame,
                                  min_games: int = 5) -> pd.DataFrame:
        """
        Identify players whose mean is inflated by outliers.
        These are "trap" players to avoid in DFS or fade in props.
        """
        # Group by player and calculate mean vs median
        stats = player_stats.groupby('player_id').agg({
            'fantasy_points': ['mean', 'median', 'count', 'std'],
            'player_name': 'first'
        })
        
        stats.columns = ['mean_points', 'median_points', 'games', 'std_dev', 'name']
        stats = stats[stats['games'] >= min_games]
        
        # Calculate mean-median gap
        stats['mean_median_gap'] = stats['mean_points'] - stats['median_points']
        stats['gap_percentage'] = stats['mean_median_gap'] / stats['median_points']
        stats['outlier_score'] = stats['mean_median_gap'] * stats['std_dev'] / stats['games']
        
        # Sort by outlier score (high = avoid)
        return stats.sort_values('outlier_score', ascending=False)


def train_sport_models(sport: str, 
                      training_data: pd.DataFrame,
                      feature_columns: List[str],
                      target_column: str = 'fantasy_points') -> QuantileRegressionService:
    """
    Train quantile regression models for a specific sport.
    
    Args:
        sport: Sport name (NFL, NBA, MLB, NHL)
        training_data: DataFrame with features and target
        feature_columns: List of feature column names
        target_column: Name of target column
        
    Returns:
        Trained QuantileRegressionService
    """
    config = QuantileModelConfig(
        sport=sport,
        target_column=target_column,
        feature_columns=feature_columns
    )
    
    from sklearn.model_selection import train_test_split
    
    service = QuantileRegressionService(config)
    
    X = training_data[feature_columns]
    y = training_data[target_column]
    
    # Proper train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, shuffle=True
    )
    
    print(f"\n{'='*60}")
    print(f"Training {sport} Quantile Regression Models")
    print(f"{'='*60}")
    print(f"Training samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")
    print(f"Features: {len(feature_columns)}")
    print(f"Target: {target_column}")
    print(f"Quantiles: {config.quantiles}")
    
    service.train(X_train, y_train)
    
    # Show model performance ON TEST SET
    predictions = service.predict_all_quantiles(X_test)
    
    print(f"\nModel Performance Summary (Test Set):")
    print(f"Median MAE: {np.mean(np.abs(predictions['median'] - y_test)):.2f}")
    print(f"Mean MAE: {np.mean(np.abs(predictions['mean_approx'] - y_test)):.2f}")
    print(f"Average Mean-Median Gap: {np.mean(np.abs(predictions['mean_median_gap'])):.2f}")
    
    # Show advantage of median over mean
    median_within_5 = np.mean(np.abs(predictions['median'] - y_test) <= 5)
    mean_within_5 = np.mean(np.abs(predictions['mean_approx'] - y_test) <= 5)
    
    # Sport-specific accuracy thresholds
    sport_thresholds = {
        'NFL': 3,    # ±3 points
        'NBA': 5,    # ±5 points  
        'MLB': 2,    # ±2 points
        'NHL': 1.5   # ±1.5 points
    }
    threshold = sport_thresholds.get(sport, 5)
    
    median_within_threshold = np.mean(np.abs(predictions['median'] - y_test) <= threshold)
    mean_within_threshold = np.mean(np.abs(predictions['mean_approx'] - y_test) <= threshold)
    
    print(f"\nAccuracy within ±{threshold} points:")
    print(f"Median-based: {median_within_threshold*100:.1f}%")
    print(f"Mean-based: {mean_within_threshold*100:.1f}%")
    print(f"Improvement: +{(median_within_threshold-mean_within_threshold)*100:.1f}%")
    
    return service


if __name__ == "__main__":
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description='Quantile Regression Service')
    parser.add_argument('--train', action='store_true', help='Training mode')
    parser.add_argument('--sport', type=str, help='Sport name')
    parser.add_argument('--data', type=str, help='Path to training data JSON')
    
    args = parser.parse_args()
    
    if args.train and args.data:
        # Load training data from JSON file
        with open(args.data, 'r') as f:
            data = json.load(f)
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Extract feature columns (all columns except target and metadata)
        exclude_cols = ['fantasy_points', 'player_id', 'name', 'position', 'team', 
                       'game_date', 'opponent', 'is_home', 'weather', 'prev_game_date',
                       'game_number', 'stat_type']
        
        # Only use numeric columns as features
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        feature_cols = [col for col in numeric_cols if col not in exclude_cols and col != 'fantasy_points']
        
        # Clean the data - handle NaN/Inf values intelligently
        print(f"Original data shape: {df.shape}", file=sys.stderr)
        
        # Replace Inf with NaN
        df = df.replace([np.inf, -np.inf], np.nan)
        
        # For feature columns, fill NaN with 0 (represents no historical data)
        for col in feature_cols:
            if col in df.columns:
                df[col] = df[col].fillna(0)
        
        # For target column, we must have valid values
        df = df.dropna(subset=['fantasy_points'])
        
        # Remove any remaining rows with all features as NaN
        df = df.dropna(subset=feature_cols, how='all')
        
        print(f"Cleaned data shape: {df.shape}", file=sys.stderr)
        print(f"Features to use: {feature_cols}", file=sys.stderr)
        
        # Ensure all feature columns are numeric
        for col in feature_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        # Ensure target is numeric
        df['fantasy_points'] = pd.to_numeric(df['fantasy_points'], errors='coerce')
        
        # Final check - remove any remaining non-numeric rows
        df = df.dropna(subset=['fantasy_points'])
        
        # Train the model
        service = train_sport_models(
            sport=args.sport,
            training_data=df,
            feature_columns=feature_cols,
            target_column='fantasy_points'
        )
        
        # Output results as JSON
        results = {
            'sport': args.sport,
            'features_used': feature_cols,
            'samples_trained': len(df),
            'model_trained': True
        }
        
        print(json.dumps(results))
        sys.exit(0)
    
    # If not in training mode, run the example code
    print("Quantile Regression Service - Dmochowski Median-Centric Approach")
    print("This service should be called from Node.js via Python bridge")
    
    # Create sample data for testing
    np.random.seed(42)
    n_samples = 1000
    
    # Simulate player data with outliers
    base_skill = np.random.normal(25, 5, n_samples)
    noise = np.random.chisquare(3, n_samples) - 3  # Skewed noise
    outliers = np.random.binomial(1, 0.1, n_samples) * np.random.normal(20, 5, n_samples)
    
    fantasy_points = base_skill + noise + outliers
    
    df = pd.DataFrame({
        'skill_rating': base_skill,
        'recent_form': np.random.normal(0, 1, n_samples),
        'matchup_difficulty': np.random.normal(0, 1, n_samples),
        'fantasy_points': fantasy_points
    })
    
    # Train example model
    service = train_sport_models(
        sport='NFL',
        training_data=df,
        feature_columns=['skill_rating', 'recent_form', 'matchup_difficulty']
    )
    
    # Test betting decision
    print("\n" + "="*60)
    print("Testing Betting Decision Logic")
    print("="*60)
    
    test_features = pd.DataFrame({
        'skill_rating': [28],
        'recent_form': [0.5],
        'matchup_difficulty': [-0.5]
    })
    
    predictions = service.predict_all_quantiles(test_features)
    our_median = predictions['median'].iloc[0]
    
    print(f"\nOur predictions:")
    print(f"Median: {our_median:.1f}")
    print(f"Mean: {predictions['mean_approx'].iloc[0]:.1f}")
    print(f"Floor (p25): {predictions['p25'].iloc[0]:.1f}")
    print(f"Ceiling (p75): {predictions['p75'].iloc[0]:.1f}")
    
    # Test against different market lines
    for market_line in [25, 26, 27, 28, 29, 30]:
        decision = service.calculate_betting_decision(our_median, market_line)
        print(f"\nMarket line: {market_line}")
        print(f"Decision: {decision['recommendation']}")
        print(f"Edge: {decision['edge']:.1f} points")
        print(f"Expected ROI: {decision['expected_roi']*100:.1f}%")
        print(f"Confidence: {decision['confidence']}")