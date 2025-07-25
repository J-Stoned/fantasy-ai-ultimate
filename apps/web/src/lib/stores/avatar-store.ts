/**
 * Avatar store implementation
 * Replaces @fantasy-ai/shared for build compatibility
 */

import { create } from 'zustand';

interface AvatarState {
  avatars: Map<string, any>;
  loadAvatar: (playerId: string) => Promise<void>;
  getAvatar: (playerId: string) => any;
}

export const useAvatarStore = create<AvatarState>((set, get) => ({
  avatars: new Map(),
  
  loadAvatar: async (playerId: string) => {
    // Mock avatar loading
    const mockAvatar = {
      id: playerId,
      style: '2d',
      imageUrl: `/api/avatars/${playerId}`,
      colors: ['#1f2937', '#3b82f6'],
    };
    
    set((state) => {
      const newAvatars = new Map(state.avatars);
      newAvatars.set(playerId, mockAvatar);
      return { avatars: newAvatars };
    });
  },
  
  getAvatar: (playerId: string) => {
    return get().avatars.get(playerId) || null;
  },
}));