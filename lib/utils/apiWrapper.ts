import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateAndSanitize } from './security'
import { withRateLimit } from './rateLimiter'
import { createClient } from '../supabase/server'
import { apiLogger } from './logger'

interface ApiHandlerOptions<T> {
  schema?: z.ZodSchema<T>
  requireAuth?: boolean
  rateLimit?: 'api' | 'auth' | 'import'
  allowedMethods?: string[]
}

export function createApiHandler<T = any>(
  handler: (
    request: NextRequest,
    context: {
      user?: any
      data?: T
      params?: any
    }
  ) => Promise<NextResponse>,
  options: ApiHandlerOptions<T> = {}
) {
  const {
    schema,
    requireAuth = false,
    rateLimit = 'api',
    allowedMethods = ['GET', 'POST']
  } = options

  async function wrappedHandler(request: NextRequest) {
    try {
      // Check HTTP method
      if (!allowedMethods.includes(request.method)) {
        return NextResponse.json(
          { error: 'Method not allowed' },
          { status: 405 }
        )
      }

      // Initialize context
      const context: any = { params: {} }

      // Authentication check
      if (requireAuth) {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        }

        context.user = user
      }

      // Parse and validate request body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        let body
        try {
          body = await request.json()
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: 400 }
          )
        }

        if (schema) {
          const validation = validateAndSanitize(schema, body)
          if (!validation.success) {
            return NextResponse.json(
              { error: validation.error },
              { status: 400 }
            )
          }
          context.data = validation.data
        } else {
          context.data = body
        }
      }

      // Parse URL params for GET requests
      if (request.method === 'GET') {
        const { searchParams } = new URL(request.url)
        const params: Record<string, string> = {}
        searchParams.forEach((value, key) => {
          params[key] = value
        })
        context.params = params
      }

      // Call the actual handler
      return await handler(request, context)

    } catch (error) {
      apiLogger.error('API handler error', error)

      // Don't expose internal error details
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  // Apply rate limiting if specified
  if (rateLimit) {
    return withRateLimit(wrappedHandler, rateLimit)
  }

  return wrappedHandler
}

// Example usage:
/*
export const GET = createApiHandler(
  async (request, { user, params }) => {
    // Your handler logic here
    return NextResponse.json({ data: 'success' })
  },
  {
    requireAuth: true,
    rateLimit: 'api'
  }
)

export const POST = createApiHandler(
  async (request, { user, data }) => {
    // Your handler logic here
    return NextResponse.json({ data: 'success' })
  },
  {
    schema: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email()
    }),
    requireAuth: true,
    rateLimit: 'api'
  }
)
*/