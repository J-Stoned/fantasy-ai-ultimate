/**
 * 🔥 ENTERPRISE ADMIN LOGIN 🔥
 * 
 * Secure admin authentication with MFA and security monitoring.
 * Built for maximum security and enterprise compliance.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '../../../lib/logging/logger';

interface LoginForm {
  email: string;
  password: string;
  mfaToken?: string;
}

interface LoginState {
  isLoading: boolean;
  requiresMFA: boolean;
  error: string | null;
  attempts: number;
  isLocked: boolean;
  lockoutTime?: Date;
}

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState<LoginForm>({
    email: '',
    password: '',
    mfaToken: ''
  });
  
  const [state, setState] = useState<LoginState>({
    isLoading: false,
    requiresMFA: false,
    error: null,
    attempts: 0,
    isLocked: false
  });

  const [securityInfo, setSecurityInfo] = useState({
    ipAddress: '',
    location: '',
    lastLogin: ''
  });

  useEffect(() => {
    // Get client information for security display
    fetch('/api/admin/client-info')
      .then(res => res.json())
      .then(data => setSecurityInfo(data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (state.isLocked) {
      setState(prev => ({ ...prev, error: 'Account temporarily locked. Please try again later.' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const loginUrl = '/api/admin/login-test';
    logger.info('[Admin Login] Attempting login to:', { data: loginUrl });
    logger.info('[Admin Login] Form data:', { data: { email: form.email, hasPassword: !!form.password, hasMFA: !!form.mfaToken } });

    try {
      const requestBody = {
        email: form.email,
        password: form.password,
        mfaToken: form.mfaToken,
        clientInfo: {
          userAgent: navigator.userAgent,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language
        }
      };

      logger.info('[Admin Login] Sending request...');
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      logger.info('[Admin Login] Response status:', { data: response.status });
      logger.info('[Admin Login] Response headers:', { data: response.headers });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        logger.error('[Admin Login] Response not OK:', { error: response.status, statusText: response.statusText });
        const text = await response.text();
        logger.error('[Admin Login] Response body:', { error: text });
        
        setState(prev => ({ 
          ...prev, 
          error: `Server error: ${response.status} ${response.statusText}`,
          isLoading: false
        }));
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        logger.error('[Admin Login] Invalid content type:', { error: contentType });
        const text = await response.text();
        logger.error('[Admin Login] Response text:', { error: text });
        
        setState(prev => ({ 
          ...prev, 
          error: 'Invalid server response (not JSON)',
          isLoading: false
        }));
        return;
      }

      const data = await response.json();
      logger.info('[Admin Login] Response data:', { data: data });

      if (data.requiresMFA) {
        logger.info('[Admin Login] MFA required');
        setState(prev => ({ 
          ...prev, 
          requiresMFA: true, 
          isLoading: false,
          error: null 
        }));
      } else if (data.success) {
        // Successful login - redirect to admin dashboard
        logger.info('[Admin Login] Login successful, redirecting...');
        localStorage.setItem('admin_session_token', data.sessionToken);
        router.push('/admin');
      } else {
        const newAttempts = state.attempts + 1;
        const isLocked = newAttempts >= 5;
        
        logger.error('[Admin Login] Login failed:', { error: data.error });
        setState(prev => ({ 
          ...prev, 
          error: data.error || 'Login failed',
          attempts: newAttempts,
          isLocked,
          lockoutTime: isLocked ? new Date(Date.now() + 15 * 60 * 1000) : undefined,
          isLoading: false
        }));
      }
    } catch (error) {
      logger.error('[Admin Login] Fetch error:', { error: error });
      logger.error('[Admin Login] Error details:', { error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      } });
      
      setState(prev => ({ 
        ...prev, 
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isLoading: false
      }));
    }
  };

  const handleInputChange = (field: keyof LoginForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (state.error) {
      setState(prev => ({ ...prev, error: null }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
      <div className="w-full max-w-md">
        {/* Security Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            🛡️ Admin Security Portal
          </h1>
          <p className="text-gray-300">
            Enterprise Fantasy.AI Administration
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-black/40 backdrop-blur-lg rounded-xl p-8 border border-white/10">
          {/* Security Info */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="text-blue-400 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span>IP Address:</span>
                <span className="font-mono">{securityInfo.ipAddress || 'Loading...'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Location:</span>
                <span>{securityInfo.location || 'Unknown'}</span>
              </div>
              {securityInfo.lastLogin && (
                <div className="flex items-center justify-between">
                  <span>Last Login:</span>
                  <span>{securityInfo.lastLogin}</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {state.error && (
            <div className="mb-6 p-4 bg-red-500/20 text-red-200 border border-red-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{state.error}</span>
              </div>
              {state.attempts > 0 && (
                <div className="mt-2 text-xs text-red-300">
                  Login attempts: {state.attempts}/5
                  {state.isLocked && state.lockoutTime && (
                    <span className="block">
                      Account locked until {state.lockoutTime.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MFA Notice */}
          {state.requiresMFA && (
            <div className="mb-6 p-4 bg-yellow-500/20 text-yellow-200 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Multi-Factor Authentication Required</span>
              </div>
              <p className="text-xs mt-1">Please enter your authenticator code to continue.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  disabled={state.requiresMFA || state.isLocked}
                  className="w-full px-4 py-3 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  placeholder="admin@company.com"
                />
                <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  required
                  disabled={state.requiresMFA || state.isLocked}
                  className="w-full px-4 py-3 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  placeholder="••••••••••••"
                />
                <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            {/* MFA Token Input */}
            {state.requiresMFA && (
              <div>
                <label htmlFor="mfaToken" className="block text-sm font-medium text-gray-200 mb-2">
                  Authenticator Code
                </label>
                <div className="relative">
                  <input
                    id="mfaToken"
                    type="text"
                    value={form.mfaToken}
                    onChange={(e) => handleInputChange('mfaToken', e.target.value)}
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    className="w-full px-4 py-3 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-center text-xl tracking-widest"
                    placeholder="******"
                  />
                  <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={state.isLoading || state.isLocked}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {state.isLoading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>{state.requiresMFA ? 'Verify & Login' : 'Secure Login'}</span>
                </>
              )}
            </button>
          </form>

          {/* Security Footer */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-center text-gray-400 text-xs space-y-1">
              <p>🔒 All login attempts are monitored and logged</p>
              <p>Enterprise security powered by Fantasy.AI</p>
              <div className="flex items-center justify-center space-x-4 mt-2">
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>SSL Secured</span>
                </span>
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>SOC2 Compliant</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Security Notice */}
        <div className="mt-6 text-center text-gray-400 text-xs">
          <p>By logging in, you agree to our security monitoring and audit logging policies.</p>
          <p className="mt-1">Unauthorized access attempts will be prosecuted to the full extent of the law.</p>
        </div>
      </div>
    </div>
  );
}