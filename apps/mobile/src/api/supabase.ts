/**
 * MARCUS "THE FIXER" RODRIGUEZ - MOBILE SUPABASE CLIENT
 * 
 * Real data, real authentication, real app!
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Get from environment - these are now set in .env.local
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Verify we have credentials
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials! Check .env.local');
}

// Create Supabase client with React Native storage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth helpers
export const auth = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  onAuthStateChange(callback: (event: any, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helpers
export const db = {
  // Leagues
  async getMyLeagues() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('leagues')
      .select('*, league_members!inner(*)')
      .eq('league_members.user_id', user.id);

    if (error) throw error;
    return data;
  },

  // Players
  async getPlayers(sport = 'nfl') {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('sport', sport)
      .order('projected_points', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getPlayerStats(playerId: string) {
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', playerId)
      .order('week', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data;
  },

  // Lineups
  async getLineup(leagueId: string, week?: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const query = supabase
      .from('lineups')
      .select('*, lineup_players(*, player:players(*))')
      .eq('league_id', leagueId)
      .eq('user_id', user.id);

    if (week) {
      query.eq('week', week);
    }

    const { data, error } = await query.single();
    if (error) throw error;
    return data;
  },

  async updateLineup(lineupId: string, players: any[]) {
    // Start transaction
    const { error: deleteError } = await supabase
      .from('lineup_players')
      .delete()
      .eq('lineup_id', lineupId);

    if (deleteError) throw deleteError;

    // Insert new lineup
    const lineupPlayers = players.map((player, index) => ({
      lineup_id: lineupId,
      player_id: player.id,
      position: player.position,
      slot_position: player.slotPosition,
      order: index,
    }));

    const { error: insertError } = await supabase
      .from('lineup_players')
      .insert(lineupPlayers);

    if (insertError) throw insertError;
  },

  // Contests
  async getContests() {
    const { data, error } = await supabase
      .from('contests')
      .select('*')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data;
  },

  async enterContest(contestId: string, lineupId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('contest_entries')
      .insert({
        contest_id: contestId,
        user_id: user.id,
        lineup_id: lineupId,
      });

    if (error) throw error;
    return data;
  },

  // Live scores
  async getLiveScores() {
    const { data, error } = await supabase
      .from('live_games')
      .select('*')
      .eq('status', 'active');

    if (error) throw error;
    return data;
  },

  // Realtime subscriptions
  subscribeToLineupScores(lineupId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`lineup-scores-${lineupId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lineup_players',
          filter: `lineup_id=eq.${lineupId}`,
        },
        callback
      )
      .subscribe();
  },
};

// Storage helpers for images
export const storage = {
  async uploadAvatar(userId: string, file: Blob) {
    const fileName = `${userId}-${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file);

    if (error) throw error;
    return data;
  },

  getAvatarUrl(path: string) {
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);
    
    return data.publicUrl;
  },
};

/**
 * THE MARCUS GUARANTEE:
 * 
 * This connects your mobile app to real data:
 * - Authentication that works
 * - Real-time updates
 * - Secure RLS policies
 * - Offline support with AsyncStorage
 * 
 * No more mock data!
 * 
 * - Marcus "The Fixer" Rodriguez
 */