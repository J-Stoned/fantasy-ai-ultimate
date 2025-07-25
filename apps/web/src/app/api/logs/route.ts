/**
 * API endpoint for receiving browser logs
 * Handles client-side log forwarding to server-side logging system
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logging/logger';
import { errorHandler } from '@/lib/errors/error-handler';
import { z } from 'zod';

const LogEntrySchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  message: z.string(),
  timestamp: z.string(),
  service: z.string(),
  environment: z.string(),
  metadata: z.record(z.any()).optional()
});

const LogsRequestSchema = z.object({
  logs: z.array(LogEntrySchema)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logs } = LogsRequestSchema.parse(body);

    const clientIP = request.ip || 
                    request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Process each log entry
    for (const logEntry of logs) {
      const serverMetadata = {
        ...logEntry.metadata,
        source: 'browser',
        clientIP,
        userAgent: request.headers.get('user-agent'),
        forwarded: true
      };

      // Log to server with browser metadata
      const serverLogger = logger.child({ 
        service: 'browser-logs',
        clientService: logEntry.service 
      });

      switch (logEntry.level) {
        case 'debug':
          serverLogger.debug(`[Browser] ${logEntry.message}`, serverMetadata);
          break;
        case 'info':
          serverLogger.info(`[Browser] ${logEntry.message}`, serverMetadata);
          break;
        case 'warn':
          serverLogger.warn(`[Browser] ${logEntry.message}`, serverMetadata);
          break;
        case 'error':
          serverLogger.error(`[Browser] ${logEntry.message}`, serverMetadata);
          break;
        case 'fatal':
          serverLogger.fatal(`[Browser] ${logEntry.message}`, serverMetadata);
          break;
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: logs.length 
    });

  } catch (error) {
    const handledError = errorHandler.handleError(error, {
      operation: 'POST /api/logs',
      service: 'logging-api'
    });

    return errorHandler.createHttpResponse(handledError);
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}