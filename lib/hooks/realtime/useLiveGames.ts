import { useState, useEffect, useCallback } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { supabase } from '../../supabase/client-browser';
import { defaultLogger } from '../../utils/logger';

interface LiveGame {
  id: string;
  sport_id: string;
  home_team: {
    id: string;
    name: string;
    abbreviation: string;
    score: number;
  };
  away_team: {
    id: string;
    name: string;
    abbreviation: string;
    score: number;
  };
  status: 'scheduled' | 'in_progress' | 'final';
  period: string;
  time_remaining?: string;
  game_date: string;
  updated_at: string;
}

interface GameUpdate {
  game_id: string;
  home_score: number;
  away_score: number;
  period: string;
  time_remaining?: string;
  status: string;
}

export function useLiveGames(sportId?: string, date?: Date) {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Get games for specified date (default to today)
  const gameDate = date || new Date();
  const dateString = gameDate.toISOString().split('T')[0];

  // Fetch games
  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('games')
        .select(`
          id,
          sport_id,
          game_date,
          status,
          period,
          time_remaining,
          final_score_home,
          final_score_away,
          home_team:home_team_id (
            id,
            name,
            abbreviation
          ),
          away_team:away_team_id (
            id,
            name,
            abbreviation
          ),
          updated_at
        `)
        .eq('game_date', dateString);

      if (sportId) {
        query = query.eq('sport_id', sportId);
      }

      const { data, error } = await query.order('game_date', { ascending: true });

      if (error) throw error;

      // Transform data to LiveGame format
      const liveGames: LiveGame[] = data.map((game: any) => ({
        id: game.id,
        sport_id: game.sport_id,
        home_team: {
          ...game.home_team,
          score: game.final_score_home || 0,
        },
        away_team: {
          ...game.away_team,
          score: game.final_score_away || 0,
        },
        status: game.status || 'scheduled',
        period: game.period || '',
        time_remaining: game.time_remaining,
        game_date: game.game_date,
        updated_at: game.updated_at,
      }));

      setGames(liveGames);
    } catch (error) {
      defaultLogger.error('Error fetching live games', { error, sportId, dateString });
    } finally {
      setLoading(false);
    }
  }, [dateString, sportId]);

  // Initial fetch
  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Subscribe to game updates
  useRealtimeSubscription({
    table: 'games',
    filter: `game_date=eq.${dateString}`,
    onUpdate: (payload) => {
      const updatedGame = payload.new;
      
      setGames((prevGames) => {
        return prevGames.map((game) => {
          if (game.id === updatedGame.id) {
            return {
              ...game,
              home_team: {
                ...game.home_team,
                score: updatedGame.final_score_home || 0,
              },
              away_team: {
                ...game.away_team,
                score: updatedGame.final_score_away || 0,
              },
              status: updatedGame.status || game.status,
              period: updatedGame.period || game.period,
              time_remaining: updatedGame.time_remaining,
              updated_at: updatedGame.updated_at,
            };
          }
          return game;
        });
      });

      setLastUpdate(new Date());
    },
  });

  // Auto-refresh in-progress games every 30 seconds
  useEffect(() => {
    const hasLiveGames = games.some(g => g.status === 'in_progress');
    if (!hasLiveGames) return;

    const interval = setInterval(() => {
      fetchGames();
    }, 30000);

    return () => clearInterval(interval);
  }, [games, fetchGames]);

  // Get games by status
  const getGamesByStatus = useCallback((status: string) => {
    return games.filter(g => g.status === status);
  }, [games]);

  return {
    games,
    loading,
    lastUpdate,
    refresh: fetchGames,
    liveGames: getGamesByStatus('in_progress'),
    upcomingGames: getGamesByStatus('scheduled'),
    finalGames: getGamesByStatus('final'),
    hasLiveGames: games.some(g => g.status === 'in_progress'),
  };
}