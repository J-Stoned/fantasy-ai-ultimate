import * as tf from '@tensorflow/tfjs';
import { prisma } from '../prisma';
import { arLogger } from '../utils/logger';

interface RecognitionModel {
  jerseyDetector: tf.GraphModel;
  numberRecognizer: tf.LayersModel;
  teamColorClassifier: tf.LayersModel;
  poseEstimator: tf.GraphModel;
}

interface PlayerMatch {
  playerId: string;
  confidence: number;
  features: {
    jerseyNumber: string;
    teamColors: string[];
    bodyPose: any;
    height: number;
  };
}

export class PlayerRecognition {
  private models: Partial<RecognitionModel> = {};
  private playerDatabase: Map<string, any> = new Map();
  private teamColorMap: Map<string, string[]> = new Map();

  constructor() {
    this.initializeTeamColors();
  }

  private initializeTeamColors() {
    // NFL team colors for recognition
    this.teamColorMap.set('KC', ['#E31837', '#FFB81C']); // Chiefs
    this.teamColorMap.set('BUF', ['#00338D', '#C60C30']); // Bills
    this.teamColorMap.set('SF', ['#AA0000', '#B3995D']); // 49ers
    this.teamColorMap.set('DAL', ['#041E42', '#869397']); // Cowboys
    this.teamColorMap.set('GB', ['#203731', '#FFB612']); // Packers
    this.teamColorMap.set('NE', ['#002244', '#C60C30']); // Patriots
    this.teamColorMap.set('PHI', ['#004C54', '#A5ACAF']); // Eagles
    this.teamColorMap.set('MIA', ['#008E97', '#FC4C02']); // Dolphins
    // Add more teams...
  }

  async initialize() {
    arLogger.info('Initializing player recognition models...');
    
    try {
      // Load pre-trained models
      this.models.jerseyDetector = await tf.loadGraphModel(
        '/models/jersey_detector/model.json'
      );
      
      // Create custom models for demo
      this.models.numberRecognizer = this.createNumberRecognizer();
      this.models.teamColorClassifier = this.createColorClassifier();
      this.models.poseEstimator = await tf.loadGraphModel(
        'https://tfhub.dev/google/movenet/singlepose/lightning/4'
      );
      
      // Load player database
      await this.loadPlayerDatabase();
      
      arLogger.info('Player recognition initialized successfully');
    } catch (error) {
      arLogger.error('Failed to initialize recognition', { error });
    }
  }

  private createNumberRecognizer(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // CNN for digit recognition
        tf.layers.conv2d({
          inputShape: [64, 64, 1],
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.5 }),
        // Output: 100 classes (00-99)
        tf.layers.dense({ units: 100, activation: 'softmax' }),
      ],
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  private createColorClassifier(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [3], // RGB values
          units: 64,
          activation: 'relu',
        }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'softmax' }), // 32 NFL teams
      ],
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  private async loadPlayerDatabase() {
    // Load active players for quick matching
    const players = await prisma.player.findMany({
      where: {
        status: 'active',
        jersey_number: { not: null },
      },
      include: {
        team: true,
      },
    });

    players.forEach(player => {
      const key = `${player.team?.abbreviation}:${player.jersey_number}`;
      this.playerDatabase.set(key, player);
    });

    arLogger.info('Players loaded into recognition database', { count: players.length });
  }

  async recognizePlayer(imageData: ImageData): Promise<PlayerMatch | null> {
    try {
      // Extract features from image
      const features = await this.extractFeatures(imageData);
      
      if (!features.jerseyNumber || !features.teamColors.length) {
        return null;
      }

      // Match against database
      const teamAbbr = this.matchTeamByColors(features.teamColors);
      const key = `${teamAbbr}:${features.jerseyNumber}`;
      const player = this.playerDatabase.get(key);

      if (!player) {
        // Try fuzzy matching
        return this.fuzzyMatch(features);
      }

      return {
        playerId: player.id,
        confidence: 0.95,
        features,
      };
    } catch (error) {
      arLogger.error('Player recognition error', { error });
      return null;
    }
  }

  private async extractFeatures(imageData: ImageData): Promise<any> {
    const features: any = {
      jerseyNumber: null,
      teamColors: [],
      bodyPose: null,
      height: 0,
    };

    // Extract jersey number
    features.jerseyNumber = await this.extractJerseyNumber(imageData);
    
    // Extract team colors
    features.teamColors = this.extractDominantColors(imageData);
    
    // Estimate pose (for additional validation)
    if (this.models.poseEstimator) {
      features.bodyPose = await this.estimatePose(imageData);
    }

    return features;
  }

  private async extractJerseyNumber(imageData: ImageData): Promise<string | null> {
    if (!this.models.numberRecognizer) return null;

    try {
      // Preprocess image for number recognition
      const tensor = tf.browser.fromPixels(imageData);
      const gray = tf.image.rgbToGrayscale(tensor);
      const resized = tf.image.resizeBilinear(gray, [64, 64]);
      const normalized = resized.div(255.0);
      const batched = normalized.expandDims(0);

      // Predict number
      const prediction = this.models.numberRecognizer.predict(batched) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // Get top prediction
      const maxIdx = probabilities.indexOf(Math.max(...probabilities));
      const confidence = probabilities[maxIdx];

      // Cleanup
      tensor.dispose();
      gray.dispose();
      resized.dispose();
      normalized.dispose();
      batched.dispose();
      prediction.dispose();

      // Return number if confident
      if (confidence > 0.8) {
        return maxIdx.toString().padStart(2, '0');
      }

      return null;
    } catch (error) {
      arLogger.error('Jersey number extraction error', { error });
      return null;
    }
  }

  private extractDominantColors(imageData: ImageData): string[] {
    const colorMap = new Map<string, number>();
    const data = imageData.data;
    
    // Sample pixels and count colors
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.floor(data[i] / 32) * 32;
      const g = Math.floor(data[i + 1] / 32) * 32;
      const b = Math.floor(data[i + 2] / 32) * 32;
      
      // Skip grayscale colors
      if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) continue;
      
      const hex = this.rgbToHex(r, g, b);
      colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
    }

    // Get top colors
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([color]) => color);

    return sortedColors;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private matchTeamByColors(colors: string[]): string {
    let bestMatch = '';
    let bestScore = 0;

    this.teamColorMap.forEach((teamColors, teamAbbr) => {
      const score = this.calculateColorSimilarity(colors, teamColors);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = teamAbbr;
      }
    });

    return bestMatch;
  }

  private calculateColorSimilarity(colors1: string[], colors2: string[]): number {
    let totalScore = 0;
    
    colors1.forEach(c1 => {
      const maxSimilarity = Math.max(...colors2.map(c2 => 
        this.colorSimilarity(c1, c2)
      ));
      totalScore += maxSimilarity;
    });

    return totalScore / colors1.length;
  }

  private colorSimilarity(hex1: string, hex2: string): number {
    const rgb1 = this.hexToRgb(hex1);
    const rgb2 = this.hexToRgb(hex2);
    
    if (!rgb1 || !rgb2) return 0;

    // Calculate Euclidean distance in RGB space
    const distance = Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    );

    // Convert to similarity (0-1)
    return 1 - (distance / 441.67); // Max distance in RGB space
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  }

  private async estimatePose(imageData: ImageData): Promise<any> {
    if (!this.models.poseEstimator) return null;

    try {
      const tensor = tf.browser.fromPixels(imageData);
      const resized = tf.image.resizeBilinear(tensor, [192, 192]);
      const normalized = resized.div(255.0);
      const batched = normalized.expandDims(0);

      const prediction = await this.models.poseEstimator.predict(batched);
      const keypoints = await prediction.data();

      tensor.dispose();
      resized.dispose();
      normalized.dispose();
      batched.dispose();

      return keypoints;
    } catch (error) {
      arLogger.error('Pose estimation error', { error });
      return null;
    }
  }

  private async fuzzyMatch(features: any): Promise<PlayerMatch | null> {
    // Try to find best match with partial information
    let bestMatch: any = null;
    let bestScore = 0;

    this.playerDatabase.forEach((player, key) => {
      const [teamAbbr, number] = key.split(':');
      let score = 0;

      // Jersey number similarity
      if (features.jerseyNumber) {
        const numberSim = this.stringSimilarity(features.jerseyNumber, number);
        score += numberSim * 0.5;
      }

      // Team color match
      const teamColors = this.teamColorMap.get(teamAbbr) || [];
      const colorSim = this.calculateColorSimilarity(features.teamColors, teamColors);
      score += colorSim * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = player;
      }
    });

    if (bestMatch && bestScore > 0.7) {
      return {
        playerId: bestMatch.id,
        confidence: bestScore,
        features,
      };
    }

    return null;
  }

  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Batch recognition for performance
  async recognizeMultiplePlayers(
    detections: Array<{ imageData: ImageData; boundingBox: any }>
  ): Promise<PlayerMatch[]> {
    const matches = await Promise.all(
      detections.map(d => this.recognizePlayer(d.imageData))
    );

    return matches.filter((m): m is PlayerMatch => m !== null);
  }

  // Update player database with new data
  async updatePlayerDatabase() {
    await this.loadPlayerDatabase();
  }

  // Cleanup resources
  dispose() {
    Object.values(this.models).forEach(model => {
      if (model) model.dispose();
    });
    this.playerDatabase.clear();
  }
}