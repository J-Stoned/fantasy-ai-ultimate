/**
 * 🤖 ML Service Factory
 * Creates ML services for voice processing and predictions
 */

import { BackendPredictionService } from './ml/backend-prediction-service';
import { FeatureEngineeringService } from './ml/feature-engineering-service';
import { logger } from '../logging/logger';

interface MLServiceConfig {
  enableGPU?: boolean;
  modelPath?: string;
  features?: string[];
}

export class MLService {
  private predictionService: BackendPredictionService;
  private featureService: FeatureEngineeringService;

  constructor(config: MLServiceConfig = {}) {
    this.predictionService = new BackendPredictionService();
    this.featureService = new FeatureEngineeringService();
    
    logger.info('🤖 ML Service initialized', { config });
  }

  async predict(data: any) {
    try {
      // Use the backend prediction service
      return await this.predictionService.predictPlayerPerformance(data);
    } catch (error) {
      logger.error('ML prediction failed:', error);
      return {
        predictions: [],
        confidence: 0,
        error: 'Prediction service unavailable'
      };
    }
  }

  async processVoiceCommand(transcript: string) {
    try {
      // Simple voice command processing
      const cleanText = transcript.toLowerCase().trim();
      
      // Extract player names and commands
      const playerPattern = /(?:tell me about|analyze|show me)\s+([a-z\s]+)/i;
      const match = cleanText.match(playerPattern);
      
      if (match) {
        const playerName = match[1].trim();
        return {
          action: 'analyze_player',
          player: playerName,
          confidence: 0.8
        };
      }
      
      // Default response
      return {
        action: 'general_query',
        text: cleanText,
        confidence: 0.5
      };
    } catch (error) {
      logger.error('Voice command processing failed:', error);
      return {
        action: 'error',
        error: 'Voice processing unavailable'
      };
    }
  }

  async shutdown() {
    logger.info('🤖 ML Service shutting down');
  }
}

// Factory function for creating ML service instances
export function createMLService(config: MLServiceConfig = {}): MLService {
  return new MLService(config);
}

// Default export for convenience
export default MLService;