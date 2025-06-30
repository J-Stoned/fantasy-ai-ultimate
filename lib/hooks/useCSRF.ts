import { useEffect, useState } from 'react'
import { getCSRFToken } from '../utils/security'

/**
 * Hook to manage CSRF tokens in client-side React components
 */
export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null)

  useEffect(() => {
    // Get CSRF token on mount
    const token = getCSRFToken()
    setCSRFToken(token)

    // Listen for token updates (e.g., after page navigation)
    const checkToken = () => {
      const newToken = getCSRFToken()
      if (newToken !== token) {
        setCSRFToken(newToken)
      }
    }

    // Check periodically for token updates
    const interval = setInterval(checkToken, 5000)

    return () => clearInterval(interval)
  }, [])

  // Helper function to make fetch requests with CSRF token
  const secureFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers)
    
    if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
      headers.set('x-csrf-token', csrfToken)
    }

    return fetch(url, {
      ...options,
      headers
    })
  }

  // Helper function to create headers with CSRF token
  const getSecureHeaders = (additionalHeaders: HeadersInit = {}): HeadersInit => {
    const headers = new Headers(additionalHeaders)
    
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken)
    }

    return headers
  }

  return {
    csrfToken,
    secureFetch,
    getSecureHeaders
  }
}

// Example usage:
/*
function MyComponent() {
  const { secureFetch } = useCSRF()

  const handleSubmit = async (data: any) => {
    const response = await secureFetch('/api/my-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Request failed')
    }

    return response.json()
  }
}
*/