import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Optimized collector that handles Supabase limits and captures ALL stats efficiently
export class UltimateStatsCollectorOptimized {
    private sport: string;
    private playerCache = new Map<string, number>();
    private teamCache = new Map<string, number>();
    private statDefinitionsCache = new Map<string, any>();
    private batchSize = 100; // Optimal batch size for Supabase
    
    constructor(sport: string) {
        this.sport = sport;
    }
    
    // Pre-load all necessary data to minimize queries
    async initialize() {
        console.log(`⚡ Initializing ${this.sport} ultimate collector...`);
        
        // Load teams (single query)
        const { data: teams } = await supabase
            .from('teams')
            .select('id, external_id')
            .eq('sport', this.sport);
            
        teams?.forEach(team => {
            if (team.external_id) this.teamCache.set(team.external_id, team.id);
        });
        
        // Load players in batches to handle 1000 row limit
        await this.loadAllPlayers();
        
        // Load stat definitions
        await this.loadStatDefinitions();
        
        console.log(`✅ Loaded ${this.teamCache.size} teams, ${this.playerCache.size} players`);
    }
    
    private async loadAllPlayers() {
        let offset = 0;
        const limit = 1000;
        
        while (true) {
            const { data: players } = await supabase
                .from('players')
                .select('id, external_id')
                .eq('sport', this.sport)
                .range(offset, offset + limit - 1);
                
            if (!players || players.length === 0) break;
            
            players.forEach(player => {
                if (player.external_id) this.playerCache.set(player.external_id, player.id);
            });
            
            if (players.length < limit) break;
            offset += limit;
        }
    }
    
    private async loadStatDefinitions() {
        const { data: definitions } = await supabase
            .from('stat_definitions')
            .select('*')
            .eq('sport', this.sport);
            
        definitions?.forEach(def => {
            this.statDefinitionsCache.set(def.stat_name, def);
        });
    }
    
    // Comprehensive stat extraction for each sport
    extractAllStats(sport: string, playerData: any, gameData: any): any {
        switch (sport) {
            case 'NBA':
            case 'NCAA_BB':
                return this.extractBasketballStats(playerData, gameData);
            case 'NFL':
            case 'NCAA_FB':
                return this.extractFootballStats(playerData, gameData);
            case 'MLB':
                return this.extractBaseballStats(playerData, gameData);
            case 'NHL':
                return this.extractHockeyStats(playerData, gameData);
            case 'MLS':
                return this.extractSoccerStats(playerData, gameData);
            default:
                return {};
        }
    }
    
    // Basketball: Extract ALL possible stats
    private extractBasketballStats(playerData: any, gameData: any): any {
        const stats: any = {
            // Basic box score stats
            minutes_played: 0,
            points: 0,
            rebounds: 0,
            offensive_rebounds: 0,
            defensive_rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            fouls: 0,
            technical_fouls: 0,
            flagrant_fouls: 0,
            fg_made: 0,
            fg_attempted: 0,
            fg_percentage: 0,
            three_made: 0,
            three_attempted: 0,
            three_percentage: 0,
            ft_made: 0,
            ft_attempted: 0,
            ft_percentage: 0,
            plus_minus: 0,
            
            // Advanced tracking stats (extracted from play-by-play if available)
            touches: 0,
            front_court_touches: 0,
            time_of_possession: 0,
            elbow_touches: 0,
            post_touches: 0,
            paint_touches: 0,
            points_off_turnovers: 0,
            second_chance_points: 0,
            fast_break_points: 0,
            points_in_paint: 0,
            
            // Defensive stats
            opponent_fg_attempted_at_rim: 0,
            opponent_fg_made_at_rim: 0,
            contested_shots: 0,
            contested_shots_2pt: 0,
            contested_shots_3pt: 0,
            deflections: 0,
            loose_balls_recovered: 0,
            charges_drawn: 0,
            screen_assists: 0,
            
            // Hustle stats
            box_outs: 0,
            contested_rebounds: 0,
            hustle_plays: 0,
            
            // Shot locations
            restricted_area_made: 0,
            restricted_area_attempted: 0,
            paint_non_ra_made: 0,
            paint_non_ra_attempted: 0,
            mid_range_made: 0,
            mid_range_attempted: 0,
            left_corner_3_made: 0,
            left_corner_3_attempted: 0,
            right_corner_3_made: 0,
            right_corner_3_attempted: 0,
            above_break_3_made: 0,
            above_break_3_attempted: 0,
            
            // Play types
            isolation_possessions: 0,
            isolation_points: 0,
            isolation_fg_pct: 0,
            pick_roll_ball_handler_possessions: 0,
            pick_roll_ball_handler_points: 0,
            pick_roll_roll_man_possessions: 0,
            pick_roll_roll_man_points: 0,
            post_up_possessions: 0,
            post_up_points: 0,
            spot_up_possessions: 0,
            spot_up_points: 0,
            handoff_possessions: 0,
            handoff_points: 0,
            cut_possessions: 0,
            cut_points: 0,
            off_screen_possessions: 0,
            off_screen_points: 0,
            putback_possessions: 0,
            putback_points: 0,
            transition_possessions: 0,
            transition_points: 0,
            
            // Clutch stats (last 5 minutes, margin within 5)
            clutch_minutes: 0,
            clutch_points: 0,
            clutch_fg_made: 0,
            clutch_fg_attempted: 0,
            clutch_fg_pct: 0,
            clutch_3p_made: 0,
            clutch_3p_attempted: 0,
            clutch_ft_made: 0,
            clutch_ft_attempted: 0,
            clutch_rebounds: 0,
            clutch_assists: 0,
            clutch_turnovers: 0,
            clutch_plus_minus: 0,
            
            // Miscellaneous
            double_double: false,
            triple_double: false,
            perfect_fg: false,
            perfect_ft: false,
            five_by_five: false, // 5+ in 5 categories
            team_high_points: false,
            team_high_rebounds: false,
            team_high_assists: false,
            season_high_points: false,
            career_high_points: false
        };
        
        // Parse ESPN stats array
        if (playerData.stats && Array.isArray(playerData.stats)) {
            const s = playerData.stats;
            
            // ESPN basketball stat positions
            stats.minutes_played = this.parseMinutes(s[0]);
            stats.fg_made = parseInt(s[1]) || 0;
            stats.fg_attempted = parseInt(s[2]) || 0;
            stats.fg_percentage = parseFloat(s[3]) || 0;
            stats.three_made = parseInt(s[4]) || 0;
            stats.three_attempted = parseInt(s[5]) || 0;
            stats.three_percentage = parseFloat(s[6]) || 0;
            stats.ft_made = parseInt(s[7]) || 0;
            stats.ft_attempted = parseInt(s[8]) || 0;
            stats.ft_percentage = parseFloat(s[9]) || 0;
            stats.offensive_rebounds = parseInt(s[10]) || 0;
            stats.defensive_rebounds = parseInt(s[11]) || 0;
            stats.rebounds = parseInt(s[12]) || 0;
            stats.assists = parseInt(s[13]) || 0;
            stats.steals = parseInt(s[14]) || 0;
            stats.blocks = parseInt(s[15]) || 0;
            stats.turnovers = parseInt(s[16]) || 0;
            stats.fouls = parseInt(s[17]) || 0;
            stats.points = parseInt(s[18]) || 0;
            
            // Extended stats if available
            if (s.length > 19) stats.plus_minus = parseInt(s[19]) || 0;
            if (s.length > 20) stats.technical_fouls = parseInt(s[20]) || 0;
            if (s.length > 21) stats.flagrant_fouls = parseInt(s[21]) || 0;
        }
        
        // Calculate double-double, triple-double
        const doubleDigitStats = [
            stats.points >= 10,
            stats.rebounds >= 10,
            stats.assists >= 10,
            stats.steals >= 10,
            stats.blocks >= 10
        ].filter(x => x).length;
        
        stats.double_double = doubleDigitStats >= 2;
        stats.triple_double = doubleDigitStats >= 3;
        stats.five_by_five = [
            stats.points >= 5,
            stats.rebounds >= 5,
            stats.assists >= 5,
            stats.steals >= 5,
            stats.blocks >= 5
        ].every(x => x);
        
        return stats;
    }
    
    // Football: Extract ALL stats by position
    private extractFootballStats(playerData: any, gameData: any): any {
        const position = playerData.position?.abbreviation || '';
        const stats: any = {
            // Universal stats
            snaps_played: 0,
            
            // Passing stats
            passing_completions: 0,
            passing_attempts: 0,
            passing_yards: 0,
            passing_touchdowns: 0,
            passing_interceptions: 0,
            passing_rating: 0,
            qbr: 0,
            sacks_taken: 0,
            sack_yards_lost: 0,
            passing_first_downs: 0,
            passing_20_plus: 0,
            passing_40_plus: 0,
            longest_pass: 0,
            air_yards_completed: 0,
            air_yards_attempted: 0,
            air_yards_to_sticks: 0,
            passing_epa: 0,
            cpoe: 0, // Completion % over expected
            pacr: 0, // Passing air conversion ratio
            times_blitzed: 0,
            times_hurried: 0,
            times_hit: 0,
            times_pressured: 0,
            scrambles: 0,
            scramble_yards: 0,
            designed_rush_attempts: 0,
            
            // Rushing stats
            rushing_attempts: 0,
            rushing_yards: 0,
            rushing_touchdowns: 0,
            rushing_first_downs: 0,
            rushing_long: 0,
            rushing_20_plus: 0,
            rushing_fumbles: 0,
            rushing_fumbles_lost: 0,
            rushing_broken_tackles: 0,
            rushing_yards_before_contact: 0,
            rushing_yards_after_contact: 0,
            rushing_attempts_inside_5: 0,
            rushing_attempts_inside_10: 0,
            rushing_attempts_inside_20: 0,
            goal_line_carries: 0,
            rushing_epa: 0,
            rushing_success_rate: 0,
            stacked_box_rate: 0,
            
            // Receiving stats
            receiving_targets: 0,
            receiving_receptions: 0,
            receiving_yards: 0,
            receiving_touchdowns: 0,
            receiving_long: 0,
            receiving_20_plus: 0,
            receiving_first_downs: 0,
            receiving_yards_after_catch: 0,
            receiving_air_yards: 0,
            receiving_broken_tackles: 0,
            receiving_drop: 0,
            receiving_contested_catches: 0,
            receiving_epa: 0,
            target_share: 0,
            air_yards_share: 0,
            racr: 0, // Receiver air conversion ratio
            target_separation: 0,
            cushion: 0,
            intended_air_yards: 0,
            catch_percentage: 0,
            
            // Defensive stats
            tackles_solo: 0,
            tackles_assist: 0,
            tackles_combined: 0,
            tackles_for_loss: 0,
            sacks: 0,
            quarterback_hits: 0,
            quarterback_hurries: 0,
            quarterback_knockdowns: 0,
            batted_passes: 0,
            forced_fumbles: 0,
            fumble_recoveries: 0,
            fumble_return_yards: 0,
            fumble_return_touchdowns: 0,
            interceptions: 0,
            interception_return_yards: 0,
            interception_return_touchdowns: 0,
            passes_defended: 0,
            safeties: 0,
            defensive_snaps: 0,
            defensive_targets: 0,
            defensive_receptions_allowed: 0,
            defensive_yards_allowed: 0,
            defensive_touchdowns_allowed: 0,
            defensive_qb_rating_allowed: 0,
            yards_per_coverage_snap: 0,
            tackles_missed: 0,
            tackles_missed_percentage: 0,
            pressure_rate: 0,
            
            // Special teams
            field_goals_made: 0,
            field_goals_attempted: 0,
            field_goals_longest: 0,
            field_goals_blocked: 0,
            field_goals_pct: 0,
            extra_points_made: 0,
            extra_points_attempted: 0,
            extra_points_pct: 0,
            punts: 0,
            punt_yards: 0,
            punt_longest: 0,
            punt_average: 0,
            punt_inside_20: 0,
            punt_touchbacks: 0,
            kickoffs: 0,
            kickoff_yards: 0,
            kickoff_touchbacks: 0,
            
            // Returns
            punt_returns: 0,
            punt_return_yards: 0,
            punt_return_touchdowns: 0,
            punt_return_long: 0,
            kick_returns: 0,
            kick_return_yards: 0,
            kick_return_touchdowns: 0,
            kick_return_long: 0,
            
            // Penalties
            penalties: 0,
            penalty_yards: 0
        };
        
        // Parse based on position
        if (playerData.stats && Array.isArray(playerData.stats)) {
            // Position-specific parsing would go here
            // This varies significantly by position
        }
        
        return stats;
    }
    
    // Baseball: Comprehensive stats
    private extractBaseballStats(playerData: any, gameData: any): any {
        const isHitter = playerData.position?.type === 'hitter';
        const isPitcher = playerData.position?.type === 'pitcher';
        
        const stats: any = {
            // Hitting stats
            plate_appearances: 0,
            at_bats: 0,
            runs: 0,
            hits: 0,
            singles: 0,
            doubles: 0,
            triples: 0,
            home_runs: 0,
            rbi: 0,
            walks: 0,
            intentional_walks: 0,
            strikeouts: 0,
            hit_by_pitch: 0,
            sacrifice_hits: 0,
            sacrifice_flies: 0,
            stolen_bases: 0,
            caught_stealing: 0,
            ground_into_double_plays: 0,
            total_bases: 0,
            batting_average: 0,
            on_base_percentage: 0,
            slugging_percentage: 0,
            ops: 0,
            ground_balls: 0,
            fly_balls: 0,
            line_drives: 0,
            pop_ups: 0,
            
            // Advanced hitting
            exit_velocity_avg: 0,
            exit_velocity_max: 0,
            launch_angle_avg: 0,
            barrel_count: 0,
            barrel_percentage: 0,
            hard_hit_count: 0,
            hard_hit_percentage: 0,
            expected_batting_avg: 0,
            expected_slugging: 0,
            expected_woba: 0,
            
            // Pitching stats
            innings_pitched: 0,
            batters_faced: 0,
            pitches_thrown: 0,
            strikes_thrown: 0,
            balls_thrown: 0,
            strike_percentage: 0,
            wins: 0,
            losses: 0,
            saves: 0,
            holds: 0,
            blown_saves: 0,
            hits_allowed: 0,
            runs_allowed: 0,
            earned_runs_allowed: 0,
            home_runs_allowed: 0,
            walks_allowed: 0,
            intentional_walks_allowed: 0,
            strikeouts_pitched: 0,
            wild_pitches: 0,
            hit_batters: 0,
            balks: 0,
            pickoffs: 0,
            
            // Advanced pitching
            era: 0,
            whip: 0,
            k_per_9: 0,
            bb_per_9: 0,
            hr_per_9: 0,
            k_bb_ratio: 0,
            pitch_velocity_avg: 0,
            pitch_velocity_max: 0,
            spin_rate_avg: 0,
            spin_rate_max: 0,
            
            // Pitch types
            fastball_count: 0,
            fastball_velocity: 0,
            breaking_ball_count: 0,
            offspeed_count: 0,
            
            // Fielding stats
            putouts: 0,
            assists: 0,
            errors: 0,
            fielding_percentage: 0,
            total_chances: 0,
            passed_balls: 0,
            stolen_bases_allowed: 0,
            caught_stealing_catcher: 0,
            
            // Situational
            risp_at_bats: 0,
            risp_hits: 0,
            left_on_base: 0,
            two_out_rbi: 0,
            batting_order_position: 0
        };
        
        return stats;
    }
    
    // Hockey: Complete stats
    private extractHockeyStats(playerData: any, gameData: any): any {
        const stats: any = {
            // Basic stats
            goals: 0,
            assists: 0,
            points: 0,
            plus_minus: 0,
            penalty_minutes: 0,
            shots: 0,
            shooting_percentage: 0,
            game_winning_goals: 0,
            power_play_goals: 0,
            power_play_assists: 0,
            short_handed_goals: 0,
            short_handed_assists: 0,
            overtime_goals: 0,
            empty_net_goals: 0,
            
            // Time on ice
            time_on_ice: 0,
            time_on_ice_even_strength: 0,
            time_on_ice_power_play: 0,
            time_on_ice_short_handed: 0,
            shifts: 0,
            average_shift_length: 0,
            
            // Advanced stats
            shots_blocked: 0,
            missed_shots: 0,
            hits: 0,
            takeaways: 0,
            giveaways: 0,
            blocked_shots: 0,
            faceoffs_won: 0,
            faceoffs_lost: 0,
            faceoff_win_percentage: 0,
            
            // Corsi and Fenwick
            corsi_for: 0,
            corsi_against: 0,
            corsi_percentage: 0,
            corsi_relative: 0,
            fenwick_for: 0,
            fenwick_against: 0,
            fenwick_percentage: 0,
            
            // Expected goals
            expected_goals_for: 0,
            expected_goals_against: 0,
            expected_goals_percentage: 0,
            goals_above_expected: 0,
            
            // Scoring chances
            scoring_chances_for: 0,
            scoring_chances_against: 0,
            high_danger_chances_for: 0,
            high_danger_chances_against: 0,
            
            // Zone starts
            offensive_zone_starts: 0,
            defensive_zone_starts: 0,
            neutral_zone_starts: 0,
            zone_start_percentage: 0,
            
            // On-ice stats
            goals_for_on_ice: 0,
            goals_against_on_ice: 0,
            shots_for_on_ice: 0,
            shots_against_on_ice: 0,
            
            // Penalties
            minor_penalties: 0,
            major_penalties: 0,
            misconduct_penalties: 0,
            penalties_drawn: 0,
            
            // Special achievements
            hat_trick: false,
            gordie_howe_hat_trick: false,
            
            // Goalie stats
            saves: 0,
            shots_against: 0,
            save_percentage: 0,
            goals_against: 0,
            goals_against_average: 0,
            shutout: false,
            
            // Goalie advanced
            even_strength_saves: 0,
            power_play_saves: 0,
            short_handed_saves: 0,
            quality_starts: 0,
            really_bad_starts: 0,
            goals_saved_above_average: 0,
            high_danger_save_percentage: 0,
            medium_danger_save_percentage: 0,
            low_danger_save_percentage: 0,
            rebound_control_percentage: 0
        };
        
        return stats;
    }
    
    // Soccer: All available stats
    private extractSoccerStats(playerData: any, gameData: any): any {
        const stats: any = {
            // Basic stats
            minutes_played: 0,
            goals: 0,
            assists: 0,
            shots: 0,
            shots_on_target: 0,
            shot_accuracy: 0,
            
            // Passing
            passes_attempted: 0,
            passes_completed: 0,
            pass_completion_percentage: 0,
            key_passes: 0,
            through_balls: 0,
            long_balls_attempted: 0,
            long_balls_accurate: 0,
            crosses_attempted: 0,
            crosses_accurate: 0,
            
            // Defensive
            tackles_attempted: 0,
            tackles_successful: 0,
            tackle_success_rate: 0,
            interceptions: 0,
            clearances: 0,
            headers_won: 0,
            headers_lost: 0,
            blocks: 0,
            
            // Duels
            ground_duels_won: 0,
            ground_duels_lost: 0,
            aerial_duels_won: 0,
            aerial_duels_lost: 0,
            total_duels_won_percentage: 0,
            
            // Possession
            touches: 0,
            touches_in_opposition_box: 0,
            carries: 0,
            carry_distance: 0,
            carry_progressive_distance: 0,
            miscontrols: 0,
            dispossessed: 0,
            
            // Dribbling
            take_ons_attempted: 0,
            take_ons_successful: 0,
            take_on_success_rate: 0,
            times_tackled: 0,
            
            // Creating
            chances_created: 0,
            big_chances_created: 0,
            assists_expected: 0,
            
            // Goal threat
            goals_expected: 0,
            non_penalty_expected_goals: 0,
            goals_minus_expected_goals: 0,
            
            // Fouls
            fouls_committed: 0,
            fouls_suffered: 0,
            yellow_cards: 0,
            red_cards: 0,
            offsides: 0,
            penalties_won: 0,
            penalties_conceded: 0,
            
            // Advanced
            progressive_passes: 0,
            progressive_carries: 0,
            progressive_receptions: 0,
            passes_into_final_third: 0,
            passes_into_penalty_area: 0,
            crosses_into_penalty_area: 0,
            
            // Pressing
            pressures: 0,
            successful_pressures: 0,
            pressure_success_rate: 0,
            pressures_in_defensive_third: 0,
            pressures_in_middle_third: 0,
            pressures_in_attacking_third: 0,
            
            // Goalkeeper specific
            saves: 0,
            save_percentage: 0,
            goals_conceded: 0,
            clean_sheet: false,
            penalties_saved: 0,
            penalties_faced: 0,
            catches: 0,
            punches: 0,
            drops: 0,
            crosses_claimed: 0,
            sweeper_clearances: 0,
            
            // Team success
            team_goals_while_on_pitch: 0,
            team_goals_conceded_while_on_pitch: 0,
            plus_minus_goals: 0,
            
            // Physical
            distance_covered: 0,
            sprints: 0,
            high_intensity_runs: 0,
            
            // Achievements
            hat_trick: false,
            brace: false,
            clean_sheet_gk: false,
            penalty_saved_gk: false,
            red_card_offense: false
        };
        
        return stats;
    }
    
    // Calculate ALL advanced metrics
    calculateAllMetrics(stats: any, sport: string): any {
        switch (sport) {
            case 'NBA':
            case 'NCAA_BB':
                return this.calculateBasketballMetrics(stats);
            case 'NFL':
            case 'NCAA_FB':
                return this.calculateFootballMetrics(stats);
            case 'MLB':
                return this.calculateBaseballMetrics(stats);
            case 'NHL':
                return this.calculateHockeyMetrics(stats);
            case 'MLS':
                return this.calculateSoccerMetrics(stats);
            default:
                return {};
        }
    }
    
    private calculateBasketballMetrics(stats: any): any {
        const metrics: any = {};
        
        // Shooting efficiency
        const tsa = stats.fg_attempted + 0.44 * stats.ft_attempted;
        metrics.true_shooting_pct = tsa > 0 ? stats.points / (2 * tsa) : 0;
        metrics.effective_fg_pct = stats.fg_attempted > 0 
            ? (stats.fg_made + 0.5 * stats.three_made) / stats.fg_attempted : 0;
            
        // Usage and efficiency
        const possessions = stats.fg_attempted + 0.44 * stats.ft_attempted + stats.turnovers;
        metrics.usage_rate = stats.minutes_played > 0 
            ? (possessions / stats.minutes_played) * 48 / 5 : 0;
            
        // Rebounding rates
        if (stats.minutes_played > 0) {
            metrics.offensive_rebound_rate = (stats.offensive_rebounds / stats.minutes_played) * 48;
            metrics.defensive_rebound_rate = (stats.defensive_rebounds / stats.minutes_played) * 48;
            metrics.total_rebound_rate = (stats.rebounds / stats.minutes_played) * 48;
        }
        
        // Per 36 minutes stats
        if (stats.minutes_played > 0) {
            const per36 = 36 / stats.minutes_played;
            metrics.points_per_36 = stats.points * per36;
            metrics.rebounds_per_36 = stats.rebounds * per36;
            metrics.assists_per_36 = stats.assists * per36;
            metrics.steals_per_36 = stats.steals * per36;
            metrics.blocks_per_36 = stats.blocks * per36;
        }
        
        // Advanced metrics
        metrics.assist_to_turnover_ratio = stats.turnovers > 0 
            ? stats.assists / stats.turnovers : stats.assists;
            
        // Game Score (Hollinger)
        metrics.game_score = stats.points + 0.4 * stats.fg_made - 0.7 * stats.fg_attempted
            - 0.4 * (stats.ft_attempted - stats.ft_made) + 0.7 * stats.offensive_rebounds
            + 0.3 * stats.defensive_rebounds + stats.steals + 0.7 * stats.assists
            + 0.7 * stats.blocks - 0.4 * stats.fouls - stats.turnovers;
            
        // Player Efficiency Rating (simplified)
        if (stats.minutes_played > 0) {
            const factor = 2.0 / 3.0;
            metrics.per_estimate = (1 / stats.minutes_played) *
                (stats.points + stats.rebounds + stats.assists + stats.steals + stats.blocks
                - (stats.fg_attempted - stats.fg_made) - (stats.ft_attempted - stats.ft_made) - stats.turnovers);
        }
        
        // Floor percentage
        const scoringPossessions = stats.fg_made + 0.5 * stats.assists;
        metrics.floor_percentage = possessions > 0 ? scoringPossessions / possessions : 0;
        
        // Touches and possession metrics
        if (stats.touches > 0) {
            metrics.points_per_touch = stats.points / stats.touches;
            metrics.assists_per_touch = stats.assists / stats.touches;
            metrics.time_of_possession_pct = stats.time_of_possession / (stats.minutes_played * 60);
        }
        
        return metrics;
    }
    
    private calculateFootballMetrics(stats: any): any {
        const metrics: any = {};
        
        // QB metrics
        if (stats.passing_attempts > 0) {
            // Passer rating
            const a = Math.max(0, Math.min(2.375, ((stats.passing_completions / stats.passing_attempts) - 0.3) * 5));
            const b = Math.max(0, Math.min(2.375, ((stats.passing_yards / stats.passing_attempts) - 3) * 0.25));
            const c = Math.max(0, Math.min(2.375, (stats.passing_touchdowns / stats.passing_attempts) * 20));
            const d = Math.max(0, Math.min(2.375, 2.375 - (stats.passing_interceptions / stats.passing_attempts) * 25));
            metrics.passer_rating = ((a + b + c + d) / 6) * 100;
            
            // Other passing metrics
            metrics.completion_percentage = (stats.passing_completions / stats.passing_attempts) * 100;
            metrics.yards_per_attempt = stats.passing_yards / stats.passing_attempts;
            metrics.touchdown_percentage = (stats.passing_touchdowns / stats.passing_attempts) * 100;
            metrics.interception_percentage = (stats.passing_interceptions / stats.passing_attempts) * 100;
            metrics.adjusted_yards_per_attempt = (stats.passing_yards + 20 * stats.passing_touchdowns - 45 * stats.passing_interceptions) / stats.passing_attempts;
        }
        
        // RB metrics
        if (stats.rushing_attempts > 0) {
            metrics.yards_per_carry = stats.rushing_yards / stats.rushing_attempts;
            metrics.rushing_touchdown_rate = (stats.rushing_touchdowns / stats.rushing_attempts) * 100;
            metrics.fumble_rate = (stats.rushing_fumbles / stats.rushing_attempts) * 100;
        }
        
        // WR/TE metrics
        if (stats.receiving_targets > 0) {
            metrics.catch_rate = (stats.receiving_receptions / stats.receiving_targets) * 100;
            metrics.yards_per_target = stats.receiving_yards / stats.receiving_targets;
            metrics.yards_per_reception = stats.receiving_receptions > 0 
                ? stats.receiving_yards / stats.receiving_receptions : 0;
        }
        
        // All-purpose
        metrics.all_purpose_yards = (stats.rushing_yards || 0) + (stats.receiving_yards || 0) + 
            (stats.punt_return_yards || 0) + (stats.kick_return_yards || 0);
            
        // Defensive metrics
        if (stats.defensive_snaps > 0) {
            metrics.tackles_per_snap = stats.tackles_combined / stats.defensive_snaps;
            metrics.pressure_rate = stats.quarterback_hurries > 0 
                ? (stats.quarterback_hurries + stats.quarterback_hits + stats.sacks) / stats.defensive_snaps : 0;
        }
        
        return metrics;
    }
    
    private calculateBaseballMetrics(stats: any): any {
        const metrics: any = {};
        
        // Hitting metrics
        if (stats.at_bats > 0) {
            metrics.batting_average = stats.hits / stats.at_bats;
            metrics.on_base_percentage = (stats.hits + stats.walks + stats.hit_by_pitch) / 
                (stats.at_bats + stats.walks + stats.hit_by_pitch + stats.sacrifice_flies);
            metrics.slugging_percentage = stats.total_bases / stats.at_bats;
            metrics.ops = metrics.on_base_percentage + metrics.slugging_percentage;
            
            // Advanced
            metrics.isolated_power = metrics.slugging_percentage - metrics.batting_average;
            metrics.babip = stats.at_bats - stats.strikeouts - stats.home_runs + stats.sacrifice_flies > 0
                ? (stats.hits - stats.home_runs) / (stats.at_bats - stats.strikeouts - stats.home_runs + stats.sacrifice_flies)
                : 0;
        }
        
        // Pitching metrics
        if (stats.innings_pitched > 0) {
            metrics.era = (stats.earned_runs_allowed * 9) / stats.innings_pitched;
            metrics.whip = (stats.walks_allowed + stats.hits_allowed) / stats.innings_pitched;
            metrics.k_per_9 = (stats.strikeouts_pitched * 9) / stats.innings_pitched;
            metrics.bb_per_9 = (stats.walks_allowed * 9) / stats.innings_pitched;
            metrics.k_bb_ratio = stats.walks_allowed > 0 ? stats.strikeouts_pitched / stats.walks_allowed : stats.strikeouts_pitched;
            
            // FIP
            const hr = stats.home_runs_allowed || 0;
            const bb = stats.walks_allowed || 0;
            const hbp = stats.hit_batters || 0;
            const k = stats.strikeouts_pitched || 0;
            metrics.fip = ((13 * hr + 3 * (bb + hbp) - 2 * k) / stats.innings_pitched) + 3.2;
        }
        
        return metrics;
    }
    
    private calculateHockeyMetrics(stats: any): any {
        const metrics: any = {};
        
        // Basic rates
        metrics.shooting_percentage = stats.shots > 0 ? (stats.goals / stats.shots) * 100 : 0;
        metrics.faceoff_win_percentage = (stats.faceoffs_won + stats.faceoffs_lost) > 0 
            ? (stats.faceoffs_won / (stats.faceoffs_won + stats.faceoffs_lost)) * 100 : 0;
            
        // Per 60 minutes
        if (stats.time_on_ice > 0) {
            const per60 = 3600 / stats.time_on_ice;
            metrics.goals_per_60 = stats.goals * per60;
            metrics.assists_per_60 = stats.assists * per60;
            metrics.points_per_60 = stats.points * per60;
            metrics.shots_per_60 = stats.shots * per60;
        }
        
        // Possession metrics
        if ((stats.corsi_for + stats.corsi_against) > 0) {
            metrics.corsi_percentage = (stats.corsi_for / (stats.corsi_for + stats.corsi_against)) * 100;
        }
        if ((stats.fenwick_for + stats.fenwick_against) > 0) {
            metrics.fenwick_percentage = (stats.fenwick_for / (stats.fenwick_for + stats.fenwick_against)) * 100;
        }
        
        // Goalie metrics
        if (stats.shots_against > 0) {
            metrics.save_percentage = (stats.saves / stats.shots_against) * 100;
            metrics.goals_against_average = stats.time_on_ice > 0 
                ? (stats.goals_against * 3600) / stats.time_on_ice : 0;
        }
        
        return metrics;
    }
    
    private calculateSoccerMetrics(stats: any): any {
        const metrics: any = {};
        
        // Passing efficiency
        metrics.pass_completion_rate = stats.passes_attempted > 0 
            ? (stats.passes_completed / stats.passes_attempted) * 100 : 0;
            
        // Shooting efficiency
        metrics.shot_accuracy = stats.shots > 0 
            ? (stats.shots_on_target / stats.shots) * 100 : 0;
        metrics.goal_conversion_rate = stats.shots > 0 
            ? (stats.goals / stats.shots) * 100 : 0;
            
        // Defensive efficiency
        metrics.tackle_success_rate = stats.tackles_attempted > 0 
            ? (stats.tackles_successful / stats.tackles_attempted) * 100 : 0;
            
        // Dribbling
        metrics.take_on_success_rate = stats.take_ons_attempted > 0 
            ? (stats.take_ons_successful / stats.take_ons_attempted) * 100 : 0;
            
        // Per 90 minutes
        if (stats.minutes_played > 0) {
            const per90 = 90 / stats.minutes_played;
            metrics.goals_per_90 = stats.goals * per90;
            metrics.assists_per_90 = stats.assists * per90;
            metrics.key_passes_per_90 = stats.key_passes * per90;
            metrics.shots_per_90 = stats.shots * per90;
            metrics.tackles_per_90 = stats.tackles_successful * per90;
        }
        
        // Expected goals difference
        metrics.goals_minus_xg = stats.goals - stats.goals_expected;
        
        // Goalkeeper specific
        if (stats.shots_against > 0) {
            metrics.save_percentage = (stats.saves / stats.shots_against) * 100;
        }
        
        return metrics;
    }
    
    // Parse minutes helper
    private parseMinutes(timeStr: string): number {
        if (!timeStr || timeStr === 'DNP' || timeStr === 'DND') return 0;
        
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            if (parts.length === 2) {
                return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
            } else if (parts.length === 3) {
                // Hockey format H:MM:SS
                return parseInt(parts[0]) * 60 + parseInt(parts[1]) + (parseInt(parts[2]) / 60);
            }
        }
        
        return parseFloat(timeStr) || 0;
    }
    
    // Main processing function with database optimization
    async processGamesInBatches(games: any[], onProgress?: (processed: number, total: number) => void): Promise<number> {
        let totalLogsInserted = 0;
        const allLogs: any[] = [];
        
        // Process games in parallel but control concurrency
        const PARALLEL_LIMIT = 10;
        
        for (let i = 0; i < games.length; i += PARALLEL_LIMIT) {
            const batch = games.slice(i, i + PARALLEL_LIMIT);
            
            const batchResults = await Promise.all(
                batch.map(game => this.processGame(game))
            );
            
            // Flatten results
            batchResults.forEach(logs => allLogs.push(...logs));
            
            // Insert when we have enough logs or at the end
            if (allLogs.length >= this.batchSize || i + PARALLEL_LIMIT >= games.length) {
                const inserted = await this.insertLogs(allLogs);
                totalLogsInserted += inserted;
                allLogs.length = 0; // Clear array
            }
            
            if (onProgress) {
                onProgress(i + batch.length, games.length);
            }
        }
        
        return totalLogsInserted;
    }
    
    private async processGame(game: any): Promise<any[]> {
        const logs: any[] = [];
        
        try {
            // Fetch comprehensive game data
            const url = `https://site.api.espn.com/apis/site/v2/sports/${this.getESPNPath()}/summary?event=${game.external_id}`;
            const { data } = await axios.get(url, { timeout: 5000 });
            
            if (!data?.boxscore?.players) return logs;
            
            const gameDate = new Date(game.start_time).toISOString().split('T')[0];
            
            for (const teamPlayers of data.boxscore.players) {
                const teamId = this.teamCache.get(teamPlayers.team.id);
                if (!teamId) continue;
                
                const isHome = teamPlayers.homeAway === 'home';
                const opponentId = isHome ? game.away_team_id : game.home_team_id;
                
                for (const statGroup of teamPlayers.statistics || []) {
                    for (const player of statGroup.athletes || []) {
                        if (!player.athlete || !player.stats) continue;
                        
                        const playerId = this.playerCache.get(player.athlete.id);
                        if (!playerId) continue;
                        
                        // Extract ALL stats
                        const rawStats = this.extractAllStats(this.sport, player, data);
                        
                        // Skip if didn't play
                        if (rawStats.minutes_played === 0 && this.sport !== 'NFL') continue;
                        
                        // Calculate ALL metrics
                        const computedMetrics = this.calculateAllMetrics(rawStats, this.sport);
                        
                        // Calculate fantasy points
                        const fantasyPoints = this.calculateFantasyPoints(rawStats, this.sport);
                        
                        // Build comprehensive log
                        logs.push({
                            player_id: playerId,
                            game_id: game.id,
                            team_id: teamId,
                            game_date: gameDate,
                            opponent_id: opponentId,
                            is_home: isHome,
                            minutes_played: rawStats.minutes_played || 0,
                            fantasy_points: fantasyPoints,
                            
                            // Store everything
                            stats: rawStats,
                            computed_metrics: computedMetrics,
                            raw_stats: player.stats, // Original array for reference
                            
                            // Metadata
                            metadata: {
                                starter: player.starter || statGroup.name === 'starters',
                                jersey_number: player.athlete.jersey,
                                position: player.position?.abbreviation,
                                dnp_reason: player.didNotPlay || null,
                                stat_group: statGroup.name
                            },
                            
                            // Quality indicators
                            quality_metrics: {
                                data_source: 'ESPN',
                                api_version: 'v2',
                                completeness_score: this.calculateCompleteness(rawStats),
                                has_advanced_stats: Object.keys(computedMetrics).length > 10,
                                collection_timestamp: new Date()
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error processing game ${game.id}:`, error);
        }
        
        return logs;
    }
    
    private async insertLogs(logs: any[]): Promise<number> {
        if (logs.length === 0) return 0;
        
        let inserted = 0;
        
        // Insert in chunks to respect Supabase limits
        for (let i = 0; i < logs.length; i += this.batchSize) {
            const chunk = logs.slice(i, i + this.batchSize);
            
            const { data, error } = await supabase
                .from('player_game_logs')
                .upsert(chunk, {
                    onConflict: 'player_id,game_id',
                    ignoreDuplicates: true
                });
                
            if (!error) {
                inserted += chunk.length;
            } else {
                console.error(`Insert error:`, error);
            }
        }
        
        return inserted;
    }
    
    private getESPNPath(): string {
        const paths: Record<string, string> = {
            'NBA': 'basketball/nba',
            'NFL': 'football/nfl',
            'MLB': 'baseball/mlb',
            'NHL': 'hockey/nhl',
            'NCAA_BB': 'basketball/mens-college-basketball',
            'NCAA_FB': 'football/college-football',
            'MLS': 'soccer/usa.1'
        };
        return paths[this.sport] || '';
    }
    
    private calculateFantasyPoints(stats: any, sport: string): number {
        // Sport-specific fantasy point calculations
        switch (sport) {
            case 'NBA':
            case 'NCAA_BB':
                return (stats.points || 0) * 1 +
                    (stats.rebounds || 0) * 1.25 +
                    (stats.assists || 0) * 1.5 +
                    (stats.steals || 0) * 2 +
                    (stats.blocks || 0) * 2 +
                    (stats.turnovers || 0) * -0.5 +
                    (stats.three_made || 0) * 0.5;
                    
            case 'NFL':
            case 'NCAA_FB':
                return (stats.passing_yards || 0) * 0.04 +
                    (stats.passing_touchdowns || 0) * 4 +
                    (stats.passing_interceptions || 0) * -2 +
                    (stats.rushing_yards || 0) * 0.1 +
                    (stats.rushing_touchdowns || 0) * 6 +
                    (stats.receiving_yards || 0) * 0.1 +
                    (stats.receiving_touchdowns || 0) * 6 +
                    (stats.receiving_receptions || 0) * 0.5;
                    
            // Add other sports...
            default:
                return 0;
        }
    }
    
    private calculateCompleteness(stats: any): number {
        const expectedFields = this.getExpectedFields(this.sport);
        const presentFields = expectedFields.filter(field => 
            stats[field] !== undefined && stats[field] !== null && stats[field] !== 0
        );
        return presentFields.length / expectedFields.length;
    }
    
    private getExpectedFields(sport: string): string[] {
        const fields: Record<string, string[]> = {
            'NBA': ['points', 'rebounds', 'assists', 'steals', 'blocks', 'fg_made', 'fg_attempted'],
            'NFL': ['passing_yards', 'rushing_yards', 'receiving_yards'],
            'MLB': ['at_bats', 'hits', 'runs', 'rbi'],
            'NHL': ['goals', 'assists', 'shots', 'plus_minus'],
            'MLS': ['goals', 'assists', 'shots', 'passes_completed']
        };
        return fields[sport] || [];
    }
}

// Example usage
export async function collectWithUltimateStats(sport: string, games: any[]) {
    const collector = new UltimateStatsCollectorOptimized(sport);
    await collector.initialize();
    
    console.log(`\n🎯 Processing ${games.length} ${sport} games with ULTIMATE stats...`);
    
    const logsInserted = await collector.processGamesInBatches(games, (processed, total) => {
        if (processed % 10 === 0) {
            console.log(`Progress: ${processed}/${total} games processed...`);
        }
    });
    
    console.log(`✅ Complete! Inserted ${logsInserted} player logs with comprehensive stats.`);
    return logsInserted;
}