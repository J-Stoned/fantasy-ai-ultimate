# TensorFlow Backend Migration Guide

## Overview

We've moved TensorFlow from the client-side to server-side to improve:
- Bundle size (reduces client bundle by ~2MB)
- Performance (GPU acceleration on server)
- Security (models stay on server)
- Compatibility (no browser compatibility issues)

## Architecture Changes

### Before (Client-Side)
```
Browser → Load TensorFlow.js → Load Models → Run Predictions
```

### After (Server-Side)
```
Browser → API Request → Backend TensorFlow → Return Prediction
```

## Implementation

### 1. Backend Prediction Service

Located at `/apps/web/src/lib/services/ml/backend-prediction-service.ts`

- Handles TensorFlow initialization
- Loads and manages models
- Runs predictions on server
- Returns results via API

### 2. API Endpoint

Located at `/apps/web/src/app/api/ml/predict/route.ts`

**POST /api/ml/predict**
```json
{
  "sport": "NFL",
  "playerId": "player-123",
  "features": {
    "recentGames": [...],
    "seasonAverage": 20.5,
    "careerAverage": 18.2
  },
  "modelType": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "prediction": {
    "projectedPoints": 22.5,
    "confidence": 0.85,
    "range": {
      "low": 18.5,
      "high": 26.5
    },
    "factors": [...]
  }
}
```

### 3. Client-Side Service

Located at `/apps/web/src/lib/services/ml/client-prediction-service.ts`

- Calls backend API
- Handles caching
- Formats results for display

### 4. React Hook

Located at `/apps/web/src/hooks/useMLPrediction.ts`

```typescript
const { prediction, isLoading, error } = useMLPrediction({
  sport: 'NFL',
  playerId: 'player-123',
  features: playerFeatures,
  modelType: 'standard'
});
```

## Migration Steps

### 1. Update Component Imports

**Before:**
```typescript
import * as tf from '@tensorflow/tfjs';
import { PredictionService } from '@/lib/services/ml/prediction-service';

// Direct TensorFlow usage
const model = await tf.loadLayersModel('/models/nfl.json');
const prediction = model.predict(features);
```

**After:**
```typescript
import { useMLPrediction } from '@/hooks/useMLPrediction';

// Use hook
const { prediction, isLoading } = useMLPrediction({
  sport: 'NFL',
  playerId,
  features
});
```

### 2. Update Service Calls

**Before:**
```typescript
const predictionService = new PredictionService();
const result = await predictionService.predict(playerId, features);
```

**After:**
```typescript
import { clientPredictionService } from '@/lib/services/ml/client-prediction-service';

const result = await clientPredictionService.predict({
  sport: 'NFL',
  playerId,
  features
});
```

### 3. Handle Loading States

Since predictions now require network requests, handle loading states:

```typescript
function PlayerProjection({ playerId, features }) {
  const { prediction, isLoading, error } = useMLPrediction({
    sport: 'NFL',
    playerId,
    features
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error} />;
  
  return <ProjectionDisplay prediction={prediction} />;
}
```

## Benefits

### 1. Performance
- **Server GPU**: Can use NVIDIA GPUs for 10x faster predictions
- **Caching**: Server-side caching reduces repeated computations
- **Batch Processing**: Can process multiple predictions efficiently

### 2. Bundle Size
- **Before**: ~2MB TensorFlow.js in client bundle
- **After**: 0MB - TensorFlow only on server
- **Result**: Faster initial page loads

### 3. Security
- Models stay on server (intellectual property protection)
- No model reverse engineering possible
- API rate limiting prevents abuse

### 4. Maintenance
- Update models without client deployments
- A/B test different models easily
- Monitor prediction accuracy centrally

## Model Management

### Model Location
Models are stored in `/models/[sport]/model.json`

### Model Updates
1. Train new model
2. Save to server models directory
3. Backend automatically loads new model
4. No client updates needed

### Model Versioning
Each prediction includes `modelVersion` for tracking

## Monitoring

### Health Check
**GET /api/ml/predict**

Returns:
```json
{
  "status": "healthy",
  "models": {
    "NFL": true,
    "NBA": true,
    "MLB": true,
    "NHL": true
  },
  "tensorflow": "4.21.0",
  "gpu": true
}
```

### Metrics to Track
- Prediction latency
- Cache hit rate
- Model accuracy
- GPU utilization
- API request volume

## Troubleshooting

### Common Issues

1. **Slow Predictions**
   - Check server GPU availability
   - Monitor model complexity
   - Implement prediction caching

2. **High Memory Usage**
   - Limit concurrent model loads
   - Implement model unloading
   - Use model quantization

3. **API Timeouts**
   - Increase timeout limits
   - Implement request queuing
   - Add circuit breakers

### Development Setup

For local development without GPU:
```bash
# Install CPU version
npm install @tensorflow/tfjs-node --save-dev

# Set environment variable
TENSORFLOW_BACKEND=cpu
```

## Future Enhancements

1. **Model Optimization**
   - Quantization for smaller models
   - Pruning for faster inference
   - Model distillation

2. **Advanced Features**
   - Real-time predictions via WebSocket
   - Batch prediction endpoints
   - Model ensemble support

3. **Infrastructure**
   - GPU cluster for scaling
   - Model serving with TensorFlow Serving
   - Edge deployment for low latency