// Performance Tracker - Tracks and analyzes historical performance metrics

import {
  LeagueMemory,
  ManagerProfile,
  ManagerPerformance,
  DraftResult,
  Trade,
  WaiverClaim,
  LineupDecision,
  Transaction,
  SeasonMemory
} from './types';

export class PerformanceTracker {
  private readonly MINIMUM_DATA_POINTS = 5;
  private readonly OUTLIER_THRESHOLD = 2.5; // Standard deviations

  // Track all performance metrics for a manager
  trackManagerPerformance(managerId: string, memory: LeagueMemory): ManagerPerformance {
    const performance: ManagerPerformance = {
      winRate: this.calculateWinRate(managerId, memory),
      playoffRate: this.calculatePlayoffRate(managerId, memory),
      championshipRate: this.calculateChampionshipRate(managerId, memory),
      draftGrade: this.calculateDraftGrade(managerId, memory),
      tradeGrade: this.calculateTradeGrade(managerId, memory),
      waiverGrade: this.calculateWaiverGrade(managerId, memory),
      pointsPerGame: this.calculatePointsPerGame(managerId, memory),
      consistency: this.calculateConsistency(managerId, memory),
      clutchFactor: this.calculateClutchFactor(managerId, memory)
    };

    return performance;
  }

  // Calculate comprehensive league performance metrics
  calculateLeagueMetrics(memory: LeagueMemory): {
    averageScore: number;
    scoringTrend: 'increasing' | 'stable' | 'decreasing';
    competitiveness: number;
    parityIndex: number;
    dynastyTeams: string[];
    improvingTeams: string[];
    decliningTeams: string[];
  } {
    const avgScore = this.calculateLeagueAverageScore(memory);
    const trend = this.analyzeScoringTrend(memory);
    const competitiveness = this.calculateCompetitiveness(memory);
    const parity = this.calculateParityIndex(memory);
    const dynasties = this.identifyDynastyTeams(memory);
    const improving = this.identifyImprovingTeams(memory);
    const declining = this.identifyDecliningTeams(memory);

    return {
      averageScore: avgScore,
      scoringTrend: trend,
      competitiveness,
      parityIndex: parity,
      dynastyTeams: dynasties,
      improvingTeams: improving,
      decliningTeams: declining
    };
  }

  // Calculate win rate
  private calculateWinRate(managerId: string, memory: LeagueMemory): number {
    let totalWins = 0;
    let totalGames = 0;

    for (const season of memory.seasons) {
      const seasonRecord = this.getSeasonRecord(managerId, season);
      totalWins += seasonRecord.wins;
      totalGames += seasonRecord.wins + seasonRecord.losses;
    }

    return totalGames > 0 ? totalWins / totalGames : 0;
  }

  // Calculate playoff appearance rate
  private calculatePlayoffRate(managerId: string, memory: LeagueMemory): number {
    let playoffAppearances = 0;
    let seasonsPlayed = 0;

    for (const season of memory.seasons) {
      if (this.managerPlayedSeason(managerId, season)) {
        seasonsPlayed++;
        if (this.madePlayoffs(managerId, season)) {
          playoffAppearances++;
        }
      }
    }

    return seasonsPlayed > 0 ? playoffAppearances / seasonsPlayed : 0;
  }

  // Calculate championship rate
  private calculateChampionshipRate(managerId: string, memory: LeagueMemory): number {
    let championships = 0;
    let seasonsPlayed = 0;

    for (const season of memory.seasons) {
      if (this.managerPlayedSeason(managerId, season)) {
        seasonsPlayed++;
        if (season.playoffs && season.playoffs.champion === managerId) {
          championships++;
        }
      }
    }

    return seasonsPlayed > 0 ? championships / seasonsPlayed : 0;
  }

  // Calculate draft performance grade
  private calculateDraftGrade(managerId: string, memory: LeagueMemory): number {
    const draftPicks: DraftResult[] = [];
    
    for (const season of memory.seasons) {
      draftPicks.push(...season.draftResults.filter(d => d.managerId === managerId));
    }

    if (draftPicks.length < this.MINIMUM_DATA_POINTS) return 0.5;

    let totalScore = 0;
    const weights = {
      'league-winner': 1.0,
      'exceed': 0.85,
      'meet': 0.65,
      'underperform': 0.35,
      'bust': 0.15
    };

    for (const pick of draftPicks) {
      // Factor in round (earlier rounds more important)
      const roundWeight = 1 - (pick.round - 1) * 0.05;
      const outcomeScore = weights[pick.seasonOutcome.value] || 0.5;
      totalScore += outcomeScore * roundWeight;
    }

    // Normalize to 0-1 scale
    return totalScore / draftPicks.length;
  }

  // Calculate trade performance grade
  private calculateTradeGrade(managerId: string, memory: LeagueMemory): number {
    const trades: Trade[] = [];
    
    for (const season of memory.seasons) {
      trades.push(...season.trades.filter(t => 
        t.team1.managerId === managerId || t.team2.managerId === managerId
      ));
    }

    if (trades.length === 0) return 0.5;

    let totalValue = 0;
    let tradeCount = 0;

    for (const trade of trades) {
      if (trade.outcome && trade.outcome.value) {
        const managerValue = trade.outcome.value[managerId] || 0;
        // Normalize value to 0-1 scale
        const normalizedValue = (managerValue + 1) / 2;
        totalValue += normalizedValue;
        tradeCount++;
      }
    }

    return tradeCount > 0 ? totalValue / tradeCount : 0.5;
  }

  // Calculate waiver performance grade
  private calculateWaiverGrade(managerId: string, memory: LeagueMemory): number {
    const claims: WaiverClaim[] = [];
    
    for (const season of memory.seasons) {
      claims.push(...season.waiverClaims.filter(w => w.managerId === managerId));
    }

    if (claims.length < this.MINIMUM_DATA_POINTS) return 0.5;

    let score = 0;
    const successfulClaims = claims.filter(c => c.successful);
    
    // Success rate
    const successRate = successfulClaims.length / claims.length;
    score += successRate * 0.4;

    // Efficiency (not overpaying in FAAB)
    const faabClaims = successfulClaims.filter(c => c.bidAmount !== undefined);
    if (faabClaims.length > 0) {
      const efficiency = this.calculateFAABEfficiency(faabClaims);
      score += efficiency * 0.3;
    } else {
      score += 0.15; // Neutral if no FAAB
    }

    // Impact (would need player performance data)
    score += 0.3 * 0.65; // Placeholder

    return score;
  }

  // Calculate average points per game
  private calculatePointsPerGame(managerId: string, memory: LeagueMemory): number {
    let totalPoints = 0;
    let totalGames = 0;

    for (const season of memory.seasons) {
      for (const lineup of season.lineupDecisions) {
        if (lineup.managerId === managerId) {
          totalPoints += lineup.outcome.points;
          totalGames++;
        }
      }
    }

    return totalGames > 0 ? totalPoints / totalGames : 0;
  }

  // Calculate scoring consistency
  private calculateConsistency(managerId: string, memory: LeagueMemory): number {
    const scores: number[] = [];

    for (const season of memory.seasons) {
      for (const lineup of season.lineupDecisions) {
        if (lineup.managerId === managerId) {
          scores.push(lineup.outcome.points);
        }
      }
    }

    if (scores.length < this.MINIMUM_DATA_POINTS) return 0.5;

    // Remove outliers
    const cleanScores = this.removeOutliers(scores);
    
    // Calculate coefficient of variation
    const mean = cleanScores.reduce((sum, s) => sum + s, 0) / cleanScores.length;
    const variance = cleanScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / cleanScores.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    // Convert to 0-1 scale (lower CV = higher consistency)
    return Math.max(0, Math.min(1, 1 - cv * 2));
  }

  // Calculate clutch performance factor
  private calculateClutchFactor(managerId: string, memory: LeagueMemory): number {
    let clutchWins = 0;
    let clutchOpportunities = 0;

    for (const season of memory.seasons) {
      // Playoff performance
      const playoffPerformance = this.getPlayoffPerformance(managerId, season);
      clutchWins += playoffPerformance.wins;
      clutchOpportunities += playoffPerformance.games;

      // Must-win regular season games
      const mustWinPerformance = this.getMustWinPerformance(managerId, season);
      clutchWins += mustWinPerformance.wins;
      clutchOpportunities += mustWinPerformance.games;

      // Close games (decided by < 5 points)
      const closeGamePerformance = this.getCloseGamePerformance(managerId, season);
      clutchWins += closeGamePerformance.wins;
      clutchOpportunities += closeGamePerformance.games;
    }

    return clutchOpportunities > 0 ? clutchWins / clutchOpportunities : 0.5;
  }

  // Calculate league-wide metrics
  private calculateLeagueAverageScore(memory: LeagueMemory): number {
    let totalScore = 0;
    let gameCount = 0;

    for (const season of memory.seasons) {
      for (const lineup of season.lineupDecisions) {
        totalScore += lineup.outcome.points;
        gameCount++;
      }
    }

    return gameCount > 0 ? totalScore / gameCount : 0;
  }

  // Analyze scoring trend over seasons
  private analyzeScoringTrend(memory: LeagueMemory): 'increasing' | 'stable' | 'decreasing' {
    if (memory.seasons.length < 2) return 'stable';

    const seasonAverages: number[] = [];
    
    for (const season of memory.seasons) {
      let seasonTotal = 0;
      let seasonGames = 0;
      
      for (const lineup of season.lineupDecisions) {
        seasonTotal += lineup.outcome.points;
        seasonGames++;
      }
      
      if (seasonGames > 0) {
        seasonAverages.push(seasonTotal / seasonGames);
      }
    }

    // Calculate trend
    const firstHalf = seasonAverages.slice(0, Math.floor(seasonAverages.length / 2));
    const secondHalf = seasonAverages.slice(Math.floor(seasonAverages.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, avg) => sum + avg, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, avg) => sum + avg, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  }

  // Calculate league competitiveness
  private calculateCompetitiveness(memory: LeagueMemory): number {
    let totalCompetitiveness = 0;
    let seasonCount = 0;

    for (const season of memory.seasons) {
      const standings = season.standings[season.standings.length - 1]; // Final standings
      if (!standings) continue;

      // Calculate standard deviation of win percentages
      const winPercentages = standings.rankings.map(r => {
        const [wins, losses] = r.record.split('-').map(Number);
        return wins / (wins + losses);
      });

      const mean = winPercentages.reduce((sum, wp) => sum + wp, 0) / winPercentages.length;
      const variance = winPercentages.reduce((sum, wp) => sum + Math.pow(wp - mean, 2), 0) / winPercentages.length;
      const stdDev = Math.sqrt(variance);

      // Lower standard deviation = more competitive
      const seasonCompetitiveness = 1 - stdDev * 2;
      totalCompetitiveness += Math.max(0, Math.min(1, seasonCompetitiveness));
      seasonCount++;
    }

    return seasonCount > 0 ? totalCompetitiveness / seasonCount : 0.5;
  }

  // Calculate parity index
  private calculateParityIndex(memory: LeagueMemory): number {
    const championshipCounts = new Map<string, number>();
    const playoffCounts = new Map<string, number>();

    for (const season of memory.seasons) {
      // Count championships
      if (season.playoffs && season.playoffs.champion) {
        championshipCounts.set(
          season.playoffs.champion,
          (championshipCounts.get(season.playoffs.champion) || 0) + 1
        );
      }

      // Count playoff appearances
      if (season.playoffs) {
        const playoffTeams = this.getPlayoffTeams(season);
        for (const team of playoffTeams) {
          playoffCounts.set(team, (playoffCounts.get(team) || 0) + 1);
        }
      }
    }

    // Calculate distribution metrics
    const maxChampionships = Math.max(...championshipCounts.values());
    const uniqueChampions = championshipCounts.size;
    const expectedChampions = memory.managers.length / 3; // Expect 1/3 to win over time

    const championParity = Math.min(1, uniqueChampions / expectedChampions);
    const dominanceFactor = 1 - (maxChampionships / memory.seasons.length);

    return (championParity + dominanceFactor) / 2;
  }

  // Identify dynasty teams
  private identifyDynastyTeams(memory: LeagueMemory): string[] {
    const dynastyThreshold = 0.4; // 40% championship rate
    const minSeasons = 3;
    
    const dynasties: string[] = [];

    for (const manager of memory.managers) {
      const seasonsPlayed = this.countSeasonsPlayed(manager.managerId, memory);
      if (seasonsPlayed < minSeasons) continue;

      const championshipRate = this.calculateChampionshipRate(manager.managerId, memory);
      const playoffRate = this.calculatePlayoffRate(manager.managerId, memory);

      if (championshipRate >= dynastyThreshold || 
          (championshipRate >= 0.25 && playoffRate >= 0.8)) {
        dynasties.push(manager.managerId);
      }
    }

    return dynasties;
  }

  // Identify improving teams
  private identifyImprovingTeams(memory: LeagueMemory): string[] {
    if (memory.seasons.length < 3) return [];

    const improving: string[] = [];
    const recentSeasons = memory.seasons.slice(-3);
    const olderSeasons = memory.seasons.slice(0, -3);

    for (const manager of memory.managers) {
      const recentPerformance = this.calculateAverageRank(manager.managerId, recentSeasons);
      const olderPerformance = this.calculateAverageRank(manager.managerId, olderSeasons);

      if (olderPerformance > 0 && recentPerformance > 0) {
        const improvement = olderPerformance - recentPerformance;
        if (improvement >= 2) { // Improved by 2+ positions
          improving.push(manager.managerId);
        }
      }
    }

    return improving;
  }

  // Identify declining teams
  private identifyDecliningTeams(memory: LeagueMemory): string[] {
    if (memory.seasons.length < 3) return [];

    const declining: string[] = [];
    const recentSeasons = memory.seasons.slice(-3);
    const olderSeasons = memory.seasons.slice(0, -3);

    for (const manager of memory.managers) {
      const recentPerformance = this.calculateAverageRank(manager.managerId, recentSeasons);
      const olderPerformance = this.calculateAverageRank(manager.managerId, olderSeasons);

      if (olderPerformance > 0 && recentPerformance > 0) {
        const decline = recentPerformance - olderPerformance;
        if (decline >= 2) { // Declined by 2+ positions
          declining.push(manager.managerId);
        }
      }
    }

    return declining;
  }

  // Helper methods
  private getSeasonRecord(managerId: string, season: SeasonMemory): { wins: number; losses: number } {
    const finalStandings = season.standings[season.standings.length - 1];
    if (!finalStandings) return { wins: 0, losses: 0 };

    const standing = finalStandings.rankings.find(r => r.managerId === managerId);
    if (!standing) return { wins: 0, losses: 0 };

    const [wins, losses] = standing.record.split('-').map(Number);
    return { wins, losses };
  }

  private managerPlayedSeason(managerId: string, season: SeasonMemory): boolean {
    return season.draftResults.some(d => d.managerId === managerId);
  }

  private madePlayoffs(managerId: string, season: SeasonMemory): boolean {
    if (!season.playoffs) return false;
    
    return season.playoffs.bracket.rounds[0].matchups.some(m => 
      m.team1 === managerId || m.team2 === managerId
    );
  }

  private calculateFAABEfficiency(claims: WaiverClaim[]): number {
    // Calculate how efficiently FAAB budget was used
    const totalSpent = claims.reduce((sum, c) => sum + (c.bidAmount || 0), 0);
    const avgBid = totalSpent / claims.length;
    
    // Assume $100 budget, efficient is spending 60-80% by season end
    const efficiency = Math.abs(totalSpent - 70) / 100;
    
    return Math.max(0, 1 - efficiency);
  }

  private removeOutliers(scores: number[]): number[] {
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const stdDev = Math.sqrt(
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
    );

    return scores.filter(s => 
      Math.abs(s - mean) <= this.OUTLIER_THRESHOLD * stdDev
    );
  }

  private getPlayoffPerformance(managerId: string, season: SeasonMemory): { wins: number; games: number } {
    let wins = 0;
    let games = 0;

    if (!season.playoffs) return { wins, games };

    for (const round of season.playoffs.bracket.rounds) {
      for (const matchup of round.matchups) {
        if (matchup.team1 === managerId || matchup.team2 === managerId) {
          games++;
          if (matchup.winner === managerId) {
            wins++;
          }
        }
      }
    }

    return { wins, games };
  }

  private getMustWinPerformance(managerId: string, season: SeasonMemory): { wins: number; games: number } {
    // Simplified - would need more context about playoff implications
    return { wins: 0, games: 0 };
  }

  private getCloseGamePerformance(managerId: string, season: SeasonMemory): { wins: number; games: number } {
    let wins = 0;
    let games = 0;

    // Would need head-to-head matchup data
    // This is a simplified placeholder
    for (const lineup of season.lineupDecisions) {
      if (lineup.managerId === managerId) {
        // Simulate close game detection
        if (Math.random() > 0.7) { // 30% of games are "close"
          games++;
          if (Math.random() > 0.5) {
            wins++;
          }
        }
      }
    }

    return { wins, games };
  }

  private getPlayoffTeams(season: SeasonMemory): string[] {
    const teams: Set<string> = new Set();
    
    if (season.playoffs) {
      for (const round of season.playoffs.bracket.rounds) {
        for (const matchup of round.matchups) {
          teams.add(matchup.team1);
          teams.add(matchup.team2);
        }
      }
    }

    return Array.from(teams);
  }

  private countSeasonsPlayed(managerId: string, memory: LeagueMemory): number {
    return memory.seasons.filter(s => this.managerPlayedSeason(managerId, s)).length;
  }

  private calculateAverageRank(managerId: string, seasons: SeasonMemory[]): number {
    let totalRank = 0;
    let count = 0;

    for (const season of seasons) {
      const finalStandings = season.standings[season.standings.length - 1];
      if (finalStandings) {
        const standing = finalStandings.rankings.find(r => r.managerId === managerId);
        if (standing) {
          totalRank += standing.rank;
          count++;
        }
      }
    }

    return count > 0 ? totalRank / count : 0;
  }
}