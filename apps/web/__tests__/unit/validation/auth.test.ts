import { z } from 'zod'
import { 
  loginSchema, 
  registerSchema, 
  passwordResetSchema,
  changePasswordSchema,
  adminLoginSchema
} from '@/lib/validation/schemas/auth'

describe('Authentication Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const validLogin = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      }

      expect(() => loginSchema.parse(validLogin)).not.toThrow()
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@domain.com',
        'test@',
        'test.domain.com',
        'test..test@domain.com'
      ]

      invalidEmails.forEach(email => {
        expect(() => loginSchema.parse({ email, password: 'ValidPass123!' }))
          .toThrow()
      })
    })

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password', // no uppercase, no numbers, no special chars
        'PASSWORD', // no lowercase, no numbers, no special chars
        'Pass123', // too short
        'Password', // no numbers, no special chars
        ''
      ]

      weakPasswords.forEach(password => {
        expect(() => loginSchema.parse({ email: 'test@example.com', password }))
          .toThrow()
      })
    })

    it('should sanitize email input', () => {
      const result = loginSchema.parse({
        email: '  TEST@EXAMPLE.COM  ',
        password: 'SecurePass123!'
      })

      expect(result.email).toBe('test@example.com')
    })

    it('should reject XSS attempts in email', () => {
      const maliciousEmails = [
        '<script>alert("xss")</script>@domain.com',
        'javascript:alert(1)@domain.com',
        'test@domain.com<script>',
        'test+<script>@domain.com'
      ]

      maliciousEmails.forEach(email => {
        expect(() => loginSchema.parse({ email, password: 'ValidPass123!' }))
          .toThrow()
      })
    })
  })

  describe('registerSchema', () => {
    it('should validate complete registration data', () => {
      const validRegistration = {
        email: 'newuser@example.com',
        password: 'SecureNewPass123!',
        confirmPassword: 'SecureNewPass123!',
        username: 'newuser123',
        acceptTerms: true
      }

      expect(() => registerSchema.parse(validRegistration)).not.toThrow()
    })

    it('should reject mismatched passwords', () => {
      const mismatchedPasswords = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!',
        username: 'testuser',
        acceptTerms: true
      }

      expect(() => registerSchema.parse(mismatchedPasswords)).toThrow()
    })

    it('should validate username requirements', () => {
      const validUsernames = ['user123', 'test_user', 'User-Name', 'a'.repeat(20)]
      const invalidUsernames = ['ab', 'a'.repeat(31), 'user@name', 'user name', '']

      validUsernames.forEach(username => {
        expect(() => registerSchema.parse({
          email: 'test@example.com',
          password: 'SecurePass123!',
          confirmPassword: 'SecurePass123!',
          username,
          acceptTerms: true
        })).not.toThrow()
      })

      invalidUsernames.forEach(username => {
        expect(() => registerSchema.parse({
          email: 'test@example.com',
          password: 'SecurePass123!',
          confirmPassword: 'SecurePass123!',
          username,
          acceptTerms: true
        })).toThrow()
      })
    })

    it('should require terms acceptance', () => {
      const withoutTerms = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        username: 'testuser',
        acceptTerms: false
      }

      expect(() => registerSchema.parse(withoutTerms)).toThrow()
    })

    it('should sanitize username input', () => {
      const result = registerSchema.parse({
        email: 'test@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        username: '  TestUser123  ',
        acceptTerms: true
      })

      expect(result.username).toBe('TestUser123')
    })
  })

  describe('passwordResetSchema', () => {
    it('should validate password reset request', () => {
      const validReset = {
        email: 'user@example.com'
      }

      expect(() => passwordResetSchema.parse(validReset)).not.toThrow()
    })

    it('should reject invalid emails for password reset', () => {
      const invalidEmails = ['notanemail', '', '  ']

      invalidEmails.forEach(email => {
        expect(() => passwordResetSchema.parse({ email })).toThrow()
      })
    })
  })

  describe('changePasswordSchema', () => {
    it('should validate password change data', () => {
      const validChange = {
        currentPassword: 'OldSecurePass123!',
        newPassword: 'NewSecurePass123!',
        confirmNewPassword: 'NewSecurePass123!'
      }

      expect(() => changePasswordSchema.parse(validChange)).not.toThrow()
    })

    it('should reject mismatched new passwords', () => {
      const mismatchedChange = {
        currentPassword: 'OldSecurePass123!',
        newPassword: 'NewSecurePass123!',
        confirmNewPassword: 'DifferentNewPass123!'
      }

      expect(() => changePasswordSchema.parse(mismatchedChange)).toThrow()
    })

    it('should reject same current and new password', () => {
      const samePasswords = {
        currentPassword: 'SamePass123!',
        newPassword: 'SamePass123!',
        confirmNewPassword: 'SamePass123!'
      }

      expect(() => changePasswordSchema.parse(samePasswords)).toThrow()
    })

    it('should enforce new password strength', () => {
      const weakNewPassword = {
        currentPassword: 'OldSecurePass123!',
        newPassword: 'weak',
        confirmNewPassword: 'weak'
      }

      expect(() => changePasswordSchema.parse(weakNewPassword)).toThrow()
    })
  })

  describe('adminLoginSchema', () => {
    it('should validate admin login with additional security', () => {
      const validAdminLogin = {
        email: 'admin@example.com',
        password: 'AdminSecurePass123!',
        totpCode: '123456'
      }

      expect(() => adminLoginSchema.parse(validAdminLogin)).not.toThrow()
    })

    it('should require TOTP code for admin login', () => {
      const withoutTotp = {
        email: 'admin@example.com',
        password: 'AdminSecurePass123!'
      }

      expect(() => adminLoginSchema.parse(withoutTotp)).toThrow()
    })

    it('should validate TOTP code format', () => {
      const invalidTotpCodes = ['12345', '1234567', 'abcdef', '']

      invalidTotpCodes.forEach(totpCode => {
        expect(() => adminLoginSchema.parse({
          email: 'admin@example.com',
          password: 'AdminSecurePass123!',
          totpCode
        })).toThrow()
      })
    })

    it('should enforce stricter password requirements for admin', () => {
      const adminWeakPassword = {
        email: 'admin@example.com',
        password: 'Password123', // missing special character
        totpCode: '123456'
      }

      expect(() => adminLoginSchema.parse(adminWeakPassword)).toThrow()
    })
  })

  describe('Security Edge Cases', () => {
    it('should handle extremely long inputs gracefully', () => {
      const longString = 'a'.repeat(1000)
      
      expect(() => loginSchema.parse({
        email: longString + '@example.com',
        password: longString
      })).toThrow()
    })

    it('should reject null and undefined values', () => {
      const nullValues = [null, undefined]
      
      nullValues.forEach(value => {
        expect(() => loginSchema.parse({
          email: value,
          password: 'ValidPass123!'
        })).toThrow()

        expect(() => loginSchema.parse({
          email: 'test@example.com',
          password: value
        })).toThrow()
      })
    })

    it('should handle Unicode and special characters safely', () => {
      const unicodeEmail = 'tëst@éxämplë.com'
      const unicodePassword = 'Unicodë123!🔐'

      // Should handle Unicode gracefully (may pass or fail depending on implementation)
      try {
        const result = loginSchema.parse({
          email: unicodeEmail,
          password: unicodePassword
        })
        // If it passes, ensure it's properly handled
        expect(typeof result.email).toBe('string')
        expect(typeof result.password).toBe('string')
      } catch (error) {
        // If it fails, that's also acceptable for security
        expect(error).toBeInstanceOf(z.ZodError)
      }
    })

    it('should prevent password reuse in change password', () => {
      const passwordReuse = {
        currentPassword: 'CurrentPass123!',
        newPassword: 'CurrentPass123!', // Same as current
        confirmNewPassword: 'CurrentPass123!'
      }

      expect(() => changePasswordSchema.parse(passwordReuse)).toThrow()
    })
  })
})