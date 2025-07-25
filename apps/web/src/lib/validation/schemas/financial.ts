import { z } from 'zod';
import { moneySchema, percentageSchema, uuidSchema, dateRangeSchema } from './common';

// Bankroll management schemas

export const bankrollUpdateSchema = z.object({
  userId: uuidSchema,
  balance: moneySchema,
  dailyLimit: moneySchema.optional(),
  weeklyLimit: moneySchema.optional(),
  monthlyLimit: moneySchema.optional(),
  maxExposure: percentageSchema.optional(),
});

export const bankrollHistoryQuerySchema = z.object({
  userId: uuidSchema,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  type: z.enum(['deposit', 'withdrawal', 'bet', 'win', 'loss']).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

// Kelly Criterion calculation
export const kellyCalculationSchema = z.object({
  bankroll: moneySchema,
  probability: percentageSchema.transform(p => p / 100), // Convert percentage to decimal
  odds: z.number().positive().finite(),
  maxBetPercentage: percentageSchema.transform(p => p / 100).optional(),
  confidenceLevel: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
});

// Betting recommendation
export const bettingRecommendationSchema = z.object({
  userId: uuidSchema,
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL']),
  contests: z.array(z.object({
    contestId: z.string().max(100),
    entryFee: moneySchema,
    expectedValue: z.number().finite(),
    confidence: percentageSchema,
    maxEntries: z.number().int().positive().max(150).optional(),
  })).min(1).max(50),
  bankrollPercentage: percentageSchema.optional(),
});

// Contest entry validation
export const contestEntrySchema = z.object({
  userId: uuidSchema,
  contestId: z.string().max(100),
  lineupId: uuidSchema,
  entryFee: moneySchema,
  numberOfEntries: z.number().int().positive().max(150).default(1),
  platform: z.enum(['draftkings', 'fanduel', 'yahoo']),
});

// Transaction recording
export const transactionSchema = z.object({
  userId: uuidSchema,
  type: z.enum(['deposit', 'withdrawal', 'entry_fee', 'winnings', 'refund', 'bonus']),
  amount: moneySchema,
  description: z.string().max(500).trim(),
  metadata: z.object({
    contestId: z.string().optional(),
    platform: z.string().optional(),
    transactionId: z.string().optional(),
  }).optional(),
});

// Portfolio analysis
export const portfolioAnalysisSchema = z.object({
  userId: uuidSchema,
  dateRange: dateRangeSchema.optional(),
  groupBy: z.enum(['sport', 'contest_type', 'platform', 'day', 'week', 'month']).optional(),
});

// Risk management
export const riskAssessmentSchema = z.object({
  userId: uuidSchema,
  proposedBets: z.array(z.object({
    amount: moneySchema,
    expectedReturn: z.number().finite(),
    variance: z.number().min(0).finite(),
    correlation: z.number().min(-1).max(1).optional(),
  })).min(1).max(100),
  timeHorizon: z.enum(['daily', 'weekly', 'monthly']),
});

// Withdrawal request
export const withdrawalRequestSchema = z.object({
  userId: uuidSchema,
  amount: moneySchema,
  method: z.enum(['bank_transfer', 'paypal', 'check']),
  accountDetails: z.object({
    accountNumber: z.string().max(50).optional(),
    routingNumber: z.string().max(50).optional(),
    paypalEmail: z.string().email().optional(),
  }).refine(
    (data) => {
      if (data.accountNumber || data.routingNumber) {
        return data.accountNumber && data.routingNumber;
      }
      return true;
    },
    'Both account and routing numbers are required for bank transfers'
  ),
});

// Deposit validation
export const depositSchema = z.object({
  userId: uuidSchema,
  amount: moneySchema.min(10, 'Minimum deposit is $10').max(10000, 'Maximum deposit is $10,000'),
  paymentMethod: z.enum(['credit_card', 'debit_card', 'bank_transfer', 'paypal']),
  paymentToken: z.string().max(500).optional(), // For Stripe or payment processor tokens
});

export type BankrollUpdateInput = z.infer<typeof bankrollUpdateSchema>;
export type KellyCalculationInput = z.infer<typeof kellyCalculationSchema>;
export type ContestEntryInput = z.infer<typeof contestEntrySchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;