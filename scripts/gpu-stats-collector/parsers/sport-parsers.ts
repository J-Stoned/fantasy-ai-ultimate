#!/usr/bin/env tsx
/**
 * 🏆 SPORT-SPECIFIC PARSERS
 * Unified parsers for all major sports
 */

export interface ParsedStats {
  playerId: string;
  playerName: string;
  teamId: string;
  stats: any;
  fantasyPoints?: number;
}

export class SportParsers {
  /**
   * Parse NFL game data from ESPN API
   */
  static parseNFLGame(gameData: any): ParsedStats[] {
    const results: ParsedStats[] = [];
    
    if (!gameData.boxscore?.players) return results;
    
    for (const teamData of gameData.boxscore.players) {
      const teamId = teamData.team.id;
      
      // NFL has separate categories for passing, rushing, receiving, etc.
      const playerStats = new Map<string, any>();
      
      // Process each stat category
      for (const category of teamData.statistics || []) {
        if (!category || !category.name) continue;
        const catName = category.name.toLowerCase();
        
        for (const athlete of category.athletes || []) {
          if (!athlete.athlete) continue;
          
          const playerId = athlete.athlete.id;
          const playerName = athlete.athlete.displayName;
          
          if (!playerStats.has(playerId)) {
            playerStats.set(playerId, {
              playerId: String(playerId),
              playerName,
              teamId: String(teamId),
              stats: {}
            });
          }
          
          const player = playerStats.get(playerId);
          
          // Parse category-specific stats
          switch (catName) {
            case 'passing':
              Object.assign(player.stats, this.parseNFLPassing(athlete.stats));
              break;
            case 'rushing':
              Object.assign(player.stats, this.parseNFLRushing(athlete.stats));
              break;
            case 'receiving':
              Object.assign(player.stats, this.parseNFLReceiving(athlete.stats));
              break;
            case 'defensive':
              Object.assign(player.stats, this.parseNFLDefensive(athlete.stats));
              break;
            case 'kicking':
              Object.assign(player.stats, this.parseNFLKicking(athlete.stats));
              break;
          }
        }
      }
      
      // Convert map to array
      playerStats.forEach(player => results.push(player));
    }
    
    return results;
  }
  
  /**
   * Parse NBA game data from ESPN API
   */
  static parseNBAGame(gameData: any): ParsedStats[] {
    const results: ParsedStats[] = [];
    
    if (!gameData.boxscore?.players) return results;
    
    for (const teamData of gameData.boxscore.players) {
      const teamId = teamData.team.id;
      
      // NBA typically has all stats in one category
      for (const player of teamData.statistics[0]?.athletes || []) {
        if (!player.athlete || !player.stats) continue;
        
        const stats = this.parseNBAStats(player.stats);
        
        results.push({
          playerId: String(player.athlete.id),
          playerName: player.athlete.displayName,
          teamId: String(teamId),
          stats
        });
      }
    }
    
    return results;
  }
  
  /**
   * Parse MLB game data from ESPN API
   */
  static parseMLBGame(gameData: any): ParsedStats[] {
    const results: ParsedStats[] = [];
    
    if (!gameData.boxscore?.players) return results;
    
    for (const teamData of gameData.boxscore.players) {
      const teamId = teamData.team.id;
      
      // MLB has batting and pitching categories
      for (const category of teamData.statistics || []) {
        const catName = category.name.toLowerCase();
        
        for (const player of category.athletes || []) {
          if (!player.athlete) continue;
          
          const stats = catName === 'pitching' 
            ? this.parseMLBPitching(player.stats)
            : this.parseMLBBatting(player.stats);
          
          results.push({
            playerId: String(player.athlete.id),
            playerName: player.athlete.displayName,
            teamId: String(teamId),
            stats
          });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Parse NHL game data from ESPN API
   */
  static parseNHLGame(gameData: any): ParsedStats[] {
    const results: ParsedStats[] = [];
    
    if (!gameData.boxscore?.players) return results;
    
    for (const teamData of gameData.boxscore.players) {
      const teamId = teamData.team.id;
      
      // NHL has skaters and goalies
      for (const category of teamData.statistics || []) {
        const catName = category.name.toLowerCase();
        
        for (const player of category.athletes || []) {
          if (!player.athlete) continue;
          
          const stats = catName === 'goalies'
            ? this.parseNHLGoalie(player.stats)
            : this.parseNHLSkater(player.stats);
          
          results.push({
            playerId: String(player.athlete.id),
            playerName: player.athlete.displayName,
            teamId: String(teamId),
            stats
          });
        }
      }
    }
    
    return results;
  }
  
  // NFL Stat Parsers
  private static parseNFLPassing(stats: string[]): any {
    if (!stats || stats.length < 8) return {};
    
    // ESPN format: [compAtt, yards, avg, td, int, sacks, qbr, rtg]
    const [compAtt, yards, avg, td, int, sacks, qbr, rtg] = stats;
    const result: any = {};
    
    if (compAtt && compAtt.includes('/')) {
      const [comp, att] = compAtt.split('/');
      result.completions = parseInt(comp) || 0;
      result.attempts = parseInt(att) || 0;
    }
    
    result.passingYards = parseInt(yards) || 0;
    result.passingTDs = parseInt(td) || 0;
    result.interceptions = parseInt(int) || 0;
    result.qbRating = parseFloat(rtg) || 0;
    
    return result;
  }
  
  private static parseNFLRushing(stats: string[]): any {
    if (!stats || stats.length < 5) return {};
    
    const [carries, yards, avg, td, long] = stats;
    
    return {
      carries: parseInt(carries) || 0,
      rushingYards: parseInt(yards) || 0,
      rushingTDs: parseInt(td) || 0,
      yardsPerCarry: parseFloat(avg) || 0
    };
  }
  
  private static parseNFLReceiving(stats: string[]): any {
    if (!stats || stats.length < 6) return {};
    
    const [receptions, yards, avg, td, long, targets] = stats;
    
    return {
      receptions: parseInt(receptions) || 0,
      receivingYards: parseInt(yards) || 0,
      receivingTDs: parseInt(td) || 0,
      targets: parseInt(targets) || 0,
      yardsPerReception: parseFloat(avg) || 0
    };
  }
  
  private static parseNFLDefensive(stats: string[]): any {
    if (!stats || stats.length < 8) return {};
    
    const [tackles, solo, sacks, tfls, pd, qbHits, td] = stats;
    
    return {
      tackles: parseInt(tackles) || 0,
      sacks: parseFloat(sacks) || 0,
      passDeflections: parseInt(pd) || 0,
      defensiveTDs: parseInt(td) || 0
    };
  }
  
  private static parseNFLKicking(stats: string[]): any {
    if (!stats || stats.length < 8) return {};
    
    const [fgMade, fgAtt, fgPct, longFg, xpMade, xpAtt, totalPts] = stats;
    
    return {
      fieldGoalsMade: parseInt(fgMade) || 0,
      fieldGoalsAttempted: parseInt(fgAtt) || 0,
      extraPointsMade: parseInt(xpMade) || 0,
      totalPoints: parseInt(totalPts) || 0
    };
  }
  
  // NBA Stat Parser
  private static parseNBAStats(stats: string[]): any {
    if (!stats || stats.length < 15) return {};
    
    const [min, fg, threePt, ft, oreb, dreb, reb, ast, stl, blk, to, pf, plusMinus, pts] = stats;
    
    const result: any = {
      minutes: parseInt(min) || 0,
      points: parseInt(pts) || 0,
      rebounds: parseInt(reb) || 0,
      assists: parseInt(ast) || 0,
      steals: parseInt(stl) || 0,
      blocks: parseInt(blk) || 0,
      turnovers: parseInt(to) || 0,
      plusMinus: parseInt(plusMinus) || 0
    };
    
    // Parse shooting stats
    if (fg && fg.includes('-')) {
      const [made, att] = fg.split('-');
      result.fieldGoalsMade = parseInt(made) || 0;
      result.fieldGoalsAttempted = parseInt(att) || 0;
    }
    
    if (threePt && threePt.includes('-')) {
      const [made, att] = threePt.split('-');
      result.threePointersMade = parseInt(made) || 0;
      result.threePointersAttempted = parseInt(att) || 0;
    }
    
    if (ft && ft.includes('-')) {
      const [made, att] = ft.split('-');
      result.freeThrowsMade = parseInt(made) || 0;
      result.freeThrowsAttempted = parseInt(att) || 0;
    }
    
    return result;
  }
  
  // MLB Stat Parsers
  private static parseMLBBatting(stats: string[]): any {
    if (!stats || stats.length < 11) return {};
    
    const [ab, r, h, rbi, bb, k, avg, obp, slg, ops, hr] = stats;
    
    return {
      atBats: parseInt(ab) || 0,
      runs: parseInt(r) || 0,
      hits: parseInt(h) || 0,
      rbis: parseInt(rbi) || 0,
      walks: parseInt(bb) || 0,
      strikeouts: parseInt(k) || 0,
      homeRuns: parseInt(hr) || 0,
      battingAvg: parseFloat(avg) || 0
    };
  }
  
  private static parseMLBPitching(stats: string[]): any {
    if (!stats || stats.length < 10) return {};
    
    const [ip, h, r, er, bb, k, hr, era, whip, pc] = stats;
    
    return {
      inningsPitched: parseFloat(ip) || 0,
      hitsAllowed: parseInt(h) || 0,
      runsAllowed: parseInt(r) || 0,
      earnedRuns: parseInt(er) || 0,
      walksAllowed: parseInt(bb) || 0,
      strikeouts: parseInt(k) || 0,
      homeRunsAllowed: parseInt(hr) || 0,
      era: parseFloat(era) || 0,
      whip: parseFloat(whip) || 0,
      pitchCount: parseInt(pc) || 0
    };
  }
  
  // NHL Stat Parsers
  private static parseNHLSkater(stats: string[]): any {
    if (!stats || stats.length < 8) return {};
    
    const [g, a, pts, plusMinus, pim, sog, hits, blocks] = stats;
    
    return {
      goals: parseInt(g) || 0,
      assists: parseInt(a) || 0,
      points: parseInt(pts) || 0,
      plusMinus: parseInt(plusMinus) || 0,
      penaltyMinutes: parseInt(pim) || 0,
      shots: parseInt(sog) || 0,
      hits: parseInt(hits) || 0,
      blockedShots: parseInt(blocks) || 0
    };
  }
  
  private static parseNHLGoalie(stats: string[]): any {
    if (!stats || stats.length < 8) return {};
    
    const [sa, ga, sv, svPct, gaa, toi, so] = stats;
    
    return {
      shotsAgainst: parseInt(sa) || 0,
      goalsAgainst: parseInt(ga) || 0,
      saves: parseInt(sv) || 0,
      savePercentage: parseFloat(svPct) || 0,
      goalsAgainstAvg: parseFloat(gaa) || 0,
      timeOnIce: toi || '00:00',
      shutouts: parseInt(so) || 0
    };
  }
}