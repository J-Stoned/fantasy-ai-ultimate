import { z } from 'zod';
import { uuidSchema, safeStringSchema, safeTextSchema, sportSchema, platformSchema } from './common';

// League validation schemas

export const leagueSettingsSchema = z.object({
  scoringSystem: z.enum(['standard', 'ppr', 'half_ppr', 'custom']),
  rosterSize: z.number().int().min(1).max(50),
  maxTeams: z.number().int().min(2).max(32),
  tradeDeadline: z.string().datetime().optional(),
  playoffTeams: z.number().int().min(2).max(16).optional(),
  waiverType: z.enum(['rolling', 'faab', 'none']).optional(),
  faabBudget: z.number().int().min(0).max(10000).optional(),
  draftType: z.enum(['snake', 'auction', 'keeper']).optional(),
  keeperCount: z.number().int().min(0).max(20).optional(),
});

export const createLeagueSchema = z.object({
  name: safeStringSchema(100).min(1, 'League name is required'),
  description: safeTextSchema(1000).optional(),
  sport: sportSchema,
  platform: platformSchema,
  platformLeagueId: z.string().max(100).optional(),
  settings: leagueSettingsSchema,
  isPrivate: z.boolean().default(false),
  password: z.string().max(128).optional(),
}).refine(
  (data) => !data.isPrivate || (data.isPrivate && data.password),
  {
    message: 'Password required for private leagues',
    path: ['password'],
  }
);

export const updateLeagueSchema = createLeagueSchema.partial().extend({
  leagueId: uuidSchema,
});

export const joinLeagueSchema = z.object({
  leagueId: uuidSchema,
  teamName: safeStringSchema(50).min(1, 'Team name is required'),
  password: z.string().max(128).optional(),
});

// League import schemas
export const importLeagueSchema = z.object({
  platform: platformSchema,
  credentials: z.object({
    username: z.string().max(100).optional(),
    password: z.string().max(128).optional(),
    sessionToken: z.string().max(1000).optional(),
    leagueId: z.string().max(100),
  }),
  importOptions: z.object({
    importRosters: z.boolean().default(true),
    importTransactions: z.boolean().default(true),
    importDraftResults: z.boolean().default(true),
    importScoring: z.boolean().default(true),
  }).optional(),
});

// Roster management
export const rosterMoveSchema = z.object({
  leagueId: uuidSchema,
  teamId: uuidSchema,
  playerId: z.string().max(100),
  action: z.enum(['add', 'drop', 'bench', 'start', 'ir']),
  dropPlayerId: z.string().max(100).optional(), // For add/drop transactions
}).refine(
  (data) => data.action !== 'add' || data.dropPlayerId,
  {
    message: 'Drop player required for add transactions',
    path: ['dropPlayerId'],
  }
);

// Trade schemas
export const tradeProposalSchema = z.object({
  leagueId: uuidSchema,
  proposingTeamId: uuidSchema,
  receivingTeamId: uuidSchema,
  givingPlayers: z.array(z.string().max(100)).min(1).max(10),
  receivingPlayers: z.array(z.string().max(100)).min(1).max(10),
  givingPicks: z.array(z.object({
    round: z.number().int().min(1).max(30),
    year: z.number().int().min(2024).max(2030),
  })).max(5).optional(),
  receivingPicks: z.array(z.object({
    round: z.number().int().min(1).max(30),
    year: z.number().int().min(2024).max(2030),
  })).max(5).optional(),
  message: safeTextSchema(500).optional(),
});

export const tradeResponseSchema = z.object({
  tradeId: uuidSchema,
  action: z.enum(['accept', 'reject', 'counter']),
  counterOffer: tradeProposalSchema.omit({ leagueId: true }).optional(),
}).refine(
  (data) => data.action !== 'counter' || data.counterOffer,
  {
    message: 'Counter offer required when countering',
    path: ['counterOffer'],
  }
);

// Waiver claims
export const waiverClaimSchema = z.object({
  leagueId: uuidSchema,
  teamId: uuidSchema,
  playerId: z.string().max(100),
  dropPlayerId: z.string().max(100).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  bidAmount: z.number().int().min(0).max(10000).optional(), // For FAAB
});

// League templates
export const leagueTemplateSchema = z.object({
  name: safeStringSchema(100).min(1),
  description: safeTextSchema(1000).optional(),
  sport: sportSchema,
  settings: leagueSettingsSchema,
  scoringRules: z.record(z.string(), z.number()).optional(),
  isPublic: z.boolean().default(false),
});

// League validation for platform-specific rules
export const validateLeagueRulesSchema = z.object({
  leagueId: uuidSchema,
  platform: platformSchema,
  rules: z.array(z.object({
    ruleType: z.string().max(50),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })),
});

// League stats query
export const leagueStatsQuerySchema = z.object({
  leagueId: uuidSchema,
  season: z.number().int().min(2020).max(2030).optional(),
  week: z.number().int().min(1).max(18).optional(),
  statType: z.enum(['standings', 'scoring', 'transactions', 'activity']).optional(),
});

export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type ImportLeagueInput = z.infer<typeof importLeagueSchema>;
export type TradeProposalInput = z.infer<typeof tradeProposalSchema>;
export type RosterMoveInput = z.infer<typeof rosterMoveSchema>;
export type WaiverClaimInput = z.infer<typeof waiverClaimSchema>;