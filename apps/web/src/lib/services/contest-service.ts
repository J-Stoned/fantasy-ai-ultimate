/**
 * Contest Service - Integration layer for contest data
 * 
 * This service provides contest data from various sources:
 * - Mock data for development
 * - Database integration (when available)
 * - External API integration (DraftKings, FanDuel)
 * - Contest selector service integration
 */

export interface Contest {
  id: string;
  name: string;
  sport: string;
  type: 'GPP' | '50/50' | 'H2H' | 'Tournament' | 'Satellite' | 'Multiplier';
  entryFee: number;
  prizePool: number;
  guaranteedPrizePool: number;
  entries: number;
  maxEntries: number;
  maxEntriesPerUser: number;
  startTime: Date;
  overlay: number;
  expectedValue: number;
  projectedROI: number;
  sharpRatio: number;
  entryVelocity: number;
  featured?: boolean;
  recommended?: boolean;
  platform?: 'draftkings' | 'fanduel' | 'yahoo';
}

export interface ContestFilters {
  sport?: string;
  type?: string;
  minFee?: number;
  maxFee?: number;
  minOverlay?: number;
  showRecommended?: boolean;
  search?: string;
  sortBy?: string;
  limit?: number;
}

export interface ContestStats {
  totalContests: number;
  totalPrizePool: number;
  positiveEVCount: number;
  highOverlayCount: number;
  featuredCount: number;
  recommendedCount: number;
  avgOverlay: number;
  avgROI: number;
}

class ContestService {
  private static instance: ContestService;
  
  private constructor() {}
  
  static getInstance(): ContestService {
    if (!ContestService.instance) {
      ContestService.instance = new ContestService();
    }
    return ContestService.instance;
  }

  /**
   * Fetch contests with optional filters
   */
  async getContests(filters: ContestFilters = {}): Promise<{
    contests: Contest[];
    stats: ContestStats;
  }> {
    // TODO: Replace with actual database/API call
    const contests = this.generateMockContests(100);
    
    // Apply filters
    let filteredContests = this.applyFilters(contests, filters);
    
    // Sort contests
    filteredContests = this.sortContests(filteredContests, filters.sortBy || 'overlay');
    
    // Apply limit
    if (filters.limit) {
      filteredContests = filteredContests.slice(0, filters.limit);
    }
    
    // Calculate stats
    const stats = this.calculateStats(filteredContests);
    
    return { contests: filteredContests, stats };
  }

  /**
   * Get a single contest by ID
   */
  async getContestById(id: string): Promise<Contest | null> {
    // TODO: Replace with actual database/API call
    const contests = this.generateMockContests(100);
    return contests.find(c => c.id === id) || null;
  }

  /**
   * Enter a contest
   */
  async enterContest(contestId: string, lineupId: string, entryCount: number = 1): Promise<{
    success: boolean;
    entryId?: string;
    error?: string;
  }> {
    // TODO: Implement actual contest entry logic
    // - Validate contest exists and is open
    // - Validate lineup
    // - Check user balance
    // - Create entry record
    // - Update contest entries count
    
    return {
      success: true,
      entryId: `entry-${Date.now()}`,
    };
  }

  /**
   * Get optimal contests based on EV and overlay
   */
  async getOptimalContests(budget: number, riskTolerance: 'low' | 'medium' | 'high' = 'medium'): Promise<Contest[]> {
    const allContests = await this.getContests();
    
    // Filter by budget
    let eligibleContests = allContests.contests.filter(c => c.entryFee <= budget);
    
    // Filter by risk tolerance
    switch (riskTolerance) {
      case 'low':
        eligibleContests = eligibleContests.filter(c => 
          c.type === '50/50' || c.type === 'H2H' || c.overlay > 10
        );
        break;
      case 'medium':
        eligibleContests = eligibleContests.filter(c => 
          c.overlay > 5 || c.projectedROI > 10
        );
        break;
      case 'high':
        // Include all contests for high risk tolerance
        break;
    }
    
    // Sort by expected value
    return eligibleContests.sort((a, b) => b.expectedValue - a.expectedValue).slice(0, 10);
  }

  private applyFilters(contests: Contest[], filters: ContestFilters): Contest[] {
    return contests.filter(contest => {
      if (filters.sport && filters.sport !== 'all' && contest.sport !== filters.sport) return false;
      if (filters.type && filters.type !== 'all' && contest.type !== filters.type) return false;
      if (filters.minFee !== undefined && contest.entryFee < filters.minFee) return false;
      if (filters.maxFee !== undefined && contest.entryFee > filters.maxFee) return false;
      if (filters.minOverlay !== undefined && contest.overlay < filters.minOverlay) return false;
      if (filters.showRecommended && !contest.recommended) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!contest.name.toLowerCase().includes(searchLower) &&
            !contest.sport.toLowerCase().includes(searchLower) &&
            !contest.type.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }

  private sortContests(contests: Contest[], sortBy: string): Contest[] {
    const sorted = [...contests];
    
    switch (sortBy) {
      case 'overlay':
        return sorted.sort((a, b) => b.overlay - a.overlay);
      case 'expectedValue':
        return sorted.sort((a, b) => b.expectedValue - a.expectedValue);
      case 'roi':
        return sorted.sort((a, b) => b.projectedROI - a.projectedROI);
      case 'prizePool':
        return sorted.sort((a, b) => b.guaranteedPrizePool - a.guaranteedPrizePool);
      case 'entryFee':
        return sorted.sort((a, b) => a.entryFee - b.entryFee);
      case 'startTime':
        return sorted.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      default:
        return sorted.sort((a, b) => b.overlay - a.overlay);
    }
  }

  private calculateStats(contests: Contest[]): ContestStats {
    return {
      totalContests: contests.length,
      totalPrizePool: contests.reduce((sum, c) => sum + c.guaranteedPrizePool, 0),
      positiveEVCount: contests.filter(c => c.overlay > 5).length,
      highOverlayCount: contests.filter(c => c.overlay > 10).length,
      featuredCount: contests.filter(c => c.featured).length,
      recommendedCount: contests.filter(c => c.recommended).length,
      avgOverlay: contests.reduce((sum, c) => sum + c.overlay, 0) / contests.length || 0,
      avgROI: contests.reduce((sum, c) => sum + c.projectedROI, 0) / contests.length || 0,
    };
  }

  private generateMockContests(count: number): Contest[] {
    const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'PGA', 'UFC'];
    const types: Contest['type'][] = ['GPP', '50/50', 'H2H', 'Tournament', 'Satellite', 'Multiplier'];
    const platforms: Contest['platform'][] = ['draftkings', 'fanduel', 'yahoo'];
    
    const contests: Contest[] = [];
    
    for (let i = 0; i < count; i++) {
      const sport = sports[Math.floor(Math.random() * sports.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const entryFee = [1, 3, 5, 10, 20, 50, 100, 250, 500][Math.floor(Math.random() * 9)];
      const guaranteedPrizePool = entryFee * (100 + Math.floor(Math.random() * 900));
      const maxEntries = [100, 500, 1000, 5000, 10000, 50000, 100000][Math.floor(Math.random() * 7)];
      const entries = Math.floor(maxEntries * (0.3 + Math.random() * 0.6));
      const currentPrizePool = entries * entryFee;
      const overlay = Math.max(0, (guaranteedPrizePool - currentPrizePool) / guaranteedPrizePool * 100);
      
      contests.push({
        id: `contest-${i + 1}`,
        name: `${sport} ${type === 'GPP' ? 'Millionaire Maker' : type} ${entryFee >= 100 ? 'High Roller' : ''}`.trim(),
        sport,
        type,
        entryFee,
        prizePool: currentPrizePool,
        guaranteedPrizePool,
        entries,
        maxEntries,
        maxEntriesPerUser: type === 'GPP' ? 150 : type === '50/50' ? 1 : 3,
        startTime: new Date(Date.now() + Math.random() * 86400000),
        overlay,
        expectedValue: overlay > 5 ? entryFee * (1 + overlay / 100) * 0.8 : entryFee * 0.95,
        projectedROI: overlay > 5 ? 15 + Math.random() * 25 : -5 + Math.random() * 15,
        sharpRatio: 0.5 + Math.random() * 2.5,
        entryVelocity: 10 + Math.random() * 90,
        featured: Math.random() > 0.9,
        recommended: overlay > 5 || Math.random() > 0.8,
        platform,
      });
    }
    
    return contests;
  }
}

export const contestService = ContestService.getInstance();