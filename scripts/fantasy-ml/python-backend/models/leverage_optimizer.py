#!/usr/bin/env python3
"""
Leverage-Based Lineup Optimizer for DFS
Uses linear programming to generate GPP-winning lineups
"""

from pulp import *
import pandas as pd
import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import json
from datetime import datetime

@dataclass
class LineupConstraints:
    """Constraints for lineup generation"""
    salary_cap: int = 50000
    min_salary: int = 45000  # Force spending
    max_from_team: int = 4
    qb_stack_required: bool = True
    bring_back_required: bool = False
    max_exposure: float = 0.4
    unique_players: int = 3  # Min unique players between lineups

class LeverageOptimizer:
    """
    Advanced lineup optimizer that focuses on leverage instead of raw projections
    Designed for GPP tournaments
    """
    
    def __init__(self, site: str = 'DK', sport: str = 'NFL'):
        self.site = site
        self.sport = sport
        self.generated_lineups = []
        self.player_exposures = {}
        
        # Site-specific settings
        self.site_config = {
            'DK': {
                'salary_cap': 50000,
                'roster_size': {'NFL': 9, 'NBA': 8, 'MLB': 10, 'NHL': 9}
            },
            'FD': {
                'salary_cap': 60000,
                'roster_size': {'NFL': 9, 'NBA': 9, 'MLB': 9, 'NHL': 9}
            }
        }
        
        # Sport-specific roster requirements
        self.roster_reqs = {
            'NFL': {
                'DK': {'QB': (1, 1), 'RB': (2, 3), 'WR': (3, 4), 'TE': (1, 2), 'DST': (1, 1)},
                'FD': {'QB': (1, 1), 'RB': (2, 2), 'WR': (3, 3), 'TE': (1, 1), 'DEF': (1, 1)}
            },
            'NBA': {
                'DK': {'PG': (1, 3), 'SG': (1, 3), 'SF': (1, 3), 'PF': (1, 3), 'C': (1, 2)},
                'FD': {'PG': (2, 2), 'SG': (2, 2), 'SF': (2, 2), 'PF': (2, 2), 'C': (1, 1)}
            },
            'MLB': {
                'DK': {'P': (2, 2), 'C': (1, 1), '1B': (1, 1), '2B': (1, 1), 
                       '3B': (1, 1), 'SS': (1, 1), 'OF': (3, 3)},
                'FD': {'P': (1, 1), 'C/1B': (1, 1), '2B': (1, 1), '3B': (1, 1), 
                       'SS': (1, 1), 'OF': (3, 3), 'UTIL': (1, 1)}
            },
            'NHL': {
                'DK': {'C': (2, 3), 'W': (3, 4), 'D': (2, 3), 'G': (1, 1)},
                'FD': {'C': (2, 2), 'W': (4, 4), 'D': (2, 2), 'G': (1, 1)}
            }
        }
    
    def optimize_single_lineup(self, players_df: pd.DataFrame, 
                             objective: str = 'leverage',
                             constraints: Optional[LineupConstraints] = None) -> Dict:
        """Optimize a single lineup based on the specified objective"""
        
        if constraints is None:
            constraints = LineupConstraints()
        
        # Create the optimization problem
        prob = LpProblem("DFS_Lineup_Optimization", LpMaximize)
        
        # Decision variables
        player_vars = LpVariable.dicts("players", players_df.index, cat='Binary')
        
        # Objective function
        if objective == 'leverage':
            prob += lpSum([players_df.loc[i, 'leverage_score'] * player_vars[i] 
                          for i in players_df.index])
        elif objective == 'optimal_pct':
            prob += lpSum([players_df.loc[i, 'optimal_pct'] * player_vars[i] 
                          for i in players_df.index])
        elif objective == 'projection':
            prob += lpSum([players_df.loc[i, 'projection'] * player_vars[i] 
                          for i in players_df.index])
        else:
            raise ValueError(f"Unknown objective: {objective}")
        
        # Constraints
        self._add_constraints(prob, player_vars, players_df, constraints)
        
        # Solve
        prob.solve(PULP_CBC_CMD(msg=0))
        
        # Extract lineup
        if prob.status == LpStatusOptimal:
            lineup = self._extract_lineup(player_vars, players_df)
            return lineup
        else:
            return None
    
    def generate_lineup_portfolio(self, players_df: pd.DataFrame,
                                num_lineups: int = 150,
                                objective: str = 'leverage',
                                constraints: Optional[LineupConstraints] = None) -> List[Dict]:
        """Generate a portfolio of diverse lineups"""
        
        print(f"🎯 Generating {num_lineups} {objective}-optimized lineups...")
        
        if constraints is None:
            constraints = LineupConstraints()
        
        self.generated_lineups = []
        self.player_exposures = {i: 0 for i in players_df.index}
        
        for lineup_num in range(num_lineups):
            # Update exposure constraints
            players_df['current_exposure'] = [
                self.player_exposures[i] / max(1, len(self.generated_lineups))
                for i in players_df.index
            ]
            
            # Generate lineup
            lineup = self._generate_unique_lineup(players_df, objective, constraints)
            
            if lineup:
                self.generated_lineups.append(lineup)
                
                # Update exposures
                for player_idx in lineup['player_indices']:
                    self.player_exposures[player_idx] += 1
                
                if (lineup_num + 1) % 25 == 0:
                    print(f"  Generated {lineup_num + 1}/{num_lineups} lineups...")
            else:
                print(f"  Warning: Could not generate lineup {lineup_num + 1}")
        
        print(f"✅ Successfully generated {len(self.generated_lineups)} lineups")
        
        return self.generated_lineups
    
    def _add_constraints(self, prob: LpProblem, player_vars: Dict, 
                        players_df: pd.DataFrame, constraints: LineupConstraints):
        """Add all constraints to the optimization problem"""
        
        # Salary constraints
        prob += lpSum([players_df.loc[i, 'salary'] * player_vars[i] 
                      for i in players_df.index]) <= constraints.salary_cap
        prob += lpSum([players_df.loc[i, 'salary'] * player_vars[i] 
                      for i in players_df.index]) >= constraints.min_salary
        
        # Roster size
        roster_size = self.site_config[self.site]['roster_size'][self.sport]
        prob += lpSum([player_vars[i] for i in players_df.index]) == roster_size
        
        # Position constraints
        position_reqs = self.roster_reqs[self.sport][self.site]
        
        for position, (min_req, max_req) in position_reqs.items():
            # Handle multi-position eligibility
            if '/' in position:
                positions = position.split('/')
                position_players = players_df[players_df['position'].isin(positions)].index
            else:
                position_players = players_df[players_df['position'] == position].index
            
            if position_players.any():
                prob += lpSum([player_vars[i] for i in position_players]) >= min_req
                prob += lpSum([player_vars[i] for i in position_players]) <= max_req
        
        # Handle FLEX positions for NFL
        if self.sport == 'NFL' and self.site == 'DK':
            flex_positions = ['RB', 'WR', 'TE']
            flex_players = players_df[players_df['position'].isin(flex_positions)].index
            prob += lpSum([player_vars[i] for i in flex_players]) == 7  # 2 RB + 3 WR + 1 TE + 1 FLEX
        
        # Team constraints
        teams = players_df['team'].unique()
        for team in teams:
            team_players = players_df[players_df['team'] == team].index
            prob += lpSum([player_vars[i] for i in team_players]) <= constraints.max_from_team
        
        # Exposure constraints (for portfolio generation)
        if 'current_exposure' in players_df.columns:
            for i in players_df.index:
                if players_df.loc[i, 'current_exposure'] >= constraints.max_exposure:
                    prob += player_vars[i] == 0
        
        # Stacking constraints for NFL
        if self.sport == 'NFL' and constraints.qb_stack_required:
            # Ensure at least one pass catcher from QB's team
            qb_indices = players_df[players_df['position'] == 'QB'].index
            
            for qb_idx in qb_indices:
                qb_team = players_df.loc[qb_idx, 'team']
                stack_players = players_df[
                    (players_df['team'] == qb_team) & 
                    (players_df['position'].isin(['WR', 'TE']))
                ].index
                
                # If QB is selected, at least one stack player must be selected
                if stack_players.any():
                    prob += lpSum([player_vars[i] for i in stack_players]) >= player_vars[qb_idx]
    
    def _generate_unique_lineup(self, players_df: pd.DataFrame, 
                               objective: str, constraints: LineupConstraints) -> Optional[Dict]:
        """Generate a lineup that is unique from previously generated ones"""
        
        # Create a copy of the dataframe
        df_copy = players_df.copy()
        
        # Add constraint to ensure uniqueness
        if self.generated_lineups:
            # Create a new problem with uniqueness constraint
            prob = LpProblem("Unique_Lineup", LpMaximize)
            player_vars = LpVariable.dicts("players", df_copy.index, cat='Binary')
            
            # Original objective
            if objective == 'leverage':
                prob += lpSum([df_copy.loc[i, 'leverage_score'] * player_vars[i] 
                              for i in df_copy.index])
            elif objective == 'optimal_pct':
                prob += lpSum([df_copy.loc[i, 'optimal_pct'] * player_vars[i] 
                              for i in df_copy.index])
            else:
                prob += lpSum([df_copy.loc[i, 'projection'] * player_vars[i] 
                              for i in df_copy.index])
            
            # Add all regular constraints
            self._add_constraints(prob, player_vars, df_copy, constraints)
            
            # Add uniqueness constraints
            for prev_lineup in self.generated_lineups[-20:]:  # Check last 20 lineups
                prev_indices = prev_lineup['player_indices']
                # At least X players must be different
                prob += lpSum([player_vars[i] for i in prev_indices]) <= (
                    len(prev_indices) - constraints.unique_players
                )
            
            # Solve
            prob.solve(PULP_CBC_CMD(msg=0))
            
            if prob.status == LpStatusOptimal:
                return self._extract_lineup(player_vars, df_copy)
            else:
                # Try random exclusions to force diversity
                random_exclude = np.random.choice(df_copy.index, size=5, replace=False)
                df_copy = df_copy.drop(random_exclude)
                return self.optimize_single_lineup(df_copy, objective, constraints)
        else:
            # First lineup
            return self.optimize_single_lineup(df_copy, objective, constraints)
    
    def _extract_lineup(self, player_vars: Dict, players_df: pd.DataFrame) -> Dict:
        """Extract lineup details from solved problem"""
        
        lineup_indices = []
        lineup_players = []
        total_salary = 0
        total_projection = 0
        total_leverage = 0
        positions = {}
        
        for i in players_df.index:
            if player_vars[i].value() == 1:
                player = players_df.loc[i]
                lineup_indices.append(i)
                lineup_players.append({
                    'name': player['name'],
                    'position': player['position'],
                    'team': player['team'],
                    'salary': player['salary'],
                    'projection': player['projection'],
                    'leverage_score': player.get('leverage_score', 0),
                    'ownership_proj': player.get('ownership_proj', 0)
                })
                
                total_salary += player['salary']
                total_projection += player['projection']
                total_leverage += player.get('leverage_score', 0)
                
                pos = player['position']
                positions[pos] = positions.get(pos, 0) + 1
        
        return {
            'player_indices': lineup_indices,
            'players': lineup_players,
            'total_salary': total_salary,
            'total_projection': round(total_projection, 2),
            'total_leverage': round(total_leverage, 2),
            'positions': positions,
            'timestamp': datetime.now().isoformat()
        }
    
    def export_lineups(self, output_format: str = 'csv', filename: str = None) -> str:
        """Export lineups to various formats"""
        
        if not self.generated_lineups:
            raise ValueError("No lineups to export")
        
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"lineups_{self.sport}_{timestamp}.{output_format}"
        
        if output_format == 'csv':
            # DraftKings CSV format
            rows = []
            for lineup in self.generated_lineups:
                row = {}
                for player in lineup['players']:
                    pos = player['position']
                    if pos in row:
                        # Handle multiple positions (e.g., multiple WRs)
                        counter = 2
                        while f"{pos}{counter}" in row:
                            counter += 1
                        pos = f"{pos}{counter}"
                    row[pos] = player['name']
                rows.append(row)
            
            df = pd.DataFrame(rows)
            df.to_csv(filename, index=False)
        
        elif output_format == 'json':
            with open(filename, 'w') as f:
                json.dump(self.generated_lineups, f, indent=2)
        
        print(f"📁 Lineups exported to {filename}")
        return filename

# Example usage
if __name__ == "__main__":
    # Test the optimizer
    print("🧪 Testing leverage optimizer...")
    
    # Create sample player pool
    sample_players = pd.DataFrame([
        {'name': 'Patrick Mahomes', 'position': 'QB', 'team': 'KC', 'salary': 8500, 
         'projection': 24.5, 'leverage_score': -3.5, 'ownership_proj': 22.0},
        {'name': 'Lamar Jackson', 'position': 'QB', 'team': 'BAL', 'salary': 8100,
         'projection': 22.8, 'leverage_score': 6.5, 'ownership_proj': 9.5},
        {'name': 'Christian McCaffrey', 'position': 'RB', 'team': 'SF', 'salary': 9200,
         'projection': 22.0, 'leverage_score': -3.0, 'ownership_proj': 28.0},
        {'name': "D'Andre Swift", 'position': 'RB', 'team': 'PHI', 'salary': 6100,
         'projection': 14.5, 'leverage_score': 12.0, 'ownership_proj': 4.0},
        # Add more players for a complete test...
    ])
    
    # Generate lineups
    optimizer = LeverageOptimizer(site='DK', sport='NFL')
    
    # Single lineup
    print("\n📋 Generating single leverage lineup...")
    lineup = optimizer.optimize_single_lineup(sample_players, objective='leverage')
    if lineup:
        print(f"Total Leverage: {lineup['total_leverage']}")
        print(f"Total Projection: {lineup['total_projection']}")
        print(f"Salary Used: ${lineup['total_salary']}")
        
    # Portfolio
    print("\n📊 Generating lineup portfolio...")
    portfolio = optimizer.generate_lineup_portfolio(sample_players, num_lineups=5)
    print(f"Generated {len(portfolio)} unique lineups")