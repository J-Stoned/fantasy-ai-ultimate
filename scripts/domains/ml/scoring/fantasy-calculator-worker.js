/**
 * WORKER THREAD FOR FANTASY POINTS CALCULATION
 * Runs in parallel to maximize CPU utilization
 */

const { parentPort, workerData } = require('worker_threads');
const { getScoringRules, normalizePosition } = require('./dfs-scoring-rules');

// Calculate fantasy points for a single platform
function calculateFantasyPoints(stats, sport, position, platform) {
  const rules = getScoringRules(sport, platform, position);
  
  if (!rules || rules.length === 0) {
    return 0;
  }
  
  let totalPoints = 0;
  const appliedBonuses = new Set();
  
  for (const rule of rules) {
    const statValue = getStatValue(stats, rule.stat);
    
    if (statValue !== null && statValue !== undefined) {
      if (rule.isBonus || rule.bonusThreshold) {
        if (rule.bonusThreshold && statValue >= rule.bonusThreshold) {
          const bonusKey = `${rule.stat}_${rule.bonusThreshold}`;
          if (!appliedBonuses.has(bonusKey)) {
            totalPoints += rule.bonusPoints || rule.points;
            appliedBonuses.add(bonusKey);
          }
        }
      } else {
        totalPoints += statValue * rule.points;
      }
    }
  }
  
  // Round to 2 decimal places
  return Math.round(totalPoints * 100) / 100;
}

// Get stat value from nested stats object
function getStatValue(stats, statName) {
  // Handle special stat mappings
  if (statName === 'singles') {
    const hits = stats.hits || stats.h || 0;
    const doubles = stats.doubles || stats['2b'] || 0;
    const triples = stats.triples || stats['3b'] || 0;
    const homeRuns = stats.home_runs || stats.hr || 0;
    return Math.max(0, hits - doubles - triples - homeRuns);
  }
  
  if (statName === 'double_double') {
    const points = stats.points || stats.pts || 0;
    const rebounds = stats.rebounds || stats.reb || 0;
    const assists = stats.assists || stats.ast || 0;
    const steals = stats.steals || stats.stl || 0;
    const blocks = stats.blocks || stats.blk || 0;
    
    let doubleCount = 0;
    if (points >= 10) doubleCount++;
    if (rebounds >= 10) doubleCount++;
    if (assists >= 10) doubleCount++;
    if (steals >= 10) doubleCount++;
    if (blocks >= 10) doubleCount++;
    
    return doubleCount >= 2 ? 1 : 0;
  }
  
  if (statName === 'triple_double') {
    const points = stats.points || stats.pts || 0;
    const rebounds = stats.rebounds || stats.reb || 0;
    const assists = stats.assists || stats.ast || 0;
    const steals = stats.steals || stats.stl || 0;
    const blocks = stats.blocks || stats.blk || 0;
    
    let tripleCount = 0;
    if (points >= 10) tripleCount++;
    if (rebounds >= 10) tripleCount++;
    if (assists >= 10) tripleCount++;
    if (steals >= 10) tripleCount++;
    if (blocks >= 10) tripleCount++;
    
    return tripleCount >= 3 ? 1 : 0;
  }
  
  // Handle points allowed for DST
  if (statName.startsWith('points_allowed_')) {
    const pointsAllowed = stats.points_allowed || 0;
    if (statName === 'points_allowed_0' && pointsAllowed === 0) return 1;
    if (statName === 'points_allowed_1_6' && pointsAllowed >= 1 && pointsAllowed <= 6) return 1;
    if (statName === 'points_allowed_7_13' && pointsAllowed >= 7 && pointsAllowed <= 13) return 1;
    if (statName === 'points_allowed_14_20' && pointsAllowed >= 14 && pointsAllowed <= 20) return 1;
    if (statName === 'points_allowed_21_27' && pointsAllowed >= 21 && pointsAllowed <= 27) return 1;
    if (statName === 'points_allowed_28_34' && pointsAllowed >= 28 && pointsAllowed <= 34) return 1;
    if (statName === 'points_allowed_35_plus' && pointsAllowed >= 35) return 1;
    return 0;
  }
  
  // Handle field goal ranges for kickers
  if (statName.startsWith('field_goals_made_')) {
    const fgMade = stats.field_goals_made || [];
    const fgDistances = stats.field_goal_distances || [];
    let count = 0;
    
    for (let i = 0; i < fgMade.length && i < fgDistances.length; i++) {
      if (fgMade[i]) {
        const distance = fgDistances[i];
        if (statName === 'field_goals_made_0_39' && distance < 40) count++;
        else if (statName === 'field_goals_made_40_49' && distance >= 40 && distance < 50) count++;
        else if (statName === 'field_goals_made_50_plus' && distance >= 50) count++;
      }
    }
    return count;
  }
  
  // Map common stat name variations
  const statMappings = {
    'passing_yards': ['passing_yards', 'pass_yds', 'passYds'],
    'passing_touchdowns': ['passing_touchdowns', 'pass_td', 'passTD', 'passing_tds'],
    'interceptions': ['interceptions', 'int', 'ints'],
    'rushing_yards': ['rushing_yards', 'rush_yds', 'rushYds'],
    'rushing_touchdowns': ['rushing_touchdowns', 'rush_td', 'rushTD', 'rushing_tds'],
    'receiving_yards': ['receiving_yards', 'rec_yds', 'recYds'],
    'receiving_touchdowns': ['receiving_touchdowns', 'rec_td', 'recTD', 'receiving_tds'],
    'receptions': ['receptions', 'rec', 'catches'],
    'fumbles_lost': ['fumbles_lost', 'fumbles', 'fum'],
    'points': ['points', 'pts'],
    'rebounds': ['rebounds', 'reb', 'total_rebounds'],
    'assists': ['assists', 'ast'],
    'steals': ['steals', 'stl'],
    'blocks': ['blocks', 'blk'],
    'turnovers': ['turnovers', 'to', 'tov'],
    'three_pointers_made': ['three_pointers_made', 'fg3m', 'threes_made'],
    'field_goals_made': ['field_goals_made', 'fgm'],
    'field_goals_missed': ['field_goals_missed', 'fga', 'field_goals_attempted'],
    'free_throws_made': ['free_throws_made', 'ftm'],
    'free_throws_missed': ['free_throws_missed', 'fta', 'free_throws_attempted'],
    'hits': ['hits', 'h'],
    'doubles': ['doubles', '2b'],
    'triples': ['triples', '3b'],
    'home_runs': ['home_runs', 'hr'],
    'rbis': ['rbis', 'rbi'],
    'runs': ['runs', 'r'],
    'walks': ['walks', 'bb', 'base_on_balls'],
    'stolen_bases': ['stolen_bases', 'sb'],
    'caught_stealing': ['caught_stealing', 'cs'],
    'strikeouts': ['strikeouts', 'so', 'k'],
    'innings_pitched': ['innings_pitched', 'ip'],
    'earned_runs': ['earned_runs', 'er'],
    'wins': ['wins', 'w'],
    'losses': ['losses', 'l'],
    'saves': ['saves', 'sv'],
    'quality_starts': ['quality_starts', 'qs'],
    'goals': ['goals', 'g'],
    'shots': ['shots', 'sog', 'shots_on_goal'],
    'blocked_shots': ['blocked_shots', 'blocks', 'bs'],
    'plus_minus': ['plus_minus', 'plusMinus', 'pm'],
    'powerplay_points': ['powerplay_points', 'ppp'],
    'shorthanded_points': ['shorthanded_points', 'shp'],
    'penalty_minutes': ['penalty_minutes', 'pim'],
    'hits_allowed': ['hits_allowed', 'h_allowed'],
    'walks_allowed': ['walks_allowed', 'bb_allowed'],
    'hit_batters': ['hit_batters', 'hbp', 'hit_by_pitch']
  };
  
  // Try to find the stat value
  const possibleNames = statMappings[statName] || [statName];
  
  for (const name of possibleNames) {
    if (stats[name] !== undefined && stats[name] !== null) {
      // For missed stats, calculate from attempts - made
      if (name.includes('missed') || name.includes('attempted')) {
        const madeName = name.replace('missed', 'made').replace('attempted', 'made');
        const made = stats[madeName] || 0;
        const attempted = stats[name] || 0;
        return Math.max(0, attempted - made);
      }
      return stats[name];
    }
  }
  
  return 0;
}

// Process the chunk of data
const { chunk, workerId } = workerData;
const results = [];

for (const record of chunk) {
  try {
    const sport = record.sport.replace(/^(MILB_|NCAAF_|NCAAB_|NCAABB_)/, '');
    const normalizedSport = sport.includes('NFL') || sport === 'NCAAF' ? 'NFL' :
                           sport.includes('NBA') || sport === 'NCAAB' ? 'NBA' :
                           sport.includes('MLB') || sport.includes('MILB') ? 'MLB' :
                           sport.includes('NHL') ? 'NHL' : sport;
    
    const normalizedPosition = normalizePosition(record.position, normalizedSport);
    
    const result = {
      id: record.id,
      dk_points: calculateFantasyPoints(record.stats, normalizedSport, normalizedPosition, 'draftkings'),
      fd_points: calculateFantasyPoints(record.stats, normalizedSport, normalizedPosition, 'fanduel'),
      yahoo_points: calculateFantasyPoints(record.stats, normalizedSport, normalizedPosition, 'yahoo'),
      espn_points: calculateFantasyPoints(record.stats, normalizedSport, normalizedPosition, 'espn'),
      cbs_points: calculateFantasyPoints(record.stats, normalizedSport, normalizedPosition, 'cbs'),
      sleeper_points: calculateFantasyPoints(record.stats, normalizedSport, normalizedPosition, 'sleeper')
    };
    
    results.push(result);
  } catch (error) {
    console.error(`Worker ${workerId} error processing record ${record.id}:`, error);
    // Still include the record with 0 points rather than failing
    results.push({
      id: record.id,
      dk_points: 0,
      fd_points: 0,
      yahoo_points: 0,
      espn_points: 0,
      cbs_points: 0,
      sleeper_points: 0
    });
  }
}

// Send results back to main thread
parentPort.postMessage(results);