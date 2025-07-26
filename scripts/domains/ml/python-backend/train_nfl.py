#!/usr/bin/env python3
"""
Train NFL ML Model with Real Data
Connects to PostgreSQL and trains XGBoost model with GPU acceleration
"""

import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import sys
from models.xgboost_gpu_trainer import FantasyMLTrainer

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Database configuration from environment
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'fantasy_dev'),
    'user': os.getenv('DB_USER', 'dev_user'),
    'password': os.getenv('DB_PASSWORD', 'dev_password'),
    'connect_timeout': int(os.getenv('DB_TIMEOUT', 30))
}

def fetch_nfl_training_data():
    """Fetch NFL player data and stats from database"""
    print("📊 Fetching NFL training data from database...")
    
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Query to get player stats with features
    query = """
    WITH player_averages AS (
        SELECT 
            ps.player_id,
            ps.game_id,
            ps.game_date,
            ps.fantasy_points_dk as actual_fp,
            -- Calculate rolling averages
            AVG(ps.fantasy_points_dk) OVER (
                PARTITION BY ps.player_id 
                ORDER BY ps.game_date 
                ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
            ) as avg_fp_last_3,
            AVG(ps.fantasy_points_dk) OVER (
                PARTITION BY ps.player_id 
                ORDER BY ps.game_date 
                ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING
            ) as avg_fp_last_5,
            AVG(ps.fantasy_points_dk) OVER (
                PARTITION BY ps.player_id 
                ORDER BY ps.game_date 
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ) as avg_fp_season,
            -- Get recent usage metrics
            AVG(CASE 
                WHEN p.position = 'QB' THEN CAST(ps.passing_attempts AS FLOAT) / NULLIF(40, 0)
                WHEN p.position = 'RB' THEN CAST(ps.rushing_attempts + ps.receiving_targets AS FLOAT) / NULLIF(25, 0)
                WHEN p.position = 'WR' THEN CAST(ps.receiving_targets AS FLOAT) / NULLIF(15, 0)
                WHEN p.position = 'TE' THEN CAST(ps.receiving_targets AS FLOAT) / NULLIF(10, 0)
                ELSE 0
            END) OVER (
                PARTITION BY ps.player_id 
                ORDER BY ps.game_date 
                ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
            ) as usage_rate,
            -- Target share (simplified)
            CASE 
                WHEN p.position IN ('WR', 'TE') THEN COALESCE(ps.receiving_targets::FLOAT / NULLIF(35, 0), 0)
                ELSE 0
            END as target_share,
            -- Red zone touches
            CASE 
                WHEN p.position = 'RB' THEN COALESCE(ps.rushing_touchdowns::FLOAT, 0) * 0.5
                ELSE 0
            END as red_zone_touches
        FROM player_stats ps
        JOIN players p ON ps.player_id = p.player_id
        WHERE p.sport = 'NFL'
        AND ps.season >= 2023
        AND p.position IN ('QB', 'RB', 'WR', 'TE')
    ),
    game_info AS (
        SELECT 
            g.game_id,
            g.home_team_id,
            g.away_team_id,
            -- Mock Vegas data (in production, this would come from betting_lines table)
            45 + RANDOM() * 10 as vegas_total,
            -3 + RANDOM() * 6 as spread
        FROM games g
        WHERE g.sport = 'NFL'
        AND g.season >= 2023
    )
    SELECT 
        pa.*,
        p.name,
        p.position,
        t.abbreviation as team,
        -- Game features
        COALESCE(gi.vegas_total, 48.5) as vegas_total,
        CASE 
            WHEN p.team_id = gi.home_team_id THEN gi.vegas_total / 2 - gi.spread / 2
            ELSE gi.vegas_total / 2 + gi.spread / 2
        END as team_implied_total,
        COALESCE(gi.spread, 0) as spread,
        -- Opponent ranking (mock data)
        FLOOR(RANDOM() * 32 + 1)::INT as opponent_dvp_rank,
        25 + RANDOM() * 10 as opponent_pace,
        -- Days rest
        EXTRACT(DAY FROM pa.game_date - LAG(pa.game_date) OVER (
            PARTITION BY pa.player_id ORDER BY pa.game_date
        )) as days_rest,
        -- Home/away
        CASE WHEN p.team_id = gi.home_team_id THEN 1 ELSE 0 END as is_home,
        -- Dome game (simplified - just checking certain teams)
        CASE WHEN t.abbreviation IN ('NO', 'MIN', 'DET', 'IND', 'DAL', 'LV') THEN 1 ELSE 0 END as dome_game,
        -- Mock salary based on recent performance
        CASE
            WHEN p.position = 'QB' THEN 6000 + pa.avg_fp_season * 200
            WHEN p.position = 'RB' THEN 5000 + pa.avg_fp_season * 250
            WHEN p.position = 'WR' THEN 4500 + pa.avg_fp_season * 300
            WHEN p.position = 'TE' THEN 4000 + pa.avg_fp_season * 350
        END as salary,
        0 as salary_change,
        -- Value rating
        pa.avg_fp_season / NULLIF(
            CASE
                WHEN p.position = 'QB' THEN 6000 + pa.avg_fp_season * 200
                WHEN p.position = 'RB' THEN 5000 + pa.avg_fp_season * 250
                WHEN p.position = 'WR' THEN 4500 + pa.avg_fp_season * 300
                WHEN p.position = 'TE' THEN 4000 + pa.avg_fp_season * 350
            END / 1000, 0
        ) as value_rating
    FROM player_averages pa
    JOIN players p ON pa.player_id = p.player_id
    JOIN teams t ON p.team_id = t.team_id
    LEFT JOIN game_info gi ON pa.game_id = gi.game_id
    WHERE pa.avg_fp_last_3 IS NOT NULL  -- Ensure we have historical data
    AND pa.actual_fp >= 0  -- Filter out invalid scores
    ORDER BY pa.game_date;
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    print(f"✅ Fetched {len(df)} training samples")
    
    # Handle missing values
    df['days_rest'] = df['days_rest'].fillna(7).clip(1, 14)
    df['usage_rate'] = df['usage_rate'].fillna(0).clip(0, 1)
    df['target_share'] = df['target_share'].fillna(0).clip(0, 1)
    df['red_zone_touches'] = df['red_zone_touches'].fillna(0)
    
    return df

def prepare_train_test_split(df, test_size=0.2):
    """Split data into train and test sets (time-based)"""
    # Sort by date
    df = df.sort_values('game_date')
    
    # Use last 20% of games as test set
    split_idx = int(len(df) * (1 - test_size))
    
    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()
    
    print(f"📊 Train samples: {len(train_df)}, Test samples: {len(test_df)}")
    
    return train_df, test_df

def main():
    """Main training pipeline"""
    print("🏈 NFL ML Model Training Pipeline\n")
    
    # Fetch data
    df = fetch_nfl_training_data()
    
    # Basic stats
    print("\n📈 Data Statistics:")
    print(f"Total samples: {len(df)}")
    print(f"Date range: {df['game_date'].min()} to {df['game_date'].max()}")
    print(f"Unique players: {df['player_id'].nunique()}")
    print(f"Position breakdown:")
    print(df['position'].value_counts())
    
    # Split data
    train_df, test_df = prepare_train_test_split(df)
    
    # Initialize trainer
    trainer = FantasyMLTrainer('NFL')
    
    # Train model
    print("\n🚀 Training XGBoost model...")
    metrics = trainer.train(
        train_df, 
        test_df,
        num_boost_round=1000,
        early_stopping_rounds=50
    )
    
    # Evaluate on test set
    print("\n📊 Evaluating on test set...")
    test_predictions = trainer.predict(test_df)
    
    # Calculate metrics
    from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
    
    y_true = test_df['actual_fp'].values
    y_pred = np.array(test_predictions['predictions'])
    
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    
    print(f"\n🎯 Test Set Performance:")
    print(f"RMSE: {rmse:.2f}")
    print(f"MAE: {mae:.2f}")
    print(f"R²: {r2:.4f}")
    
    # Feature importance
    print("\n📊 Top 10 Most Important Features:")
    for i, (feat, score) in enumerate(trainer.get_feature_importance(10)):
        print(f"{i+1:2d}. {feat:<20} {score:>8.2f}")
    
    # Save some predictions for inspection
    print("\n💾 Saving sample predictions...")
    sample_preds = test_df[['name', 'position', 'team', 'actual_fp']].copy()
    sample_preds['predicted_fp'] = y_pred
    sample_preds['error'] = sample_preds['predicted_fp'] - sample_preds['actual_fp']
    sample_preds = sample_preds.head(50)
    
    sample_preds.to_csv('nfl_sample_predictions.csv', index=False)
    print("✅ Sample predictions saved to nfl_sample_predictions.csv")
    
    print("\n✅ NFL model training complete!")
    print(f"Model saved to: {trainer.model_dir}")

if __name__ == "__main__":
    main()