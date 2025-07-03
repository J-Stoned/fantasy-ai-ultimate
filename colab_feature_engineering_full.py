"""
Complete feature engineering for Fantasy AI GPU training
Upload this file to Colab to avoid indentation issues
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


def engineer_features(games_df, stats_df, injuries_df, weather_df, sentiment_df):
    """
    Engineer all 23 features for maximum accuracy
    """
    features = []
    labels = []
    
    # Create lookup tables for player stats
    stats_by_game = {}
    if len(stats_df) > 0:
        # Check what columns exist
        stat_cols = stats_df.columns.tolist()
        if 'game_id' in stat_cols:
            # Group by game_id and aggregate available columns
            agg_dict = {}
            for col in ['points', 'rebounds', 'assists', 'turnovers', 'minutes']:
                if col in stat_cols:
                    agg_dict[col] = ['mean', 'sum', 'max']
            
            if agg_dict and 'game_id' in stats_df.columns:
                try:
                    stats_by_game = stats_df.groupby('game_id').agg(agg_dict).to_dict('index')
                except:
                    pass
    
    # Create injuries lookup
    injuries_by_team = {}
    if len(injuries_df) > 0 and 'team_id' in injuries_df.columns:
        injuries_by_team = injuries_df.groupby('team_id').size().to_dict()
    
    # Create weather lookup
    weather_by_game = {}
    if len(weather_df) > 0:
        for _, w in weather_df.iterrows():
            if 'game_id' in w and pd.notna(w.get('game_id')):
                weather_by_game[w['game_id']] = w.to_dict()
    
    # Create sentiment lookup
    sentiment_by_team = {}
    if len(sentiment_df) > 0:
        if 'team_id' in sentiment_df.columns and 'sentiment_score' in sentiment_df.columns:
            sentiment_by_team = sentiment_df.groupby('team_id')['sentiment_score'].mean().to_dict()
    
    # Initialize team statistics
    team_stats = {}
    
    # Process games chronologically
    for idx, game in games_df.iterrows():
        home_id = game['home_team_id']
        away_id = game['away_team_id']
        
        # Initialize team stats if needed
        for team_id in [home_id, away_id]:
            if team_id not in team_stats:
                team_stats[team_id] = {
                    'games': 0,
                    'wins': 0,
                    'losses': 0,
                    'points_for': 0,
                    'points_against': 0,
                    'recent_form': [],
                    'home_games': 0,
                    'home_wins': 0,
                    'away_games': 0,
                    'away_wins': 0,
                    'streak': 0,
                    'rest_days': 0
                }
        
        # Only process games with scores
        if pd.notna(game['home_score']) and pd.notna(game['away_score']):
            home_stats = team_stats[home_id]
            away_stats = team_stats[away_id]
            
            # Need minimum games for reliable stats
            if home_stats['games'] >= 5 and away_stats['games'] >= 5:
                # Calculate all features
                game_features = []
                
                # 1-2: Win rates
                game_features.append(home_stats['wins'] / home_stats['games'])
                game_features.append(away_stats['wins'] / away_stats['games'])
                
                # 3-4: Average points scored
                game_features.append(home_stats['points_for'] / home_stats['games'])
                game_features.append(away_stats['points_for'] / away_stats['games'])
                
                # 5-6: Average points allowed
                game_features.append(home_stats['points_against'] / home_stats['games'])
                game_features.append(away_stats['points_against'] / away_stats['games'])
                
                # 7-8: Recent form (last 5 games)
                home_recent = home_stats['recent_form'][-5:] if len(home_stats['recent_form']) >= 5 else home_stats['recent_form']
                away_recent = away_stats['recent_form'][-5:] if len(away_stats['recent_form']) >= 5 else away_stats['recent_form']
                game_features.append(np.mean(home_recent) if home_recent else 0.5)
                game_features.append(np.mean(away_recent) if away_recent else 0.5)
                
                # 9: Win rate differential
                game_features.append((home_stats['wins'] / home_stats['games']) - (away_stats['wins'] / away_stats['games']))
                
                # 10-11: Point differentials
                game_features.append((home_stats['points_for'] - home_stats['points_against']) / home_stats['games'])
                game_features.append((away_stats['points_for'] - away_stats['points_against']) / away_stats['games'])
                
                # 12-13: Player stats (if available)
                game_stats = stats_by_game.get(game['id'], {})
                if game_stats:
                    # Get total points from player stats
                    points_sum = 0
                    points_mean = 0
                    if ('points', 'sum') in game_stats:
                        points_sum = game_stats[('points', 'sum')]
                    if ('points', 'mean') in game_stats:
                        points_mean = game_stats[('points', 'mean')]
                    game_features.extend([points_mean / 20.0, points_sum / 200.0])  # Normalize
                else:
                    game_features.extend([0.0, 0.0])
                
                # 14-15: Injuries
                home_injuries = injuries_by_team.get(home_id, 0)
                away_injuries = injuries_by_team.get(away_id, 0)
                game_features.append(min(home_injuries / 5.0, 1.0))
                game_features.append(min(away_injuries / 5.0, 1.0))
                
                # 16-17: Weather
                weather = weather_by_game.get(game['id'], {})
                temp = weather.get('temperature', 72) / 100.0
                wind = weather.get('wind_speed', 5) / 30.0
                game_features.extend([temp, wind])
                
                # 18-19: Sentiment
                home_sentiment = sentiment_by_team.get(home_id, 0)
                away_sentiment = sentiment_by_team.get(away_id, 0)
                game_features.append(np.tanh(home_sentiment))
                game_features.append(np.tanh(away_sentiment))
                
                # 20-22: Time features
                game_date = pd.to_datetime(game['created_at'])
                game_features.append(game_date.hour / 24.0)
                game_features.append(game_date.dayofweek / 7.0)
                game_features.append(game_date.month / 12.0)
                
                # 23: Home advantage
                game_features.append(1.0)
                
                # Add to dataset
                features.append(game_features)
                labels.append(1 if game['home_score'] > game['away_score'] else 0)
            
            # Update team stats for next games
            home_won = game['home_score'] > game['away_score']
            
            # Update basic stats
            home_stats['games'] += 1
            away_stats['games'] += 1
            home_stats['points_for'] += game['home_score']
            home_stats['points_against'] += game['away_score']
            away_stats['points_for'] += game['away_score']
            away_stats['points_against'] += game['home_score']
            
            # Update home/away specific stats
            home_stats['home_games'] += 1
            away_stats['away_games'] += 1
            
            if home_won:
                home_stats['wins'] += 1
                away_stats['losses'] += 1
                home_stats['home_wins'] += 1
                home_stats['recent_form'].append(1)
                away_stats['recent_form'].append(0)
                home_stats['streak'] = home_stats['streak'] + 1 if home_stats['streak'] > 0 else 1
                away_stats['streak'] = -1 if away_stats['streak'] > 0 else away_stats['streak'] - 1
            else:
                home_stats['losses'] += 1
                away_stats['wins'] += 1
                away_stats['away_wins'] += 1
                home_stats['recent_form'].append(0)
                away_stats['recent_form'].append(1)
                home_stats['streak'] = -1 if home_stats['streak'] > 0 else home_stats['streak'] - 1
                away_stats['streak'] = away_stats['streak'] + 1 if away_stats['streak'] > 0 else 1
            
            # Keep only last 10 games for form
            home_stats['recent_form'] = home_stats['recent_form'][-10:]
            away_stats['recent_form'] = away_stats['recent_form'][-10:]
    
    return np.array(features), np.array(labels)


def process_data(df_games, df_stats, df_injuries, df_weather, df_sentiment):
    """
    Complete data processing pipeline
    """
    print("🔧 Engineering features...")
    
    # Show what data we have
    print(f"  Games: {len(df_games)}")
    print(f"  Player stats: {len(df_stats)}")
    print(f"  Injuries: {len(df_injuries)}")
    print(f"  Weather: {len(df_weather)}")
    print(f"  Sentiment: {len(df_sentiment)}")
    
    # Engineer features
    X, y = engineer_features(df_games, df_stats, df_injuries, df_weather, df_sentiment)
    print(f"✅ Created {len(X)} samples with {len(X[0]) if len(X) > 0 else 0} features each")
    
    if len(X) == 0:
        raise ValueError("No features created! Check your data.")
    
    # Split data
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)
    
    print(f"✅ Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    
    return X_train_scaled, X_val_scaled, X_test_scaled, y_train, y_val, y_test, scaler