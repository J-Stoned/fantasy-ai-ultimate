#!/usr/bin/env python3
"""
🔥 LEVERAGE-OPTIMIZED DFS LINEUP GENERATOR - 10X PROFESSIONAL DEMO! 🚀
Implements Monte Carlo simulations + Game Theory for GPP-winning strategies
For Dad's Birthday Demo - Show full GPU acceleration potential!
"""

import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime
import os
import sys
from typing import Dict, List

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from models.monte_carlo_engine import MonteCarloSimulator
from models.leverage_optimizer import LeverageOptimizer, LineupConstraints

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'fantasy_ai_local'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres'),
    'connect_timeout': int(os.getenv('DB_TIMEOUT', 30))
}

def fetch_nfl_demo_data():
    """Fetch live NFL data for leverage optimization demo"""
    print("🏈 Fetching NFL player data for leverage optimization...")
    
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Simplified query using existing data structure
    query = """
    SELECT 
        p.id as player_id,
        p.name,
        p.position,
        COALESCE(p.team, 'FA') as team,
        -- Use recent fantasy points average
        COALESCE(AVG(ps.fantasy_points_dk), 8.0) as avg_fantasy_points,
        -- Calculate rolling averages (mock data if missing)
        COALESCE(AVG(ps.fantasy_points_dk) * 0.9, 7.2) as avg_fp_last_3,
        COALESCE(AVG(ps.fantasy_points_dk) * 0.95, 7.6) as avg_fp_last_5,
        COALESCE(AVG(ps.fantasy_points_dk), 8.0) as avg_fp_season,
        -- Usage rate calculation
        CASE 
            WHEN p.position = 'QB' THEN 0.8 + RANDOM() * 0.15
            WHEN p.position = 'RB' THEN 0.6 + RANDOM() * 0.2
            WHEN p.position = 'WR' THEN 0.4 + RANDOM() * 0.3
            WHEN p.position = 'TE' THEN 0.3 + RANDOM() * 0.2
            ELSE 0.2
        END as usage_rate,
        -- Mock Vegas data
        47.5 + RANDOM() * 5 as vegas_total,
        24 + RANDOM() * 8 as team_implied_total,
        -3 + RANDOM() * 6 as spread,
        FLOOR(RANDOM() * 32 + 1)::INT as opponent_dvp_rank,
        CASE WHEN RANDOM() > 0.5 THEN 1 ELSE 0 END as is_home,
        -- Target share for pass catchers
        CASE 
            WHEN p.position IN ('WR', 'TE') THEN 0.1 + RANDOM() * 0.25
            ELSE 0.0
        END as target_share,
        -- Red zone touches for RBs
        CASE 
            WHEN p.position = 'RB' THEN 0.1 + RANDOM() * 0.15
            ELSE 0.0
        END as red_zone_touches,
        -- Mock salary based on position and performance
        CASE
            WHEN p.position = 'QB' THEN 6500 + COALESCE(AVG(ps.fantasy_points_dk), 8) * 150
            WHEN p.position = 'RB' THEN 5500 + COALESCE(AVG(ps.fantasy_points_dk), 6) * 200
            WHEN p.position = 'WR' THEN 5000 + COALESCE(AVG(ps.fantasy_points_dk), 5) * 250
            WHEN p.position = 'TE' THEN 4500 + COALESCE(AVG(ps.fantasy_points_dk), 4) * 300
            ELSE 4000
        END as salary,
        -- Mock ownership percentages for leverage calculation
        CASE
            WHEN p.position = 'QB' THEN 8 + RANDOM() * 15
            WHEN p.position = 'RB' THEN 10 + RANDOM() * 20
            WHEN p.position = 'WR' THEN 6 + RANDOM() * 18
            WHEN p.position = 'TE' THEN 4 + RANDOM() * 12
            ELSE 5
        END as projected_ownership_pct,
        COUNT(ps.id) as games_played
    FROM players p
    LEFT JOIN player_stats ps ON p.id = ps.player_id
    WHERE p.sport = 'NFL'
    AND p.position IN ('QB', 'RB', 'WR', 'TE')
    GROUP BY p.id, p.name, p.position, p.team
    HAVING COUNT(ps.id) > 2  -- Players with some game history
    ORDER BY avg_fantasy_points DESC
    LIMIT 100
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    print(f"✅ Fetched {len(df)} NFL players for optimization")
    print(f"Position breakdown: {df['position'].value_counts().to_dict()}")
    
    return df

def run_monte_carlo_simulation(players_df, iterations=10000):
    """Run Monte Carlo simulation on player pool"""
    print(f"🎲 Running {iterations:,} Monte Carlo iterations...")
    
    # Initialize simulator
    simulator = MonteCarloSimulator(iterations=iterations)
    
    # Prepare player data for simulation
    players_list = []
    for _, player in players_df.iterrows():
        players_list.append({
            'id': int(player['player_id']),
            'name': player['name'],
            'position': player['position'],
            'team': player['team'],
            'salary': int(player['salary']),
            'projection': float(player['avg_fantasy_points']),
            'std_dev': max(float(player['avg_fantasy_points']) * 0.3, 2.0),  # 30% std dev
            'projected_ownership': float(player['projected_ownership_pct'])
        })
    
    # Run simulation
    print("🔄 Simulating player performance distributions...")
    results = simulator.simulate_slate(players_list, 'NFL')
    
    # Add simulation results back to dataframe
    for i, result in enumerate(results['players']):
        players_df.loc[i, 'sim_ceiling'] = result['ceiling']
        players_df.loc[i, 'sim_floor'] = result['floor']
        players_df.loc[i, 'sim_median'] = result['median']
        players_df.loc[i, 'sim_std'] = result['std_dev']
    
    print("✅ Monte Carlo simulation complete!")
    return players_df, results

def calculate_leverage_scores(players_df):
    """Calculate leverage scores for each player"""
    print("📊 Calculating leverage scores...")
    
    # Leverage = Ceiling Projection - Projected Ownership
    # Higher ceiling + Lower ownership = Better leverage
    players_df['ceiling_projection'] = players_df['sim_ceiling']
    players_df['leverage_score'] = (
        players_df['ceiling_projection'] - 
        players_df['projected_ownership_pct']
    )
    
    # Normalize leverage scores (0-100 scale)
    min_lev = players_df['leverage_score'].min()
    max_lev = players_df['leverage_score'].max()
    players_df['leverage_normalized'] = (
        (players_df['leverage_score'] - min_lev) / (max_lev - min_lev) * 100
    )
    
    print("✅ Leverage scores calculated!")
    return players_df

def optimize_dfs_lineups(players_df, num_lineups=20):
    """Generate leverage-optimized DFS lineups"""
    print(f"🏆 Optimizing {num_lineups} DFS lineups using game theory...")
    
    # Initialize optimizer for DraftKings NFL
    optimizer = LeverageOptimizer(site='DK', sport='NFL')
    
    # Create constraints for NFL DraftKings
    constraints = LineupConstraints(
        salary_cap=50000,
        min_salary=48000,  # Use most of salary cap
        max_players_per_team=4,  # Stack limits
        min_teams=3,  # Diversification
        position_limits={
            'QB': {'min': 1, 'max': 1},
            'RB': {'min': 2, 'max': 3},
            'WR': {'min': 3, 'max': 4},
            'TE': {'min': 1, 'max': 2},
            'K': {'min': 0, 'max': 0},   # Skip kickers for demo
            'DST': {'min': 0, 'max': 0}  # Skip defense for demo
        }
    )
    
    # Generate lineup portfolio
    print("🎯 Generating optimal lineup combinations...")
    lineups = optimizer.generate_lineup_portfolio(
        players_df,
        num_lineups=num_lineups,
        objective='leverage',
        constraints=constraints
    )
    
    print(f"✅ Generated {len(lineups)} optimized lineups!")
    
    # Display top 5 lineups
    print("\n🏆 TOP 5 LEVERAGE-OPTIMIZED LINEUPS:")
    print("=" * 80)
    
    for i, lineup in enumerate(lineups[:5]):
        print(f"\n💎 LINEUP #{i+1} (Leverage Score: {lineup.get('leverage_score', 0):.1f})")
        print(f"💰 Salary: ${lineup.get('total_salary', 0):,}")
        print(f"📊 Projection: {lineup.get('projection_total', 0):.1f} pts")
        print(f"🎯 Ownership: {lineup.get('ownership_total', 0):.1f}%")
        print("-" * 60)
        
        for player in lineup.get('players', []):
            print(f"{player['position']:<3} {player['name']:<18} "
                  f"{player['team']:<4} ${player['salary']:<5} "
                  f"{player.get('projection', 0):<5.1f}pts "
                  f"({player.get('ownership', 0):.1f}%)")
    
    return lineups

def main():
    """Main demo pipeline"""
    print("🔥 STARTING LEVERAGE-OPTIMIZED DFS LINEUP GENERATOR 🚀")
    print("=" * 70)
    print("🎯 Mission: Create GPP-winning lineups using Monte Carlo + Game Theory")
    print("💪 Hardware: RTX 4060 + Ryzen 5 7600X + 32GB RAM")
    print("📊 Strategy: Leverage = Ceiling Projection - Ownership %")
    print("=" * 70)
    
    try:
        # Step 1: Fetch NFL data
        players_df = fetch_nfl_demo_data()
        
        # Step 2: Run Monte Carlo simulation
        players_df, sim_results = run_monte_carlo_simulation(players_df, iterations=10000)
        
        # Step 3: Calculate leverage scores
        players_df = calculate_leverage_scores(players_df)
        
        # Show top leverage plays
        print("\n🎯 TOP 10 LEVERAGE PLAYS:")
        print("-" * 70)
        top_leverage = players_df.nlargest(10, 'leverage_score')[
            ['name', 'position', 'team', 'ceiling_projection', 'projected_ownership_pct', 'leverage_score']
        ]
        
        for _, player in top_leverage.iterrows():
            print(f"{player['position']:<3} {player['name']:<18} {player['team']:<4} "
                  f"Ceiling: {player['ceiling_projection']:<5.1f} "
                  f"Own: {player['projected_ownership_pct']:<5.1f}% "
                  f"Lev: {player['leverage_score']:<6.1f}")
        
        # Step 4: Generate optimized lineups
        lineups = optimize_dfs_lineups(players_df, num_lineups=20)
        
        print("\n" + "🏆" * 25)
        print("✅ LEVERAGE OPTIMIZATION COMPLETE!")
        print(f"📊 {len(players_df)} players analyzed")
        print(f"🎲 10,000 Monte Carlo simulations")
        print(f"💎 {len(lineups)} optimal lineups generated")
        print(f"🎯 Using game theory leverage scoring")
        print("🏆" * 25)
        
        return lineups
        
    except Exception as e:
        print(f"❌ Error in leverage optimization: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    main()