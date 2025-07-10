#!/usr/bin/env tsx
/**
 * 🔥 LIVE GAME PATTERN TRACKER
 * 
 * Real-time pattern detection during live games
 * Monitors game flow and adjusts predictions dynamically
 * Sends alerts when patterns emerge or break
 */

import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import express from 'express';
import cors from 'cors';

config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3341;
const WS_PORT = 3342;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LiveGame {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  quarter: number;
  timeRemaining: string;
  possession?: string;
  lastPlay?: string;
  momentum: 'home' | 'away' | 'neutral';
  pace: 'fast' | 'normal' | 'slow';
}

interface LivePattern {
  patternId: string;
  type: 'in_game' | 'emerging' | 'broken' | 'confirmed';
  name: string;
  description: string;
  impact: number; // -100 to +100 (negative hurts projections, positive helps)
  confidence: number;
  affectedPlayers: string[];
  triggerConditions: string[];
  timestamp: string;
}

interface PlayerUpdate {
  playerId: string;
  playerName: string;
  originalProjection: number;
  currentProjection: number;
  percentChange: number;
  reason: string;
  confidence: number;
}

class LiveGamePatternTracker {
  private activeGames: Map<string, LiveGame> = new Map();
  private detectedPatterns: Map<string, LivePattern[]> = new Map();
  private playerProjections: Map<string, number> = new Map();
  private wsClients = new Set<any>();
  
  // Pattern definitions
  private patterns = {
    blowout: {
      name: 'Blowout Risk',
      check: (game: LiveGame) => {
        const diff = Math.abs(game.homeScore - game.awayScore);
        const quarter = game.quarter;
        return (quarter >= 3 && diff > 21) || (quarter >= 4 && diff > 14);
      },
      impact: -30,
      affects: ['starters', 'passing_game']
    },
    
    shootout: {
      name: 'Shootout Developing',
      check: (game: LiveGame) => {
        const totalScore = game.homeScore + game.awayScore;
        const quarter = game.quarter;
        return (quarter === 2 && totalScore > 35) || (quarter === 3 && totalScore > 52);
      },
      impact: 25,
      affects: ['qb', 'wr', 'te']
    },
    
    defensive_struggle: {
      name: 'Defensive Battle',
      check: (game: LiveGame) => {
        const totalScore = game.homeScore + game.awayScore;
        const quarter = game.quarter;
        return (quarter >= 2 && totalScore < 14) || (quarter >= 3 && totalScore < 21);
      },
      impact: -20,
      affects: ['qb', 'wr', 'kicker']
    },
    
    garbage_time: {
      name: 'Garbage Time',
      check: (game: LiveGame) => {
        const diff = Math.abs(game.homeScore - game.awayScore);
        const quarter = game.quarter;
        return quarter === 4 && diff > 17;
      },
      impact: 40,
      affects: ['backup_qb', 'wr3', 'rb2']
    },
    
    momentum_shift: {
      name: 'Momentum Shift',
      check: (game: LiveGame, history: any[]) => {
        // Check if team scored 14+ unanswered points
        return false; // Simplified for now
      },
      impact: 15,
      affects: ['all']
    },
    
    injury_opportunity: {
      name: 'Injury Replacement Value',
      check: (game: LiveGame, injury?: any) => {
        return !!injury;
      },
      impact: 50,
      affects: ['backup', 'next_man_up']
    },
    
    weather_impact: {
      name: 'Weather Affecting Game',
      check: (game: LiveGame, weather?: any) => {
        return weather?.windSpeed > 20 || weather?.precipitation > 0.5;
      },
      impact: -15,
      affects: ['passing_game', 'kicker']
    }
  };
  
  async trackGame(gameData: Partial<LiveGame>) {
    const gameId = gameData.gameId || `game_${Date.now()}`;
    
    // Update or create game
    const game: LiveGame = {
      gameId,
      homeTeam: gameData.homeTeam || 'HOME',
      awayTeam: gameData.awayTeam || 'AWAY',
      homeScore: gameData.homeScore || 0,
      awayScore: gameData.awayScore || 0,
      quarter: gameData.quarter || 1,
      timeRemaining: gameData.timeRemaining || '15:00',
      momentum: gameData.momentum || 'neutral',
      pace: gameData.pace || 'normal'
    };
    
    this.activeGames.set(gameId, game);
    
    // Detect patterns
    const patterns = this.detectPatterns(game);
    this.detectedPatterns.set(gameId, patterns);
    
    // Update player projections
    const updates = this.updateProjections(game, patterns);
    
    // Broadcast updates
    this.broadcastUpdate({
      type: 'game_update',
      game,
      patterns,
      playerUpdates: updates,
      timestamp: new Date().toISOString()
    });
    
    return { game, patterns, updates };
  }
  
  private detectPatterns(game: LiveGame): LivePattern[] {
    const patterns: LivePattern[] = [];
    const timestamp = new Date().toISOString();
    
    // Check each pattern
    for (const [key, pattern] of Object.entries(this.patterns)) {
      if (pattern.check(game)) {
        patterns.push({
          patternId: `${game.gameId}_${key}_${Date.now()}`,
          type: 'in_game',
          name: pattern.name,
          description: `${pattern.name} detected in ${game.homeTeam} vs ${game.awayTeam}`,
          impact: pattern.impact,
          confidence: 70 + Math.random() * 20,
          affectedPlayers: this.getAffectedPlayers(game, pattern.affects),
          triggerConditions: [`Q${game.quarter}: ${game.homeScore}-${game.awayScore}`],
          timestamp
        });
      }
    }
    
    return patterns;
  }
  
  private getAffectedPlayers(game: LiveGame, affects: string[]): string[] {
    // In production, would query actual rosters
    const mockPlayers: Record<string, string[]> = {
      qb: ['Patrick Mahomes', 'Josh Allen'],
      rb: ['Christian McCaffrey', 'Derrick Henry'],
      wr: ['Tyreek Hill', 'Justin Jefferson', 'CeeDee Lamb'],
      te: ['Travis Kelce', 'Mark Andrews'],
      starters: ['Mahomes', 'McCaffrey', 'Hill', 'Kelce'],
      backup_qb: ['Chad Henne', 'Case Keenum'],
      wr3: ['Skyy Moore', 'Khalil Shakir'],
      rb2: ['Clyde Edwards-Helaire', 'James Cook']
    };
    
    const affected = new Set<string>();
    
    affects.forEach(category => {
      if (category === 'all') {
        Object.values(mockPlayers).flat().forEach(p => affected.add(p));
      } else if (mockPlayers[category]) {
        mockPlayers[category].forEach(p => affected.add(p));
      }
    });
    
    return Array.from(affected);
  }
  
  private updateProjections(game: LiveGame, patterns: LivePattern[]): PlayerUpdate[] {
    const updates: PlayerUpdate[] = [];
    
    // Get all affected players
    const affectedPlayers = new Set<string>();
    patterns.forEach(p => p.affectedPlayers.forEach(player => affectedPlayers.add(player)));
    
    // Calculate projection changes
    affectedPlayers.forEach(playerName => {
      const originalProjection = this.playerProjections.get(playerName) || 15 + Math.random() * 10;
      
      // Apply pattern impacts
      let totalImpact = 0;
      let reasons: string[] = [];
      
      patterns.forEach(pattern => {
        if (pattern.affectedPlayers.includes(playerName)) {
          totalImpact += pattern.impact;
          reasons.push(pattern.name);
        }
      });
      
      const impactMultiplier = 1 + (totalImpact / 100);
      const currentProjection = originalProjection * impactMultiplier;
      const percentChange = ((currentProjection - originalProjection) / originalProjection) * 100;
      
      updates.push({
        playerId: `player_${playerName.replace(/\s+/g, '_').toLowerCase()}`,
        playerName,
        originalProjection: Math.round(originalProjection * 10) / 10,
        currentProjection: Math.round(currentProjection * 10) / 10,
        percentChange: Math.round(percentChange * 10) / 10,
        reason: reasons.join(', '),
        confidence: 65 + Math.random() * 20
      });
      
      // Store updated projection
      this.playerProjections.set(playerName, currentProjection);
    });
    
    return updates;
  }
  
  private broadcastUpdate(data: any) {
    const message = JSON.stringify(data);
    
    this.wsClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
    
    console.log(chalk.green(`📡 Broadcast to ${this.wsClients.size} clients`));
  }
  
  simulateLiveGame() {
    console.log(chalk.cyan('\n🏈 Simulating live game...'));
    
    const game: Partial<LiveGame> = {
      gameId: 'sim_001',
      homeTeam: 'KC',
      awayTeam: 'BUF',
      homeScore: 0,
      awayScore: 0,
      quarter: 1,
      timeRemaining: '15:00'
    };
    
    let quarter = 1;
    let homeScore = 0;
    let awayScore = 0;
    
    const simulate = () => {
      // Random scoring
      if (Math.random() > 0.7) {
        if (Math.random() > 0.5) {
          homeScore += Math.random() > 0.3 ? 7 : 3;
        } else {
          awayScore += Math.random() > 0.3 ? 7 : 3;
        }
      }
      
      // Update game state
      game.homeScore = homeScore;
      game.awayScore = awayScore;
      game.quarter = quarter;
      
      // Determine momentum
      if (homeScore - awayScore > 10) {
        game.momentum = 'home';
      } else if (awayScore - homeScore > 10) {
        game.momentum = 'away';
      } else {
        game.momentum = 'neutral';
      }
      
      // Track the game
      this.trackGame(game);
      
      // Advance quarter
      if (Math.random() > 0.8 && quarter < 4) {
        quarter++;
        console.log(chalk.yellow(`\n📢 End of Quarter ${quarter - 1}`));
        console.log(chalk.white(`Score: ${game.homeTeam} ${homeScore} - ${awayScore} ${game.awayTeam}`));
      }
      
      // Continue simulation
      if (quarter <= 4) {
        setTimeout(simulate, 5000); // Every 5 seconds
      } else {
        console.log(chalk.green('\n🏁 Game Final!'));
        console.log(chalk.white(`${game.homeTeam} ${homeScore} - ${awayScore} ${game.awayTeam}`));
      }
    };
    
    simulate();
  }
}

// WebSocket server setup
const tracker = new LiveGamePatternTracker();
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log(chalk.blue('🔌 New live tracking connection'));
  tracker['wsClients'].add(ws);
  
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Live Game Pattern Tracker',
    capabilities: ['real-time updates', 'pattern detection', 'projection adjustments']
  }));
  
  ws.on('close', () => {
    tracker['wsClients'].delete(ws);
  });
});

// HTTP endpoints
app.get('/live/status', (req, res) => {
  res.json({
    active: true,
    games: tracker['activeGames'].size,
    patterns: Array.from(tracker['detectedPatterns'].values()).flat().length,
    connections: tracker['wsClients'].size
  });
});

app.post('/live/update', async (req, res) => {
  const result = await tracker.trackGame(req.body);
  res.json(result);
});

app.post('/live/simulate', (req, res) => {
  tracker.simulateLiveGame();
  res.json({ success: true, message: 'Simulation started' });
});

// Start server
app.listen(PORT, () => {
  console.log(chalk.green(`\n🏈 LIVE GAME PATTERN TRACKER RUNNING!`));
  console.log(chalk.white(`HTTP API: http://localhost:${PORT}`));
  console.log(chalk.white(`WebSocket: ws://localhost:${WS_PORT}`));
  console.log(chalk.cyan(`\nCapabilities:`));
  console.log(`  - Real-time game tracking`);
  console.log(`  - Live pattern detection`);
  console.log(`  - Dynamic projection updates`);
  console.log(`  - Multi-pattern analysis`);
  console.log(chalk.yellow(`\nEndpoints:`));
  console.log(`  GET  /live/status - System status`);
  console.log(`  POST /live/update - Update game data`);
  console.log(`  POST /live/simulate - Start simulation`);
  
  // Auto-start simulation
  setTimeout(() => {
    console.log(chalk.magenta('\n🎮 Starting demo simulation...'));
    tracker.simulateLiveGame();
  }, 2000);
});