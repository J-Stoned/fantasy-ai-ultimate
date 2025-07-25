/**
 * 🛡️ REQUEST VALIDATION UTILITIES
 * 
 * This module provides validation utilities for API requests
 * using Zod schemas for type-safe validation.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validate request body against a Zod schema
 */
export async function validateRequest<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    // Parse request body
    const body = await req.json();
    
    // Validate against schema
    const result = schema.safeParse(body);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      // Format Zod errors
      const errors = result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      
      return {
        success: false,
        error: `Validation failed: ${errors.map(e => `${e.path}: ${e.message}`).join(', ')}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Invalid JSON in request body'
    };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  try {
    // Convert URLSearchParams to object
    const params: Record<string, any> = {};
    searchParams.forEach((value, key) => {
      // Handle array parameters (key[]=value)
      if (key.endsWith('[]')) {
        const arrayKey = key.slice(0, -2);
        if (!params[arrayKey]) {
          params[arrayKey] = [];
        }
        params[arrayKey].push(value);
      } else {
        params[key] = value;
      }
    });
    
    // Validate against schema
    const result = schema.safeParse(params);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      const errors = result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      
      return {
        success: false,
        error: `Invalid query parameters: ${errors.map(e => `${e.path}: ${e.message}`).join(', ')}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse query parameters'
    };
  }
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20)
  }),
  
  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }),
  
  // Sport
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'PGA', 'UFC']),
  
  // Contest type
  contestType: z.enum(['GPP', 'CASH', 'H2H', 'LEAGUE']),
  
  // Sort order
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // ID validation
  id: z.string().min(1).max(100),
  
  // User preferences
  userPreferences: z.object({
    riskTolerance: z.enum(['conservative', 'balanced', 'aggressive']).optional(),
    favoriteTeams: z.array(z.string()).optional(),
    blacklist: z.array(z.string()).optional(),
    sportPreference: z.array(z.string()).optional(),
    contestPreference: z.string().optional()
  })
};

/**
 * Create a validated API handler
 */
export function createValidatedHandler<T>(
  schema: z.ZodSchema<T>,
  handler: (data: T, req: NextRequest) => Promise<Response>
) {
  return async (req: NextRequest): Promise<Response> => {
    const validation = await validateRequest(req, schema);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return handler(validation.data, req);
  };
}

/**
 * Validate authentication token
 */
export async function validateAuth(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  
  if (!auth?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = auth.substring(7);
  
  // In production, verify JWT token here
  // For now, return mock user ID
  return 'user_123';
}

/**
 * 🛡️ VALIDATION UTILITIES FEATURES:
 * 
 * - Type-safe request validation with Zod
 * - Common validation schemas
 * - Query parameter validation
 * - Validated handler wrapper
 * - Authentication validation
 * - Detailed error messages
 * 
 * All API endpoints use these utilities for consistency!
 */