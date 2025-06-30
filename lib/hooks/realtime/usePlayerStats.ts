import { useState, useEffect, useCallback } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { supabase } from '../../supabase/client-browser';
import { defaultLogger } from '../../utils/logger';

interface PlayerStats {
  id: string;
  player_id: string;
  season: number;
  season_type: string;
  games_played: number;
  stats: Record<string, any>;
  fantasy_points?: number;
  updated_at: string;
}

interface Player {
  id: string;
  full_name: string;
  "position": string[];
  current_team_id: string;
  team?: {
    name: string;
    city: string;
    abbreviation: string;
  };
}

export function usePlayerStats(playerId: string) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  const fetchPlayerData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch player with team info
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(`
          *,
          team:current_team_id (
            name,
            city,
            abbreviation
          )
        `)
        .eq('id', playerId)
        .single();

      if (playerError) throw playerError;
      setPlayer(playerData);

      // Fetch current season stats
      const currentYear = new Date().getFullYear();
      const { data: statsData, error: statsError } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', playerId)
        .eq('season', currentYear)
        .eq('season_type', 'regular')
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        throw statsError;
      }

      setStats(statsData || null);
    } catch (err) {
      defaultLogger.error('Error fetching player data', { error: err, playerId });
      setError(err instanceof Error ? err.message : 'Failed to fetch player data');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  // Initial fetch
  useEffect(() => {
    fetchPlayerData();
  }, [fetchPlayerData]);

  // Subscribe to player updates
  useRealtimeSubscription({
    table: 'players',
    filter: `id=eq.${playerId}`,
    onUpdate: (payload) => {
      defaultLogger.debug('Player data updated via realtime', { playerId, payload });
      setPlayer((prev) => ({
        ...prev,
        ...payload.new,
      }));
    },
  });

  // Subscribe to stats updates
  useRealtimeSubscription({
    table: 'player_stats',
    filter: `player_id=eq.${playerId}`,
    onInsert: (payload) => {
      const newStats = payload.new as PlayerStats;
      if (
        newStats.season === new Date().getFullYear() &&
        newStats.season_type === 'regular'
      ) {
        setStats(newStats);
      }
    },
    onUpdate: (payload) => {
      const updatedStats = payload.new as PlayerStats;
      if (
        updatedStats.season === new Date().getFullYear() &&
        updatedStats.season_type === 'regular'
      ) {
        setStats(updatedStats);
      }
    },
  });

  // Calculate fantasy points based on stats
  const calculateFantasyPoints = useCallback((statsData: PlayerStats) => {
    if (!statsData?.stats) return 0;

    // Example PPR scoring for football
    const s = statsData.stats;
    let points = 0;

    // Passing
    points += (s.passing_yards || 0) * 0.04;
    points += (s.passing_tds || 0) * 4;
    points -= (s.interceptions || 0) * 2;

    // Rushing
    points += (s.rushing_yards || 0) * 0.1;
    points += (s.rushing_tds || 0) * 6;

    // Receiving
    points += (s.receptions || 0) * 1; // PPR
    points += (s.receiving_yards || 0) * 0.1;
    points += (s.receiving_tds || 0) * 6;

    // Misc
    points -= (s.fumbles_lost || 0) * 2;

    return Math.round(points * 10) / 10;
  }, []);

  return {
    player,
    stats,
    loading,
    error,
    fantasyPoints: stats ? calculateFantasyPoints(stats) : 0,
    refresh: fetchPlayerData,
  };
}