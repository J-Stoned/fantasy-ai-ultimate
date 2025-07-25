import { logger } from '../../../logging/logger';

/**
 * Dynasty Strategy Service
 * Frontend service layer for Dynasty Management features
 */

export interface DynastyAsset {
  id: string;
  name: string;
  position: string;
  team: string;
  age: number;
  currentValue: number;
  futureValue: number[];
  category: 'elite' | 'core' | 'developing' | 'aging' | 'roster' | 'draft';
  injuryStatus?: string;
  imageUrl?: string;
}

export interface DynastyRoster {
  players: DynastyAsset[];
  picks: any[];
  totalValue: number;
  composition: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
}

export interface RosterAnalysis {
  overallGrade: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  ageAnalysis: {
    average: number;
    distribution: Record<string, number>;
  };
  positionDepth: Record<string, number>;
  injuryRisk: number;
  futureOutlook: string;
}

class DynastyStrategyService {
  private baseUrl = '/api/dynasty';

  /**
   * Get keeper recommendations
   */
  async getKeeperRecommendations(leagueId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/keeper-recommendations?leagueId=${leagueId}`);
      if (!response.ok) throw new Error('Failed to fetch keeper recommendations');
      const data = await response.json();
      return data.recommendations || [];
    } catch (error) {
      logger.error('Error fetching keeper recommendations:', { error: error });
      return [];
    }
  }

  /**
   * Save keeper decision
   */
  async saveKeeperDecision(leagueId: string, playerId: string, decision: 'keep' | 'release') {
    try {
      const response = await fetch(`${this.baseUrl}/keeper-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, playerId, decision })
      });
      if (!response.ok) throw new Error('Failed to save keeper decision');
      return await response.json();
    } catch (error) {
      logger.error('Error saving keeper decision:', { error: error });
      throw error;
    }
  }

  /**
   * Get championship window analysis
   */
  async getChampionshipWindow(leagueId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/championship-window?leagueId=${leagueId}`);
      if (!response.ok) throw new Error('Failed to fetch championship window');
      const data = await response.json();
      return {
        window: data.window,
        championshipProbabilities: data.championshipProbabilities,
        positionStrength: data.positionStrength,
        recommendations: data.recommendations
      };
    } catch (error) {
      logger.error('Error fetching championship window:', { error: error });
      return null;
    }
  }

  /**
   * Get dynasty assets
   */
  async getTeamAssets(leagueId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/assets?leagueId=${leagueId}`);
      if (!response.ok) throw new Error('Failed to fetch dynasty assets');
      const data = await response.json();
      return {
        assets: data.assets,
        summary: data.summary
      };
    } catch (error) {
      logger.error('Error fetching dynasty assets:', { error: error });
      return { assets: { players: [], picks: [] }, summary: null };
    }
  }

  /**
   * Get dynasty roster
   */
  async getDynastyRoster(leagueId: string): Promise<DynastyRoster> {
    try {
      const { assets } = await this.getTeamAssets(leagueId);
      
      const composition = {
        QB: assets.players.filter((p: any) => p.position === 'QB').length,
        RB: assets.players.filter((p: any) => p.position === 'RB').length,
        WR: assets.players.filter((p: any) => p.position === 'WR').length,
        TE: assets.players.filter((p: any) => p.position === 'TE').length
      };

      const totalValue = assets.players.reduce((sum: number, p: any) => sum + p.currentValue, 0) +
                        assets.picks.reduce((sum: number, p: any) => sum + p.currentValue, 0);

      return {
        players: assets.players,
        picks: assets.picks,
        totalValue,
        composition
      };
    } catch (error) {
      logger.error('Error fetching dynasty roster:', { error: error });
      return {
        players: [],
        picks: [],
        totalValue: 0,
        composition: { QB: 0, RB: 0, WR: 0, TE: 0 }
      };
    }
  }

  /**
   * Analyze roster
   */
  async analyzeRoster(leagueId: string): Promise<RosterAnalysis> {
    try {
      const roster = await this.getDynastyRoster(leagueId);
      const window = await this.getChampionshipWindow(leagueId);
      
      // Calculate age analysis
      const ages = roster.players.map(p => p.age);
      const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
      
      const ageDistribution: Record<string, number> = {
        'Under 23': roster.players.filter(p => p.age < 23).length,
        '23-25': roster.players.filter(p => p.age >= 23 && p.age <= 25).length,
        '26-28': roster.players.filter(p => p.age >= 26 && p.age <= 28).length,
        '29+': roster.players.filter(p => p.age >= 29).length
      };

      // Position depth
      const positionDepth = {
        QB: roster.composition.QB,
        RB: roster.composition.RB,
        WR: roster.composition.WR,
        TE: roster.composition.TE
      };

      // Calculate overall grade
      let grade = 'C';
      if (roster.totalValue > 800) grade = 'A';
      else if (roster.totalValue > 700) grade = 'B+';
      else if (roster.totalValue > 600) grade = 'B';
      else if (roster.totalValue > 500) grade = 'C+';
      else if (roster.totalValue > 400) grade = 'C';
      else grade = 'D';

      // Generate analysis
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      if (roster.composition.RB >= 4) strengths.push('Strong RB depth');
      if (roster.composition.RB < 3) weaknesses.push('Thin at RB position');
      if (roster.composition.WR >= 5) strengths.push('Excellent WR corps');
      if (roster.composition.WR < 4) weaknesses.push('Need more WR depth');
      if (avgAge < 26) strengths.push('Young roster with upside');
      if (avgAge > 28) weaknesses.push('Aging roster concerns');

      const recommendations = window?.recommendations || [
        'Consider your championship window when making roster decisions',
        'Balance youth with proven production',
        'Maintain positional depth for injury protection'
      ];

      return {
        overallGrade: grade,
        strengths,
        weaknesses,
        recommendations,
        ageAnalysis: {
          average: avgAge,
          distribution: ageDistribution
        },
        positionDepth,
        injuryRisk: roster.players.filter(p => p.injuryStatus).length / roster.players.length,
        futureOutlook: avgAge < 26 ? 'Bright' : avgAge < 28 ? 'Stable' : 'Declining'
      };
    } catch (error) {
      logger.error('Error analyzing roster:', { error: error });
      return {
        overallGrade: 'N/A',
        strengths: [],
        weaknesses: ['Unable to analyze roster'],
        recommendations: ['Check your league connection'],
        ageAnalysis: { average: 0, distribution: {} },
        positionDepth: {},
        injuryRisk: 0,
        futureOutlook: 'Unknown'
      };
    }
  }

  /**
   * Analyze trade
   */
  async analyzeTrade(
    leagueId: string,
    givePlayers: any[],
    givePickIds: string[],
    receivePlayers: any[],
    receivePickIds: string[]
  ) {
    try {
      const response = await fetch(`${this.baseUrl}/trade-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          givePlayers,
          givePickIds,
          receivePlayers,
          receivePickIds
        })
      });
      
      if (!response.ok) throw new Error('Failed to analyze trade');
      const data = await response.json();
      return data.analysis;
    } catch (error) {
      logger.error('Error analyzing trade:', { error: error });
      throw error;
    }
  }

  /**
   * Get team strategy
   */
  async getTeamStrategy(leagueId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/team-strategy?leagueId=${leagueId}`);
      if (!response.ok) throw new Error('Failed to fetch team strategy');
      const data = await response.json();
      return {
        strategy: data.strategy,
        recommendations: data.recommendations,
        teamComposition: data.teamComposition,
        actionItems: data.actionItems
      };
    } catch (error) {
      logger.error('Error fetching team strategy:', { error: error });
      return null;
    }
  }

  /**
   * Get rookie projections
   */
  async getRookieProjections(leagueId: string) {
    // Mock rookie data for now - would connect to real rookie evaluation service
    return [
      {
        id: 'rookie_1',
        name: 'Marvin Harrison Jr.',
        position: 'WR',
        college: 'Ohio State',
        projectedValue: 85,
        confidence: 0.8,
        athleticScore: 92,
        productionScore: 88,
        draftCapital: { round: 1, pick: 4 },
        comparison: 'A.J. Green',
        notes: 'Elite prospect with immediate impact potential'
      },
      {
        id: 'rookie_2',
        name: 'Bijan Robinson',
        position: 'RB',
        college: 'Texas',
        projectedValue: 90,
        confidence: 0.85,
        athleticScore: 94,
        productionScore: 91,
        draftCapital: { round: 1, pick: 8 },
        comparison: 'Saquon Barkley',
        notes: 'Generational RB talent'
      }
    ];
  }

  /**
   * Get contract projections
   */
  async getContractProjections(leagueId: string) {
    // Mock contract data - would connect to contract management service
    const roster = await this.getDynastyRoster(leagueId);
    const currentCap = roster.players.reduce((sum, p) => sum + (p.currentValue * 0.5), 0);
    
    return {
      salaryCap: 200,
      currentSpending: currentCap,
      projectedSpending: [currentCap, currentCap * 1.05, currentCap * 1.1],
      availableCap: 200 - currentCap,
      recommendations: [
        'Consider restructuring high-value veteran contracts',
        'Target young talent on rookie contracts',
        'Maintain 15-20% cap flexibility'
      ]
    };
  }

  /**
   * Get player projections
   */
  async getPlayerProjections(leagueId: string, playerId: string) {
    const roster = await this.getDynastyRoster(leagueId);
    const player = roster.players.find(p => p.id === playerId);
    
    if (!player) return null;

    return {
      player,
      projections: player.futureValue || [
        player.currentValue,
        player.currentValue * 0.95,
        player.currentValue * 0.9,
        player.currentValue * 0.85,
        player.currentValue * 0.8
      ],
      confidence: 0.75,
      factors: {
        age: player.age < 27 ? 'positive' : 'negative',
        position: ['RB', 'WR'].includes(player.position) ? 'volatile' : 'stable',
        team: 'neutral',
        injury: player.injuryStatus ? 'negative' : 'neutral'
      }
    };
  }
}

// Export singleton instance
export const dynastyStrategyService = new DynastyStrategyService();