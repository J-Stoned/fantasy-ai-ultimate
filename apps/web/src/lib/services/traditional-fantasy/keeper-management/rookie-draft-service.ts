/**
 * Rookie Draft Service for Dynasty/Keeper Leagues
 */

export interface RookiePlayer {
  id: string;
  name: string;
  position: string;
  college: string;
  adp: number; // Average Draft Position
  tier: number;
}

export interface DraftPick {
  round: number;
  pick: number;
  overallPick: number;
  teamId: string;
  playerId?: string;
}

export class RookieDraftService {
  async getRookies(year: number): Promise<RookiePlayer[]> {
    // Mock implementation
    return [
      {
        id: 'r1',
        name: 'Mock Rookie 1',
        position: 'RB',
        college: 'Alabama',
        adp: 1.3,
        tier: 1,
      },
      {
        id: 'r2',
        name: 'Mock Rookie 2',
        position: 'WR',
        college: 'Ohio State',
        adp: 2.1,
        tier: 1,
      },
    ];
  }

  async getDraftBoard(leagueId: string): Promise<DraftPick[]> {
    // Mock implementation
    return Array.from({ length: 24 }, (_, i) => ({
      round: Math.floor(i / 12) + 1,
      pick: (i % 12) + 1,
      overallPick: i + 1,
      teamId: `team${(i % 12) + 1}`,
    }));
  }

  async makePick(leagueId: string, pick: number, playerId: string): Promise<DraftPick> {
    return {
      round: Math.ceil(pick / 12),
      pick: ((pick - 1) % 12) + 1,
      overallPick: pick,
      teamId: 'user-team',
      playerId,
    };
  }
}