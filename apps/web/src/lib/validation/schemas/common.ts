import { z } from 'zod';

// Common validation schemas used across the application

// ID validation schemas
export const uuidSchema = z
  .string()
  .uuid('Invalid ID format')
  .trim();

export const numericIdSchema = z
  .string()
  .regex(/^\d+$/, 'Invalid numeric ID')
  .transform(Number)
  .pipe(z.number().int().positive());

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Date range validation
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  {
    message: 'Start date must be before or equal to end date',
    path: ['endDate'],
  }
);

// Safe string validation (prevents XSS)
export const safeStringSchema = (maxLength: number = 255) => z
  .string()
  .max(maxLength)
  .trim()
  .transform((str) => str.replace(/<[^>]*>/g, '')) // Strip HTML tags
  .refine(
    (str) => !str.includes('<script>') && !str.includes('javascript:'),
    'Invalid characters detected'
  );

// Safe text validation for longer content
export const safeTextSchema = (maxLength: number = 5000) => z
  .string()
  .max(maxLength)
  .trim()
  .transform((str) => str.replace(/<script[^>]*>.*?<\/script>/gi, '')) // Remove script tags
  .refine(
    (str) => !str.includes('javascript:') && !str.includes('onerror='),
    'Invalid content detected'
  );

// Numeric validation with bounds
export const positiveNumberSchema = z
  .number()
  .positive('Must be a positive number')
  .finite('Must be a finite number');

export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage cannot exceed 100')
  .finite();

// Money/currency validation
export const moneySchema = z
  .number()
  .min(0, 'Amount cannot be negative')
  .max(1000000, 'Amount too large')
  .multipleOf(0.01, 'Invalid currency amount')
  .finite();

// Sports-related enums
export const sportSchema = z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'SOCCER', 'GOLF', 'NASCAR', 'MMA']);
export const platformSchema = z.enum(['draftkings', 'fanduel', 'yahoo', 'espn']);
export const contestTypeSchema = z.enum(['GPP', 'CASH', 'H2H', 'LEAGUE', '50-50']);

// File upload validation
export const fileUploadSchema = z.object({
  filename: safeStringSchema(255),
  mimetype: z.enum([
    'text/csv',
    'application/json',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
  size: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
});

// Search query validation
export const searchQuerySchema = z
  .string()
  .max(100)
  .trim()
  .transform((str) => str.replace(/[<>'"]/g, '')) // Remove potentially dangerous characters
  .refine(
    (str) => !str.includes('--') && !str.includes('/*') && !str.includes('*/'),
    'Invalid search query'
  );

// Sort validation
export const sortFieldSchema = z
  .string()
  .max(50)
  .regex(/^[a-zA-Z0-9_]+$/, 'Invalid sort field');

// Batch operation validation
export const batchIdsSchema = z
  .array(uuidSchema)
  .min(1, 'At least one ID required')
  .max(100, 'Too many items for batch operation');

// IP address validation
export const ipAddressSchema = z
  .string()
  .ip({ version: 'v4' })
  .or(z.string().ip({ version: 'v6' }));

// Request metadata validation
export const requestMetadataSchema = z.object({
  userAgent: z.string().max(500).optional(),
  ip: ipAddressSchema.optional(),
  timestamp: z.number().int().positive().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type Sport = z.infer<typeof sportSchema>;
export type Platform = z.infer<typeof platformSchema>;
export type ContestType = z.infer<typeof contestTypeSchema>;