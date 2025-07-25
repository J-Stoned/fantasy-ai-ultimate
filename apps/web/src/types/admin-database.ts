// Admin Database Types

// Hyperparameter types for ML training
export interface MLHyperparameters {
  learningRate?: number;
  batchSize?: number;
  epochs?: number;
  optimizer?: string;
  lossFunction?: string;
  dropout?: number;
  hiddenLayers?: number[];
  regularization?: {
    type: 'l1' | 'l2' | 'elastic';
    strength: number;
  };
  [key: string]: unknown; // Allow additional custom parameters
}

// Validation metrics for ML models
export interface MLValidationMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  confusionMatrix?: number[][];
  classificationReport?: Record<string, {
    precision: number;
    recall: number;
    f1Score: number;
    support: number;
  }>;
  [key: string]: unknown; // Allow additional custom metrics
}

// Custom metrics for ML training
export interface MLCustomMetrics {
  gradientNorm?: number;
  parameterUpdates?: number;
  activationStats?: {
    mean: number;
    std: number;
    min: number;
    max: number;
  };
  [key: string]: number | Record<string, unknown>;
}

// Lineup structure for DFS contests
export interface DFSLineup {
  players: Array<{
    playerId: string;
    playerName: string;
    position: string;
    salary: number;
    projectedPoints: number;
    actualPoints?: number;
  }>;
  captain?: string;
  mvp?: string;
  totalSalary: number;
  remainingSalary?: number;
}

// Ownership projections for DFS
export interface DFSOwnershipProjections {
  [playerId: string]: {
    projectedOwnership: number;
    actualOwnership?: number;
    leverageScore?: number;
  };
}

// Alert data types
export type AlertData = 
  | MLTrainingAlertData
  | DFSContestAlertData
  | SystemAlertData
  | SecurityAlertData;

export interface MLTrainingAlertData {
  jobId: string;
  metric?: string;
  threshold?: number;
  actualValue?: number;
  details?: string;
}

export interface DFSContestAlertData {
  contestId: string;
  type: 'entry' | 'result' | 'roi' | 'ownership';
  value?: number;
  details?: string;
}

export interface SystemAlertData {
  component: string;
  serverId?: string;
  metric: string;
  value: number;
  threshold?: number;
  details?: string;
}

export interface SecurityAlertData {
  userId?: string;
  action?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
}

// Query filter types
export interface AdminQueryFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: string | string[];
  sport?: string | string[];
  platform?: string | string[];
  modelType?: string | string[];
  severity?: string | string[];
  userId?: string;
  [key: string]: unknown;
}