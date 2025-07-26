#!/usr/bin/env python3
"""
Deep Analysis of NFL Model Performance
Figure out why we're getting 97.2% accuracy
"""

import pandas as pd
import numpy as np
import json
import sys
from pathlib import Path

def analyze_nfl_predictions():
    """Analyze NFL training data and predictions in detail"""
    
    # Load the training data
    data_path = Path(__file__).parent / "temp_NFL_training_data.json"
    if not data_path.exists():
        print("ERROR: No NFL training data file found!")
        return
        
    with open(data_path, 'r') as f:
        data = json.load(f)
    
    df = pd.DataFrame(data)
    print(f"Total samples: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    
    # Basic statistics
    print("\n=== TARGET VARIABLE ANALYSIS ===")
    print(f"Fantasy points - Mean: {df['fantasy_points'].mean():.2f}")
    print(f"Fantasy points - Std: {df['fantasy_points'].std():.2f}")
    print(f"Fantasy points - Min: {df['fantasy_points'].min():.2f}")
    print(f"Fantasy points - Max: {df['fantasy_points'].max():.2f}")
    
    # Check if lag features are too similar to target
    print("\n=== LAG FEATURE CORRELATION ===")
    for lag in ['lag_1', 'lag_2', 'lag_3', 'lag_4', 'lag_5']:
        if lag in df.columns:
            # Calculate correlation
            valid_idx = df[lag].notna()
            if valid_idx.sum() > 0:
                corr = df.loc[valid_idx, 'fantasy_points'].corr(df.loc[valid_idx, lag])
                print(f"{lag} correlation with target: {corr:.3f}")
                
                # Check exact matches
                exact_matches = (df.loc[valid_idx, 'fantasy_points'] == df.loc[valid_idx, lag]).sum()
                print(f"  Exact matches: {exact_matches} ({exact_matches/valid_idx.sum()*100:.1f}%)")
                
                # Check near matches (within 0.1)
                near_matches = (np.abs(df.loc[valid_idx, 'fantasy_points'] - df.loc[valid_idx, lag]) < 0.1).sum()
                print(f"  Near matches (±0.1): {near_matches} ({near_matches/valid_idx.sum()*100:.1f}%)")
    
    # Analyze median_last_3
    print("\n=== MEDIAN_LAST_3 ANALYSIS ===")
    valid_median = df['median_last_3'].notna()
    if valid_median.sum() > 0:
        median_corr = df.loc[valid_median, 'fantasy_points'].corr(df.loc[valid_median, 'median_last_3'])
        print(f"Median_last_3 correlation with target: {median_corr:.3f}")
        
        # Check how close median predictions would be
        errors = np.abs(df.loc[valid_median, 'fantasy_points'] - df.loc[valid_median, 'median_last_3'])
        print(f"Mean absolute error if using median_last_3: {errors.mean():.2f}")
        print(f"Accuracy within ±3 points: {(errors <= 3).sum() / len(errors) * 100:.1f}%")
        print(f"Accuracy within ±5 points: {(errors <= 5).sum() / len(errors) * 100:.1f}%")
    
    # Check for data ordering issues
    print("\n=== DATA ORDERING CHECK ===")
    # Group by player and check if dates are properly ordered
    player_groups = df.groupby('player_id')
    ordering_issues = 0
    
    for player_id, group in player_groups:
        if len(group) > 1:
            # Check if fantasy_points matches any lag values in next row
            for i in range(len(group) - 1):
                current_fp = group.iloc[i]['fantasy_points']
                next_lag1 = group.iloc[i + 1]['lag_1']
                
                if pd.notna(next_lag1) and np.abs(current_fp - next_lag1) > 0.1:
                    ordering_issues += 1
                    if ordering_issues < 5:  # Show first 5 examples
                        print(f"Player {group.iloc[i]['name']}: FP={current_fp:.1f}, Next_Lag1={next_lag1:.1f}")
    
    print(f"Total ordering issues found: {ordering_issues}")
    
    # Feature importance proxy - variance analysis
    print("\n=== FEATURE VARIANCE ANALYSIS ===")
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    feature_cols = [col for col in numeric_cols if col not in ['fantasy_points', 'player_id']]
    
    for col in ['lag_1', 'lag_2', 'lag_3', 'median_last_3', 'avg_last_3', 'avg_last_5']:
        if col in df.columns:
            valid_data = df[col].dropna()
            if len(valid_data) > 0:
                print(f"{col}: Mean={valid_data.mean():.2f}, Std={valid_data.std():.2f}, CV={valid_data.std()/valid_data.mean():.3f}")
    
    # Check if we're predicting the same game
    print("\n=== TEMPORAL LEAKAGE CHECK ===")
    # Look for suspiciously high correlations
    suspicious_features = []
    for col in feature_cols:
        if col in df.columns:
            valid_idx = df[col].notna()
            if valid_idx.sum() > 100:
                corr = df.loc[valid_idx, 'fantasy_points'].corr(df.loc[valid_idx, col])
                if abs(corr) > 0.9:
                    suspicious_features.append((col, corr))
    
    if suspicious_features:
        print("WARNING: Suspiciously high correlations found!")
        for feat, corr in suspicious_features:
            print(f"  {feat}: {corr:.3f}")
    else:
        print("No suspiciously high correlations found (>0.9)")
    
    # Save detailed analysis
    analysis_results = {
        'total_samples': len(df),
        'target_mean': df['fantasy_points'].mean(),
        'target_std': df['fantasy_points'].std(),
        'median_last_3_accuracy': float((errors <= 3).sum() / len(errors) * 100) if valid_median.sum() > 0 else 0,
        'ordering_issues': ordering_issues,
        'suspicious_features': suspicious_features
    }
    
    with open('nfl_analysis_results.json', 'w') as f:
        json.dump(analysis_results, f, indent=2)
    
    print(f"\nDetailed results saved to nfl_analysis_results.json")

if __name__ == "__main__":
    analyze_nfl_predictions()