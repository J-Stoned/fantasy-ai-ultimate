#!/usr/bin/env python3
"""
Monte Carlo Simulation Engine for Fantasy Sports
Hybrid GPU/CPU implementation optimized for 10K+ simulations
"""

import numpy as np
from typing import List, Dict, Tuple
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import multiprocessing as mp
from dataclasses import dataclass
import json
from tqdm import tqdm

# Try to import CuPy for GPU operations
try:
    import cupy as cp
    GPU_AVAILABLE = True
    print("✅ GPU acceleration available for Monte Carlo simulations")
except ImportError:
    cp = np
    GPU_AVAILABLE = False
    print("⚠️  GPU not available - using CPU for simulations")

@dataclass
class Player:
    """Player data structure for simulations"""
    id: int
    name: str
    position: str
    team: str
    salary: int
    projection: float
    std_dev: float
    ownership_proj: float = 0.0
    optimal_pct: float = 0.0
    leverage_score: float = 0.0

class MonteCarloSimulator:
    """
    High-performance Monte Carlo simulator for DFS
    Uses GPU for random number generation and CPU for lineup optimization
    """
    
    def __init__(self, iterations: int = 10000, cpu_cores: int = None):
        self.iterations = iterations
        self.cpu_cores = cpu_cores or min(mp.cpu_count(), 6)  # Use 6 cores max for Ryzen 5 7600X
        self.correlation_cache = {}
        
    def simulate_slate(self, players: List[Dict], sport: str = 'NFL') -> List[Dict]:
        """
        Run Monte Carlo simulation on a slate of players
        Returns players with updated optimal_pct and other metrics
        """
        print(f"🎲 Running {self.iterations:,} simulations on {len(players)} players...")
        
        # Convert to Player objects
        player_objects = [Player(**p) for p in players]
        
        # Step 1: Generate random samples on GPU
        samples = self._generate_samples_gpu(player_objects)
        
        # Step 2: Apply correlations
        samples = self._apply_correlations(samples, player_objects, sport)
        
        # Step 3: Find optimal lineups (CPU parallel)
        optimal_counts = self._find_optimal_lineups_parallel(samples, player_objects, sport)
        
        # Step 4: Calculate metrics
        results = self._calculate_metrics(player_objects, optimal_counts, samples)
        
        return results
    
    def _generate_samples_gpu(self, players: List[Player]) -> np.ndarray:
        """Generate random samples using GPU acceleration"""
        n_players = len(players)
        
        # Extract means and standard deviations
        means = np.array([p.projection for p in players])
        stds = np.array([p.std_dev for p in players])
        
        if GPU_AVAILABLE:
            # Use GPU for fast random number generation
            means_gpu = cp.asarray(means, dtype=cp.float32)
            stds_gpu = cp.asarray(stds, dtype=cp.float32)
            
            # Generate all random samples at once on GPU
            # Shape: (n_players, iterations)
            samples_gpu = cp.random.normal(
                means_gpu[:, None],
                stds_gpu[:, None],
                (n_players, self.iterations)
            )
            
            # Ensure non-negative values
            samples_gpu = cp.maximum(samples_gpu, 0)
            
            # Transfer back to CPU for lineup optimization
            samples = cp.asnumpy(samples_gpu)
        else:
            # CPU fallback
            samples = np.random.normal(
                means[:, None],
                stds[:, None],
                (n_players, self.iterations)
            )
            samples = np.maximum(samples, 0)
        
        return samples
    
    def _apply_correlations(self, samples: np.ndarray, players: List[Player], sport: str) -> np.ndarray:
        """Apply correlation adjustments to samples"""
        
        # Build correlation groups
        correlations = self._build_correlations(players, sport)
        
        # Apply correlations
        for iteration in range(self.iterations):
            for group in correlations:
                self._apply_correlation_group(samples[:, iteration], players, group)
        
        return samples
    
    def _build_correlations(self, players: List[Player], sport: str) -> List[Dict]:
        """Build correlation groups based on sport and team"""
        correlations = []
        
        if sport == 'NFL':
            # QB-WR/TE correlations
            teams = set(p.team for p in players)
            for team in teams:
                team_players = [i for i, p in enumerate(players) if p.team == team]
                qb_idx = [i for i in team_players if players[i].position == 'QB']
                wr_te_idx = [i for i in team_players if players[i].position in ['WR', 'TE']]
                
                if qb_idx and wr_te_idx:
                    correlations.append({
                        'type': 'qb_stack',
                        'primary': qb_idx[0],
                        'secondary': wr_te_idx,
                        'coefficient': 0.3
                    })
            
            # RB-DEF correlations (same team)
            for team in teams:
                team_players = [i for i, p in enumerate(players) if p.team == team]
                rb_idx = [i for i in team_players if players[i].position == 'RB']
                def_idx = [i for i in team_players if players[i].position == 'DST']
                
                if rb_idx and def_idx:
                    correlations.append({
                        'type': 'rb_def',
                        'primary': def_idx[0],
                        'secondary': rb_idx,
                        'coefficient': 0.2
                    })
        
        return correlations
    
    def _apply_correlation_group(self, iteration_samples: np.ndarray, players: List[Player], group: Dict):
        """Apply correlation to a specific group of players"""
        primary_idx = group['primary']
        secondary_idxs = group['secondary']
        coefficient = group['coefficient']
        
        # Calculate how much the primary player exceeded their mean
        primary_diff = iteration_samples[primary_idx] - players[primary_idx].projection
        
        # Apply correlation to secondary players
        for sec_idx in secondary_idxs:
            adjustment = primary_diff * coefficient
            iteration_samples[sec_idx] += adjustment
            iteration_samples[sec_idx] = max(0, iteration_samples[sec_idx])
    
    def _find_optimal_lineups_parallel(self, samples: np.ndarray, players: List[Player], sport: str) -> Dict[int, int]:
        """Find optimal lineups using parallel CPU processing"""
        
        # Split iterations across CPU cores
        chunk_size = self.iterations // self.cpu_cores
        chunks = []
        
        for i in range(0, self.iterations, chunk_size):
            end = min(i + chunk_size, self.iterations)
            chunks.append((i, end, samples[:, i:end], players, sport))
        
        # Process chunks in parallel
        optimal_counts = {}
        
        with ProcessPoolExecutor(max_workers=self.cpu_cores) as executor:
            futures = [executor.submit(self._process_chunk, chunk) for chunk in chunks]
            
            # Aggregate results
            for future in futures:
                chunk_counts = future.result()
                for player_idx, count in chunk_counts.items():
                    optimal_counts[player_idx] = optimal_counts.get(player_idx, 0) + count
        
        return optimal_counts
    
    def _process_chunk(self, chunk_data: Tuple) -> Dict[int, int]:
        """Process a chunk of iterations"""
        start_idx, end_idx, chunk_samples, players, sport = chunk_data
        optimal_counts = {}
        
        for i in range(chunk_samples.shape[1]):
            # Get scores for this iteration
            scores = chunk_samples[:, i]
            
            # Find optimal lineup
            lineup_indices = self._find_single_optimal_lineup(scores, players, sport)
            
            # Count appearances
            for idx in lineup_indices:
                optimal_counts[idx] = optimal_counts.get(idx, 0) + 1
        
        return optimal_counts
    
    def _find_single_optimal_lineup(self, scores: np.ndarray, players: List[Player], sport: str) -> List[int]:
        """
        Find the optimal lineup for a single iteration
        Uses a greedy algorithm for speed (can be replaced with proper optimizer)
        """
        # Sport-specific roster requirements
        roster_reqs = {
            'NFL': {'QB': 1, 'RB': 2, 'WR': 3, 'TE': 1, 'FLEX': 1, 'DST': 1},
            'NBA': {'PG': 1, 'SG': 1, 'SF': 1, 'PF': 1, 'C': 1, 'G': 1, 'F': 1, 'UTIL': 1},
            'MLB': {'P': 2, 'C': 1, '1B': 1, '2B': 1, '3B': 1, 'SS': 1, 'OF': 3},
            'NHL': {'C': 2, 'W': 3, 'D': 2, 'G': 1, 'UTIL': 1}
        }
        
        salary_cap = 50000  # DraftKings
        reqs = roster_reqs.get(sport, roster_reqs['NFL'])
        
        # Calculate value scores (points per dollar)
        values = scores / np.array([p.salary for p in players])
        
        # Sort players by value
        sorted_indices = np.argsort(values)[::-1]
        
        # Greedy selection
        lineup = []
        total_salary = 0
        position_counts = {pos: 0 for pos in reqs}
        
        for idx in sorted_indices:
            player = players[idx]
            
            # Check salary constraint
            if total_salary + player.salary > salary_cap:
                continue
            
            # Check position constraint
            can_add = False
            player_positions = [player.position]
            
            # Handle FLEX/UTIL positions
            if sport == 'NFL' and player.position in ['RB', 'WR', 'TE']:
                player_positions.append('FLEX')
            elif sport == 'NBA':
                if player.position in ['PG', 'SG']:
                    player_positions.append('G')
                if player.position in ['SF', 'PF']:
                    player_positions.append('F')
                player_positions.append('UTIL')
            
            for pos in player_positions:
                if pos in position_counts and position_counts[pos] < reqs.get(pos, 0):
                    can_add = True
                    position_counts[pos] += 1
                    break
            
            if can_add:
                lineup.append(idx)
                total_salary += player.salary
                
                # Check if lineup is complete
                if len(lineup) == sum(reqs.values()):
                    break
        
        return lineup
    
    def _calculate_metrics(self, players: List[Player], optimal_counts: Dict[int, int], 
                          samples: np.ndarray) -> List[Dict]:
        """Calculate final metrics for each player"""
        results = []
        
        for i, player in enumerate(players):
            # Calculate optimal percentage
            optimal_pct = (optimal_counts.get(i, 0) / self.iterations) * 100
            
            # Calculate boom/bust percentages
            boom_threshold = (player.salary / 1000) * 3  # 3x value
            bust_threshold = (player.salary / 1000) * 1  # 1x value
            
            boom_pct = np.sum(samples[i] >= boom_threshold) / self.iterations * 100
            bust_pct = np.sum(samples[i] <= bust_threshold) / self.iterations * 100
            
            # Calculate ceiling and floor
            ceiling = np.percentile(samples[i], 90)
            floor = np.percentile(samples[i], 10)
            
            # Calculate leverage score
            leverage_score = optimal_pct - player.ownership_proj
            
            results.append({
                'id': player.id,
                'name': player.name,
                'position': player.position,
                'team': player.team,
                'salary': player.salary,
                'projection': player.projection,
                'std_dev': player.std_dev,
                'optimal_pct': round(optimal_pct, 2),
                'ownership_proj': player.ownership_proj,
                'leverage_score': round(leverage_score, 2),
                'boom_pct': round(boom_pct, 2),
                'bust_pct': round(bust_pct, 2),
                'ceiling': round(ceiling, 2),
                'floor': round(floor, 2)
            })
        
        return results

# Example usage
if __name__ == "__main__":
    # Test the simulator
    print("🧪 Testing Monte Carlo simulation engine...")
    
    # Create sample players
    sample_players = [
        {'id': 1, 'name': 'Patrick Mahomes', 'position': 'QB', 'team': 'KC', 
         'salary': 8500, 'projection': 24.5, 'std_dev': 6.5, 'ownership_proj': 22.0},
        {'id': 2, 'name': 'Travis Kelce', 'position': 'TE', 'team': 'KC',
         'salary': 7800, 'projection': 18.5, 'std_dev': 5.2, 'ownership_proj': 18.0},
        {'id': 3, 'name': 'Tyreek Hill', 'position': 'WR', 'team': 'MIA',
         'salary': 8800, 'projection': 20.5, 'std_dev': 7.1, 'ownership_proj': 25.5},
        # Add more players for a complete test...
    ]
    
    # Run simulation
    simulator = MonteCarloSimulator(iterations=1000)  # Reduced for testing
    results = simulator.simulate_slate(sample_players, sport='NFL')
    
    # Print results
    print("\n📊 Simulation Results:")
    print(f"{'Player':<20} {'Proj':<6} {'Opt%':<6} {'Own%':<6} {'Lev':<6}")
    print("-" * 60)
    for player in sorted(results, key=lambda x: x['leverage_score'], reverse=True)[:5]:
        print(f"{player['name']:<20} {player['projection']:<6.1f} "
              f"{player['optimal_pct']:<6.1f} {player['ownership_proj']:<6.1f} "
              f"{player['leverage_score']:<+6.1f}")