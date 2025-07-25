import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '../supabase/client-browser'

interface User {
  id: string;
  email: string;
  name?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock initial session check
    setTimeout(() => {
      setLoading(false)
    }, 100)
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    // Mock sign in - replace with actual auth
    const mockUser = { id: '1', email, name: 'Mock User' }
    setUser(mockUser)
    setLoading(false)
    return { data: { user: mockUser }, error: null }
  }

  const signUp = async (email: string, password: string) => {
    setLoading(true)
    // Mock sign up - replace with actual auth
    const mockUser = { id: '1', email, name: 'New User' }
    setUser(mockUser)
    setLoading(false)
    return { data: { user: mockUser }, error: null }
  }

  const signOut = async () => {
    setUser(null)
    return { error: null }
  }

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }
}