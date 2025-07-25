/**
 * ML Service Interface - Clean Architecture Pattern
 * Abstracts ML implementation details from the application
 */

export interface PredictionResult {
  playerId: string;
  predictedPoints: number;
  confidence: number;
  features?: Record<string, number>;
}

export interface IPredictionService {
  predict(playerData: any): Promise<PredictionResult>;
  batchPredict(players: any[]): Promise<PredictionResult[]>;
  isAvailable(): Promise<boolean>;
  getModelVersion(): string;
}

export interface ILineupOptimizer {
  optimize(params: {
    players: any[];
    salary: number;
    positions: string[];
    constraints?: any;
  }): Promise<{
    lineup: any[];
    projectedPoints: number;
    remainingSalary: number;
  }>;
}

// Factory pattern for service creation
export class MLServiceFactory {
  static createPredictionService(): IPredictionService {
    const serviceUrl = process.env.ML_SERVICE_URL;
    
    if (serviceUrl) {
      // Production: Use remote ML service
      return new RemoteMLService(serviceUrl);
    } else if (process.env.NODE_ENV === 'development') {
      // Development: Use local ML if available
      try {
        const LocalMLService = require('./local-ml-service').LocalMLService;
        return new LocalMLService();
      } catch {
        return new MockMLService();
      }
    }
    
    // Fallback: Mock service
    return new MockMLService();
  }
}

// Remote ML Service Implementation
class RemoteMLService implements IPredictionService {
  constructor(private serviceUrl: string) {}

  async predict(playerData: any): Promise<PredictionResult> {
    const response = await fetch(`${this.serviceUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(playerData),
    });
    
    if (!response.ok) {
      throw new Error('ML service unavailable');
    }
    
    return response.json();
  }

  async batchPredict(players: any[]): Promise<PredictionResult[]> {
    const response = await fetch(`${this.serviceUrl}/batch-predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players }),
    });
    
    if (!response.ok) {
      throw new Error('ML service unavailable');
    }
    
    return response.json();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serviceUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  getModelVersion(): string {
    return 'remote-v1.0';
  }
}

// Mock ML Service for development/testing
class MockMLService implements IPredictionService {
  async predict(playerData: any): Promise<PredictionResult> {
    // Simple mock prediction based on historical average
    return {
      playerId: playerData.playerId,
      predictedPoints: playerData.historicalAverage || 10,
      confidence: 0.5,
    };
  }

  async batchPredict(players: any[]): Promise<PredictionResult[]> {
    return Promise.all(players.map(p => this.predict(p)));
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getModelVersion(): string {
    return 'mock-v1.0';
  }
}