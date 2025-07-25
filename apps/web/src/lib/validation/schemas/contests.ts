import { z } from 'zod';
import { uuidSchema, moneySchema, sportSchema, platformSchema, contestTypeSchema } from './common';

// Contest and lineup validation schemas

// Player selection for lineups
export const playerSelectionSchema = z.object({
  playerId: z.string().max(100),
  position: z.string().max(10),
  salary: z.number().int().positive().max(100000),
  projectedPoints: z.number().min(0).max(1000).finite().optional(),
  ownership: z.number().min(0).max(100).finite().optional(),
});

// DFS lineup validation
export const lineupSchema = z.object({
  sport: sportSchema,
  contestId: z.string().max(100),
  players: z.array(playerSelectionSchema).min(1).max(20),
  totalSalary: z.number().int().positive(),
  salaryCap: z.number().int().positive(),
  isValid: z.boolean().optional(),
}).refine(
  (data) => data.totalSalary <= data.salaryCap,
  {
    message: 'Lineup exceeds salary cap',
    path: ['totalSalary'],
  }
);

// Contest search/filter
export const contestSearchSchema = z.object({
  sport: sportSchema.optional(),
  platform: platformSchema.optional(),
  contestType: contestTypeSchema.optional(),
  minEntryFee: moneySchema.optional(),
  maxEntryFee: moneySchema.optional(),
  minPrizePool: moneySchema.optional(),
  maxPrizePool: moneySchema.optional(),
  minEntries: z.number().int().positive().optional(),
  maxEntries: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  guaranteed: z.boolean().optional(),
  multiEntry: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Optimal lineup request
export const optimalLineupRequestSchema = z.object({
  sport: sportSchema,
  contestId: z.string().max(100),
  salaryCap: z.number().int().positive(),
  optimizationStrategy: z.enum(['balanced', 'ceiling', 'floor', 'contrarian']).optional(),
  lockedPlayers: z.array(z.string().max(100)).max(8).optional(),
  excludedPlayers: z.array(z.string().max(100)).max(50).optional(),
  maxExposure: z.number().min(0).max(100).optional(),
  minProjectedPoints: z.number().min(0).optional(),
  stackRules: z.object({
    qbStack: z.boolean().optional(),
    teamStacks: z.array(z.object({
      team: z.string().max(10),
      minPlayers: z.number().int().min(1).max(5),
      maxPlayers: z.number().int().min(1).max(5),
    })).max(10).optional(),
    gameStacks: z.array(z.object({
      gameId: z.string().max(100),
      minPlayers: z.number().int().min(2).max(8),
    })).max(10).optional(),
  }).optional(),
});

// Multiple lineup generation
export const multiLineupRequestSchema = optimalLineupRequestSchema.extend({
  numberOfLineups: z.number().int().min(1).max(150),
  diversitySettings: z.object({
    minUniquePlayers: z.number().int().min(1).max(20).optional(),
    maxPlayerExposure: z.number().min(0).max(100).optional(),
    correlationRules: z.boolean().optional(),
  }).optional(),
});

// Contest entry submission
export const contestEntrySubmissionSchema = z.object({
  userId: uuidSchema,
  contestId: z.string().max(100),
  lineups: z.array(lineupSchema).min(1).max(150),
  entryFee: moneySchema,
  platform: platformSchema,
  confirmBankrollCheck: z.boolean().default(true),
});

// Player pool request
export const playerPoolRequestSchema = z.object({
  sport: sportSchema,
  platform: platformSchema,
  contestId: z.string().max(100).optional(),
  slate: z.string().max(50).optional(),
  includeInjured: z.boolean().default(false),
  includeProjections: z.boolean().default(true),
  includeOwnership: z.boolean().default(true),
});

// Stack validation
export const stackValidationSchema = z.object({
  sport: sportSchema,
  lineup: z.array(playerSelectionSchema),
  stackType: z.enum(['qb_pass_catcher', 'team', 'game', 'mini']),
  requirements: z.object({
    minPlayers: z.number().int().min(1).max(8),
    maxPlayers: z.number().int().min(1).max(8).optional(),
    teams: z.array(z.string().max(10)).optional(),
    positions: z.array(z.string().max(10)).optional(),
  }),
});

// Contest results query
export const contestResultsQuerySchema = z.object({
  userId: uuidSchema.optional(),
  contestId: z.string().max(100).optional(),
  platform: platformSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minPayout: moneySchema.optional(),
  onlyWins: z.boolean().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
});

// Ownership projections
export const ownershipProjectionSchema = z.object({
  sport: sportSchema,
  contestType: contestTypeSchema,
  slate: z.string().max(50),
  fieldSize: z.enum(['small', 'medium', 'large']).optional(),
});

export type LineupInput = z.infer<typeof lineupSchema>;
export type ContestSearchInput = z.infer<typeof contestSearchSchema>;
export type OptimalLineupRequestInput = z.infer<typeof optimalLineupRequestSchema>;
export type MultiLineupRequestInput = z.infer<typeof multiLineupRequestSchema>;
export type ContestEntrySubmissionInput = z.infer<typeof contestEntrySubmissionSchema>;