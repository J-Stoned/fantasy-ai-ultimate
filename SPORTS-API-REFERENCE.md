# 🏆 SPORTS API REFERENCE GUIDE

**Complete technical documentation for collecting player rosters from all major sports**

---

## 📊 API TESTING RESULTS SUMMARY

| Sport | API | Status | Players Found | Auth Required | Rate Limit |
|-------|-----|--------|---------------|---------------|------------|
| ⚾ MLB | MLB Stats API | ✅ **WORKING** | 50 per team | No | None |
| 🏈 NFL | ESPN NFL API | ✅ **WORKING** | 93 per team | No | None |
| 🏀 NBA | ESPN NBA API | ⚠️ **EMPTY** | 0 (off-season) | No | None |
| 🏀 NBA | NBA.com API | ⚠️ **EMPTY** | 0 (off-season) | No | Headers required |
| 🏒 NHL | ESPN NHL API | ✅ **WORKING** | 23 per team | No | None |

---

## ⚾ MLB - MLB Stats API ✅ **RECOMMENDED**

### Base Information
- **Base URL**: `https://statsapi.mlb.com/api/v1`
- **Authentication**: None required
- **Rate Limits**: None specified
- **Status**: ✅ Fully working

### Roster Endpoint
```
GET /teams/{teamId}/roster?season={year}
```

### Example Request
```bash
curl "https://statsapi.mlb.com/api/v1/teams/118/roster?season=2024"
```

### Response Structure
```json
{
  "roster": [
    {
      "person": {
        "id": 680769,
        "fullName": "CJ Alexander",
        "link": "/api/v1/people/680769"
      },
      "jerseyNumber": "40",
      "position": {
        "code": "5",
        "name": "Third Base",
        "type": "Infielder",
        "abbreviation": "3B"
      },
      "status": {
        "code": "RL",
        "description": "Released"
      }
    }
  ]
}
```

### Team ID Mapping
```typescript
const MLB_TEAM_IDS = {
  'ARI': 109, 'ATL': 144, 'BAL': 110, 'BOS': 111, 'CHC': 112,
  'CHW': 145, 'CIN': 113, 'CLE': 114, 'COL': 115, 'DET': 116,
  'HOU': 117, 'KC': 118, 'LAA': 108, 'LAD': 119, 'MIA': 146,
  'MIL': 158, 'MIN': 142, 'NYM': 121, 'NYY': 147, 'OAK': 133,
  'PHI': 143, 'PIT': 134, 'SD': 135, 'SF': 137, 'SEA': 136,
  'STL': 138, 'TB': 139, 'TEX': 140, 'TOR': 141, 'WSH': 120
};
```

### Implementation Notes
- Returns 40-60 players per team (including minor league affiliates)
- Includes detailed position information
- Status codes indicate active/released/injured players
- Works reliably year-round
- Can query historical seasons

---

## 🏈 NFL - ESPN NFL API ✅ **RECOMMENDED**

### Base Information
- **Base URL**: `https://site.api.espn.com/apis/site/v2/sports/football/nfl`
- **Authentication**: None required
- **Rate Limits**: None specified
- **Status**: ✅ Fully working

### Roster Endpoint
```
GET /teams/{teamId}/roster
```

### Example Request
```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/12/roster"
```

### Response Structure
```json
{
  "athletes": [
    {
      "position": "offense",
      "items": [
        {
          "id": "4429184",
          "firstName": "Elijhah",
          "lastName": "Badger",
          "displayName": "Elijhah Badger",
          "jersey": "80",
          "position": {
            "abbreviation": "WR",
            "name": "Wide Receiver"
          },
          "height": 73,
          "weight": 192,
          "college": {
            "name": "Florida"
          },
          "birthPlace": {
            "city": "Sacramento",
            "state": "CA"
          },
          "experience": {
            "years": 0
          },
          "status": {
            "name": "Active"
          }
        }
      ]
    }
  ]
}
```

### Team ID Mapping
```typescript
const NFL_ESPN_TEAM_IDS = {
  'ATL': '1', 'BUF': '2', 'CHI': '3', 'CIN': '4', 'CLE': '5',
  'DAL': '6', 'DEN': '7', 'DET': '8', 'GB': '9', 'TEN': '10',
  'IND': '11', 'KC': '12', 'LV': '13', 'LAR': '14', 'MIA': '15',
  'MIN': '16', 'NE': '17', 'NO': '18', 'NYG': '19', 'NYJ': '20',
  'PHI': '21', 'ARI': '22', 'PIT': '23', 'LAC': '24', 'SF': '25',
  'SEA': '26', 'TB': '27', 'WAS': '28', 'WSH': '28', 'CAR': '29', 
  'JAX': '30', 'BAL': '33', 'HOU': '34'
};
```

### Implementation Notes
- Returns 90-95 players per team (full roster + practice squad)
- Players grouped by position (offense, defense, special teams)
- Height as number (inches), weight as number (pounds)
- Rich metadata including college, birthplace, experience
- **Note**: Handle WSH/WAS team name variations

---

## 🏀 NBA - Current Status: ⚠️ **PROBLEMATIC**

### Base Information
- **Status**: Both ESPN and NBA.com APIs returning empty rosters
- **Likely Cause**: Off-season period, roster changes
- **Recommendation**: Use manual roster approach or paid APIs

### ESPN NBA API (Empty)
- **URL**: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{id}/roster`
- **Status**: Returns empty position groups

### NBA.com API (Empty)
- **URL**: `https://stats.nba.com/stats/commonteamroster?TeamID={id}&Season=2024-25`
- **Status**: Returns empty result sets

### Alternative Solutions

#### 1. Manual Core Rosters (Immediate)
```typescript
const NBA_CORE_ROSTERS = {
  'LAL': [
    { name: 'LeBron James', position: 'SF', jersey: '23' },
    { name: 'Anthony Davis', position: 'PF', jersey: '3' },
    { name: 'Austin Reaves', position: 'SG', jersey: '15' }
  ],
  // ... other teams
};
```

#### 2. Paid API Services
- **RapidAPI NBA**: Premium service with reliable data
- **SportsData.io**: Enterprise-grade NBA data
- **ESPN API Premium**: Enhanced access

#### 3. Web Scraping (Not Recommended)
- Basketball-Reference.com
- ESPN.com team pages
- NBA.com team rosters

### Team ID Mapping (ESPN)
```typescript
const NBA_ESPN_TEAM_IDS = {
  'ATL': '1', 'BOS': '2', 'BKN': '17', 'CHA': '30', 'CHI': '4',
  'CLE': '5', 'DAL': '6', 'DEN': '7', 'DET': '8', 'GSW': '9',
  'HOU': '10', 'IND': '11', 'LAC': '12', 'LAL': '13', 'MEM': '29',
  'MIA': '14', 'MIL': '15', 'MIN': '16', 'NOP': '3', 'NYK': '18',
  'OKC': '25', 'ORL': '19', 'PHI': '20', 'PHX': '21', 'POR': '22',
  'SAC': '23', 'SAS': '24', 'TOR': '28', 'UTA': '26', 'WAS': '27'
};
```

---

## 🏒 NHL - ESPN NHL API ✅ **WORKING** (Limited)

### Base Information
- **Base URL**: `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl`
- **Authentication**: None required
- **Rate Limits**: None specified
- **Status**: ✅ Working but limited roster size

### Roster Endpoint
```
GET /teams/{teamId}/roster
```

### Example Request
```bash
curl "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/10/roster"
```

### Response Structure
```json
{
  "athletes": [
    {
      "position": "forward",
      "items": [
        {
          "id": "4874734",
          "firstName": "Zack",
          "lastName": "Bolduc",
          "displayName": "Zack Bolduc",
          "jersey": "76",
          "position": {
            "abbreviation": "C",
            "name": "Center"
          },
          "height": 72,
          "weight": 187,
          "age": 22,
          "birthPlace": {
            "city": "Trois-Rivieres",
            "state": "QC",
            "country": "CAN"
          }
        }
      ]
    }
  ]
}
```

### Team ID Mapping
```typescript
const NHL_ESPN_TEAM_IDS = {
  'ANA': '24', 'ARI': '53', 'BOS': '6', 'BUF': '7', 'CGY': '20',
  'CAR': '12', 'CHI': '16', 'COL': '21', 'CBJ': '29', 'DAL': '25',
  'DET': '17', 'EDM': '22', 'FLA': '13', 'LAK': '26', 'MIN': '30',
  'MTL': '8', 'NSH': '18', 'NJD': '1', 'NYI': '2', 'NYR': '3',
  'OTT': '9', 'PHI': '4', 'PIT': '5', 'SEA': '55', 'SJS': '28',
  'STL': '19', 'TBL': '14', 'TOR': '10', 'VAN': '23', 'VGK': '54',
  'WSH': '15', 'WPG': '52'
};
```

### Implementation Notes
- Returns 20-40 players per team (partial roster)
- May not include full minor league affiliates
- Rich biographical data including birthplace
- **Warning**: Smaller roster sizes than expected (23 vs 50+ expected)

---

## 🛠️ IMPLEMENTATION RECOMMENDATIONS

### 1. Immediate Phase 1 Implementation

#### Use These APIs (Proven Working):
- ✅ **MLB**: MLB Stats API (50 players/team × 30 teams = 1,500 players)
- ✅ **NFL**: ESPN NFL API (93 players/team × 32 teams = 2,976 players)
- ✅ **NHL**: ESPN NHL API (23 players/team × 32 teams = 736 players)

#### NBA Solution:
- 🔄 **Manual Core Rosters**: Create manual rosters for 15 core players per team
- 📝 **Target**: 15 players/team × 30 teams = 450 players
- 🔍 **Future**: Investigate paid APIs or wait for season start

### 2. Data Structure Standardization

```typescript
interface StandardizedPlayer {
  firstname: string;
  lastname: string;
  name: string;
  team_id: number;
  team: string;
  position: string[];
  jersey_number: number | null;
  heightinches: number | null;
  weightlbs: number | null;
  sport: string;
  external_id: string;
  metadata: {
    api_source: string;
    original_id: string;
    collected_at: string;
    [key: string]: any;
  };
}
```

### 3. Error Handling Strategy

```typescript
interface CollectionResult {
  sport: string;
  status: 'success' | 'partial' | 'failed';
  total_players: number;
  new_players: number;
  updated_players: number;
  errors: number;
  warnings: string[];
}
```

### 4. Expected Phase 1 Results

| Sport | API | Expected Players | Status |
|-------|-----|-----------------|---------|
| MLB | MLB Stats API | ~1,500 | ✅ Ready |
| NFL | ESPN NFL API | ~2,976 | ✅ Ready |
| NHL | ESPN NHL API | ~736 | ✅ Ready |
| NBA | Manual Rosters | ~450 | 🔄 Fallback |
| **TOTAL** | **Multiple** | **~5,662** | **Ready** |

---

## 🚨 CRITICAL ISSUES TO ADDRESS

### 1. NBA APIs Not Working
- **Problem**: Both ESPN and NBA.com returning empty rosters
- **Impact**: Missing ~1,500 NBA players
- **Solution**: Manual core rosters as immediate fix
- **Future**: Investigate paid APIs or season timing

### 2. NHL Limited Roster Size
- **Problem**: Only 20-40 players instead of expected 50+
- **Impact**: Missing some prospects/minor league players
- **Solution**: Acceptable for Phase 1, investigate alternatives later

### 3. Team ID Mapping Consistency
- **Problem**: Different ID formats across APIs
- **Solution**: Maintain mapping tables for each API
- **Critical**: WSH/WAS naming variations in NFL

---

## ✅ NEXT STEPS

1. **Create collectors for working APIs** (MLB, NFL, NHL)
2. **Implement manual NBA rosters** for immediate Phase 1 completion
3. **Test with small samples** before full collection
4. **Monitor for API changes** and rate limiting
5. **Plan Phase 2** with game scheduling and stats collection

**Expected Timeline**: 2-3 hours to implement all working collectors with proper error handling.