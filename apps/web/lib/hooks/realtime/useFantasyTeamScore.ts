import { useState, useEffect, useCallback } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { supabase } from '../../supabase/client-browser';
import { defaultLogger } from '../../utils/logger';

interface FantasyTeam {
  id: string;
  league_id: string;
  user_id: string;
  team_name: string;
  roster: RosterSlot[];
  total_score?: number;
}

interface RosterSlot {
  player_id: string;
  position: string;
  is_starter: boolean;
  player?: {
    id: string;
    full_name: string;
    current_team: {
      abbreviation: string;
    };
  };
  live_score?: number;
  projected_score?: number;
}

interface ScoringSettings {
  passing_yards: number;
  passing_tds: number;
  interceptions: number;
  rushing_yards: number;
  rushing_tds: number;
  receptions: number;
  receiving_yards: number;
  receiving_tds: number;
  fumbles_lost: number;
}

export function useFantasyTeamScore(teamId: string) {
  const [team, setTeam] = useState<FantasyTeam | null>(null);
  const [liveScores, setLiveScores] = useState<Map<string, number>>(new Map());
  const [totalScore, setTotalScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scoringSettings, setScoringSettings] = useState<ScoringSettings>({
    passing_yards: 0.04,
    passing_tds: 4,
    interceptions: -2,
    rushing_yards: 0.1,
    rushing_tds: 6,
    receptions: 1, // PPR
    receiving_yards: 0.1,
    receiving_tds: 6,
    fumbles_lost: -2,
  });

  // Fetch team data
  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);

      // Get fantasy team with roster
      const { data: teamData, error: teamError } = await supabase
        .from('fantasy_teams')
        .select(`
          *,
          fantasy_rosters!inner (
            player_id,
            position,
            is_starter,
            player:players (
              id,
              full_name,
              current_team:teams_master (
                abbreviation
              )
            )
          ),
          league:fantasy_leagues (
            scoring_settings
          )
        `)
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;

      // Parse scoring settings
      if (teamData.league?.scoring_settings) {
        setScoringSettings(teamData.league.scoring_settings);
      }

      // Transform roster data
      const roster: RosterSlot[] = teamData.fantasy_rosters.map((slot: any) => ({
        player_id: slot.player_id,
        position: slot.position,
        is_starter: slot.is_starter,
        player: slot.player,
        live_score: 0,
        projected_score: 0,
      }));

      setTeam({
        ...teamData,
        roster,
      });

      // Fetch live scores for all players
      await updateLiveScores(roster.map(r => r.player_id));
    } catch (error) {
      defaultLogger.error('Error fetching fantasy team', { error, teamId });
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // Update live scores for players
  const updateLiveScores = useCallback(async (playerIds: string[]) => {
    const currentWeek = getCurrentWeek();
    
    // Fetch game logs for current week
    const { data: gameLogs, error } = await supabase
      .from('player_game_logs')
      .select('player_id, stats')
      .in('player_id', playerIds)
      .gte('game_date', currentWeek.start)
      .lte('game_date', currentWeek.end);

    if (error) {
      defaultLogger.error('Error fetching game logs for live scores', { error, playerIds });
      return;
    }

    // Calculate scores
    const newScores = new Map<string, number>();
    gameLogs.forEach((log) => {
      const score = calculatePlayerScore(log.stats, scoringSettings);
      newScores.set(log.player_id, score);
    });

    setLiveScores(newScores);
  }, [scoringSettings]);

  // Calculate player score based on stats
  const calculatePlayerScore = (stats: any, settings: ScoringSettings): number => {
    if (!stats) return 0;

    let score = 0;
    score += (stats.passing_yards || 0) * settings.passing_yards;
    score += (stats.passing_tds || 0) * settings.passing_tds;
    score += (stats.interceptions || 0) * settings.interceptions;
    score += (stats.rushing_yards || 0) * settings.rushing_yards;
    score += (stats.rushing_tds || 0) * settings.rushing_tds;
    score += (stats.receptions || 0) * settings.receptions;
    score += (stats.receiving_yards || 0) * settings.receiving_yards;
    score += (stats.receiving_tds || 0) * settings.receiving_tds;
    score += (stats.fumbles_lost || 0) * settings.fumbles_lost;

    return Math.round(score * 10) / 10;
  };

  // Get current week date range
  const getCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek + 2); // Tuesday
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Monday

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  // Calculate total score
  useEffect(() => {
    if (!team) return;

    let total = 0;
    team.roster.forEach((slot) => {
      if (slot.is_starter) {
        const score = liveScores.get(slot.player_id) || 0;
        total += score;
      }
    });

    setTotalScore(Math.round(total * 10) / 10);
  }, [team, liveScores]);

  // Initial fetch
  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Subscribe to game log updates for roster players
  useRealtimeSubscription({
    table: 'player_game_logs',
    event: '*',
    onChange: async (payload) => {
      if (!team) return;

      const playerIds = team.roster.map(r => r.player_id);
      if (playerIds.includes(payload.new?.player_id || payload.old?.player_id)) {
        // Refetch scores when any roster player's game log changes
        await updateLiveScores(playerIds);
      }
    },
  });

  // Subscribe to roster changes
  useRealtimeSubscription({
    table: 'fantasy_rosters',
    filter: `team_id=eq.${teamId}`,
    onChange: () => {
      // Refetch team when roster changes
      fetchTeamData();
    },
  });

  return {
    team,
    liveScores,
    totalScore,
    loading,
    refresh: fetchTeamData,
    getRosterWithScores: () => {
      if (!team) return [];
      return team.roster.map(slot => ({
        ...slot,
        live_score: liveScores.get(slot.player_id) || 0,
      }));
    },
  };
}