import crypto from 'crypto';

// File type validation
export const ALLOWED_FILE_TYPES = {
  csv: ['text/csv', 'application/vnd.ms-excel'],
  json: ['application/json'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

export const ALLOWED_FILE_EXTENSIONS = {
  csv: ['.csv'],
  json: ['.json'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  document: ['.pdf', '.doc', '.docx'],
};

// Maximum file sizes by type (in bytes)
export const MAX_FILE_SIZES = {
  csv: 10 * 1024 * 1024, // 10MB
  json: 5 * 1024 * 1024, // 5MB
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
};

/**
 * Validate file type and size
 */
export function validateFile(
  file: { name: string; type: string; size: number },
  allowedTypes: 'csv' | 'json' | 'image' | 'document'
): { valid: boolean; error?: string } {
  // Check file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_FILE_EXTENSIONS[allowedTypes].includes(extension)) {
    return { valid: false, error: `Invalid file extension. Allowed: ${ALLOWED_FILE_EXTENSIONS[allowedTypes].join(', ')}` };
  }

  // Check MIME type
  if (!ALLOWED_FILE_TYPES[allowedTypes].includes(file.type)) {
    return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES[allowedTypes].join(', ')}` };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZES[allowedTypes]) {
    const maxSizeMB = MAX_FILE_SIZES[allowedTypes] / (1024 * 1024);
    return { valid: false, error: `File too large. Maximum size: ${maxSizeMB}MB` };
  }

  return { valid: true };
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data
 */
export function hashData(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512').toString('hex');
  return salt ? hash : `${actualSalt}:${hash}`;
}

/**
 * Verify hashed data
 */
export function verifyHashedData(data: string, hashedData: string): boolean {
  if (hashedData.includes(':')) {
    const [salt, hash] = hashedData.split(':');
    const dataHash = hashData(data, salt);
    return dataHash === hash;
  }
  return false;
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path separators and special characters
  return filename
    .replace(/[\/\\]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255); // Limit length
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow HTTP(S) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    // Remove any credentials from URL
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Rate limiting key generator
 */
export function getRateLimitKey(
  identifier: string,
  endpoint: string,
  window: 'minute' | 'hour' | 'day' = 'hour'
): string {
  const now = new Date();
  let timeKey: string;
  
  switch (window) {
    case 'minute':
      timeKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      break;
    case 'hour':
      timeKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
      break;
    case 'day':
      timeKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      break;
  }
  
  return `ratelimit:${endpoint}:${identifier}:${timeKey}`;
}

/**
 * Validate request origin
 */
export function validateOrigin(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  // Check exact matches
  if (allowedOrigins.includes(origin)) return true;
  
  // Check wildcard patterns
  for (const allowed of allowedOrigins) {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(origin)) return true;
    }
  }
  
  return false;
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: any): any {
  if (typeof data === 'string') {
    // Mask email addresses
    if (data.includes('@')) {
      return data.replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+)/g, (match, local, domain) => {
        const maskedLocal = local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1);
        return `${maskedLocal}@${domain}`;
      });
    }
    // Mask credit card numbers
    if (/\d{13,19}/.test(data)) {
      return data.replace(/\d{13,19}/g, (match) => {
        return '*'.repeat(match.length - 4) + match.slice(-4);
      });
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }
  
  if (data !== null && typeof data === 'object') {
    const masked: any = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn', 'email'];
    
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        masked[key] = '***REDACTED***';
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }
  
  return data;
}

/**
 * Validate JSON depth to prevent deeply nested objects
 */
export function validateJsonDepth(obj: any, maxDepth: number = 10, currentDepth: number = 0): boolean {
  if (currentDepth > maxDepth) return false;
  
  if (obj !== null && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      if (!validateJsonDepth(value, maxDepth, currentDepth + 1)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  // In production, this would check against stored session tokens
  return token.length === 43 && /^[A-Za-z0-9_-]+$/.test(token);
}