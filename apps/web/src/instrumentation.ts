/**
 * 🔥 ELITE INSTRUMENTATION - 2025 BEST PRACTICES
 * OpenTelemetry monitoring for Vercel Edge Runtime
 * Provides real-time performance, error tracking, and analytics
 */

export async function register() {
  // Only run instrumentation in production and preview environments
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  try {
    // Dynamic import to avoid loading in development
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { Resource } = await import('@opentelemetry/resources');
    const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');

    // Initialize OpenTelemetry SDK
    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'fantasy-ai-web',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.VERCEL_ENV || 'unknown',
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable file system instrumentation for Edge Runtime compatibility
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          // Enable specific instrumentations for our stack
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span, request) => {
              // Add custom attributes for fantasy sports context
              span.setAttributes({
                'fantasy.request_type': request.url?.includes('/api/') ? 'api' : 'page',
                'fantasy.user_agent': request.headers['user-agent'] || 'unknown',
              });
            },
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
            enhancedDatabaseReporting: true,
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    console.log('🚀 OpenTelemetry instrumentation initialized successfully');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => console.log('✅ OpenTelemetry terminated'))
        .catch((error) => console.error('❌ Error terminating OpenTelemetry', error))
        .finally(() => process.exit(0));
    });

  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
    // Don't fail the application if instrumentation fails
  }
}

// Custom performance monitoring for fantasy sports specific metrics
export class FantasyMetrics {
  static trackAPICall(endpoint: string, duration: number, status: number) {
    if (typeof window !== 'undefined') {
      // Client-side performance tracking
      performance.mark(`api-${endpoint}-end`);
      performance.measure(`api-${endpoint}`, `api-${endpoint}-start`, `api-${endpoint}-end`);
    }
    
    // Log high-value metrics for fantasy sports
    if (endpoint.includes('ownership') || endpoint.includes('optimize') || endpoint.includes('ml')) {
      console.log(`🎯 Critical API: ${endpoint} - ${duration}ms - ${status}`);
    }
  }

  static trackUserInteraction(action: string, component: string) {
    if (typeof window !== 'undefined') {
      // Track user engagement with fantasy features
      performance.mark(`user-${action}-${component}`);
    }
  }

  static trackMLModelPerformance(model: string, accuracy: number, latency: number) {
    console.log(`🧠 ML Model: ${model} - Accuracy: ${accuracy}% - Latency: ${latency}ms`);
  }
}

// Export for use in API routes and components
export default register;