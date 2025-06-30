/**
 * Player Types
 */

export interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  jersey_number?: string;
  height?: string;
  weight?: string;
  age?: number;
  headshot_url?: string;
  status: string;
  espn_id?: string;
  sleeper_id?: string;
  yahoo_id?: string;
}