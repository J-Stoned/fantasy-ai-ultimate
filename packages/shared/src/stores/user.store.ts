import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { UserProfile, SubscriptionInfo } from '../types/api';
import { modernFetch } from '../api/modern-client';

// 2025 Best Practice: Type-safe store with immer for immutability
interface UserState {
  user: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  
  // Actions
  setUser: (user: UserProfile) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  updateSubscription: (subscription: SubscriptionInfo) => void;
  clearUser: () => void;
  
  // Async actions
  fetchUser: () => Promise<void>;
  savePreferences: (preferences: Partial<UserProfile['preferences']>) => Promise<void>;
}

// 2025 Best Practice: Zustand with all the middleware
export const useUserStore = create<UserState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          user: null,
          isLoading: false,
          error: null,
          
          setUser: (user) => set((state) => {
            state.user = user;
            state.error = null;
          }),
          
          updateUser: (updates) => set((state) => {
            if (state.user) {
              Object.assign(state.user, updates);
            }
          }),
          
          updateSubscription: (subscription) => set((state) => {
            if (state.user) {
              state.user.subscription = subscription;
            }
          }),
          
          clearUser: () => set((state) => {
            state.user = null;
            state.error = null;
          }),
          
          fetchUser: async () => {
            set((state) => {
              state.isLoading = true;
              state.error = null;
            });
            
            try {
              const response = await modernFetch<UserProfile>('/api/user/profile');
              
              if (response.success && response.data) {
                set((state) => {
                  state.user = response.data;
                  state.isLoading = false;
                });
              } else {
                throw new Error(response.error?.message || 'Failed to fetch user');
              }
            } catch (error) {
              set((state) => {
                state.error = error as Error;
                state.isLoading = false;
              });
            }
          },
          
          savePreferences: async (preferences) => {
            const currentUser = get().user;
            if (!currentUser) return;
            
            // Optimistic update
            set((state) => {
              if (state.user) {
                state.user.preferences = {
                  ...state.user.preferences,
                  ...preferences
                };
              }
            });
            
            try {
              const response = await modernFetch('/api/user/preferences', {
                method: 'PATCH',
                body: JSON.stringify(preferences),
                headers: { 'Content-Type': 'application/json' }
              });
              
              if (!response.success) {
                // Revert on failure
                set((state) => {
                  if (state.user) {
                    state.user.preferences = currentUser.preferences;
                  }
                });
                
                throw new Error(response.error?.message || 'Failed to save preferences');
              }
            } catch (error) {
              set((state) => {
                state.error = error as Error;
              });
            }
          }
        }))
      ),
      {
        name: 'user-storage',
        // 2025: Only persist essential data
        partialize: (state) => ({
          user: state.user ? {
            id: state.user.id,
            email: state.user.email,
            name: state.user.name,
            subscription: state.user.subscription
          } : null
        })
      }
    ),
    {
      name: 'user-store'
    }
  )
);

// 2025 Best Practice: Selectors for performance
export const userSelectors = {
  isAuthenticated: (state: UserState) => !!state.user,
  isPremium: (state: UserState) => state.user?.subscription.tier !== 'free',
  hasAvatars: (state: UserState) => {
    const tier = state.user?.subscription.tier;
    return tier && tier !== 'free';
  },
  subscriptionTier: (state: UserState) => state.user?.subscription.tier || 'free'
};

// 2025 Best Practice: React Server Components compatible selector
export async function getUserFromServer(): Promise<UserProfile | null> {
  try {
    const response = await modernFetch<UserProfile>('/api/user/profile', {
      cache: 'no-store'
    });
    
    return response.success && response.data ? response.data : null;
  } catch {
    return null;
  }
}