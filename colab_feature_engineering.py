# 4. Advanced Feature Engineering
print("🔧 Engineering features...")

def engineer_features(games_df, stats_df, injuries_df, weather_df, sentiment_df):
    features = []
    labels = []
    
    # Create lookup tables
    stats_by_game = stats_df.groupby('game_id').agg({
        'points': ['mean', 'sum', 'max'],
        'rebounds': ['mean', 'sum'],
        'assists': ['mean', 'sum'],
        'turnovers': ['mean', 'sum']
    }).to_dict('index')
    
    injuries_by_team = injuries_df.groupby('team_id')['severity'].count().to_dict()
    weather_by_game = {w['game_id']: w for w in weather_df if w.get('game_id')}
    sentiment_by_team = sentiment_df.groupby('team_id')['sentiment_score'].mean().to_dict()
    
    # Calculate team statistics
    team_stats = {}
    for _, game in games_df.iterrows():
        home_id = game['home_team_id']
        away_id = game['away_team_id']
        
        # Update team stats
        for team_id in [home_id, away_id]:
            if team_id not in team_stats:
                team_stats[team_id] = {
                    'games': 0, 'wins': 0, 'losses': 0,
                    'points_for': 0, 'points_against': 0,
                    'recent_form': []
                }
        
        # Process each game
        if pd.notna(game['home_score']) and pd.notna(game['away_score']):
            home_stats = team_stats[home_id]
            away_stats = team_stats[away_id]
            
            # Skip if not enough history
            if home_stats['games'] < 5 or away_stats['games'] < 5:
                # Update stats for next game
                home_won = game['home_score'] > game['away_score']
                
                home_stats['games'] += 1
                away_stats['games'] += 1
                home_stats['points_for'] += game['home_score']
                home_stats['points_against'] += game['away_score']
                away_stats['points_for'] += game['away_score']
                away_stats['points_against'] += game['home_score']
                
                if home_won:
                    home_stats['wins'] += 1
                    away_stats['losses'] += 1
                    home_stats['recent_form'].append(1)
                    away_stats['recent_form'].append(0)
                else:
                    home_stats['losses'] += 1
                    away_stats['wins'] += 1
                    home_stats['recent_form'].append(0)
                    away_stats['recent_form'].append(1)
                    
                # Keep only last 10 games for form
                home_stats['recent_form'] = home_stats['recent_form'][-10:]
                away_stats['recent_form'] = away_stats['recent_form'][-10:]
                continue
            
            # Extract features
            game_features = [
                # Basic team performance
                home_stats['wins'] / home_stats['games'],
                away_stats['wins'] / away_stats['games'],
                home_stats['points_for'] / home_stats['games'],
                away_stats['points_for'] / away_stats['games'],
                home_stats['points_against'] / home_stats['games'],
                away_stats['points_against'] / away_stats['games'],
                
                # Recent form (last 5 games)
                np.mean(home_stats['recent_form'][-5:]) if home_stats['recent_form'] else 0.5,
                np.mean(away_stats['recent_form'][-5:]) if away_stats['recent_form'] else 0.5,
                
                # Win rate difference
                (home_stats['wins'] / home_stats['games']) - (away_stats['wins'] / away_stats['games']),
                
                # Scoring differential
                (home_stats['points_for'] - home_stats['points_against']) / home_stats['games'],
                (away_stats['points_for'] - away_stats['points_against']) / away_stats['games'],
                
                # Player stats for this game
                stats_by_game.get(game['id'], {}).get(('points', 'mean'), (0,))[0] if game['id'] in stats_by_game else 0,
                stats_by_game.get(game['id'], {}).get(('points', 'sum'), (0,))[0] if game['id'] in stats_by_game else 0,
                
                # Injuries
                injuries_by_team.get(home_id, 0),
                injuries_by_team.get(away_id, 0),
                
                # Weather (if available)
                weather_by_game.get(game['id'], {}).get('temperature', 72) / 100 if game['id'] in weather_by_game else 0.72,
                weather_by_game.get(game['id'], {}).get('wind_speed', 5) / 30 if game['id'] in weather_by_game else 0.17,
                
                # Sentiment
                sentiment_by_team.get(home_id, 0),
                sentiment_by_team.get(away_id, 0),
                
                # Time features
                pd.to_datetime(game['created_at']).hour / 24,
                pd.to_datetime(game['created_at']).dayofweek / 7,
                pd.to_datetime(game['created_at']).month / 12,
                
                # Home advantage
                1.0  # Home team indicator
            ]
            
            features.append(game_features)
            labels.append(1 if game['home_score'] > game['away_score'] else 0)
            
            # Update stats for next game
            home_won = game['home_score'] > game['away_score']
            
            home_stats['games'] += 1
            away_stats['games'] += 1
            home_stats['points_for'] += game['home_score']
            home_stats['points_against'] += game['away_score']
            away_stats['points_for'] += game['away_score']
            away_stats['points_against'] += game['home_score']
            
            if home_won:
                home_stats['wins'] += 1
                away_stats['losses'] += 1
                home_stats['recent_form'].append(1)
                away_stats['recent_form'].append(0)
            else:
                home_stats['losses'] += 1
                away_stats['wins'] += 1
                home_stats['recent_form'].append(0)
                away_stats['recent_form'].append(1)
                
            home_stats['recent_form'] = home_stats['recent_form'][-10:]
            away_stats['recent_form'] = away_stats['recent_form'][-10:]
    
    return np.array(features), np.array(labels)

# Engineer features
X, y = engineer_features(df_games, df_stats, df_injuries, df_weather, df_sentiment)
print(f"✅ Created {len(X)} samples with {len(X[0])} features each")

# Split data
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)

# Scale features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_val_scaled = scaler.transform(X_val)
X_test_scaled = scaler.transform(X_test)

print(f"✅ Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")