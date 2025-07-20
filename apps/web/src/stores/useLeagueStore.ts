import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type FantasyPlatform = 'espn' | 'yahoo' | 'cbs' | 'sleeper' | 'draftkings' | 'fanduel';
export type AuthStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type SportType = 'nfl' | 'nba' | 'mlb' | 'nhl' | 'ncaa_fb' | 'ncaa_bb';

interface PlatformAuth {
  platform: FantasyPlatform;
  status: AuthStatus;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  username?: string;
  error?: string;
}

interface ImportedLeague {
  id: string;
  platformId: string;
  platform: FantasyPlatform;
  name: string;
  sport: SportType;
  season: string;
  teamCount: number;
  scoringType: string;
  isActive: boolean;
  myTeamId?: string;
  myTeamName?: string;
  currentStanding?: number;
  roster?: ImportedPlayer[];
  settings?: Record<string, any>;
  lastSynced?: Date;
}

interface ImportedPlayer {
  id: string;
  platformId: string;
  name: string;
  team: string;
  position: string;
  injuryStatus?: string;
  projectedPoints?: number;
  seasonPoints?: number;
  imageUrl?: string;
}

interface ImportProgress {
  platform: FantasyPlatform;
  status: 'idle' | 'authenticating' | 'fetching' | 'importing' | 'completed' | 'error';
  progress: number;
  message: string;
  currentStep?: number;
  totalSteps?: number;
}

interface LeagueStore {
  // Platform Connections
  platformAuths: Map<FantasyPlatform, PlatformAuth>;
  
  // Imported Leagues
  leagues: Map<string, ImportedLeague>;
  selectedLeagueId: string | null;
  
  // Import Progress
  importProgress: Map<FantasyPlatform, ImportProgress>;
  
  // Cross-Platform Data
  unifiedRoster: Map<string, ImportedPlayer[]>; // playerId -> array of platform appearances
  crossPlatformPlayers: Map<string, string[]>; // playerId -> [platformIds]
  
  // Actions - Platform Auth
  connectPlatform: (platform: FantasyPlatform) => Promise<void>;
  disconnectPlatform: (platform: FantasyPlatform) => void;
  updatePlatformAuth: (platform: FantasyPlatform, auth: Partial<PlatformAuth>) => void;
  
  // Actions - League Management
  importLeagues: (platform: FantasyPlatform) => Promise<void>;
  selectLeague: (leagueId: string) => void;
  refreshLeague: (leagueId: string) => Promise<void>;
  syncAllLeagues: () => Promise<void>;
  
  // Actions - Import Progress
  updateImportProgress: (platform: FantasyPlatform, progress: Partial<ImportProgress>) => void;
  
  // Actions - Cross-Platform
  buildUnifiedRoster: () => void;
  findCrossPlatformMatches: (playerId: string) => ImportedPlayer[];
  
  // Computed
  getConnectedPlatforms: () => FantasyPlatform[];
  getLeaguesBySport: (sport: SportType) => ImportedLeague[];
  getTotalLeagues: () => number;
  getSelectedLeague: () => ImportedLeague | null;
}

const useLeagueStore = create<LeagueStore>()(
  persist(
    immer((set, get) => ({
      // Initial State
      platformAuths: new Map(),
      leagues: new Map(),
      selectedLeagueId: null,
      importProgress: new Map(),
      unifiedRoster: new Map(),
      crossPlatformPlayers: new Map(),
      
      // Platform Auth Actions
      connectPlatform: async (platform) => {
        set((state) => {
          state.platformAuths.set(platform, {
            platform,
            status: 'connecting',
          });
          state.importProgress.set(platform, {
            platform,
            status: 'authenticating',
            progress: 0,
            message: 'Connecting to ' + platform + '...',
          });
        });
        
        try {
          // Platform-specific OAuth flows
          let authUrl = '';
          switch (platform) {
            case 'yahoo':
              authUrl = `/api/auth/yahoo/connect`;
              break;
            case 'espn':
              authUrl = `/api/auth/espn/connect`;
              break;
            case 'sleeper':
              authUrl = `/api/auth/sleeper/connect`;
              break;
            default:
              authUrl = `/api/auth/${platform}/connect`;
          }
          
          // For OAuth platforms, redirect to auth flow
          if (['yahoo', 'espn'].includes(platform)) {
            window.location.href = authUrl;
          } else {
            // For API key platforms, show modal (handled by UI)
            set((state) => {
              state.importProgress.set(platform, {
                platform,
                status: 'idle',
                progress: 0,
                message: 'Enter your credentials',
              });
            });
          }
        } catch (error) {
          set((state) => {
            state.platformAuths.set(platform, {
              platform,
              status: 'error',
              error: error instanceof Error ? error.message : 'Connection failed',
            });
          });
        }
      },
      
      disconnectPlatform: (platform) => {
        set((state) => {
          state.platformAuths.delete(platform);
          // Remove leagues from this platform
          const leagueIds = Array.from(state.leagues.entries())
            .filter(([_, league]) => league.platform === platform)
            .map(([id]) => id);
          leagueIds.forEach(id => state.leagues.delete(id));
        });
      },
      
      updatePlatformAuth: (platform, auth) => {
        set((state) => {
          const current = state.platformAuths.get(platform) || { platform, status: 'disconnected' };
          state.platformAuths.set(platform, { ...current, ...auth });
        });
      },
      
      // League Import Actions
      importLeagues: async (platform) => {
        const auth = get().platformAuths.get(platform);
        if (!auth || auth.status !== 'connected') {
          throw new Error('Platform not connected');
        }
        
        set((state) => {
          state.importProgress.set(platform, {
            platform,
            status: 'fetching',
            progress: 20,
            message: 'Fetching leagues...',
            currentStep: 1,
            totalSteps: 4,
          });
        });
        
        try {
          const response = await fetch(`/api/import/${platform}/leagues`, {
            headers: {
              'Authorization': `Bearer ${auth.accessToken}`,
            },
          });
          
          if (!response.ok) throw new Error('Failed to fetch leagues');
          
          const leagues = await response.json();
          
          set((state) => {
            state.importProgress.set(platform, {
              platform,
              status: 'importing',
              progress: 60,
              message: `Importing ${leagues.length} leagues...`,
              currentStep: 2,
              totalSteps: 4,
            });
          });
          
          // Import each league
          for (const league of leagues) {
            const leagueId = `${platform}_${league.id}`;
            set((state) => {
              state.leagues.set(leagueId, {
                id: leagueId,
                platformId: league.id,
                platform,
                name: league.name,
                sport: league.sport,
                season: league.season,
                teamCount: league.teamCount,
                scoringType: league.scoringType,
                isActive: league.isActive,
                myTeamId: league.myTeamId,
                myTeamName: league.myTeamName,
                currentStanding: league.currentStanding,
                settings: league.settings,
                lastSynced: new Date(),
              });
            });
          }
          
          // Import rosters
          set((state) => {
            state.importProgress.set(platform, {
              platform,
              status: 'importing',
              progress: 80,
              message: 'Importing rosters...',
              currentStep: 3,
              totalSteps: 4,
            });
          });
          
          // Build unified roster
          get().buildUnifiedRoster();
          
          set((state) => {
            state.importProgress.set(platform, {
              platform,
              status: 'completed',
              progress: 100,
              message: `Successfully imported ${leagues.length} leagues!`,
              currentStep: 4,
              totalSteps: 4,
            });
          });
          
        } catch (error) {
          set((state) => {
            state.importProgress.set(platform, {
              platform,
              status: 'error',
              progress: 0,
              message: error instanceof Error ? error.message : 'Import failed',
            });
          });
        }
      },
      
      selectLeague: (leagueId) => {
        set((state) => {
          state.selectedLeagueId = leagueId;
        });
      },
      
      refreshLeague: async (leagueId) => {
        const league = get().leagues.get(leagueId);
        if (!league) return;
        
        const auth = get().platformAuths.get(league.platform);
        if (!auth || auth.status !== 'connected') return;
        
        try {
          const response = await fetch(`/api/import/${league.platform}/league/${league.platformId}`, {
            headers: {
              'Authorization': `Bearer ${auth.accessToken}`,
            },
          });
          
          if (!response.ok) throw new Error('Failed to refresh league');
          
          const updatedLeague = await response.json();
          
          set((state) => {
            state.leagues.set(leagueId, {
              ...league,
              ...updatedLeague,
              lastSynced: new Date(),
            });
          });
        } catch (error) {
          console.error('Failed to refresh league:', error);
        }
      },
      
      syncAllLeagues: async () => {
        const leagues = Array.from(get().leagues.values());
        const connectedPlatforms = get().getConnectedPlatforms();
        
        for (const platform of connectedPlatforms) {
          const platformLeagues = leagues.filter(l => l.platform === platform);
          if (platformLeagues.length > 0) {
            await get().importLeagues(platform);
          }
        }
      },
      
      // Import Progress
      updateImportProgress: (platform, progress) => {
        set((state) => {
          const current = state.importProgress.get(platform) || {
            platform,
            status: 'idle',
            progress: 0,
            message: '',
          };
          state.importProgress.set(platform, { ...current, ...progress });
        });
      },
      
      // Cross-Platform Actions
      buildUnifiedRoster: () => {
        const unifiedRoster = new Map<string, ImportedPlayer[]>();
        const crossPlatformPlayers = new Map<string, string[]>();
        
        // Process all leagues
        get().leagues.forEach((league) => {
          if (league.roster) {
            league.roster.forEach((player) => {
              // Use a normalized player ID (name + team)
              const normalizedId = `${player.name.toLowerCase().replace(/\s+/g, '_')}_${player.team}`;
              
              if (!unifiedRoster.has(normalizedId)) {
                unifiedRoster.set(normalizedId, []);
                crossPlatformPlayers.set(normalizedId, []);
              }
              
              unifiedRoster.get(normalizedId)!.push(player);
              crossPlatformPlayers.get(normalizedId)!.push(`${league.platform}_${player.platformId}`);
            });
          }
        });
        
        set((state) => {
          state.unifiedRoster = unifiedRoster;
          state.crossPlatformPlayers = crossPlatformPlayers;
        });
      },
      
      findCrossPlatformMatches: (playerId) => {
        return get().unifiedRoster.get(playerId) || [];
      },
      
      // Computed
      getConnectedPlatforms: () => {
        return Array.from(get().platformAuths.values())
          .filter(auth => auth.status === 'connected')
          .map(auth => auth.platform);
      },
      
      getLeaguesBySport: (sport) => {
        return Array.from(get().leagues.values())
          .filter(league => league.sport === sport);
      },
      
      getTotalLeagues: () => {
        return get().leagues.size;
      },
      
      getSelectedLeague: () => {
        const id = get().selectedLeagueId;
        return id ? get().leagues.get(id) || null : null;
      },
    })),
    {
      name: 'fantasy-league-store',
      // Custom storage to handle Map serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            ...data,
            state: {
              ...data.state,
              platformAuths: new Map(data.state.platformAuths),
              leagues: new Map(data.state.leagues),
              importProgress: new Map(data.state.importProgress),
              unifiedRoster: new Map(data.state.unifiedRoster),
              crossPlatformPlayers: new Map(data.state.crossPlatformPlayers),
            },
          };
        },
        setItem: (name, value) => {
          const data = {
            ...value,
            state: {
              ...value.state,
              platformAuths: Array.from(value.state.platformAuths.entries()),
              leagues: Array.from(value.state.leagues.entries()),
              importProgress: Array.from(value.state.importProgress.entries()),
              unifiedRoster: Array.from(value.state.unifiedRoster.entries()),
              crossPlatformPlayers: Array.from(value.state.crossPlatformPlayers.entries()),
            },
          };
          localStorage.setItem(name, JSON.stringify(data));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);

export default useLeagueStore;