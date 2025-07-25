import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { PlayerAvatarProfile, AvatarAsset, AvatarCustomization } from '../types/avatar';
import { modernFetch, createCachedFetch } from '../api/modern-client';

// 2025 Best Practice: Web Workers for heavy 3D processing
const avatarWorker = typeof window !== 'undefined' && 'Worker' in window
  ? new Worker(new URL('../workers/avatar.worker.ts', import.meta.url))
  : null;

interface AvatarState {
  // State
  avatars: Map<string, PlayerAvatarProfile>;
  loadingAvatars: Set<string>;
  preloadedAssets: Map<string, AvatarAsset>;
  customizations: Map<string, AvatarCustomization>;
  
  // Settings
  quality: 'low' | 'medium' | 'high' | 'ultra';
  preloadRadius: number; // How many avatars to preload
  
  // Actions
  loadAvatar: (playerId: string) => Promise<PlayerAvatarProfile>;
  loadBatchAvatars: (playerIds: string[]) => Promise<void>;
  preloadAvatars: (playerIds: string[]) => void;
  updateCustomization: (playerId: string, customization: Partial<AvatarCustomization>) => void;
  setQuality: (quality: AvatarState['quality']) => void;
  clearCache: () => void;
}

// 2025 Best Practice: Cached fetch for avatar data
const cachedAvatarFetch = createCachedFetch(
  async (playerId: string) => modernFetch<PlayerAvatarProfile>(`/api/players/${playerId}/avatar`),
  { revalidate: 3600 } // 1 hour cache
);

export const useAvatarStore = create<AvatarState>()(
  devtools(
    persist(
      immer((set, get) => ({
        avatars: new Map(),
        loadingAvatars: new Set(),
        preloadedAssets: new Map(),
        customizations: new Map(),
        quality: 'high',
        preloadRadius: 10,
        
        loadAvatar: async (playerId: string) => {
          const existing = get().avatars.get(playerId);
          if (existing) return existing;
          
          // Mark as loading
          set((state) => {
            state.loadingAvatars.add(playerId);
          });
          
          try {
            const response = await cachedAvatarFetch(playerId);
            
            if (response.success && response.data) {
              const avatar = response.data;
              
              // Process 3D assets in web worker if available
              if (avatarWorker && avatar.avatarAsset.type === '3d') {
                avatarWorker.postMessage({
                  type: 'PROCESS_AVATAR',
                  payload: { avatar, quality: get().quality }
                });
                
                await new Promise<void>((resolve) => {
                  const handler = (e: MessageEvent) => {
                    if (e.data.type === 'AVATAR_PROCESSED' && e.data.playerId === playerId) {
                      avatarWorker.removeEventListener('message', handler);
                      resolve();
                    }
                  };
                  avatarWorker.addEventListener('message', handler);
                });
              }
              
              set((state) => {
                state.avatars.set(playerId, avatar);
                state.loadingAvatars.delete(playerId);
              });
              
              return avatar;
            }
            
            throw new Error('Failed to load avatar');
          } catch (error) {
            set((state) => {
              state.loadingAvatars.delete(playerId);
            });
            throw error;
          }
        },
        
        loadBatchAvatars: async (playerIds: string[]) => {
          const promises = playerIds.map(id => get().loadAvatar(id).catch(() => null));
          await Promise.all(promises);
        },
        
        preloadAvatars: (playerIds: string[]) => {
          // 2025: Use requestIdleCallback for non-blocking preload
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              get().loadBatchAvatars(playerIds);
            }, { timeout: 2000 });
          } else {
            setTimeout(() => {
              get().loadBatchAvatars(playerIds);
            }, 1000);
          }
        },
        
        updateCustomization: (playerId: string, customization: Partial<AvatarCustomization>) => {
          set((state) => {
            const existing = state.customizations.get(playerId) || {};
            state.customizations.set(playerId, { ...existing, ...customization });
            
            // Update avatar if loaded
            const avatar = state.avatars.get(playerId);
            if (avatar) {
              avatar.customizations = { ...existing, ...customization };
            }
          });
          
          // Persist customization to server
          modernFetch(`/api/players/${playerId}/avatar/customize`, {
            method: 'PATCH',
            body: JSON.stringify(customization),
            headers: { 'Content-Type': 'application/json' }
          });
        },
        
        setQuality: (quality: AvatarState['quality']) => {
          set((state) => {
            state.quality = quality;
          });
          
          // Notify web worker of quality change
          avatarWorker?.postMessage({
            type: 'SET_QUALITY',
            payload: { quality }
          });
        },
        
        clearCache: () => {
          set((state) => {
            state.avatars.clear();
            state.preloadedAssets.clear();
            state.loadingAvatars.clear();
          });
          
          avatarWorker?.postMessage({ type: 'CLEAR_CACHE' });
        }
      })),
      {
        name: 'avatar-storage',
        // Only persist customizations, not the actual avatar data
        partialize: (state) => ({
          customizations: Array.from(state.customizations.entries()),
          quality: state.quality
        }),
        // Restore customizations from array
        onRehydrateStorage: () => (state) => {
          if (state && Array.isArray(state.customizations)) {
            state.customizations = new Map(state.customizations);
          }
        }
      }
    ),
    {
      name: 'avatar-store'
    }
  )
);

// 2025 Best Practice: Selectors with computed values
export const avatarSelectors = {
  getAvatar: (playerId: string) => (state: AvatarState) => state.avatars.get(playerId),
  isLoading: (playerId: string) => (state: AvatarState) => state.loadingAvatars.has(playerId),
  getCustomization: (playerId: string) => (state: AvatarState) => state.customizations.get(playerId),
  starAvatars: (state: AvatarState) => Array.from(state.avatars.values()).filter(a => a.tier === 'star'),
  avatarCount: (state: AvatarState) => state.avatars.size
};