import { ContestEngine, ContestType, ContestDuration } from './ContestEngine';
import { prisma } from '../prisma';
import { cache } from '../cache/RedisCache';
import { supabase } from '../supabase/client';
import { defaultLogger } from '../utils/logger';

interface ContestTemplate {
  name: string;
  type: ContestType;
  duration: ContestDuration;
  entryFee: number;
  guaranteedPrizePool: number;
  maxEntries: number;
  sport: string;
  schedule: {
    dayOfWeek?: number; // 0-6 (Sunday-Saturday)
    hour: number; // 0-23
    minute: number; // 0-59
  };
}

export class ContestManager {
  private contestEngine: ContestEngine;
  private templates: Map<string, ContestTemplate> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.contestEngine = new ContestEngine();
    this.initializeTemplates();
  }

  async initialize() {
    defaultLogger.info('Initializing Contest Manager...');
    
    await this.contestEngine.initialize();
    await this.loadTemplates();
    await this.scheduleContests();
    
    defaultLogger.info('Contest Manager initialized successfully');
  }

  private initializeTemplates() {
    // NFL Daily Fantasy Templates
    this.templates.set('nfl_millionaire_maker', {
      name: 'NFL Millionaire Maker',
      type: 'gpp',
      duration: 'weekly',
      entryFee: 20,
      guaranteedPrizePool: 1000000,
      maxEntries: 150000,
      sport: 'nfl',
      schedule: { dayOfWeek: 0, hour: 10, minute: 0 }, // Sunday 10 AM
    });

    this.templates.set('nfl_mini_max', {
      name: 'NFL Mini-Max',
      type: 'gpp',
      duration: 'weekly',
      entryFee: 3,
      guaranteedPrizePool: 100000,
      maxEntries: 50000,
      sport: 'nfl',
      schedule: { dayOfWeek: 0, hour: 11, minute: 0 },
    });

    this.templates.set('nfl_cash_double_up', {
      name: 'NFL Double Up',
      type: 'cash',
      duration: 'weekly',
      entryFee: 10,
      guaranteedPrizePool: 0, // Dynamic based on entries
      maxEntries: 10000,
      sport: 'nfl',
      schedule: { dayOfWeek: 0, hour: 12, minute: 0 },
    });

    this.templates.set('nfl_primetime', {
      name: 'NFL Primetime Showdown',
      type: 'gpp',
      duration: 'daily',
      entryFee: 5,
      guaranteedPrizePool: 25000,
      maxEntries: 10000,
      sport: 'nfl',
      schedule: { dayOfWeek: 1, hour: 17, minute: 0 }, // Monday 5 PM
    });

    // NBA Daily Templates
    this.templates.set('nba_slam_dunk', {
      name: 'NBA Slam Dunk',
      type: 'gpp',
      duration: 'daily',
      entryFee: 10,
      guaranteedPrizePool: 50000,
      maxEntries: 20000,
      sport: 'nba',
      schedule: { hour: 17, minute: 0 }, // Daily at 5 PM
    });

    this.templates.set('nba_triple_double', {
      name: 'NBA Triple Double',
      type: 'gpp',
      duration: 'daily',
      entryFee: 33,
      guaranteedPrizePool: 100000,
      maxEntries: 10000,
      sport: 'nba',
      schedule: { hour: 18, minute: 0 },
    });

    // MLB Daily Templates
    this.templates.set('mlb_grand_slam', {
      name: 'MLB Grand Slam',
      type: 'gpp',
      duration: 'daily',
      entryFee: 5,
      guaranteedPrizePool: 25000,
      maxEntries: 15000,
      sport: 'mlb',
      schedule: { hour: 16, minute: 0 },
    });

    // NHL Daily Templates
    this.templates.set('nhl_hat_trick', {
      name: 'NHL Hat Trick',
      type: 'gpp',
      duration: 'daily',
      entryFee: 10,
      guaranteedPrizePool: 30000,
      maxEntries: 10000,
      sport: 'nhl',
      schedule: { hour: 17, minute: 30 },
    });

    // Head-to-Head Templates
    this.templates.set('h2h_high_stakes', {
      name: 'Head-to-Head High Stakes',
      type: 'h2h',
      duration: 'daily',
      entryFee: 100,
      guaranteedPrizePool: 0,
      maxEntries: 2,
      sport: 'all',
      schedule: { hour: 12, minute: 0 },
    });

    // Satellite/Qualifier Templates
    this.templates.set('satellite_to_millionaire', {
      name: 'Satellite to Millionaire Maker',
      type: 'satellite',
      duration: 'daily',
      entryFee: 3,
      guaranteedPrizePool: 0, // Tickets to main event
      maxEntries: 1000,
      sport: 'nfl',
      schedule: { dayOfWeek: 6, hour: 20, minute: 0 }, // Saturday 8 PM
    });
  }

  private async loadTemplates() {
    // Load custom templates from database
    const customTemplates = await prisma.contestTemplate.findMany({
      where: { is_active: true },
    });

    customTemplates.forEach(template => {
      this.templates.set(template.id, template as any);
    });
  }

  private async scheduleContests() {
    // Schedule recurring contests based on templates
    for (const [templateId, template] of this.templates) {
      this.scheduleTemplate(templateId, template);
    }
  }

  private scheduleTemplate(templateId: string, template: ContestTemplate) {
    const now = new Date();
    let nextRun = new Date();

    if (template.schedule.dayOfWeek !== undefined) {
      // Weekly contest
      const daysUntilNext = (template.schedule.dayOfWeek - now.getDay() + 7) % 7 || 7;
      nextRun.setDate(now.getDate() + daysUntilNext);
    }

    nextRun.setHours(template.schedule.hour, template.schedule.minute, 0, 0);

    if (nextRun <= now) {
      // If scheduled time has passed today, schedule for next occurrence
      if (template.schedule.dayOfWeek !== undefined) {
        nextRun.setDate(nextRun.getDate() + 7);
      } else {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }

    const delay = nextRun.getTime() - now.getTime();

    const job = setTimeout(async () => {
      await this.createContestFromTemplate(template);
      
      // Reschedule for next occurrence
      if (template.duration === 'daily') {
        this.scheduleTemplate(templateId, template);
      } else if (template.duration === 'weekly') {
        this.scheduleTemplate(templateId, template);
      }
    }, delay);

    this.scheduledJobs.set(templateId, job);
    
    defaultLogger.info('Scheduled contest template', { templateName: template.name, nextRun: nextRun.toISOString() });
  }

  private async createContestFromTemplate(template: ContestTemplate) {
    try {
      // Get games for the contest period
      const games = await this.getGamesForContest(template);
      
      if (games.length === 0) {
        defaultLogger.info('No games available for contest template, skipping creation', { templateName: template.name });
        return;
      }

      // Calculate start and end times
      const startTime = this.calculateStartTime(games);
      const endTime = this.calculateEndTime(games);

      // Create contest
      const contest = await this.contestEngine.createContest({
        name: `${template.name} - ${startTime.toLocaleDateString()}`,
        type: template.type,
        duration: template.duration,
        sport: template.sport,
        entryFee: template.entryFee,
        guaranteedPrizePool: template.guaranteedPrizePool,
        maxEntries: template.maxEntries,
        startTime,
        endTime,
        games: games.map(g => g.id),
      });

      defaultLogger.info('Contest created successfully', { contestName: contest.name, contestId: contest.id });

      // Notify users about new contest
      await this.notifyNewContest(contest);
    } catch (error) {
      defaultLogger.error('Failed to create contest from template', { templateName: template.name, error });
    }
  }

  private async getGamesForContest(template: ContestTemplate): Promise<any[]> {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (template.duration === 'daily') {
      // Get games for today
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (template.duration === 'weekly') {
      // Get games for the week
      if (template.sport === 'nfl') {
        // NFL week runs Thursday to Monday
        const daysUntilThursday = (4 - now.getDay() + 7) % 7;
        startDate.setDate(now.getDate() + daysUntilThursday);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 4); // Through Monday
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Other sports: current week
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const games = await prisma.game.findMany({
      where: {
        sport: template.sport === 'all' ? undefined : template.sport,
        start_time: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { start_time: 'asc' },
    });

    return games;
  }

  private calculateStartTime(games: any[]): Date {
    // Contest starts 5 minutes before first game
    const firstGame = games[0];
    const startTime = new Date(firstGame.start_time);
    startTime.setMinutes(startTime.getMinutes() - 5);
    return startTime;
  }

  private calculateEndTime(games: any[]): Date {
    // Contest ends when last game ends (estimated 3.5 hours for NFL)
    const lastGame = games[games.length - 1];
    const endTime = new Date(lastGame.start_time);
    endTime.setHours(endTime.getHours() + 3.5);
    return endTime;
  }

  private async notifyNewContest(contest: any) {
    // Send push notifications to users
    const users = await prisma.user.findMany({
      where: {
        notification_preferences: {
          path: ['new_contests'],
          equals: true,
        },
      },
    });

    for (const user of users) {
      await this.sendContestNotification(user, contest);
    }

    // Broadcast to real-time subscribers
    supabase.channel('contest_updates')
      .send({
        type: 'broadcast',
        event: 'new_contest',
        payload: contest,
      });
  }

  private async sendContestNotification(user: any, contest: any) {
    // In production, integrate with push notification service
    defaultLogger.info('Notifying user about contest', { userEmail: user.email, contestName: contest.name });
  }

  // Manual contest creation
  async createCustomContest(params: {
    name: string;
    type: ContestType;
    sport: string;
    entryFee: number;
    prizePool: number;
    maxEntries: number;
    startTime: Date;
    games: string[];
  }): Promise<any> {
    const endTime = new Date(params.startTime);
    endTime.setHours(endTime.getHours() + 4); // Default 4 hour duration

    return this.contestEngine.createContest({
      name: params.name,
      type: params.type,
      duration: 'daily',
      sport: params.sport,
      entryFee: params.entryFee,
      guaranteedPrizePool: params.prizePool,
      maxEntries: params.maxEntries,
      startTime: params.startTime,
      endTime,
      games: params.games,
    });
  }

  // Get upcoming contests by sport
  async getUpcomingContests(sport?: string): Promise<any[]> {
    return this.contestEngine.getAvailableContests({ sport });
  }

  // Get contest recommendations for user
  async getRecommendedContests(userId: string): Promise<any[]> {
    // Get user preferences and history
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        contest_entries: {
          where: { status: 'completed' },
          orderBy: { created_at: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) return [];

    // Analyze user patterns
    const entryFees = user.contest_entries.map((e: any) => e.contest.entry_fee);
    const avgEntryFee = entryFees.reduce((a, b) => a + b, 0) / entryFees.length || 10;
    
    const sports = user.contest_entries.map((e: any) => e.contest.sport);
    const favoriteSport = this.mode(sports) || 'nfl';

    // Get recommended contests
    const contests = await this.contestEngine.getAvailableContests({
      sport: favoriteSport,
      entryFee: {
        min: avgEntryFee * 0.5,
        max: avgEntryFee * 2,
      },
    });

    // Sort by relevance
    return contests.slice(0, 10);
  }

  private mode(arr: any[]): any {
    const counts = new Map();
    let maxCount = 0;
    let mode = null;

    for (const item of arr) {
      const count = (counts.get(item) || 0) + 1;
      counts.set(item, count);
      
      if (count > maxCount) {
        maxCount = count;
        mode = item;
      }
    }

    return mode;
  }

  // Live contest monitoring
  async startContestMonitoring(contestId: string) {
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest || contest.status !== 'upcoming') return;

    // Wait for start time
    const now = Date.now();
    const startTime = new Date(contest.start_time).getTime();
    const delay = Math.max(0, startTime - now);

    setTimeout(async () => {
      // Update contest to live
      await prisma.contest.update({
        where: { id: contestId },
        data: { status: 'live' },
      });

      defaultLogger.info('Contest is now LIVE!', { contestName: contest.name, contestId: contest.id });

      // Start live scoring
      this.monitorLiveScoring(contestId);
    }, delay);
  }

  private async monitorLiveScoring(contestId: string) {
    // Monitor game completion
    const checkInterval = setInterval(async () => {
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        include: { games: true },
      });

      if (!contest) {
        clearInterval(checkInterval);
        return;
      }

      // Check if all games are complete
      const allGamesComplete = contest.games.every((g: any) => g.status === 'completed');

      if (allGamesComplete) {
        clearInterval(checkInterval);
        await this.contestEngine.completeContest(contestId);
      }
    }, 60000); // Check every minute
  }

  // Cleanup
  async shutdown() {
    // Clear scheduled jobs
    for (const job of this.scheduledJobs.values()) {
      clearTimeout(job);
    }
    this.scheduledJobs.clear();
  }
}