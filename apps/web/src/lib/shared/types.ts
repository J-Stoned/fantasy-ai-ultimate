/**
 * Shared types for Fantasy AI Platform
 * Mock implementation for build compatibility
 */

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: string[];
  team?: string;
  jerseyNumber?: string;
  status?: string;
  rating?: number;
  fantasyPoints?: number;
}

export interface AvatarConfig {
  playerId: string;
  style: '2d' | '3d';
  theme: string;
  colors: string[];
}

export interface League {
  id: string;
  name: string;
  sport: string;
  type: string;
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  colors: string[];
}