/**
 * MARCUS "THE FIXER" RODRIGUEZ - AUTH CONTEXT
 * 
 * Real authentication that works across the app
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { auth } from '../api/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    auth.getSession().then((session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: authListener } = auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { user } = await auth.signIn(email, password);
      setUser(user);
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { user } = await auth.signUp(email, password);
      if (user) {
        Alert.alert(
          'Success!',
          'Check your email to confirm your account before signing in.'
        );
      }
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error: any) {
      Alert.alert('Sign Out Failed', error.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * THE MARCUS GUARANTEE:
 * 
 * This auth context:
 * - Works with Supabase
 * - Persists sessions
 * - Handles all auth states
 * - Shows proper error messages
 * 
 * No more auth headaches!
 * 
 * - Marcus "The Fixer" Rodriguez
 */