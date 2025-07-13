import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Enhanced collector template with advanced metrics
export class EnhancedSportsCollector {
    private sport: string;
    private espnPath: string;
    private playerCache = new Map<string, number>();
    private teamCache = new Map<string, number>();
    
    constructor(sport: string, espnPath: string) {
        this.sport = sport;
        this.espnPath = espnPath;
    }
    
    async preloadCaches() {
        // Load teams
        const { data: teams } = await supabase
            .from('teams')
            .select('id, external_id')
            .eq('sport', this.sport);
            
        teams?.forEach(team => {
            if (team.external_id) this.teamCache.set(team.external_id, team.id);
        });
        
        // Load players
        const { data: players } = await supabase
            .from('players')
            .select('id, external_id')
            .eq('sport', this.sport);
            
        players?.forEach(player => {
            if (player.external_id) this.playerCache.set(player.external_id, player.id);
        });
        
        console.log(`✅ Loaded ${this.teamCache.size} teams and ${this.playerCache.size} players for ${this.sport}`);
    }
    
    // Calculate universal metrics that work across all sports
    calculateUniversalMetrics(stats: any, minutesPlayed: number): any {
        const metrics: any = {};
        
        if (minutesPlayed > 0) {
            // Per-minute efficiency
            metrics.fantasy_points_per_minute = stats.fantasy_points / minutesPlayed;
            
            // Activity rate
            const totalActions = Object.values(stats)
                .filter(v => typeof v === 'number')
                .reduce((sum: number, val: any) => sum + Math.abs(val), 0);
            metrics.activity_rate = totalActions / minutesPlayed;
        }
        
        return metrics;
    }
    
    // Basketball-specific advanced metrics
    calculateBasketballMetrics(stats: any): any {
        const metrics: any = {};
        
        // True Shooting Percentage
        const tsa = (stats.fg_attempted || 0) + 0.44 * (stats.ft_attempted || 0);
        metrics.true_shooting_pct = tsa > 0 ? (stats.points || 0) / (2 * tsa) : 0;
        
        // Effective Field Goal Percentage
        metrics.effective_fg_pct = stats.fg_attempted > 0 
            ? ((stats.fg_made || 0) + 0.5 * (stats.three_made || 0)) / stats.fg_attempted 
            : 0;
        
        // Assist to Turnover Ratio
        metrics.assist_to_turnover_ratio = stats.turnovers > 0 
            ? (stats.assists || 0) / stats.turnovers 
            : (stats.assists || 0);
        
        // Usage Rate (simplified)
        const possessions = (stats.fg_attempted || 0) + 0.44 * (stats.ft_attempted || 0) + (stats.turnovers || 0);
        metrics.usage_rate = stats.minutes_played > 0 ? (possessions / stats.minutes_played) * 48 : 0;
        
        // Double-Double and Triple-Double
        const doubleDigitStats = [
            (stats.points || 0) >= 10,
            (stats.rebounds || 0) >= 10,
            (stats.assists || 0) >= 10,
            (stats.steals || 0) >= 10,
            (stats.blocks || 0) >= 10
        ].filter(x => x).length;
        
        metrics.double_double = doubleDigitStats >= 2;
        metrics.triple_double = doubleDigitStats >= 3;
        
        // Game Score
        metrics.game_score = (stats.points || 0) + 0.4 * (stats.fg_made || 0) - 0.7 * (stats.fg_attempted || 0)
            - 0.4 * ((stats.ft_attempted || 0) - (stats.ft_made || 0)) + 0.7 * (stats.offensive_rebounds || 0)
            + 0.3 * ((stats.rebounds || 0) - (stats.offensive_rebounds || 0))
            + (stats.steals || 0) + 0.7 * (stats.assists || 0) + 0.7 * (stats.blocks || 0)
            - 0.4 * (stats.fouls || 0) - (stats.turnovers || 0);
        
        return metrics;
    }
    
    // Process game with enhanced metrics
    async processGameWithMetrics(game: any): Promise<any[]> {
        const logs: any[] = [];
        
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${this.espnPath}/summary?event=${game.external_id}`;
            const { data } = await axios.get(url, { timeout: 5000 });
            
            if (!data?.boxscore?.players) return logs;
            
            const gameDate = new Date(game.start_time).toISOString().split('T')[0];
            
            for (const teamPlayers of data.boxscore.players) {
                const teamId = this.teamCache.get(teamPlayers.team.id);
                if (!teamId) continue;
                
                const isHome = teamPlayers.homeAway === 'home';
                const opponentId = isHome ? game.away_team_id : game.home_team_id;
                
                if (teamPlayers.statistics?.[0]?.athletes) {
                    for (const player of teamPlayers.statistics[0].athletes) {
                        if (!player.athlete || !player.stats || player.stats.length === 0) continue;
                        
                        const playerId = this.playerCache.get(player.athlete.id);
                        if (!playerId) continue;
                        
                        // Parse stats based on sport
                        const stats = this.parseStatsForSport(player.stats);
                        const minutesPlayed = this.parseMinutesPlayed(player.stats[0]);
                        
                        // Calculate fantasy points
                        const fantasy_points = this.calculateFantasyPoints(stats);
                        
                        // Calculate advanced metrics
                        let computed_metrics = {};
                        if (this.sport === 'NBA' || this.sport === 'NCAA_BB') {
                            computed_metrics = {
                                ...this.calculateBasketballMetrics(stats),
                                ...this.calculateUniversalMetrics({ ...stats, fantasy_points }, minutesPlayed)
                            };
                        }
                        // Add other sport calculations here
                        
                        // Build metadata
                        const metadata = {
                            starter: player.starter || false,
                            dnp_reason: minutesPlayed === 0 ? player.stats[0] : null,
                            jersey_number: player.athlete.jersey,
                            position: player.position?.abbreviation,
                            home_team: isHome,
                            game_time: game.start_time,
                            venue: game.venue
                        };
                        
                        logs.push({
                            player_id: playerId,
                            game_id: game.id,
                            team_id: teamId,
                            game_date: gameDate,
                            opponent_id: opponentId,
                            is_home: isHome,
                            minutes_played: minutesPlayed,
                            stats,
                            fantasy_points,
                            computed_metrics,
                            metadata
                        });
                    }
                }
            }
            
            // Add team-level stats if needed for advanced metrics
            if (data.boxscore.teams) {
                // Store team stats for usage rate calculations, etc.
            }
            
        } catch (error) {
            console.error(`Error processing game ${game.id}:`, error);
        }
        
        return logs;
    }
    
    // Parse stats based on sport
    private parseStatsForSport(statsArray: any[]): any {
        const stats: any = {};
        
        switch (this.sport) {
            case 'NBA':
            case 'NCAA_BB':
                stats.points = parseInt(statsArray[18]) || 0;
                stats.rebounds = parseInt(statsArray[12]) || 0;
                stats.assists = parseInt(statsArray[13]) || 0;
                stats.steals = parseInt(statsArray[14]) || 0;
                stats.blocks = parseInt(statsArray[15]) || 0;
                stats.turnovers = parseInt(statsArray[16]) || 0;
                stats.fouls = parseInt(statsArray[17]) || 0;
                stats.fg_made = parseInt(statsArray[1]) || 0;
                stats.fg_attempted = parseInt(statsArray[2]) || 0;
                stats.fg_percentage = parseFloat(statsArray[3]) || 0;
                stats.three_made = parseInt(statsArray[4]) || 0;
                stats.three_attempted = parseInt(statsArray[5]) || 0;
                stats.three_percentage = parseFloat(statsArray[6]) || 0;
                stats.ft_made = parseInt(statsArray[7]) || 0;
                stats.ft_attempted = parseInt(statsArray[8]) || 0;
                stats.ft_percentage = parseFloat(statsArray[9]) || 0;
                stats.offensive_rebounds = parseInt(statsArray[10]) || 0;
                stats.defensive_rebounds = parseInt(statsArray[11]) || 0;
                break;
                
            case 'NFL':
            case 'NCAA_FB':
                // QB stats
                if (statsArray.length > 20) {
                    stats.passing_completions = parseInt(statsArray[0]?.split('/')[0]) || 0;
                    stats.passing_attempts = parseInt(statsArray[0]?.split('/')[1]) || 0;
                    stats.passing_yards = parseInt(statsArray[1]) || 0;
                    stats.passing_touchdowns = parseInt(statsArray[3]) || 0;
                    stats.passing_interceptions = parseInt(statsArray[4]) || 0;
                }
                // Add RB, WR, defensive stats...
                break;
                
            case 'MLB':
                // Batting stats
                stats.at_bats = parseInt(statsArray[0]) || 0;
                stats.runs = parseInt(statsArray[1]) || 0;
                stats.hits = parseInt(statsArray[2]) || 0;
                stats.doubles = parseInt(statsArray[3]) || 0;
                stats.triples = parseInt(statsArray[4]) || 0;
                stats.home_runs = parseInt(statsArray[5]) || 0;
                stats.rbi = parseInt(statsArray[6]) || 0;
                stats.walks = parseInt(statsArray[7]) || 0;
                stats.strikeouts = parseInt(statsArray[8]) || 0;
                stats.stolen_bases = parseInt(statsArray[9]) || 0;
                break;
                
            case 'NHL':
                stats.goals = parseInt(statsArray[0]) || 0;
                stats.assists = parseInt(statsArray[1]) || 0;
                stats.plus_minus = parseInt(statsArray[2]) || 0;
                stats.shots = parseInt(statsArray[3]) || 0;
                stats.hits = parseInt(statsArray[4]) || 0;
                stats.blocks = parseInt(statsArray[5]) || 0;
                stats.penalty_minutes = parseInt(statsArray[6]) || 0;
                stats.power_play_goals = parseInt(statsArray[7]) || 0;
                stats.power_play_assists = parseInt(statsArray[8]) || 0;
                stats.time_on_ice = this.parseTimeOnIce(statsArray[9]);
                break;
                
            case 'MLS':
                stats.goals = parseInt(statsArray[0]) || 0;
                stats.assists = parseInt(statsArray[1]) || 0;
                stats.shots = parseInt(statsArray[2]) || 0;
                stats.shots_on_target = parseInt(statsArray[3]) || 0;
                stats.passes_completed = parseInt(statsArray[4]) || 0;
                stats.passes_attempted = parseInt(statsArray[5]) || 0;
                stats.tackles_won = parseInt(statsArray[6]) || 0;
                stats.interceptions = parseInt(statsArray[7]) || 0;
                stats.fouls = parseInt(statsArray[8]) || 0;
                stats.yellow_cards = parseInt(statsArray[9]) || 0;
                stats.red_cards = parseInt(statsArray[10]) || 0;
                break;
        }
        
        return stats;
    }
    
    // Parse minutes played
    private parseMinutesPlayed(minutesStr: string): number {
        if (!minutesStr || minutesStr === 'DNP' || minutesStr === 'DND') return 0;
        
        if (minutesStr.includes(':')) {
            const [min, sec] = minutesStr.split(':').map(Number);
            return min + (sec / 60);
        }
        
        return parseInt(minutesStr) || 0;
    }
    
    // Parse time on ice for hockey
    private parseTimeOnIce(timeStr: string): number {
        if (!timeStr) return 0;
        const [min, sec] = timeStr.split(':').map(Number);
        return min * 60 + sec;
    }
    
    // Calculate fantasy points based on sport
    private calculateFantasyPoints(stats: any): number {
        switch (this.sport) {
            case 'NBA':
            case 'NCAA_BB':
                return (stats.points * 1) +
                    (stats.rebounds * 1.25) +
                    (stats.assists * 1.5) +
                    (stats.steals * 2) +
                    (stats.blocks * 2) +
                    (stats.turnovers * -0.5) +
                    (stats.three_made * 0.5);
                    
            case 'NFL':
            case 'NCAA_FB':
                // QB scoring
                return (stats.passing_yards * 0.04) +
                    (stats.passing_touchdowns * 4) +
                    (stats.passing_interceptions * -2) +
                    (stats.rushing_yards * 0.1) +
                    (stats.rushing_touchdowns * 6) +
                    (stats.receiving_yards * 0.1) +
                    (stats.receiving_touchdowns * 6);
                    
            case 'MLB':
                // Hitter scoring
                return (stats.runs * 2) +
                    (stats.rbi * 2) +
                    (stats.stolen_bases * 5) +
                    (stats.walks * 1) +
                    (stats.hits * 3) +
                    (stats.home_runs * 4);
                    
            case 'NHL':
                return (stats.goals * 3) +
                    (stats.assists * 2) +
                    (stats.shots * 0.5) +
                    (stats.blocks * 0.5) +
                    (stats.plus_minus * 1);
                    
            case 'MLS':
                return (stats.goals * 10) +
                    (stats.assists * 5) +
                    (stats.shots_on_target * 1) +
                    (stats.tackles_won * 1) +
                    (stats.interceptions * 1) +
                    (stats.yellow_cards * -2) +
                    (stats.red_cards * -5);
                    
            default:
                return 0;
        }
    }
}

// Example usage for new sports
async function collectMLSData() {
    const collector = new EnhancedSportsCollector('MLS', 'soccer/usa.1');
    await collector.preloadCaches();
    
    // Get MLS games
    const { data: games } = await supabase
        .from('games')
        .select('*')
        .eq('sport', 'MLS')
        .eq('status', 'STATUS_FINAL')
        .limit(100);
        
    if (!games) return;
    
    for (const game of games) {
        const logs = await collector.processGameWithMetrics(game);
        
        if (logs.length > 0) {
            // Insert with all advanced metrics
            await supabase
                .from('player_game_logs')
                .upsert(logs, {
                    onConflict: 'player_id,game_id',
                    ignoreDuplicates: true
                });
        }
    }
}