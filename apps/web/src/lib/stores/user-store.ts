/**
 * User store implementation
 * Replaces @fantasy-ai/shared for build compatibility
 */

import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  preferences?: any;
}

interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
  updatePreferences: (preferences: any) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  
  setUser: (user: User | null) => {
    set({ user });
  },
  
  updatePreferences: (preferences: any) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ 
        user: { 
          ...currentUser, 
          preferences: { ...currentUser.preferences, ...preferences }
        }
      });
    }
  },
}));