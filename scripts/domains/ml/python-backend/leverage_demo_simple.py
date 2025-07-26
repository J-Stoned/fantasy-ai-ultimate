#!/usr/bin/env python3
"""
🔥 LEVERAGE-OPTIMIZED DFS LINEUP GENERATOR - SIMPLIFIED DEMO! 🚀
Shows Monte Carlo simulations + Game Theory for GPP-winning strategies
For Dad's Birthday Demo - Pure leverage optimization without database dependencies
"""

import pandas as pd
import numpy as np
from datetime import datetime
import os
import sys
from typing import Dict, List

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.monte_carlo_engine import MonteCarloSimulator
from models.leverage_optimizer import LeverageOptimizer, LineupConstraints

def create_mock_nfl_data():
    """Create mock NFL player data for demonstration"""
    print("🏈 Creating mock NFL player data for leverage optimization...")
    
    # Professional NFL player examples with realistic data
    mock_players = [
        # QBs - High ceiling, varying ownership
        {'id': 1, 'name': 'Josh Allen', 'position': 'QB', 'team': 'BUF', 'salary': 8800, 'avg_fp': 24.5, 'ownership': 18.2},
        {'id': 2, 'name': 'Patrick Mahomes', 'position': 'QB', 'team': 'KC', 'salary': 8600, 'avg_fp': 23.8, 'ownership': 22.1},
        {'id': 3, 'name': 'Lamar Jackson', 'position': 'QB', 'team': 'BAL', 'salary': 8400, 'avg_fp': 23.2, 'ownership': 15.7},
        {'id': 4, 'name': 'Joe Burrow', 'position': 'QB', 'team': 'CIN', 'salary': 8200, 'avg_fp': 22.1, 'ownership': 12.4},
        {'id': 5, 'name': 'Tua Tagovailoa', 'position': 'QB', 'team': 'MIA', 'salary': 7600, 'avg_fp': 19.8, 'ownership': 8.3},
        
        # RBs - Workhorse vs committee backs
        {'id': 11, 'name': 'Christian McCaffrey', 'position': 'RB', 'team': 'SF', 'salary': 8000, 'avg_fp': 18.7, 'ownership': 25.8},
        {'id': 12, 'name': 'Austin Ekeler', 'position': 'RB', 'team': 'LAC', 'salary': 7800, 'avg_fp': 17.9, 'ownership': 21.3},
        {'id': 13, 'name': 'Derrick Henry', 'position': 'RB', 'team': 'TEN', 'salary': 7600, 'avg_fp': 16.8, 'ownership': 18.7},
        {'id': 14, 'name': 'Saquon Barkley', 'position': 'RB', 'team': 'NYG', 'salary': 7400, 'avg_fp': 16.2, 'ownership': 16.9},
        {'id': 15, 'name': 'Alvin Kamara', 'position': 'RB', 'team': 'NO', 'salary': 7200, 'avg_fp': 15.6, 'ownership': 14.5},
        {'id': 16, 'name': 'Kenneth Walker III', 'position': 'RB', 'team': 'SEA', 'salary': 6800, 'avg_fp': 14.1, 'ownership': 11.2},
        {'id': 17, 'name': 'Rhamondre Stevenson', 'position': 'RB', 'team': 'NE', 'salary': 6400, 'avg_fp': 12.8, 'ownership': 9.7},
        {'id': 18, 'name': 'Isiah Pacheco', 'position': 'RB', 'team': 'KC', 'salary': 6000, 'avg_fp': 11.9, 'ownership': 7.4},
        
        # WRs - Elite targets vs volume plays
        {'id': 21, 'name': 'Tyreek Hill', 'position': 'WR', 'team': 'MIA', 'salary': 8200, 'avg_fp': 16.8, 'ownership': 19.6},
        {'id': 22, 'name': 'Davante Adams', 'position': 'WR', 'team': 'LV', 'salary': 8000, 'avg_fp': 16.2, 'ownership': 17.3},
        {'id': 23, 'name': 'Cooper Kupp', 'position': 'WR', 'team': 'LAR', 'salary': 7800, 'avg_fp': 15.7, 'ownership': 20.4},
        {'id': 24, 'name': 'Stefon Diggs', 'position': 'WR', 'team': 'BUF', 'salary': 7600, 'avg_fp': 15.1, 'ownership': 16.8},
        {'id': 25, 'name': 'A.J. Brown', 'position': 'WR', 'team': 'PHI', 'salary': 7400, 'avg_fp': 14.6, 'ownership': 15.2},
        {'id': 26, 'name': 'DeAndre Hopkins', 'position': 'WR', 'team': 'TEN', 'salary': 7000, 'avg_fp': 13.8, 'ownership': 12.1},
        {'id': 27, 'name': 'DK Metcalf', 'position': 'WR', 'team': 'SEA', 'salary': 6800, 'avg_fp': 13.2, 'ownership': 11.7},
        {'id': 28, 'name': 'Amari Cooper', 'position': 'WR', 'team': 'CLE', 'salary': 6600, 'avg_fp': 12.7, 'ownership': 10.3},
        {'id': 29, 'name': 'Jerry Jeudy', 'position': 'WR', 'team': 'DEN', 'salary': 6200, 'avg_fp': 11.9, 'ownership': 8.6},
        {'id': 30, 'name': 'Gabe Davis', 'position': 'WR', 'team': 'BUF', 'salary': 5800, 'avg_fp': 10.8, 'ownership': 6.9},
        
        # TEs - Positional scarcity creates leverage opportunities  
        {'id': 31, 'name': 'Travis Kelce', 'position': 'TE', 'team': 'KC', 'salary': 7400, 'avg_fp': 14.2, 'ownership': 28.7},
        {'id': 32, 'name': 'Mark Andrews', 'position': 'TE', 'team': 'BAL', 'salary': 6800, 'avg_fp': 12.6, 'ownership': 18.3},
        {'id': 33, 'name': 'T.J. Hockenson', 'position': 'TE', 'team': 'MIN', 'salary': 6200, 'avg_fp': 10.9, 'ownership': 12.1},
        {'id': 34, 'name': 'George Kittle', 'position': 'TE', 'team': 'SF', 'salary': 6000, 'avg_fp': 10.3, 'ownership': 11.8},
        {'id': 35, 'name': 'Kyle Pitts', 'position': 'TE', 'team': 'ATL', 'salary': 5600, 'avg_fp': 9.1, 'ownership': 8.4},
        {'id': 36, 'name': 'Dallas Goedert', 'position': 'TE', 'team': 'PHI', 'salary': 5200, 'avg_fp': 8.7, 'ownership': 7.2},
    ]
    
    # Convert to DataFrame and add additional features
    df = pd.DataFrame(mock_players)
    
    # Calculate advanced features for each player
    for i, row in df.iterrows():
        position = row['position']
        avg_fp = row['avg_fp']
        
        # Rolling averages with realistic variance
        df.loc[i, 'avg_fp_last_3'] = avg_fp * np.random.uniform(0.85, 1.15)
        df.loc[i, 'avg_fp_last_5'] = avg_fp * np.random.uniform(0.90, 1.10)
        df.loc[i, 'avg_fp_season'] = avg_fp
        
        # Position-specific usage rates
        if position == 'QB':
            df.loc[i, 'usage_rate'] = np.random.uniform(0.75, 0.95)
        elif position == 'RB':
            df.loc[i, 'usage_rate'] = np.random.uniform(0.50, 0.80)
        elif position == 'WR':
            df.loc[i, 'usage_rate'] = np.random.uniform(0.20, 0.60)
        else:  # TE
            df.loc[i, 'usage_rate'] = np.random.uniform(0.15, 0.40)
        
        # Game environment features
        df.loc[i, 'vegas_total'] = np.random.uniform(42.5, 52.5)
        df.loc[i, 'team_implied_total'] = np.random.uniform(18.0, 32.0)
        df.loc[i, 'spread'] = np.random.uniform(-7.0, 7.0)
        df.loc[i, 'opponent_dvp_rank'] = np.random.randint(1, 33)
        df.loc[i, 'is_home'] = np.random.choice([0, 1])
        
        # Target share for pass catchers
        if position in ['WR', 'TE']:
            df.loc[i, 'target_share'] = np.random.uniform(0.08, 0.35)
        else:
            df.loc[i, 'target_share'] = 0.0
        
        # Red zone touches for RBs
        if position == 'RB':
            df.loc[i, 'red_zone_touches'] = np.random.uniform(0.05, 0.25)
        else:
            df.loc[i, 'red_zone_touches'] = 0.0
        
        # Rename ownership column for consistency
        df.loc[i, 'projected_ownership_pct'] = row['ownership']
    
    # Add player_id column for compatibility
    df['player_id'] = df['id']
    
    print(f"✅ Created {len(df)} mock NFL players")
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
            'projection': float(player['avg_fp']),
            'std_dev': max(float(player['avg_fp']) * 0.25, 2.0),  # 25% std dev
            'ownership_proj': float(player['projected_ownership_pct'])
        })
    
    # Run simulation
    print("🔄 Simulating player performance distributions...")
    results = simulator.simulate_slate(players_list, 'NFL')
    
    # Add simulation results back to dataframe
    # Handle the case where results is a list of dictionaries
    for i, result in enumerate(results):
        players_df.loc[i, 'sim_ceiling'] = result.get('ceiling', result.get('95th_percentile', players_df.iloc[i]['avg_fp'] * 1.8))
        players_df.loc[i, 'sim_floor'] = result.get('floor', result.get('5th_percentile', players_df.iloc[i]['avg_fp'] * 0.3))
        players_df.loc[i, 'sim_median'] = result.get('median', result.get('50th_percentile', players_df.iloc[i]['avg_fp']))
        players_df.loc[i, 'sim_std'] = result.get('std_dev', result.get('std', players_df.iloc[i]['avg_fp'] * 0.25))
    
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

def optimize_dfs_lineups(players_df, num_lineups=15):
    """Generate leverage-optimized DFS lineups"""
    print(f"🏆 Optimizing {num_lineups} DFS lineups using game theory...")
    
    # Initialize optimizer for DraftKings NFL
    optimizer = LeverageOptimizer(site='DK', sport='NFL')
    
    # Create constraints for NFL DraftKings
    constraints = LineupConstraints(
        salary_cap=50000,
        min_salary=48000,  # Use most of salary cap
        max_from_team=4,  # Stack limits
        qb_stack_required=False,  # Skip stacking for demo
        max_exposure=0.4  # 40% max exposure per player
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
    print("=" * 85)
    
    for i, lineup in enumerate(lineups[:5]):
        print(f"\n💎 LINEUP #{i+1} (Leverage Score: {lineup.get('leverage_score', 0):.1f})")
        print(f"💰 Salary: ${lineup.get('total_salary', 0):,} / $50,000")
        print(f"📊 Projection: {lineup.get('projection_total', 0):.1f} pts")
        print(f"🎯 Ownership: {lineup.get('ownership_total', 0):.1f}%")
        print("-" * 65)
        
        for player in lineup.get('players', []):
            print(f"{player['position']:<3} {player['name']:<20} "
                  f"{player['team']:<4} ${player['salary']:<5} "
                  f"{player.get('projection', 0):<5.1f}pts "
                  f"({player.get('ownership', 0):.1f}%)")
    
    return lineups

def main():
    """Main demo pipeline"""
    print("🔥 LEVERAGE-OPTIMIZED DFS LINEUP GENERATOR - DEMO VERSION 🚀")
    print("=" * 75)
    print("🎯 Mission: Create GPP-winning lineups using Monte Carlo + Game Theory")
    print("💪 Hardware: RTX 4060 + Ryzen 5 7600X + 32GB RAM")
    print("📊 Strategy: Leverage = Ceiling Projection - Ownership %")
    print("🏈 Data: Professional NFL mock data with realistic projections")
    print("=" * 75)
    
    try:
        # Step 1: Create mock NFL data
        players_df = create_mock_nfl_data()
        
        # Step 2: Run Monte Carlo simulation
        players_df, sim_results = run_monte_carlo_simulation(players_df, iterations=10000)
        
        # Step 3: Calculate leverage scores
        players_df = calculate_leverage_scores(players_df)
        
        # Show top leverage plays
        print("\n🎯 TOP 10 LEVERAGE PLAYS:")
        print("-" * 75)
        top_leverage = players_df.nlargest(10, 'leverage_score')[
            ['name', 'position', 'team', 'ceiling_projection', 'projected_ownership_pct', 'leverage_score']
        ]
        
        for _, player in top_leverage.iterrows():
            print(f"{player['position']:<3} {player['name']:<20} {player['team']:<4} "
                  f"Ceiling: {player['ceiling_projection']:<5.1f} "
                  f"Own: {player['projected_ownership_pct']:<5.1f}% "
                  f"Lev: {player['leverage_score']:<6.1f}")
        
        # Step 4: Generate optimized lineups
        lineups = optimize_dfs_lineups(players_df, num_lineups=15)
        
        print("\n" + "🏆" * 25)
        print("✅ LEVERAGE OPTIMIZATION COMPLETE!")
        print(f"📊 {len(players_df)} players analyzed")
        print(f"🎲 10,000 Monte Carlo simulations")
        print(f"💎 {len(lineups)} optimal lineups generated")
        print(f"🎯 Using game theory leverage scoring")
        print(f"🚀 Professional DFS optimization for GPP tournaments")
        print("🏆" * 25)
        
        return lineups
        
    except Exception as e:
        print(f"❌ Error in leverage optimization: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    main()