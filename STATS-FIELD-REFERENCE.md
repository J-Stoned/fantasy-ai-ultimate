# 📊 STATS FIELD REFERENCE - NEVER FORGET AGAIN!
**Updated with ACTUAL database field discovery - 2025-07-11**

## 🏀 NBA Stats Field Names (games.sport = "NBA")

### ACTUAL Fields Found in Database (SNAKE_CASE!):
- `points` - Total points scored
- `field_goals_made` - Field goals made  
- `field_goals_attempted` - Field goals attempted
- `three_pointers_made` - Three-pointers made
- `three_pointers_attempted` - Three-pointers attempted
- `free_throws_made` - Free throws made
- `free_throws_attempted` - Free throws attempted
- `rebounds` - Total rebounds
- `assists` - Assists
- `steals` - Steals
- `blocks` - Blocks
- `turnovers` - Turnovers
- `minutes_played` - Minutes played (number)
- `fantasy_points` - Fantasy points calculated

## 🏈 NFL Stats Field Names 

### NFL_uppercase (games.sport = "NFL") - MIXED NAMING:
**Offensive (camelCase):**
- `targets` - Times targeted (number)
- `receptions` - Receptions (number)
- `receivingTDs` - Receiving TDs (number)
- `receivingYards` - Receiving yards (number)
- `yardsPerReception` - Yards per reception (number)
- `carries` - Rushing attempts (number)
- `rushingTDs` - Rushing TDs (number)
- `rushingYards` - Rushing yards (number)
- `yardsPerCarry` - Yards per carry (number)

**Defensive (STRING - needs conversion!):**
- `defensive_td` - Defensive TDs (string)
- `defensive_tot` - Total tackles (string)
- `defensive_tfl` - Tackles for loss (string)
- `defensive_solo` - Solo tackles (string)
- `defensive_sacks` - Sacks (string)
- `defensive_qb_hts` - QB hits (string)

### NFL_lowercase (games.sport = "nfl") - SNAKE_CASE:
**Passing:**
- `passing_yards` - Passing yards (number)
- `passing_attempts` - Pass attempts (number)
- `passing_touchdowns` - Passing TDs (number)
- `passing_completions` - Completions (number)
- `passing_interceptions` - INTs thrown (number)

**Rushing:**
- `rushing_yards` - Rushing yards (number)
- `rushing_attempts` - Carries (number)
- `rushing_touchdowns` - Rushing TDs (number)

**Receiving:**
- `receiving_yards` - Receiving yards (number)
- `receiving_receptions` - Receptions (number)
- `receiving_touchdowns` - Receiving TDs (number)

## ⚾ MLB Stats Field Names (games.sport = "MLB")

### ❌ DATA CORRUPTION DETECTED!
**MLB data contains BASKETBALL fields instead of baseball:**
- `points`, `field_goals_made`, `rebounds`, `assists` (WRONG!)
- `fantasy_points`, `minutes_played`, `blocks`, `steals` (WRONG!)

**This needs to be fixed before MLB metrics can be calculated.**

### Expected Baseball Fields (NOT FOUND):
- `at_bats`, `hits`, `doubles`, `triples`, `home_runs`
- `runs`, `runs_batted_in`, `walks`, `strikeouts`
- `batting_average`, `on_base_percentage`, `slugging_percentage`
- `innings_pitched`, `earned_runs`, `wins`, `losses`, `saves`

## 🏒 NHL Stats Field Names (games.sport = "NHL")

### ACTUAL Fields Found (camelCase):
**Skater Stats:**
- `goals` - Goals (number)
- `assists` - Assists (number)
- `points` - Points (number)
- `shots` - Shots on goal (number)
- `hits` - Hits (number)
- `plusMinus` - Plus/minus (number)
- `blockedShots` - Blocked shots (number)
- `penaltyMinutes` - Penalty minutes (number)
- `timeOnIce` - Time on ice (STRING - needs conversion!)

**Goalie Stats:**
- `saves` - Saves (number)
- `shutouts` - Shutouts (number)
- `goalsAgainst` - Goals against (number)
- `shotsAgainst` - Shots against (number)
- `savePercentage` - Save percentage (number)
- `wins` - Wins (number)

## ⚽ MLS/NCAA_SOC Stats Field Names:

### Field Player:
- `goals` - Goals
- `assists` - Assists
- `shots` - Total shots
- `shots_on_target` - Shots on target
- `passes` - Total passes
- `pass_accuracy` - Pass accuracy %
- `key_passes` - Key passes
- `tackles` - Tackles won
- `interceptions` - Interceptions
- `fouls` - Fouls committed
- `yellow_cards` - Yellow cards
- `red_cards` - Red cards
- `minutes_played` - Minutes

### Goalkeeper:
- `saves` - Saves
- `goals_conceded` - Goals conceded
- `clean_sheets` - Clean sheets

## 📝 CRITICAL IMPLEMENTATION NOTES:

### 🚨 QUERY STRATEGY:
**ALWAYS use `games.sport` NOT `players.sport` for multi-sport queries!**
```sql
-- CORRECT:
SELECT * FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id  
WHERE g.sport = 'NBA'

-- WRONG:
SELECT * FROM player_game_logs pgl
JOIN players p ON pgl.player_id = p.id
WHERE p.sport = 'NBA'
```

### 🔧 DATA TYPE CONVERSIONS NEEDED:
1. **NHL `timeOnIce`**: String → Number (MM:SS format)
2. **NFL defensive stats**: All strings → Numbers  
3. **Always use parseFloat()** - some numbers stored as strings

### 🏀 BASKETBALL DISCOVERY ISSUE:
- Earlier we found NBA uses `fieldGoalsAttempted` (camelCase)
- But games.sport="NBA" shows `field_goals_attempted` (snake_case)
- **Two different NBA datasets exist!** Need to check both patterns.

### 📊 DATA CORRUPTION ISSUES:
- **MLB contains basketball stats** - needs data cleanup
- **Multiple NFL formats** - handle both uppercase/lowercase variants

### 🎯 SPORTS PRIORITY ORDER:
1. **NBA** - 15,288 logs (best data)
2. **NFL** - Two formats available  
3. **NHL** - Clean camelCase data
4. **MLB** - SKIP until data fixed
5. **NCAA** - Research needed

## ALWAYS CHECK THIS FILE BEFORE WRITING CALCULATORS!