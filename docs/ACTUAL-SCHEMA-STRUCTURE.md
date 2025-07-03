# Actual Database Schema Structure

## Players Table
The actual `players` table structure differs from what collectors expect:

### Actual Columns:
```sql
- id: INTEGER (primary key)
- firstname: VARCHAR
- lastname: VARCHAR  
- position: TEXT[] (array of positions)
- team_id: INTEGER (references teams.id)
- jersey_number: INTEGER
- heightinches: INTEGER
- weightlbs: INTEGER
- birthdate: DATE
- status: VARCHAR
- sport_id: VARCHAR ('nfl', 'nba', etc.)
- external_id: VARCHAR (being added)
- photo_url: VARCHAR
- team_abbreviation: VARCHAR
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### What Collectors Expect:
```sql
- name: VARCHAR (full name)
- team: VARCHAR (team name)
- sport: VARCHAR ('football', 'basketball')
- college: VARCHAR
```

## Key Differences:

1. **Name Storage**:
   - Actual: `firstname` and `lastname` as separate columns
   - Expected: Single `name` column
   - Solution: Generated column `name` = `CONCAT(firstname, ' ', lastname)`

2. **Position Format**:
   - Actual: Array of strings `position TEXT[]`
   - Expected: Single string
   - Solution: Use `position[1]` to get first position

3. **Team Reference**:
   - Actual: `team_id` (integer foreign key)
   - Expected: `team` (text team name)
   - Solution: Add `team` column and populate from teams table

4. **Sport Format**:
   - Actual: `sport_id` ('nfl', 'nba')
   - Expected: `sport` ('football', 'basketball')
   - Solution: Add `sport` column with mapped values

## Games Table
Similar pattern - uses IDs instead of text values:
- `home_team_id`, `away_team_id` instead of team names
- `sport_id` instead of sport name
- `start_time` instead of `game_date`

## Migration Strategy:
The v3 enhancement SQL:
1. Adds missing columns for compatibility
2. Creates generated columns where possible
3. Updates null values with proper mappings
4. Maintains both formats during transition