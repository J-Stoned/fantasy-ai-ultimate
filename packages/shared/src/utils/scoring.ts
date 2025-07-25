import { PlayerStats } from '../types/player';
import { ScoringSystem } from '../types/league';

// 2025 Best Practice: Type-safe scoring calculations
export const DEFAULT_SCORING_SYSTEMS = {
  NFL: {
    PPR: {
      passingYards: 0.04,
      passingTDs: 4,
      interceptions: -2,
      rushingYards: 0.1,
      rushingTDs: 6,
      receptions: 1,
      receivingYards: 0.1,
      receivingTDs: 6,
      fumblesLost: -2,
      twoPointConversions: 2
    },
    HALF_PPR: {
      passingYards: 0.04,
      passingTDs: 4,
      interceptions: -2,
      rushingYards: 0.1,
      rushingTDs: 6,
      receptions: 0.5,
      receivingYards: 0.1,
      receivingTDs: 6,
      fumblesLost: -2,
      twoPointConversions: 2
    },
    STANDARD: {
      passingYards: 0.04,
      passingTDs: 4,
      interceptions: -2,
      rushingYards: 0.1,
      rushingTDs: 6,
      receptions: 0,
      receivingYards: 0.1,
      receivingTDs: 6,
      fumblesLost: -2,
      twoPointConversions: 2
    }
  },
  NBA: {
    STANDARD: {
      points: 1,
      rebounds: 1.2,
      assists: 1.5,
      steals: 3,
      blocks: 3,
      turnovers: -1,
      threePointersMade: 0.5,
      doubleDouble: 1.5,
      tripleDouble: 3
    },
    DRAFTKINGS: {
      points: 1,
      rebounds: 1.25,
      assists: 1.5,
      steals: 2,
      blocks: 2,
      turnovers: -0.5,
      threePointersMade: 0.5,
      doubleDouble: 1.5,
      tripleDouble: 3
    }
  },
  MLB: {
    STANDARD: {
      // Batting
      singles: 3,
      doubles: 5,
      triples: 8,
      homeRuns: 10,
      rbis: 2,
      runs: 2,
      walks: 2,
      stolenBases: 5,
      caughtStealing: -2,
      // Pitching
      inningsPitched: 3,
      strikeouts: 2,
      wins: 5,
      saves: 5,
      earnedRuns: -2,
      hits: -1,
      walks: -1
    }
  },
  NHL: {
    STANDARD: {
      goals: 3,
      assists: 2,
      plusMinus: 1,
      penaltyMinutes: 0.5,
      powerplayPoints: 0.5,
      shorthandedPoints: 2,
      shots: 0.5,
      blocks: 0.5,
      // Goalie
      wins: 5,
      saves: 0.2,
      goalsAgainst: -1,
      shutouts: 3
    }
  }
} as const;

// 2025 Best Practice: Generic scoring calculator with memoization
const scoreCache = new Map<string, number>();

export function calculateFantasyPoints(
  stats: PlayerStats,
  scoringSystem: ScoringSystem,
  platform: 'draftKings' | 'fanduel' | 'yahoo' | 'espn' = 'draftKings'
): number {
  const cacheKey = `${stats.playerId}-${stats.gameId}-${JSON.stringify(scoringSystem)}-${platform}`;
  
  if (scoreCache.has(cacheKey)) {
    return scoreCache.get(cacheKey)!;
  }
  
  let totalPoints = 0;
  
  // Calculate base points
  Object.entries(scoringSystem).forEach(([stat, value]) => {
    if (stats.stats[stat] !== undefined) {
      totalPoints += stats.stats[stat] * value;
    }
  });
  
  // Platform-specific bonuses
  totalPoints += getPlatformBonuses(stats, platform);
  
  // Cache the result
  scoreCache.set(cacheKey, totalPoints);
  
  // Clear cache if it gets too large
  if (scoreCache.size > 10000) {
    const entriesToDelete = Array.from(scoreCache.keys()).slice(0, 5000);
    entriesToDelete.forEach(key => scoreCache.delete(key));
  }
  
  return Math.round(totalPoints * 100) / 100; // Round to 2 decimal places
}

function getPlatformBonuses(stats: PlayerStats, platform: string): number {
  let bonus = 0;
  
  // Platform-specific milestone bonuses
  switch (platform) {
    case 'draftKings':
      // 100 yard rushing/receiving bonus
      if (stats.stats.rushingYards >= 100) bonus += 3;
      if (stats.stats.receivingYards >= 100) bonus += 3;
      // 300 yard passing bonus
      if (stats.stats.passingYards >= 300) bonus += 3;
      break;
      
    case 'fanduel':
      // Different bonus structure
      if (stats.stats.rushingYards >= 100) bonus += 2;
      if (stats.stats.receivingYards >= 100) bonus += 2;
      if (stats.stats.passingYards >= 300) bonus += 2;
      break;
  }
  
  return bonus;
}

// 2025 Best Practice: Projection accuracy calculator
export function calculateProjectionAccuracy(
  projected: number,
  actual: number
): {
  accuracy: number;
  difference: number;
  percentError: number;
} {
  const difference = actual - projected;
  const percentError = Math.abs(difference / projected) * 100;
  const accuracy = Math.max(0, 100 - percentError);
  
  return {
    accuracy: Math.round(accuracy * 100) / 100,
    difference: Math.round(difference * 100) / 100,
    percentError: Math.round(percentError * 100) / 100
  };
}

// 2025 Best Practice: Value calculator for DFS
export function calculateDFSValue(
  projectedPoints: number,
  salary: number,
  ownership?: number
): {
  value: number; // Points per $1000
  gppValue: number; // Tournament value considering ownership
  cashValue: number; // Cash game value
} {
  const value = (projectedPoints / salary) * 1000;
  
  // GPP value decreases with high ownership
  const gppValue = ownership 
    ? value * (1 - (ownership / 100) * 0.3) 
    : value;
  
  // Cash value is just straight value
  const cashValue = value;
  
  return {
    value: Math.round(value * 100) / 100,
    gppValue: Math.round(gppValue * 100) / 100,
    cashValue: Math.round(cashValue * 100) / 100
  };
}