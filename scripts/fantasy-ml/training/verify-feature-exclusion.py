#!/usr/bin/env python3
"""
Verify which features are being used in training
"""

import json
import pandas as pd
import numpy as np

# Load the NFL training data
with open('temp_NFL_training_data.json', 'r') as f:
    data = json.load(f)

df = pd.DataFrame(data)

print(f"Total samples: {len(df)}")
print(f"\nAll columns in data: {list(df.columns)}")

# Extract feature columns (same logic as quantile_regression_service.py)
exclude_cols = ['fantasy_points', 'player_id', 'name', 'position', 'team', 
               'game_date', 'opponent', 'is_home', 'weather', 'prev_game_date',
               'game_number', 'median_last_3', 'rest_days', 'stat_type']

# Only use numeric columns as features
numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
feature_cols = [col for col in numeric_cols if col not in exclude_cols and col != 'fantasy_points']

print(f"\nNumeric columns: {numeric_cols}")
print(f"\nFeatures being used: {feature_cols}")
print(f"\nExcluded columns: {[col for col in numeric_cols if col not in feature_cols]}")

# Check if any features have high correlation with target
if 'fantasy_points' in df.columns:
    print("\n=== Feature Correlations with Target ===")
    for col in feature_cols:
        if col in df.columns:
            valid_idx = df[col].notna() & df['fantasy_points'].notna()
            if valid_idx.sum() > 10:
                corr = df.loc[valid_idx, col].corr(df.loc[valid_idx, 'fantasy_points'])
                print(f"{col}: {corr:.3f}")

# Check for the bug - are lag values all zeros or weird?
print("\n=== Sample Feature Values ===")
for col in ['lag_1', 'lag_2', 'lag_3', 'avg_last_3', 'avg_last_5']:
    if col in df.columns:
        print(f"\n{col}:")
        print(f"  Mean: {df[col].mean():.2f}")
        print(f"  Std: {df[col].std():.2f}")
        print(f"  Min: {df[col].min():.2f}")
        print(f"  Max: {df[col].max():.2f}")
        print(f"  % zeros: {(df[col] == 0).sum() / len(df) * 100:.1f}%")