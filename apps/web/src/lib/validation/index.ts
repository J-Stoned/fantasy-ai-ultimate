// Central export for all validation utilities

// Middleware functions
export {
  validateRequest,
  withValidation,
  validateQueryParams,
  validatePathParams,
  validateAll,
  withRateLimit,
  sanitizeHtml,
  sanitizeObject,
  detectSqlInjection,
  detectMaliciousInput,
  MAX_REQUEST_SIZE,
  MAX_JSON_DEPTH,
} from './middleware';

// Auth schemas
export {
  adminLoginSchema,
  changePasswordSchema,
  sessionIdParamSchema,
  oauthCallbackSchema,
  authCheckSchema,
  tokenSchema,
  apiKeySchema,
  rateLimitSchema,
  type AdminLoginInput,
  type ChangePasswordInput,
  type OAuthCallbackInput,
  type AuthCheckInput,
} from './schemas/auth';

// Common schemas
export {
  uuidSchema,
  numericIdSchema,
  paginationSchema,
  dateRangeSchema,
  safeStringSchema,
  safeTextSchema,
  positiveNumberSchema,
  percentageSchema,
  moneySchema,
  sportSchema,
  platformSchema,
  contestTypeSchema,
  fileUploadSchema,
  searchQuerySchema,
  sortFieldSchema,
  batchIdsSchema,
  ipAddressSchema,
  requestMetadataSchema,
  type PaginationInput,
  type DateRangeInput,
  type Sport,
  type Platform,
  type ContestType,
} from './schemas/common';

// Financial schemas
export {
  bankrollUpdateSchema,
  bankrollHistoryQuerySchema,
  kellyCalculationSchema,
  bettingRecommendationSchema,
  contestEntrySchema,
  transactionSchema,
  portfolioAnalysisSchema,
  riskAssessmentSchema,
  withdrawalRequestSchema,
  depositSchema,
  type BankrollUpdateInput,
  type KellyCalculationInput,
  type ContestEntryInput,
  type TransactionInput,
  type WithdrawalRequestInput,
} from './schemas/financial';

// League schemas
export {
  leagueSettingsSchema,
  createLeagueSchema,
  updateLeagueSchema,
  joinLeagueSchema,
  importLeagueSchema,
  rosterMoveSchema,
  tradeProposalSchema,
  tradeResponseSchema,
  waiverClaimSchema,
  leagueTemplateSchema,
  validateLeagueRulesSchema,
  leagueStatsQuerySchema,
  type CreateLeagueInput,
  type ImportLeagueInput,
  type TradeProposalInput,
  type RosterMoveInput,
  type WaiverClaimInput,
} from './schemas/leagues';

// Contest schemas
export {
  playerSelectionSchema,
  lineupSchema,
  contestSearchSchema,
  optimalLineupRequestSchema,
  multiLineupRequestSchema,
  contestEntrySubmissionSchema,
  playerPoolRequestSchema,
  stackValidationSchema,
  contestResultsQuerySchema,
  ownershipProjectionSchema,
  type LineupInput,
  type ContestSearchInput,
  type OptimalLineupRequestInput,
  type MultiLineupRequestInput,
  type ContestEntrySubmissionInput,
} from './schemas/contests';

// Admin schemas
export {
  dataCollectionSchema,
  mlTrainingRequestSchema,
  adminStatsQuerySchema,
  systemOptimizationSchema,
  adminPredictionRequestSchema,
  tradingOrchestrationSchema,
  sessionManagementSchema,
  clientInfoSchema,
  rateLimitOverrideSchema,
  auditLogQuerySchema,
  type DataCollectionInput,
  type MLTrainingRequestInput,
  type TradingOrchestrationInput,
  type SessionManagementInput,
  type AuditLogQueryInput,
} from './schemas/admin';