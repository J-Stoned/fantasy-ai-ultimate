import { logger } from '../logging/logger';

/**
 * Mock GPU Service for client-side compatibility
 */

export class GPUOptimizerService {
  constructor() {
    logger.info('🎮 GPU Mock Service initialized (client-side)');
  }

  async initialize(): Promise<void> {
    // No-op for client side
  }

  dispose(): void {
    // No-op for client side
  }

  async optimizeLineup(players: any[], constraints: any): Promise<any> {
    // Return mock optimized lineup
    return {
      players: players.slice(0, 9),
      totalSalary: 50000,
      projectedPoints: 250,
      ownership: 0.15,
      optimizationTime: 0,
      gpuAccelerated: false
    };
  }
}