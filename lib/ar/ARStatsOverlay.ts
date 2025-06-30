import * as tf from '@tensorflow/tfjs';
import { Camera } from 'expo-camera';
import { prisma } from '../prisma';
import { createComponentLogger } from '../utils/client-logger';

const arLogger = createComponentLogger('ARStatsOverlay');

interface PlayerDetection {
  playerId: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  jerseyNumber?: string;
  teamColors?: string[];
}

interface ARStats {
  player: {
    id: string;
    name: string;
    position: string;
    team: string;
    number: string;
  };
  liveStats: {
    points: number;
    projection: number;
    trend: 'up' | 'down' | 'stable';
  };
  gameStats: {
    [key: string]: number;
  };
  fantasyImpact: {
    ownership: number;
    startPercent: number;
    projectedRank: number;
  };
}

export class ARStatsOverlay {
  private objectDetectionModel: tf.GraphModel | null = null;
  private jerseyRecognitionModel: tf.LayersModel | null = null;
  private isInitialized = false;
  private detectionCache = new Map<string, PlayerDetection>();
  private statsCache = new Map<string, { data: ARStats; timestamp: number }>();
  private CACHE_TTL = 30000; // 30 seconds in milliseconds

  async initialize() {
    arLogger.info('Initializing AR Stats Overlay...');
    
    try {
      // Load object detection model (COCO-SSD or custom trained)
      this.objectDetectionModel = await tf.loadGraphModel(
        'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1'
      );
      
      // Load jersey number recognition model
      this.jerseyRecognitionModel = await this.loadJerseyModel();
      
      this.isInitialized = true;
      arLogger.info('AR Stats Overlay initialized successfully');
    } catch (error) {
      arLogger.error('Failed to initialize AR models', { error });
    }
  }

  private async loadJerseyModel(): Promise<tf.LayersModel> {
    // In production, load a custom trained model for jersey recognition
    // For now, create a simple CNN architecture
    const model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [64, 64, 3],
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
        tf.layers.dense({ units: 100, activation: 'softmax' }), // 0-99 jersey numbers
      ],
    });

    return model;
  }

  async processFrame(imageData: ImageData): Promise<PlayerDetection[]> {
    if (!this.isInitialized || !this.objectDetectionModel) {
      await this.initialize();
      if (!this.isInitialized) return [];
    }

    try {
      // Convert image to tensor
      const imageTensor = tf.browser.fromPixels(imageData);
      const resized = tf.image.resizeBilinear(imageTensor, [300, 300]);
      const normalized = resized.div(255.0);
      const batched = normalized.expandDims(0);

      // Run object detection
      const predictions = await this.objectDetectionModel.executeAsync(batched) as tf.Tensor[];
      
      // Process detections
      const detections = await this.processPredictions(predictions, imageData);
      
      // Cleanup tensors
      imageTensor.dispose();
      resized.dispose();
      normalized.dispose();
      batched.dispose();
      predictions.forEach(t => t.dispose());

      return detections;
    } catch (error) {
      console.error('Frame processing error:', error);
      return [];
    }
  }

  private async processPredictions(
    predictions: tf.Tensor[],
    imageData: ImageData
  ): Promise<PlayerDetection[]> {
    const [boxes, scores, classes] = predictions;
    
    const boxesArray = await boxes.array() as number[][][];
    const scoresArray = await scores.array() as number[][];
    const classesArray = await classes.array() as number[][];
    
    const detections: PlayerDetection[] = [];
    const personClassId = 1; // COCO dataset person class
    
    for (let i = 0; i < scoresArray[0].length; i++) {
      if (classesArray[0][i] === personClassId && scoresArray[0][i] > 0.5) {
        const [yMin, xMin, yMax, xMax] = boxesArray[0][i];
        
        const boundingBox = {
          x: xMin * imageData.width,
          y: yMin * imageData.height,
          width: (xMax - xMin) * imageData.width,
          height: (yMax - yMin) * imageData.height,
        };

        // Extract jersey region
        const jerseyRegion = this.extractJerseyRegion(imageData, boundingBox);
        
        // Recognize jersey number
        const jerseyNumber = await this.recognizeJerseyNumber(jerseyRegion);
        
        // Detect team colors
        const teamColors = this.detectTeamColors(jerseyRegion);
        
        // Match to player
        const player = await this.matchPlayer(jerseyNumber, teamColors);
        
        if (player) {
          detections.push({
            playerId: player.id,
            confidence: scoresArray[0][i],
            boundingBox,
            jerseyNumber,
            teamColors,
          });
        }
      }
    }
    
    return detections;
  }

  private extractJerseyRegion(imageData: ImageData, bbox: any): ImageData {
    // Extract the jersey region from the bounding box
    // Focus on the torso area where jersey numbers are typically located
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Adjust bounding box to focus on torso
    const torsoY = bbox.y + bbox.height * 0.2;
    const torsoHeight = bbox.height * 0.4;
    
    canvas.width = bbox.width;
    canvas.height = torsoHeight;
    
    ctx.putImageData(imageData, -bbox.x, -torsoY);
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  private async recognizeJerseyNumber(jerseyRegion: ImageData): Promise<string | undefined> {
    if (!this.jerseyRecognitionModel) return undefined;
    
    try {
      // Preprocess image
      const tensor = tf.browser.fromPixels(jerseyRegion);
      const resized = tf.image.resizeBilinear(tensor, [64, 64]);
      const normalized = resized.div(255.0);
      const batched = normalized.expandDims(0);
      
      // Predict jersey number
      const prediction = this.jerseyRecognitionModel.predict(batched) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // Get most likely jersey number
      const maxIndex = probabilities.indexOf(Math.max(...probabilities));
      const confidence = probabilities[maxIndex];
      
      // Cleanup
      tensor.dispose();
      resized.dispose();
      normalized.dispose();
      batched.dispose();
      prediction.dispose();
      
      return confidence > 0.7 ? maxIndex.toString() : undefined;
    } catch (error) {
      console.error('Jersey recognition error:', error);
      return undefined;
    }
  }

  private detectTeamColors(jerseyRegion: ImageData): string[] {
    // Simple color detection using histogram
    const colorCounts = new Map<string, number>();
    const data = jerseyRegion.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.floor(data[i] / 51) * 51; // Quantize to reduce colors
      const g = Math.floor(data[i + 1] / 51) * 51;
      const b = Math.floor(data[i + 2] / 51) * 51;
      
      const color = `rgb(${r},${g},${b})`;
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }
    
    // Get top 2 colors (excluding black/white/gray)
    const sortedColors = Array.from(colorCounts.entries())
      .filter(([color]) => {
        const rgb = color.match(/\d+/g)!.map(Number);
        const isGray = rgb[0] === rgb[1] && rgb[1] === rgb[2];
        return !isGray;
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([color]) => color);
    
    return sortedColors;
  }

  private async matchPlayer(
    jerseyNumber?: string,
    teamColors?: string[]
  ): Promise<any | null> {
    if (!jerseyNumber) return null;
    
    // Check cache first
    const cacheKey = `player_match:${jerseyNumber}:${teamColors?.join(',')}`;
    const cached = this.detectionCache.get(cacheKey);
    if (cached) return { id: cached.playerId };
    
    // Query database for player
    const player = await prisma.player.findFirst({
      where: {
        jersey_number: jerseyNumber,
        // In production, also match by team colors
      },
    });
    
    if (player) {
      this.detectionCache.set(cacheKey, {
        playerId: player.id,
        confidence: 1,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      });
    }
    
    return player;
  }

  async getPlayerStats(playerId: string): Promise<ARStats | null> {
    const cacheKey = `ar_stats:${playerId}`;
    
    // Check local cache
    const cachedEntry = this.statsCache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < this.CACHE_TTL) {
      return cachedEntry.data;
    }

    try {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        include: {
          team: true,
          stats: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });

      if (!player) return null;

      // Get live game data (mock for demo)
      const liveStats = {
        points: Math.random() * 20,
        projection: Math.random() * 25,
        trend: Math.random() > 0.5 ? 'up' : 'down' as const,
      };

      // Get current game stats
      const currentStats = player.stats[0];
      const gameStats: Record<string, number> = {};
      
      if (player.position === 'QB') {
        gameStats.passYards = currentStats?.passing_yards || 0;
        gameStats.passTDs = currentStats?.passing_touchdowns || 0;
        gameStats.completions = currentStats?.completions || 0;
      } else if (['RB', 'WR', 'TE'].includes(player.position)) {
        gameStats.recYards = currentStats?.receiving_yards || 0;
        gameStats.receptions = currentStats?.receptions || 0;
        gameStats.rushYards = currentStats?.rushing_yards || 0;
        gameStats.touchdowns = (currentStats?.rushing_touchdowns || 0) + 
                               (currentStats?.receiving_touchdowns || 0);
      }

      const arStats: ARStats = {
        player: {
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team?.abbreviation || '',
          number: player.jersey_number || '',
        },
        liveStats,
        gameStats,
        fantasyImpact: {
          ownership: Math.random() * 100,
          startPercent: Math.random() * 100,
          projectedRank: Math.floor(Math.random() * 50) + 1,
        },
      };

      // Store in local cache
      this.statsCache.set(cacheKey, {
        data: arStats,
        timestamp: Date.now()
      });
      
      return arStats;
    } catch (error) {
      console.error('Failed to get player stats:', error);
      return null;
    }
  }

  // Generate AR overlay elements
  generateOverlay(
    detection: PlayerDetection,
    stats: ARStats,
    canvasContext: CanvasRenderingContext2D
  ) {
    const { boundingBox } = detection;
    
    // Draw bounding box
    canvasContext.strokeStyle = '#00ff00';
    canvasContext.lineWidth = 2;
    canvasContext.strokeRect(
      boundingBox.x,
      boundingBox.y,
      boundingBox.width,
      boundingBox.height
    );

    // Draw stats panel above player
    const panelY = boundingBox.y - 120;
    const panelX = boundingBox.x;
    const panelWidth = 200;
    const panelHeight = 100;

    // Panel background
    canvasContext.fillStyle = 'rgba(0, 0, 0, 0.8)';
    canvasContext.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Panel border
    canvasContext.strokeStyle = stats.liveStats.trend === 'up' ? '#00ff00' : '#ff0000';
    canvasContext.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Player name and info
    canvasContext.fillStyle = '#ffffff';
    canvasContext.font = 'bold 14px Arial';
    canvasContext.fillText(
      `${stats.player.name} (${stats.player.position})`,
      panelX + 10,
      panelY + 20
    );

    // Live fantasy points
    canvasContext.font = 'bold 24px Arial';
    canvasContext.fillStyle = '#00ff00';
    canvasContext.fillText(
      stats.liveStats.points.toFixed(1),
      panelX + 10,
      panelY + 50
    );

    // Projection
    canvasContext.font = '12px Arial';
    canvasContext.fillStyle = '#cccccc';
    canvasContext.fillText(
      `Proj: ${stats.liveStats.projection.toFixed(1)}`,
      panelX + 80,
      panelY + 50
    );

    // Key stats
    let statsY = panelY + 70;
    Object.entries(stats.gameStats).slice(0, 2).forEach(([key, value]) => {
      canvasContext.fillText(
        `${this.formatStatName(key)}: ${value}`,
        panelX + 10,
        statsY
      );
      statsY += 15;
    });

    // Trend indicator
    const trendSymbol = stats.liveStats.trend === 'up' ? '📈' : '📉';
    canvasContext.font = '20px Arial';
    canvasContext.fillText(trendSymbol, panelX + panelWidth - 30, panelY + 25);
  }

  private formatStatName(key: string): string {
    const names: Record<string, string> = {
      passYards: 'Pass',
      passTDs: 'TD',
      rushYards: 'Rush',
      recYards: 'Rec',
      receptions: 'Rec',
      touchdowns: 'TD',
    };
    return names[key] || key;
  }

  // Process video stream for real-time AR
  async processVideoStream(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onDetection?: (detections: PlayerDetection[]) => void
  ) {
    const ctx = canvasElement.getContext('2d')!;
    
    const processFrame = async () => {
      if (videoElement.paused || videoElement.ended) return;
      
      // Draw video frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
      
      // Detect players
      const detections = await this.processFrame(imageData);
      
      // Clear canvas for overlay
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      
      // Draw AR overlays
      for (const detection of detections) {
        const stats = await this.getPlayerStats(detection.playerId);
        if (stats) {
          this.generateOverlay(detection, stats, ctx);
        }
      }
      
      if (onDetection) {
        onDetection(detections);
      }
      
      // Continue processing
      requestAnimationFrame(processFrame);
    };
    
    processFrame();
  }

  // Cleanup resources
  dispose() {
    if (this.objectDetectionModel) {
      this.objectDetectionModel.dispose();
    }
    if (this.jerseyRecognitionModel) {
      this.jerseyRecognitionModel.dispose();
    }
    this.detectionCache.clear();
    this.statsCache.clear();
  }
}