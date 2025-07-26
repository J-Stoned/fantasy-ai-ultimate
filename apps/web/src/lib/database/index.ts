/**
 * Database service exports
 * Using the FIXED versions that match our actual database structure
 */

export { gameStatsService } from './game-stats-service-fixed';
export { playerDataService } from './player-data-service-fixed';

// Re-export types
export type { GameStatsRecord, GameStatsQuery } from './game-stats-service-fixed';
export type { PlayerProfile, PlayerSearchOptions } from './player-data-service-fixed';