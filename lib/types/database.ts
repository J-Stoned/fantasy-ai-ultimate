export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: number
          external_id: string
          name: string
          team_id: number | null
          position: string | null
          jersey_number: string | null
          height: string | null
          weight: string | null
          birth_date: string | null
          sport: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      teams: {
        Row: {
          id: number
          external_id: string
          name: string
          abbreviation: string | null
          city: string | null
          sport: string
          conference: string | null
          division: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
      }
      games: {
        Row: {
          id: number
          external_id: string
          home_team_id: number
          away_team_id: number
          game_date: string
          sport: string
          season: string | null
          week: number | null
          status: string | null
          home_score: number | null
          away_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['games']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['games']['Insert']>
      }
      player_game_logs: {
        Row: {
          id: number
          player_id: number
          game_id: number
          stats: Json
          fantasy_points: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_game_logs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['player_game_logs']['Insert']>
      }
      betting_lines: {
        Row: {
          id: number
          game_id: number
          source: string
          home_spread: number | null
          away_spread: number | null
          home_moneyline: number | null
          away_moneyline: number | null
          total: number | null
          home_spread_odds: number | null
          away_spread_odds: number | null
          over_odds: number | null
          under_odds: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['betting_lines']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['betting_lines']['Insert']>
      }
      weather_data: {
        Row: {
          id: number
          game_id: number
          temperature: number | null
          humidity: number | null
          wind_speed: number | null
          precipitation: number | null
          conditions: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['weather_data']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['weather_data']['Insert']>
      }
      enhanced_synergies: {
        Row: {
          id: number
          game_id: number
          player_ids: number[]
          synergy_type: string
          synergy_score: number
          lineup_size: number
          context_type: string
          home_away: string
          performance_metrics: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['enhanced_synergies']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['enhanced_synergies']['Insert']>
      }
      player_injuries: {
        Row: {
          id: number
          player_id: number
          injury_date: string
          injury_type: string | null
          injury_status: string | null
          expected_return: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_injuries']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['player_injuries']['Insert']>
      }
      pattern_results: {
        Row: {
          id: number
          pattern_name: string
          game_id: number
          confidence: number
          predicted_outcome: string
          actual_outcome: string | null
          is_correct: boolean | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['pattern_results']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['pattern_results']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}