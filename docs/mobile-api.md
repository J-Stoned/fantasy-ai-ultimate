# 📱 Fantasy AI Mobile API Documentation

## Overview
Enhanced REST and WebSocket APIs optimized for mobile app consumption.

## Base URL
```
Production: https://fantasy-ai.com/api/v2
Development: http://localhost:3000/api/v2
```

## Authentication
Currently, no authentication is required. In production, use Bearer tokens:
```
Authorization: Bearer YOUR_API_TOKEN
```

## Endpoints

### 1. Get Predictions
**GET** `/predictions`

Fetch AI predictions for games.

#### Query Parameters
- `sport` (string): Sport filter - 'nfl', 'nba', 'mlb', or 'all' (default: 'all')
- `timeframe` (string): Time filter - 'today', 'tomorrow', 'week' (default: 'today')
- `limit` (integer): Max results (default: 20, max: 100)
- `minConfidence` (float): Minimum confidence threshold 0-1 (default: 0)

#### Response
```json
{
  "predictions": [
    {
      "id": "pred_123",
      "gameId": "game_456",
      "sport": "nfl",
      "startTime": "2024-01-15T20:00:00Z",
      "venue": "Arrowhead Stadium",
      "homeTeam": {
        "id": "team_1",
        "name": "Kansas City Chiefs",
        "abbreviation": "KC",
        "logoUrl": "https://..."
      },
      "awayTeam": {
        "id": "team_2",
        "name": "Buffalo Bills",
        "abbreviation": "BUF",
        "logoUrl": "https://..."
      },
      "prediction": {
        "winner": "home",
        "homeWinProbability": 0.65,
        "confidence": 0.78,
        "spread": -3.5,
        "totalPoints": 48.5
      },
      "insights": {
        "topFactors": ["Home team stronger record", "Recent form"],
        "keyStats": {
          "homeWinRate": 0.75,
          "awayWinRate": 0.62
        },
        "trend": "improving"
      },
      "lastUpdated": "2024-01-15T18:00:00Z"
    }
  ],
  "summary": {
    "total": 15,
    "highConfidence": 5,
    "byTeam": {
      "Kansas City Chiefs": 3,
      "Buffalo Bills": 2
    },
    "bySport": {
      "nfl": 10,
      "nba": 5
    }
  },
  "metadata": {
    "sport": "all",
    "timeframe": "today",
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-01-16T00:00:00Z",
    "cached": false,
    "generatedAt": "2024-01-15T19:00:00Z"
  }
}
```

### 2. Get Single Prediction
**POST** `/predictions`

Generate or retrieve prediction for a specific game.

#### Request Body
```json
{
  "gameId": "game_456"
}
```

#### Response
```json
{
  "prediction": {
    "id": "pred_123",
    "gameId": "game_456",
    "sport": "nfl",
    "startTime": "2024-01-15T20:00:00Z",
    "venue": "Arrowhead Stadium",
    "homeTeam": { ... },
    "awayTeam": { ... },
    "prediction": {
      "winner": "home",
      "homeWinProbability": 0.65,
      "confidence": 0.78,
      "models": {
        "neuralNetwork": 0.63,
        "randomForest": 0.67
      }
    },
    "insights": {
      "topFactors": ["Home advantage", "Better defense"],
      "analysis": "Kansas City Chiefs have a solid advantage in this matchup."
    },
    "lastUpdated": "2024-01-15T18:00:00Z"
  },
  "cached": false
}
```

### 3. Get Statistics
**GET** `/stats`

Model performance and prediction statistics.

#### Query Parameters
- `period` (string): 'day', 'week', 'month', 'season' (default: 'week')
- `sport` (string): Sport filter or 'all' (default: 'all')

#### Response
```json
{
  "stats": {
    "overall": {
      "total": 150,
      "completed": 120,
      "correct": 78,
      "accuracy": 0.65,
      "avgConfidence": 0.72,
      "highConfidenceAccuracy": 0.78
    },
    "byConfidence": {
      "high": { "total": 30, "correct": 24, "accuracy": 0.80 },
      "medium": { "total": 60, "correct": 39, "accuracy": 0.65 },
      "low": { "total": 30, "correct": 15, "accuracy": 0.50 }
    },
    "bySport": {
      "nfl": { "total": 80, "correct": 52, "accuracy": 0.65 },
      "nba": { "total": 40, "correct": 26, "accuracy": 0.65 }
    },
    "recentForm": [1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    "topTeams": [
      { "team": "Kansas City Chiefs", "predictions": 10, "accuracy": 0.80 },
      { "team": "Buffalo Bills", "predictions": 8, "accuracy": 0.75 }
    ]
  },
  "summary": {
    "period": "week",
    "sport": "all",
    "dateRange": {
      "start": "2024-01-08T00:00:00Z",
      "end": "2024-01-15T00:00:00Z"
    },
    "highlights": {
      "bestAccuracy": 0.80,
      "totalPredictions": 150,
      "completionRate": 0.80,
      "recentFormAccuracy": 0.70
    }
  },
  "generatedAt": "2024-01-15T19:00:00Z"
}
```

### 4. WebSocket Information
**GET** `/live`

Get WebSocket connection details for real-time updates.

#### Response
```json
{
  "websocket": {
    "url": "ws://localhost:8080",
    "channels": [
      {
        "name": "predictions",
        "description": "Real-time game predictions",
        "events": ["new_prediction", "prediction_update"]
      },
      {
        "name": "alerts",
        "description": "High confidence alerts",
        "events": ["high_confidence_prediction", "upset_alert"]
      }
    ],
    "authentication": {
      "required": false,
      "method": "Bearer token in first message"
    }
  },
  "example": {
    "connect": "new WebSocket('ws://localhost:8080')",
    "subscribe": {
      "type": "subscribe",
      "channels": ["predictions", "alerts"]
    },
    "message": { ... }
  }
}
```

### 5. Health Check
**GET** `/health`

System health and status monitoring.

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T19:00:00Z",
  "services": {
    "database": { "status": "healthy", "latency": 45 },
    "ml_models": { 
      "status": "healthy", 
      "loaded": true, 
      "models": ["neural_network", "random_forest"] 
    },
    "websocket": { 
      "status": "healthy", 
      "url": "ws://localhost:8080" 
    },
    "tensorflow": { 
      "status": "healthy", 
      "backend": "tensorflow", 
      "version": "4.11.0" 
    }
  },
  "metrics": {
    "predictions_24h": 234,
    "accuracy_7d": 0.65,
    "active_games": 47,
    "model_version": "ensemble_v2"
  },
  "system": {
    "node_version": "v18.19.1",
    "memory_usage": { ... },
    "uptime": 3600
  }
}
```

## WebSocket Protocol

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  // Subscribe to channels
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['predictions', 'alerts']
  }));
});
```

### Message Types

#### New Prediction
```json
{
  "type": "predictions",
  "data": {
    "type": "new_prediction",
    "data": {
      "gameId": "game_123",
      "prediction": {
        "winner": "home",
        "homeWinProbability": 0.75,
        "confidence": 0.82
      },
      "game": {
        "homeTeam": "Chiefs",
        "awayTeam": "Bills",
        "startTime": "2024-01-15T20:00:00Z"
      }
    }
  }
}
```

#### High Confidence Alert
```json
{
  "type": "alerts",
  "data": {
    "type": "high_confidence_prediction",
    "data": {
      "gameId": "game_123",
      "message": "High confidence prediction: Chiefs vs Bills",
      "confidence": 0.85
    }
  }
}
```

## Error Handling

All errors follow this format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Server Error
- `503` - Service Unavailable

## Rate Limiting
- 1000 requests per hour per IP
- WebSocket: 100 messages per minute

## SDK Examples

### JavaScript/React Native
```javascript
// Fetch predictions
const response = await fetch('https://api.fantasy-ai.com/v2/predictions?sport=nfl&timeframe=today');
const data = await response.json();

// WebSocket connection
const ws = new WebSocket('wss://api.fantasy-ai.com');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('New prediction:', message);
};
```

### Swift (iOS)
```swift
// Using URLSession
let url = URL(string: "https://api.fantasy-ai.com/v2/predictions")!
let task = URLSession.shared.dataTask(with: url) { data, response, error in
    guard let data = data else { return }
    let predictions = try? JSONDecoder().decode(PredictionsResponse.self, from: data)
}
task.resume()
```

### Kotlin (Android)
```kotlin
// Using Retrofit
interface FantasyAIApi {
    @GET("predictions")
    suspend fun getPredictions(
        @Query("sport") sport: String = "all",
        @Query("timeframe") timeframe: String = "today"
    ): PredictionsResponse
}
```

## Best Practices

1. **Cache responses** - Use the `cached` field to determine freshness
2. **Handle WebSocket reconnection** - Implement exponential backoff
3. **Batch requests** - Use appropriate limits and filters
4. **Monitor health endpoint** - Check before making requests
5. **Use compression** - Accept gzip encoding for responses