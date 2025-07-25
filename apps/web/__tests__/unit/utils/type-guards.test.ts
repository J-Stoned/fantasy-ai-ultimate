import {
  isValidEmail,
  isValidPassword,
  isValidNumber,
  isValidDate,
  isValidSport,
  isValidPosition,
  isValidContestType,
  sanitizeInput,
  validateApiResponse
} from '@/lib/utils/type-guards'

describe('Type Guards', () => {
  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true)
      expect(isValidEmail('user123@test-domain.com')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('@domain.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('test@domain')).toBe(false)
    })

    it('should reject malicious email attempts', () => {
      expect(isValidEmail('<script>alert("xss")</script>@domain.com')).toBe(false)
      expect(isValidEmail('javascript:alert(1)@domain.com')).toBe(false)
      expect(isValidEmail('test@domain.com<script>')).toBe(false)
    })
  })

  describe('isValidPassword', () => {
    it('should validate strong passwords', () => {
      expect(isValidPassword('Password123!')).toBe(true)
      expect(isValidPassword('MySecure@Pass1')).toBe(true)
      expect(isValidPassword('Complex#Pass99')).toBe(true)
    })

    it('should reject weak passwords', () => {
      expect(isValidPassword('password')).toBe(false) // no uppercase, no numbers
      expect(isValidPassword('PASSWORD')).toBe(false) // no lowercase, no numbers
      expect(isValidPassword('Password')).toBe(false) // no numbers
      expect(isValidPassword('pass123')).toBe(false) // too short, no uppercase
      expect(isValidPassword('')).toBe(false) // empty
    })

    it('should reject passwords that are too long', () => {
      const longPassword = 'A'.repeat(129) + '1!'
      expect(isValidPassword(longPassword)).toBe(false)
    })
  })

  describe('isValidNumber', () => {
    it('should validate numbers within range', () => {
      expect(isValidNumber(5, 1, 10)).toBe(true)
      expect(isValidNumber(1, 1, 10)).toBe(true)
      expect(isValidNumber(10, 1, 10)).toBe(true)
      expect(isValidNumber(0, -5, 5)).toBe(true)
    })

    it('should reject numbers outside range', () => {
      expect(isValidNumber(0, 1, 10)).toBe(false)
      expect(isValidNumber(11, 1, 10)).toBe(false)
      expect(isValidNumber(-1, 0, 10)).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(isValidNumber(NaN, 1, 10)).toBe(false)
      expect(isValidNumber(Infinity, 1, 10)).toBe(false)
      expect(isValidNumber(-Infinity, 1, 10)).toBe(false)
    })
  })

  describe('isValidDate', () => {
    it('should validate future dates', () => {
      const futureDate = new Date(Date.now() + 86400000) // tomorrow
      expect(isValidDate(futureDate, { future: true })).toBe(true)
    })

    it('should validate past dates', () => {
      const pastDate = new Date(Date.now() - 86400000) // yesterday
      expect(isValidDate(pastDate, { past: true })).toBe(true)
    })

    it('should reject invalid date objects', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false)
      expect(isValidDate(null as any)).toBe(false)
      expect(isValidDate(undefined as any)).toBe(false)
    })

    it('should validate date ranges', () => {
      const now = new Date()
      const futureDate = new Date(Date.now() + 86400000)
      const pastDate = new Date(Date.now() - 86400000)

      expect(isValidDate(now, { minDate: pastDate, maxDate: futureDate })).toBe(true)
      expect(isValidDate(futureDate, { minDate: now, maxDate: futureDate })).toBe(true)
      expect(isValidDate(pastDate, { minDate: now, maxDate: futureDate })).toBe(false)
    })
  })

  describe('isValidSport', () => {
    it('should validate supported sports', () => {
      expect(isValidSport('NFL')).toBe(true)
      expect(isValidSport('NBA')).toBe(true)
      expect(isValidSport('MLB')).toBe(true)
      expect(isValidSport('NHL')).toBe(true)
      expect(isValidSport('PGA')).toBe(true)
    })

    it('should reject unsupported sports', () => {
      expect(isValidSport('INVALID')).toBe(false)
      expect(isValidSport('')).toBe(false)
      expect(isValidSport('soccer')).toBe(false)
      expect(isValidSport(null as any)).toBe(false)
    })
  })

  describe('isValidPosition', () => {
    it('should validate NFL positions', () => {
      expect(isValidPosition('QB', 'NFL')).toBe(true)
      expect(isValidPosition('RB', 'NFL')).toBe(true)
      expect(isValidPosition('WR', 'NFL')).toBe(true)
      expect(isValidPosition('TE', 'NFL')).toBe(true)
      expect(isValidPosition('DST', 'NFL')).toBe(true)
      expect(isValidPosition('K', 'NFL')).toBe(true)
    })

    it('should validate NBA positions', () => {
      expect(isValidPosition('PG', 'NBA')).toBe(true)
      expect(isValidPosition('SG', 'NBA')).toBe(true)
      expect(isValidPosition('SF', 'NBA')).toBe(true)
      expect(isValidPosition('PF', 'NBA')).toBe(true)
      expect(isValidPosition('C', 'NBA')).toBe(true)
    })

    it('should reject invalid position/sport combinations', () => {
      expect(isValidPosition('QB', 'NBA')).toBe(false)
      expect(isValidPosition('PG', 'NFL')).toBe(false)
      expect(isValidPosition('INVALID', 'NFL')).toBe(false)
    })
  })

  describe('isValidContestType', () => {
    it('should validate contest types', () => {
      expect(isValidContestType('GPP')).toBe(true)
      expect(isValidContestType('Cash')).toBe(true)
      expect(isValidContestType('Tournament')).toBe(true)
      expect(isValidContestType('H2H')).toBe(true)
      expect(isValidContestType('50-50')).toBe(true)
    })

    it('should reject invalid contest types', () => {
      expect(isValidContestType('INVALID')).toBe(false)
      expect(isValidContestType('')).toBe(false)
      expect(isValidContestType(null as any)).toBe(false)
    })
  })

  describe('sanitizeInput', () => {
    it('should remove malicious scripts', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('')
      expect(sanitizeInput('Hello <script>alert(1)</script> World')).toBe('Hello  World')
    })

    it('should remove dangerous attributes', () => {
      expect(sanitizeInput('<div onclick="alert(1)">Test</div>')).toBe('<div>Test</div>')
      expect(sanitizeInput('<img src="x" onerror="alert(1)">')).toBe('<img src="x">')
    })

    it('should preserve safe content', () => {
      expect(sanitizeInput('Hello World')).toBe('Hello World')
      expect(sanitizeInput('<b>Bold text</b>')).toBe('<b>Bold text</b>')
      expect(sanitizeInput('<p>Paragraph with <em>emphasis</em></p>')).toBe('<p>Paragraph with <em>emphasis</em></p>')
    })

    it('should handle edge cases', () => {
      expect(sanitizeInput('')).toBe('')
      expect(sanitizeInput(null as any)).toBe('')
      expect(sanitizeInput(undefined as any)).toBe('')
    })
  })

  describe('validateApiResponse', () => {
    it('should validate successful responses', () => {
      const validResponse = {
        success: true,
        data: { id: 1, name: 'Test' }
      }
      expect(validateApiResponse(validResponse)).toBe(true)
    })

    it('should reject malformed responses', () => {
      expect(validateApiResponse(null)).toBe(false)
      expect(validateApiResponse(undefined)).toBe(false)
      expect(validateApiResponse('')).toBe(false)
      expect(validateApiResponse([])).toBe(false)
    })

    it('should validate error responses', () => {
      const errorResponse = {
        success: false,
        error: 'Something went wrong'
      }
      expect(validateApiResponse(errorResponse)).toBe(true)
    })

    it('should reject responses with invalid structure', () => {
      const invalidResponse = {
        notSuccess: true,
        someData: {}
      }
      expect(validateApiResponse(invalidResponse)).toBe(false)
    })
  })
})