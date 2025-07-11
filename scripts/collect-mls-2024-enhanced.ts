import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// MLS-specific enhanced collector
class MLSCollector {
    private playerCache = new Map<string, number>();
    private teamCache = new Map<string, number>();
    private processedGames = new Set<number>();
    
    async preloadCaches() {
        console.log('⚡ Loading MLS teams and players...');
        
        // Load MLS teams
        const { data: teams } = await supabase
            .from('teams')
            .select('id, external_id')
            .eq('sport', 'MLS');
            
        teams?.forEach(team => {
            if (team.external_id) this.teamCache.set(team.external_id, team.id);
        });
        
        // Load players
        let offset = 0;
        while (true) {
            const { data: players } = await supabase
                .from('players')
                .select('id, external_id')
                .eq('sport', 'MLS')
                .range(offset, offset + 999);
                
            if (!players || players.length === 0) break;
            
            players.forEach(player => {
                if (player.external_id) this.playerCache.set(player.external_id, player.id);
            });
            
            if (players.length < 1000) break;
            offset += 1000;
        }
        
        console.log(`✅ Loaded ${this.teamCache.size} teams and ${this.playerCache.size} players\n`);
    }
    
    // Calculate soccer-specific advanced metrics
    calculateSoccerMetrics(stats: any): any {
        const metrics: any = {};
        
        // Basic efficiency metrics
        metrics.goals_plus_assists = (stats.goals || 0) + (stats.assists || 0);
        metrics.shooting_accuracy = stats.shots > 0 ? (stats.shots_on_target || 0) / stats.shots : 0;
        metrics.shot_conversion_rate = stats.shots > 0 ? (stats.goals || 0) / stats.shots : 0;
        
        // Passing metrics
        if (stats.passes_attempted > 0) {
            metrics.pass_completion_rate = (stats.passes_completed || 0) / stats.passes_attempted;
            metrics.key_pass_rate = (stats.key_passes || 0) / stats.passes_attempted;
        }
        
        // Defensive metrics
        if (stats.tackles_attempted > 0) {
            metrics.tackle_success_rate = (stats.tackles_won || 0) / stats.tackles_attempted;
        }
        
        if (stats.duels_total > 0) {
            metrics.duel_success_rate = (stats.duels_won || 0) / stats.duels_total;
        }
        
        // Per 90 minute stats
        if (stats.minutes_played > 0) {
            const per90Factor = 90 / stats.minutes_played;
            metrics.goals_per_90 = (stats.goals || 0) * per90Factor;
            metrics.assists_per_90 = (stats.assists || 0) * per90Factor;
            metrics.shots_per_90 = (stats.shots || 0) * per90Factor;
            metrics.key_passes_per_90 = (stats.key_passes || 0) * per90Factor;
            metrics.tackles_per_90 = (stats.tackles_won || 0) * per90Factor;
        }
        
        // Special achievements
        metrics.hat_trick = (stats.goals || 0) >= 3;
        metrics.clean_sheet = stats.position === 'GK' && stats.goals_conceded === 0 && stats.minutes_played >= 60;
        metrics.penalty_scored = (stats.penalty_goals || 0) > 0;
        metrics.penalty_saved = (stats.penalty_saves || 0) > 0;
        
        // Expected goals (xG) would require shot location data
        // For now, estimate based on shots and shot quality
        if (stats.shots > 0) {
            const avgXgPerShot = 0.1; // Average xG per shot in MLS
            const qualityFactor = stats.shots_on_target > 0 ? stats.shots_on_target / stats.shots : 0.5;
            metrics.estimated_xg = stats.shots * avgXgPerShot * (1 + qualityFactor);
            metrics.goals_minus_xg = (stats.goals || 0) - metrics.estimated_xg;
        }
        
        // Goalkeeper-specific metrics
        if (stats.position === 'GK' && stats.shots_faced > 0) {
            metrics.save_percentage = (stats.saves || 0) / stats.shots_faced;
            metrics.goals_against_average = stats.minutes_played > 0 
                ? (stats.goals_conceded || 0) * 90 / stats.minutes_played 
                : 0;
        }
        
        return metrics;
    }
    
    // Parse MLS stats from ESPN API
    parseSoccerStats(playerData: any, position: string): any {
        const stats: any = {
            position: position,
            minutes_played: 0,
            goals: 0,
            assists: 0,
            shots: 0,
            shots_on_target: 0,
            passes_completed: 0,
            passes_attempted: 0,
            key_passes: 0,
            tackles_won: 0,
            tackles_attempted: 0,
            interceptions: 0,
            clearances: 0,
            blocks: 0,
            fouls_committed: 0,
            fouls_drawn: 0,
            yellow_cards: 0,
            red_cards: 0,
            offsides: 0,
            corners: 0,
            crosses: 0,
            duels_won: 0,
            duels_total: 0,
            dribbles_completed: 0,
            dribbles_attempted: 0
        };
        
        // ESPN typically provides stats in a specific order for soccer
        if (playerData.stats && playerData.stats.length > 0) {
            const s = playerData.stats;
            
            // Common field positions (may vary by position)
            stats.minutes_played = parseInt(s[0]) || 0;
            stats.goals = parseInt(s[1]) || 0;
            stats.assists = parseInt(s[2]) || 0;
            stats.shots = parseInt(s[3]) || 0;
            stats.shots_on_target = parseInt(s[4]) || 0;
            stats.fouls_committed = parseInt(s[5]) || 0;
            stats.fouls_drawn = parseInt(s[6]) || 0;
            stats.yellow_cards = parseInt(s[7]) || 0;
            stats.red_cards = parseInt(s[8]) || 0;
            stats.offsides = parseInt(s[9]) || 0;
            
            // Additional stats if available
            if (s.length > 10) {
                stats.passes_completed = parseInt(s[10]) || 0;
                stats.passes_attempted = parseInt(s[11]) || 0;
                stats.key_passes = parseInt(s[12]) || 0;
                stats.tackles_won = parseInt(s[13]) || 0;
                stats.interceptions = parseInt(s[14]) || 0;
                stats.clearances = parseInt(s[15]) || 0;
                stats.blocks = parseInt(s[16]) || 0;
            }
            
            // Goalkeeper specific stats
            if (position === 'GK' && s.length > 17) {
                stats.saves = parseInt(s[17]) || 0;
                stats.goals_conceded = parseInt(s[18]) || 0;
                stats.shots_faced = parseInt(s[19]) || 0;
                stats.penalty_saves = parseInt(s[20]) || 0;
            }
        }
        
        return stats;
    }
    
    // Calculate fantasy points for MLS
    calculateFantasyPoints(stats: any): number {
        let points = 0;
        
        // Scoring
        points += (stats.goals || 0) * 10;
        points += (stats.assists || 0) * 5;
        points += (stats.shots_on_target || 0) * 1;
        
        // Defensive
        points += (stats.tackles_won || 0) * 1;
        points += (stats.interceptions || 0) * 1;
        points += (stats.clearances || 0) * 0.5;
        points += (stats.blocks || 0) * 0.5;
        
        // Discipline
        points += (stats.yellow_cards || 0) * -2;
        points += (stats.red_cards || 0) * -5;
        points += (stats.fouls_committed || 0) * -0.5;
        
        // Goalkeeper bonuses
        if (stats.position === 'GK') {
            points += (stats.saves || 0) * 2;
            points += stats.clean_sheet ? 10 : 0;
            points += (stats.penalty_saves || 0) * 5;
            points -= (stats.goals_conceded || 0) * 2;
        }
        
        // Participation bonus
        if (stats.minutes_played >= 60) {
            points += 2;
        }
        
        return points;
    }
    
    async processGame(game: any): Promise<any[]> {
        const logs: any[] = [];
        
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/summary?event=${game.external_id}`;
            const { data } = await axios.get(url, { timeout: 5000 });
            
            if (!data?.boxscore?.players) return logs;
            
            const gameDate = new Date(game.start_time).toISOString().split('T')[0];
            
            // Get match info for metadata
            const matchInfo = {
                attendance: data.gameInfo?.attendance || null,
                venue: data.gameInfo?.venue?.fullName || game.venue,
                weather: data.gameInfo?.weather || null,
                officials: data.gameInfo?.officials || []
            };
            
            for (const teamPlayers of data.boxscore.players) {
                const teamId = this.teamCache.get(teamPlayers.team.id);
                if (!teamId) continue;
                
                const isHome = teamPlayers.homeAway === 'home';
                const opponentId = isHome ? game.away_team_id : game.home_team_id;
                
                if (teamPlayers.statistics) {
                    // Process different player categories (starters, subs, etc.)
                    for (const statGroup of teamPlayers.statistics) {
                        if (!statGroup.athletes) continue;
                        
                        for (const player of statGroup.athletes) {
                            if (!player.athlete || !player.stats) continue;
                            
                            const playerId = this.playerCache.get(player.athlete.id);
                            if (!playerId) {
                                // Log missing player for later addition
                                console.log(`Missing player: ${player.athlete.displayName} (${player.athlete.id})`);
                                continue;
                            }
                            
                            const position = player.position?.abbreviation || 'SUB';
                            const stats = this.parseSoccerStats(player, position);
                            
                            // Skip if didn't play
                            if (stats.minutes_played === 0) continue;
                            
                            const fantasy_points = this.calculateFantasyPoints(stats);
                            const computed_metrics = this.calculateSoccerMetrics(stats);
                            
                            // Build metadata
                            const metadata = {
                                starter: player.starter || statGroup.name === 'starters',
                                jersey_number: player.athlete.jersey,
                                position: position,
                                formation_position: player.position?.displayName,
                                captain: player.captain || false,
                                home_team: isHome,
                                match_info: matchInfo,
                                substituted_at: player.subbedOut || null,
                                substituted_in: player.subbedIn || null
                            };
                            
                            logs.push({
                                player_id: playerId,
                                game_id: game.id,
                                team_id: teamId,
                                game_date: gameDate,
                                opponent_id: opponentId,
                                is_home: isHome,
                                minutes_played: stats.minutes_played,
                                stats,
                                fantasy_points,
                                computed_metrics,
                                metadata
                            });
                        }
                    }
                }
            }
            
            this.processedGames.add(game.id);
            
        } catch (error: any) {
            console.error(`Error processing game ${game.id}:`, error.message);
        }
        
        return logs;
    }
    
    async collectMLSGames(startDate: string, endDate: string) {
        console.log(`\n📅 Collecting MLS games from ${startDate} to ${endDate}...`);
        
        const dates: string[] = [];
        const current = new Date(startDate);
        const end = new Date(endDate);
        
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0].replace(/-/g, ''));
            current.setDate(current.getDate() + 1);
        }
        
        let totalGames = 0;
        let totalLogs = 0;
        
        for (const date of dates) {
            try {
                const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${date}`;
                const { data } = await axios.get(url);
                
                if (data.events && data.events.length > 0) {
                    console.log(`\nProcessing ${data.events.length} games on ${date}...`);
                    
                    for (const event of data.events) {
                        if (event.status.type.completed) {
                            // Add game to database
                            const gameData = {
                                external_id: event.id,
                                sport: 'MLS',
                                home_team_id: this.teamCache.get(event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').id),
                                away_team_id: this.teamCache.get(event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').id),
                                start_time: event.date,
                                venue: event.competitions[0].venue?.fullName || 'Unknown',
                                home_score: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').score,
                                away_score: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').score,
                                status: 'STATUS_FINAL'
                            };
                            
                            // Skip if missing team IDs
                            if (!gameData.home_team_id || !gameData.away_team_id) {
                                console.log(`Skipping game ${event.id} - missing team IDs`);
                                continue;
                            }
                            
                            // Insert game
                            const { data: game, error } = await supabase
                                .from('games')
                                .upsert(gameData, {
                                    onConflict: 'external_id'
                                })
                                .select()
                                .single();
                                
                            if (game && !this.processedGames.has(game.id)) {
                                const logs = await this.processGame(game);
                                
                                if (logs.length > 0) {
                                    // Insert logs
                                    const { error: logError } = await supabase
                                        .from('player_game_logs')
                                        .insert(logs);
                                        
                                    if (!logError) {
                                        totalLogs += logs.length;
                                        console.log(`  ✅ Game ${game.id}: ${logs.length} player logs`);
                                    }
                                }
                                
                                totalGames++;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching games for ${date}:`, error);
            }
        }
        
        console.log(`\n🏆 MLS Collection Complete!`);
        console.log(`   Games: ${totalGames}`);
        console.log(`   Player logs: ${totalLogs}`);
        console.log(`   Avg logs/game: ${totalGames > 0 ? (totalLogs / totalGames).toFixed(1) : 0}`);
        
        return { games: totalGames, logs: totalLogs };
    }
}

async function collectMLS2024() {
    console.log('⚽ MLS 2024 ENHANCED COLLECTOR');
    console.log('==============================');
    console.log('With advanced metrics and complete data!\n');
    
    const collector = new MLSCollector();
    await collector.preloadCaches();
    
    // Check if we have MLS teams
    if (collector['teamCache'].size === 0) {
        console.log('❌ No MLS teams found! Need to add MLS teams first.');
        console.log('Run: npx tsx scripts/add-mls-teams.ts');
        return;
    }
    
    // Collect MLS 2024 season (February to October)
    const results = await collector.collectMLSGames('2024-02-21', '2024-10-31');
    
    // Update master log
    await fs.appendFile('master-collection.log',
        `\n${new Date().toISOString()} - MLS 2024 Collection:
        Games: ${results.games}
        Logs: ${results.logs}
        Status: Enhanced with advanced metrics!\n`
    );
}

collectMLS2024().catch(console.error);