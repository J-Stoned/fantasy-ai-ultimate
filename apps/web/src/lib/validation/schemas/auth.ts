import { z } from 'zod';

// Security-focused validation schemas for authentication

// Email validation with additional security checks
const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(255, 'Email too long')
  .toLowerCase()
  .trim()
  .refine(
    (email) => !email.includes('<script>') && !email.includes('javascript:'),
    'Invalid email format'
  );

// Password validation with security requirements
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Password must contain at least one number'
  )
  .refine(
    (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
    'Password must contain at least one special character'
  );

// Session ID validation
const sessionIdSchema = z
  .string()
  .uuid('Invalid session ID format')
  .trim();

// Admin login validation
export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
  rememberMe: z.boolean().optional().default(false),
});

// Change password validation
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirmation is required'),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  }
);

// Session management schemas
export const sessionIdParamSchema = z.object({
  sessionId: sessionIdSchema,
});

// OAuth callback validation
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code required').max(2048),
  state: z.string().min(1, 'State parameter required').max(512),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// User authentication check
export const authCheckSchema = z.object({
  userId: z.string().uuid().optional(),
  email: emailSchema.optional(),
  provider: z.enum(['google', 'yahoo', 'email']).optional(),
});

// Token validation
export const tokenSchema = z
  .string()
  .min(1, 'Token required')
  .max(2048, 'Token too long')
  .refine(
    (token) => /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(token),
    'Invalid token format'
  );

// API key validation
export const apiKeySchema = z
  .string()
  .min(32, 'Invalid API key')
  .max(128, 'Invalid API key')
  .regex(/^[A-Za-z0-9\-_]+$/, 'Invalid API key format');

// Rate limiting validation
export const rateLimitSchema = z.object({
  ip: z.string().ip(),
  endpoint: z.string().max(255),
  timestamp: z.number().int().positive(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;
export type AuthCheckInput = z.infer<typeof authCheckSchema>;