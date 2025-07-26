/**
 * 🚀 API Documentation with OpenAPI/Swagger
 * Auto-generated documentation for all API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Fantasy AI Platform API',
    version: '1.0.0',
    description: 'Enterprise-grade Fantasy Sports ML Platform with DFS Trading',
    contact: {
      name: 'Fantasy AI Support',
      email: 'support@fantasy-ai.com',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
      description: 'API Server',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Admin', description: 'Admin management endpoints' },
    { name: 'ML', description: 'Machine Learning endpoints' },
    { name: 'DFS', description: 'Daily Fantasy Sports endpoints' },
    { name: 'Trading', description: 'Trading and optimization endpoints' },
    { name: 'Health', description: 'Health and monitoring endpoints' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        description: 'Returns the health status of the API and its dependencies',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version: { type: 'string', example: '1.0.0' },
                    checks: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          component: { type: 'string' },
                          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                          message: { type: 'string' },
                          responseTime: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Service unavailable',
          },
        },
      },
    },
    '/api/admin/auth/login': {
      post: {
        tags: ['Admin', 'Auth'],
        summary: 'Admin login with MFA',
        description: 'Authenticate admin user with email, password, and MFA token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  mfaToken: { type: 'string', pattern: '^[0-9]{6}$' },
                  rememberMe: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful or MFA required',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: {
                        requiresMFA: { type: 'boolean', example: true },
                      },
                    },
                    {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        sessionToken: { type: 'string' },
                        user: {
                          type: 'object',
                          properties: {
                            email: { type: 'string' },
                            role: { type: 'string' },
                            permissions: { type: 'array', items: { type: 'string' } },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
          },
          '429': {
            description: 'Too many login attempts',
          },
        },
      },
    },
    '/api/admin/metrics': {
      get: {
        tags: ['Admin', 'Health'],
        summary: 'Get performance metrics',
        description: 'Retrieve system performance metrics for monitoring',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'range',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['5m', '1h', '24h'],
              default: '1h',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Metrics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    api: {
                      type: 'object',
                      properties: {
                        requestsPerSecond: { type: 'number' },
                        avgResponseTime: { type: 'number' },
                        errorRate: { type: 'number' },
                        activeConnections: { type: 'integer' },
                      },
                    },
                    database: {
                      type: 'object',
                      properties: {
                        queryTime: { type: 'number' },
                        activeConnections: { type: 'integer' },
                        cacheHitRate: { type: 'number' },
                      },
                    },
                    ml: {
                      type: 'object',
                      properties: {
                        modelsLoaded: { type: 'integer' },
                        avgPredictionTime: { type: 'number' },
                        accuracy: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/api/ml/train': {
      post: {
        tags: ['ML', 'Admin'],
        summary: 'Start ML model training',
        description: 'Initiate training for a specific ML model',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['model', 'sport'],
                properties: {
                  model: {
                    type: 'string',
                    enum: ['nfl-predictor', 'nba-predictor', 'mlb-predictor', 'nhl-predictor'],
                  },
                  sport: {
                    type: 'string',
                    enum: ['NFL', 'NBA', 'MLB', 'NHL'],
                  },
                  epochs: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
                  batchSize: { type: 'integer', minimum: 8, maximum: 512, default: 32 },
                  learningRate: { type: 'number', minimum: 0.0001, maximum: 0.1, default: 0.001 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Training started successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    trainingId: { type: 'string' },
                    status: { type: 'string', example: 'started' },
                    estimatedTime: { type: 'integer', description: 'Estimated time in seconds' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid parameters',
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/api/dfs/optimize': {
      post: {
        tags: ['DFS', 'Trading'],
        summary: 'Optimize DFS lineup',
        description: 'Generate optimal DFS lineups based on projections and constraints',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sport', 'contestType', 'salaryCap'],
                properties: {
                  sport: { type: 'string', enum: ['NFL', 'NBA', 'MLB', 'NHL'] },
                  contestType: { type: 'string', enum: ['gpp', 'cash'] },
                  salaryCap: { type: 'integer', minimum: 30000, maximum: 60000 },
                  numLineups: { type: 'integer', minimum: 1, maximum: 150, default: 1 },
                  lockedPlayers: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Player IDs to lock in lineup',
                  },
                  excludedPlayers: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Player IDs to exclude from lineup',
                  },
                  ownershipProjections: { type: 'boolean', default: true },
                  correlationRules: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Lineups optimized successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    lineups: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          players: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                position: { type: 'string' },
                                team: { type: 'string' },
                                salary: { type: 'integer' },
                                projectedPoints: { type: 'number' },
                                ownership: { type: 'number' },
                              },
                            },
                          },
                          totalSalary: { type: 'integer' },
                          projectedPoints: { type: 'number' },
                          leverageScore: { type: 'number' },
                          correlationScore: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid parameters or constraints',
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer' },
        },
      },
    },
  },
};

// Swagger UI HTML
const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fantasy AI Platform - API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .swagger-ui .topbar {
      background-color: #1e293b;
    }
    .swagger-ui .topbar .wrapper {
      padding: 20px;
    }
    .swagger-ui .topbar-wrapper img {
      display: none;
    }
    .swagger-ui .topbar-wrapper:after {
      content: '🚀 Fantasy AI Platform API';
      color: white;
      font-size: 24px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(openApiSpec)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        onComplete: function() {
          console.log('Swagger UI loaded');
        }
      });
    };
  </script>
</body>
</html>
`;

export async function GET(request: NextRequest) {
  // Return OpenAPI JSON if requested
  if (request.headers.get('accept')?.includes('application/json')) {
    return NextResponse.json(openApiSpec);
  }
  
  // Return Swagger UI HTML
  return new NextResponse(swaggerHtml, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}