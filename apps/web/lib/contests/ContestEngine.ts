import { prisma } from '../prisma';
import { cache } from '../cache/RedisCache';
import { supabase } from '../supabase/client';
import { defaultLogger } from '../utils/logger';

export type ContestType = 'gpp' | 'cash' | 'h2h' | 'league' | 'satellite' | 'qualifier';
export type ContestDuration = 'daily' | 'weekly' | 'season';
export type EntryType = 'single' | 'multi' | 'unlimited';
export type ScoringSystem = 'ppr' | 'half_ppr' | 'standard' | 'custom';

interface ContestConfig {
  id: string;
  name: string;
  type: ContestType;
  duration: ContestDuration;
  sport: string;
  entryFee: number;
  guaranteedPrizePool: number;
  maxEntries: number;
  entryType: EntryType;
  maxEntriesPerUser?: number;
  scoringSystem: ScoringSystem;
  salaryCap?: number;
  rosterRequirements: {
    [position: string]: number;
  };
  startTime: Date;
  endTime: Date;
  games: string[]; // Game IDs included
  payoutStructure: PayoutTier[];
  rules: ContestRule[];
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
}

interface PayoutTier {
  minPlace: number;
  maxPlace: number;
  payoutAmount: number;
  payoutType: 'fixed' | 'percentage';
}

interface ContestRule {
  type: 'lineup_lock' | 'late_swap' | 'multiplier' | 'bonus';
  value: any;
  description: string;
}

interface ContestEntry {
  id: string;
  contestId: string;
  userId: string;
  lineup: LineupPlayer[];
  entryTime: Date;
  rank?: number;
  points?: number;
  winnings?: number;
  status: 'pending' | 'live' | 'completed';
}

interface LineupPlayer {
  playerId: string;
  position: string;
  salary?: number;
  multiplier?: number;
}

export class ContestEngine {
  private activeContests: Map<string, ContestConfig> = new Map();
  private liveScoring: Map<string, Map<string, number>> = new Map();

  async initialize() {
    defaultLogger.info('Initializing Contest Engine...');
    
    // Load active contests
    await this.loadActiveContests();
    
    // Set up real-time subscriptions
    this.setupRealtimeSubscriptions();
    
    defaultLogger.info('Contest Engine initialized successfully');
  }

  private async loadActiveContests() {
    const contests = await prisma.contest.findMany({
      where: {
        status: { in: ['upcoming', 'live'] },
      },
    });

    contests.forEach(contest => {
      this.activeContests.set(contest.id, contest as any);
    });
  }

  private setupRealtimeSubscriptions() {
    // Subscribe to score updates
    supabase
      .channel('contest_scores')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_stats',
      }, (payload) => {
        this.handleScoreUpdate(payload);
      })
      .subscribe();
  }

  // Create a new contest
  async createContest(config: Partial<ContestConfig>): Promise<ContestConfig> {
    const contest: ContestConfig = {
      id: this.generateContestId(),
      name: config.name || 'Daily Fantasy Contest',
      type: config.type || 'gpp',
      duration: config.duration || 'daily',
      sport: config.sport || 'nfl',
      entryFee: config.entryFee || 0,
      guaranteedPrizePool: config.guaranteedPrizePool || 0,
      maxEntries: config.maxEntries || 100000,
      entryType: config.entryType || 'multi',
      maxEntriesPerUser: config.maxEntriesPerUser || 150,
      scoringSystem: config.scoringSystem || 'ppr',
      salaryCap: config.salaryCap || 50000,
      rosterRequirements: config.rosterRequirements || this.getDefaultRosterRequirements(config.sport || 'nfl'),
      startTime: config.startTime || new Date(),
      endTime: config.endTime || new Date(),
      games: config.games || [],
      payoutStructure: config.payoutStructure || this.generatePayoutStructure(
        config.guaranteedPrizePool || 0,
        config.maxEntries || 100
      ),
      rules: config.rules || this.getDefaultRules(config.type || 'gpp'),
      status: 'upcoming',
    };

    // Save to database
    await prisma.contest.create({
      data: contest as any,
    });

    // Cache contest
    this.activeContests.set(contest.id, contest);
    await cache.set(`contest:${contest.id}`, contest, 3600);

    // Notify users
    await this.notifyContestCreated(contest);

    return contest;
  }

  private generateContestId(): string {
    return `contest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultRosterRequirements(sport: string): Record<string, number> {
    const requirements: Record<string, Record<string, number>> = {
      nfl: {
        QB: 1,
        RB: 2,
        WR: 3,
        TE: 1,
        FLEX: 1,
        DST: 1,
      },
      nba: {
        PG: 1,
        SG: 1,
        SF: 1,
        PF: 1,
        C: 1,
        G: 1,
        F: 1,
        UTIL: 1,
      },
      mlb: {
        P: 2,
        C: 1,
        '1B': 1,
        '2B': 1,
        '3B': 1,
        SS: 1,
        OF: 3,
      },
      nhl: {
        C: 2,
        W: 3,
        D: 2,
        G: 1,
        UTIL: 1,
      },
    };

    return requirements[sport] || requirements.nfl;
  }

  private generatePayoutStructure(prizePool: number, maxEntries: number): PayoutTier[] {
    const payouts: PayoutTier[] = [];
    
    if (prizePool === 0) return payouts;

    // Standard GPP payout structure
    const payoutPercentages = [
      { places: 1, percent: 0.20 },
      { places: 1, percent: 0.12 },
      { places: 1, percent: 0.08 },
      { places: 2, percent: 0.05 },
      { places: 5, percent: 0.03 },
      { places: 10, percent: 0.02 },
      { places: 20, percent: 0.01 },
      { places: 50, percent: 0.005 },
      { places: 100, percent: 0.002 },
    ];

    let currentPlace = 1;
    let remainingPool = prizePool;

    for (const tier of payoutPercentages) {
      if (currentPlace > maxEntries * 0.2) break; // Top 20% cash
      
      const payoutAmount = Math.floor(prizePool * tier.percent);
      payouts.push({
        minPlace: currentPlace,
        maxPlace: currentPlace + tier.places - 1,
        payoutAmount,
        payoutType: 'fixed',
      });
      
      currentPlace += tier.places;
      remainingPool -= payoutAmount * tier.places;
    }

    return payouts;
  }

  private getDefaultRules(type: ContestType): ContestRule[] {
    const rules: ContestRule[] = [
      {
        type: 'lineup_lock',
        value: 'first_game_start',
        description: 'Lineups lock at the start of the first game',
      },
    ];

    if (type === 'gpp' || type === 'cash') {
      rules.push({
        type: 'late_swap',
        value: true,
        description: 'Late swap available for players whose games haven\'t started',
      });
    }

    return rules;
  }

  // Enter a contest
  async enterContest(
    contestId: string,
    userId: string,
    lineup: LineupPlayer[]
  ): Promise<ContestEntry> {
    const contest = this.activeContests.get(contestId);
    if (!contest) {
      throw new Error('Contest not found');
    }

    // Validate entry
    await this.validateEntry(contest, userId, lineup);

    // Create entry
    const entry: ContestEntry = {
      id: this.generateEntryId(),
      contestId,
      userId,
      lineup,
      entryTime: new Date(),
      status: 'pending',
    };

    // Save to database
    await prisma.contestEntry.create({
      data: entry as any,
    });

    // Update contest metrics
    await this.updateContestMetrics(contestId);

    // Process payment
    if (contest.entryFee > 0) {
      await this.processEntryPayment(userId, contest.entryFee);
    }

    return entry;
  }

  private generateEntryId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async validateEntry(
    contest: ContestConfig,
    userId: string,
    lineup: LineupPlayer[]
  ): Promise<void> {
    // Check contest status
    if (contest.status !== 'upcoming') {
      throw new Error('Contest is not accepting entries');
    }

    // Check entry limit
    const userEntries = await prisma.contestEntry.count({
      where: {
        contest_id: contest.id,
        user_id: userId,
      },
    });

    if (contest.maxEntriesPerUser && userEntries >= contest.maxEntriesPerUser) {
      throw new Error('Maximum entries reached for this contest');
    }

    // Validate roster requirements
    const positionCounts = new Map<string, number>();
    lineup.forEach(player => {
      positionCounts.set(player.position, (positionCounts.get(player.position) || 0) + 1);
    });

    for (const [position, required] of Object.entries(contest.rosterRequirements)) {
      if ((positionCounts.get(position) || 0) !== required) {
        throw new Error(`Invalid lineup: ${position} requirement not met`);
      }
    }

    // Validate salary cap
    if (contest.salaryCap) {
      const totalSalary = lineup.reduce((sum, player) => sum + (player.salary || 0), 0);
      if (totalSalary > contest.salaryCap) {
        throw new Error(`Salary cap exceeded: ${totalSalary} > ${contest.salaryCap}`);
      }
    }

    // Validate players are from included games
    const playerGames = await this.getPlayerGames(lineup.map(p => p.playerId));
    const validGames = new Set(contest.games);
    
    for (const game of playerGames) {
      if (!validGames.has(game)) {
        throw new Error('Invalid player: not from included games');
      }
    }
  }

  private async getPlayerGames(playerIds: string[]): Promise<string[]> {
    // Query player games
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: { team: true },
    });

    // Return game IDs
    return players.map(p => p.team?.current_game_id || '').filter(Boolean);
  }

  private async updateContestMetrics(contestId: string) {
    const entryCount = await prisma.contestEntry.count({
      where: { contest_id: contestId },
    });

    await prisma.contest.update({
      where: { id: contestId },
      data: {
        current_entries: entryCount,
        updated_at: new Date(),
      },
    });
  }

  private async processEntryPayment(userId: string, entryFee: number) {
    // In production, integrate with payment processor
    defaultLogger.info('Processing payment', { entryFee, userId });
  }

  // Live scoring
  private async handleScoreUpdate(payload: any) {
    const { player_id, fantasy_points } = payload.new;
    
    // Update all live contests
    for (const [contestId, contest] of this.activeContests) {
      if (contest.status === 'live') {
        await this.updateContestScores(contestId, player_id, fantasy_points);
      }
    }
  }

  private async updateContestScores(
    contestId: string,
    playerId: string,
    points: number
  ) {
    // Get or create scoring map for contest
    if (!this.liveScoring.has(contestId)) {
      this.liveScoring.set(contestId, new Map());
    }
    
    const contestScores = this.liveScoring.get(contestId)!;
    contestScores.set(playerId, points);

    // Update all entries with this player
    const entries = await prisma.contestEntry.findMany({
      where: {
        contest_id: contestId,
        status: 'live',
      },
    });

    for (const entry of entries) {
      const lineup = entry.lineup as LineupPlayer[];
      const hasPlayer = lineup.some(p => p.playerId === playerId);
      
      if (hasPlayer) {
        const totalPoints = this.calculateEntryPoints(lineup, contestScores);
        
        await prisma.contestEntry.update({
          where: { id: entry.id },
          data: {
            points: totalPoints,
            updated_at: new Date(),
          },
        });
      }
    }

    // Update rankings
    await this.updateContestRankings(contestId);
  }

  private calculateEntryPoints(
    lineup: LineupPlayer[],
    scores: Map<string, number>
  ): number {
    return lineup.reduce((total, player) => {
      const points = scores.get(player.playerId) || 0;
      const multiplier = player.multiplier || 1;
      return total + (points * multiplier);
    }, 0);
  }

  private async updateContestRankings(contestId: string) {
    // Get all entries sorted by points
    const entries = await prisma.contestEntry.findMany({
      where: { contest_id: contestId },
      orderBy: { points: 'desc' },
    });

    // Update ranks
    let currentRank = 1;
    let previousPoints = -1;
    let tieCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      if (entry.points === previousPoints) {
        tieCount++;
      } else {
        currentRank = i + 1;
        tieCount = 0;
      }
      
      await prisma.contestEntry.update({
        where: { id: entry.id },
        data: { rank: currentRank - tieCount },
      });
      
      previousPoints = entry.points || 0;
    }

    // Broadcast leaderboard update
    await this.broadcastLeaderboardUpdate(contestId);
  }

  private async broadcastLeaderboardUpdate(contestId: string) {
    const leaderboard = await this.getLeaderboard(contestId, 10);
    
    supabase.channel(`contest_${contestId}`)
      .send({
        type: 'broadcast',
        event: 'leaderboard_update',
        payload: leaderboard,
      });
  }

  // Get contest leaderboard
  async getLeaderboard(contestId: string, limit: number = 50): Promise<any[]> {
    const cacheKey = `leaderboard:${contestId}`;
    const cached = await cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const entries = await prisma.contestEntry.findMany({
      where: { contest_id: contestId },
      orderBy: { points: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });

    const leaderboard = entries.map((entry, index) => ({
      rank: entry.rank || index + 1,
      userId: entry.user_id,
      username: entry.user?.username || 'Unknown',
      avatar: entry.user?.avatar_url,
      points: entry.points || 0,
      lineup: entry.lineup,
      winnings: this.calculateWinnings(contestId, entry.rank || index + 1),
    }));

    await cache.set(cacheKey, leaderboard, 30); // 30 second cache
    return leaderboard;
  }

  private calculateWinnings(contestId: string, rank: number): number {
    const contest = this.activeContests.get(contestId);
    if (!contest) return 0;

    const payout = contest.payoutStructure.find(
      p => rank >= p.minPlace && rank <= p.maxPlace
    );

    return payout?.payoutAmount || 0;
  }

  // Complete contest and pay out
  async completeContest(contestId: string) {
    const contest = this.activeContests.get(contestId);
    if (!contest) return;

    defaultLogger.info('Completing contest', { contestName: contest.name, contestId });

    // Final scoring update
    await this.finalizeScoring(contestId);

    // Process payouts
    await this.processPayouts(contestId);

    // Update contest status
    await prisma.contest.update({
      where: { id: contestId },
      data: {
        status: 'completed',
        completed_at: new Date(),
      },
    });

    // Remove from active contests
    this.activeContests.delete(contestId);
    this.liveScoring.delete(contestId);

    // Notify winners
    await this.notifyWinners(contestId);
  }

  private async finalizeScoring(contestId: string) {
    // Ensure all scores are final
    const contest = this.activeContests.get(contestId);
    if (!contest) return;

    // Get final stats for all players in contest games
    const finalStats = await prisma.playerStat.findMany({
      where: {
        game_id: { in: contest.games },
        week: this.getWeekNumber(contest.startTime),
      },
    });

    // Update all entry scores one final time
    const entries = await prisma.contestEntry.findMany({
      where: { contest_id: contestId },
    });

    for (const entry of entries) {
      const lineup = entry.lineup as LineupPlayer[];
      let totalPoints = 0;

      for (const player of lineup) {
        const stat = finalStats.find(s => s.player_id === player.playerId);
        if (stat) {
          const points = this.calculateFantasyPoints(stat, contest.scoringSystem);
          totalPoints += points * (player.multiplier || 1);
        }
      }

      await prisma.contestEntry.update({
        where: { id: entry.id },
        data: {
          points: totalPoints,
          status: 'completed',
        },
      });
    }

    // Final ranking update
    await this.updateContestRankings(contestId);
  }

  private getWeekNumber(date: Date): number {
    // Calculate NFL week number
    const seasonStart = new Date(date.getFullYear(), 8, 1); // September 1
    const weeksSinceStart = Math.floor((date.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(1, weeksSinceStart), 17);
  }

  private calculateFantasyPoints(stat: any, scoringSystem: ScoringSystem): number {
    let points = 0;
    
    const scoring = this.getScoringSettings(scoringSystem);
    
    // Passing
    points += (stat.passing_yards || 0) * scoring.passingYard;
    points += (stat.passing_touchdowns || 0) * scoring.passingTD;
    points += (stat.interceptions || 0) * scoring.interception;
    
    // Rushing
    points += (stat.rushing_yards || 0) * scoring.rushingYard;
    points += (stat.rushing_touchdowns || 0) * scoring.rushingTD;
    
    // Receiving
    points += (stat.receptions || 0) * scoring.reception;
    points += (stat.receiving_yards || 0) * scoring.receivingYard;
    points += (stat.receiving_touchdowns || 0) * scoring.receivingTD;
    
    // Bonuses
    if (stat.passing_yards >= 300) points += scoring.bonus300PassYards;
    if (stat.rushing_yards >= 100) points += scoring.bonus100RushYards;
    if (stat.receiving_yards >= 100) points += scoring.bonus100RecYards;
    
    return points;
  }

  private getScoringSettings(system: ScoringSystem): any {
    const settings = {
      ppr: {
        passingYard: 0.04,
        passingTD: 4,
        interception: -2,
        rushingYard: 0.1,
        rushingTD: 6,
        reception: 1,
        receivingYard: 0.1,
        receivingTD: 6,
        bonus300PassYards: 3,
        bonus100RushYards: 3,
        bonus100RecYards: 3,
      },
      half_ppr: {
        passingYard: 0.04,
        passingTD: 4,
        interception: -2,
        rushingYard: 0.1,
        rushingTD: 6,
        reception: 0.5,
        receivingYard: 0.1,
        receivingTD: 6,
        bonus300PassYards: 3,
        bonus100RushYards: 3,
        bonus100RecYards: 3,
      },
      standard: {
        passingYard: 0.04,
        passingTD: 4,
        interception: -2,
        rushingYard: 0.1,
        rushingTD: 6,
        reception: 0,
        receivingYard: 0.1,
        receivingTD: 6,
        bonus300PassYards: 3,
        bonus100RushYards: 3,
        bonus100RecYards: 3,
      },
      custom: {}, // Would be loaded from contest config
    };

    return settings[system] || settings.ppr;
  }

  private async processPayouts(contestId: string) {
    const contest = this.activeContests.get(contestId);
    if (!contest) return;

    const winners = await prisma.contestEntry.findMany({
      where: {
        contest_id: contestId,
        rank: { lte: Math.max(...contest.payoutStructure.map(p => p.maxPlace)) },
      },
      include: { user: true },
    });

    for (const winner of winners) {
      const winnings = this.calculateWinnings(contestId, winner.rank || 0);
      
      if (winnings > 0) {
        // Process payout
        await this.processPayout(winner.user_id, winnings);
        
        // Update entry with winnings
        await prisma.contestEntry.update({
          where: { id: winner.id },
          data: { winnings },
        });
        
        // Record transaction
        await prisma.transaction.create({
          data: {
            user_id: winner.user_id,
            type: 'contest_win',
            amount: winnings,
            contest_id: contestId,
            status: 'completed',
          },
        });
      }
    }
  }

  private async processPayout(userId: string, amount: number) {
    // In production, integrate with payment processor
    defaultLogger.info('Processing payout', { amount, userId });
  }

  private async notifyContestCreated(contest: ContestConfig) {
    // Notify users about new contest
    defaultLogger.info('Broadcasting new contest announcement', { contestName: contest.name });
  }

  private async notifyWinners(contestId: string) {
    // Send notifications to winners
    defaultLogger.info('Notifying contest winners', { contestId });
  }

  // Get available contests
  async getAvailableContests(filters?: {
    sport?: string;
    type?: ContestType;
    entryFee?: { min: number; max: number };
  }): Promise<ContestConfig[]> {
    let contests = Array.from(this.activeContests.values());

    if (filters) {
      if (filters.sport) {
        contests = contests.filter(c => c.sport === filters.sport);
      }
      if (filters.type) {
        contests = contests.filter(c => c.type === filters.type);
      }
      if (filters.entryFee) {
        contests = contests.filter(c => 
          c.entryFee >= filters.entryFee!.min && 
          c.entryFee <= filters.entryFee!.max
        );
      }
    }

    return contests.filter(c => c.status === 'upcoming');
  }

  // Get user's contest history
  async getUserContests(userId: string, status?: string): Promise<any[]> {
    const entries = await prisma.contestEntry.findMany({
      where: {
        user_id: userId,
        ...(status && { status }),
      },
      include: {
        contest: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return entries.map(entry => ({
      ...entry,
      contest: this.activeContests.get(entry.contest_id) || entry.contest,
    }));
  }
}