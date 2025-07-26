import axios, { AxiosInstance } from 'axios';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Python ML Backend Bridge
 * Handles communication between Node.js and Python prediction server
 */

interface PlayerData {
  id: number;
  name: string;
  position: string;
  team: string;
  salary: number;
  // Feature fields
  avg_fp_last_3: number;
  avg_fp_last_5: number;
  avg_fp_season: number;
  usage_rate: number;
  vegas_total: number;
  team_implied_total: number;
  spread: number;
  opponent_dvp_rank: number;
  is_home: boolean;
  // Optional sport-specific fields
  target_share?: number;
  red_zone_touches?: number;
  minutes_avg?: number;
  shots_per_game?: number;
  batting_order?: number;
}

interface PredictionResult {
  id: number;
  name: string;
  position: string;
  team: string;
  salary: number;
  projection: number;
  std_dev: number;
}

interface SimulationResult {
  id: number;
  name: string;
  position: string;
  team: string;
  salary: number;
  projection: number;
  std_dev: number;
  optimal_pct: number;
  ownership_proj: number;
  leverage_score: number;
  boom_pct: number;
  bust_pct: number;
  ceiling: number;
  floor: number;
}

interface Lineup {
  player_indices: number[];
  players: any[];
  total_salary: number;
  total_projection: number;
  total_leverage: number;
  positions: Record<string, number>;
  timestamp: string;
}

interface LineupConstraints {
  salary_cap?: number;
  min_salary?: number;
  max_from_team?: number;
  qb_stack_required?: boolean;
  bring_back_required?: boolean;
  max_exposure?: number;
  unique_players?: number;
}

export class PythonMLBridge extends EventEmitter {
  private axios: AxiosInstance;
  private pythonProcess: ChildProcess | null = null;
  private isReady: boolean = false;
  private baseURL: string;
  private maxRetries: number = 30;
  private retryDelay: number = 1000;

  constructor(port: number = 8000) {
    super();
    this.baseURL = `http://localhost:${port}`;
    
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Start the Python prediction server
   */
  async start(): Promise<void> {
    console.log('🐍 Starting Python ML server...');
    
    // Check if server is already running
    const isRunning = await this.checkServerHealth();
    if (isRunning) {
      console.log('✅ Python server already running');
      this.isReady = true;
      this.emit('ready');
      return;
    }

    // Start Python server
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const serverPath = './scripts/fantasy-ml/python-backend/api/prediction_server.py';
    
    this.pythonProcess = spawn(pythonPath, ['-m', 'uvicorn', 'prediction_server:app', '--host', '0.0.0.0', '--port', '8000'], {
      cwd: './scripts/fantasy-ml/python-backend/api',
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    this.pythonProcess.stdout?.on('data', (data) => {
      console.log(`Python: ${data.toString()}`);
    });

    this.pythonProcess.stderr?.on('data', (data) => {
      console.error(`Python Error: ${data.toString()}`);
    });

    this.pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      this.emit('error', error);
    });

    this.pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      this.isReady = false;
      this.pythonProcess = null;
    });

    // Wait for server to be ready
    await this.waitForServer();
  }

  /**
   * Stop the Python server
   */
  async stop(): Promise<void> {
    if (this.pythonProcess) {
      console.log('🛑 Stopping Python ML server...');
      this.pythonProcess.kill('SIGTERM');
      this.pythonProcess = null;
      this.isReady = false;
    }
  }

  /**
   * Wait for the server to be ready
   */
  private async waitForServer(): Promise<void> {
    for (let i = 0; i < this.maxRetries; i++) {
      const isHealthy = await this.checkServerHealth();
      if (isHealthy) {
        console.log('✅ Python ML server ready!');
        this.isReady = true;
        this.emit('ready');
        return;
      }
      await this.sleep(this.retryDelay);
    }
    throw new Error('Python server failed to start');
  }

  /**
   * Check if the server is healthy
   */
  private async checkServerHealth(): Promise<boolean> {
    try {
      const response = await this.axios.get('/health');
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get predictions for players
   */
  async predict(sport: string, players: PlayerData[]): Promise<PredictionResult[]> {
    if (!this.isReady) {
      throw new Error('Python ML server not ready');
    }

    const response = await this.axios.post('/predict', {
      sport,
      players
    });

    return response.data.predictions;
  }

  /**
   * Run Monte Carlo simulations
   */
  async simulate(sport: string, players: any[], iterations: number = 10000): Promise<SimulationResult[]> {
    if (!this.isReady) {
      throw new Error('Python ML server not ready');
    }

    const response = await this.axios.post('/simulate', {
      sport,
      players,
      iterations
    });

    return response.data.results;
  }

  /**
   * Generate optimized lineups
   */
  async optimizeLineups(
    sport: string,
    site: 'DK' | 'FD',
    players: any[],
    numLineups: number = 150,
    objective: 'leverage' | 'optimal_pct' | 'projection' = 'leverage',
    constraints?: LineupConstraints
  ): Promise<Lineup[]> {
    if (!this.isReady) {
      throw new Error('Python ML server not ready');
    }

    const response = await this.axios.post('/optimize', {
      sport,
      site,
      players,
      num_lineups: numLineups,
      objective,
      constraints
    });

    return response.data.lineups;
  }

  /**
   * Get feature importance for a sport
   */
  async getFeatureImportance(sport: string, topN: number = 20): Promise<Array<{name: string, importance: number}>> {
    if (!this.isReady) {
      throw new Error('Python ML server not ready');
    }

    const response = await this.axios.get(`/feature-importance/${sport}`, {
      params: { top_n: topN }
    });

    return response.data.features;
  }

  /**
   * Batch predictions for multiple sports
   */
  async predictBatch(requests: Array<{sport: string, players: PlayerData[]}>): Promise<any[]> {
    if (!this.isReady) {
      throw new Error('Python ML server not ready');
    }

    const response = await this.axios.post('/predict-batch', requests);
    return response.data.results;
  }

  /**
   * Transform database results to ML features
   */
  static transformToMLFeatures(players: any[], sport: string): PlayerData[] {
    return players.map(player => {
      const base = {
        id: player.player_id,
        name: player.name,
        position: player.position,
        team: player.team,
        salary: player.salary || 5000,
        avg_fp_last_3: player.avg_fp_last_3 || 0,
        avg_fp_last_5: player.avg_fp_last_5 || 0,
        avg_fp_season: player.avg_fp_season || 0,
        usage_rate: player.usage_rate || 0,
        vegas_total: player.vegas_total || 0,
        team_implied_total: player.team_implied_total || 0,
        spread: player.spread || 0,
        opponent_dvp_rank: player.opponent_dvp_rank || 15,
        is_home: player.is_home || false
      };

      // Add sport-specific features
      switch(sport) {
        case 'NFL':
          return {
            ...base,
            target_share: player.target_share || 0,
            red_zone_touches: player.red_zone_touches || 0
          };
        case 'NBA':
          return {
            ...base,
            minutes_avg: player.minutes_avg || 0
          };
        case 'MLB':
          return {
            ...base,
            batting_order: player.batting_order || 5
          };
        case 'NHL':
          return {
            ...base,
            shots_per_game: player.shots_per_game || 0
          };
        default:
          return base;
      }
    });
  }
}

// Example usage
if (require.main === module) {
  (async () => {
    const bridge = new PythonMLBridge();
    
    try {
      // Start server
      await bridge.start();
      
      // Example predictions
      const players: PlayerData[] = [
        {
          id: 1,
          name: 'Patrick Mahomes',
          position: 'QB',
          team: 'KC',
          salary: 8500,
          avg_fp_last_3: 25.5,
          avg_fp_last_5: 24.8,
          avg_fp_season: 24.2,
          usage_rate: 0.35,
          vegas_total: 51.5,
          team_implied_total: 28.5,
          spread: -6.5,
          opponent_dvp_rank: 20,
          is_home: true,
          target_share: 0.28,
          red_zone_touches: 2.5
        }
      ];
      
      // Get predictions
      const predictions = await bridge.predict('NFL', players);
      console.log('Predictions:', predictions);
      
      // Run simulation
      const simResults = await bridge.simulate('NFL', players, 1000);
      console.log('Simulation results:', simResults);
      
      // Get feature importance
      const importance = await bridge.getFeatureImportance('NFL');
      console.log('Top features:', importance.slice(0, 5));
      
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await bridge.stop();
    }
  })();
}