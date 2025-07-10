#!/usr/bin/env tsx
/**
 * 🏥 FIX PLAYER INJURIES WITH SMART NAME MATCHING
 * 
 * Uses fuzzy matching and multiple strategies to extract injuries from news
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Common name variations and nicknames
const NAME_VARIATIONS: Record<string, string[]> = {
  'Patrick': ['Pat'],
  'Michael': ['Mike'],
  'Christopher': ['Chris'],
  'Nicholas': ['Nick'],
  'Robert': ['Rob', 'Bob'],
  'William': ['Will', 'Bill'],
  'James': ['Jim', 'Jimmy'],
  'Thomas': ['Tom', 'Tommy'],
  'Daniel': ['Dan', 'Danny'],
  'Matthew': ['Matt'],
  'Joshua': ['Josh'],
  'Andrew': ['Andy', 'Drew'],
  'Anthony': ['Tony'],
  'Richard': ['Rick', 'Rich'],
  'Joseph': ['Joe', 'Joey'],
  'Benjamin': ['Ben'],
  'Alexander': ['Alex'],
  'Jonathan': ['Jon'],
  'Timothy': ['Tim'],
  'Kenneth': ['Ken', 'Kenny']
};

async function fixPlayerInjuries() {
  console.log(chalk.blue.bold('\n🏥 SMART PLAYER INJURIES EXTRACTION\n'));
  
  try {
    // Get injury-related news with better keywords
    const injuryKeywords = [
      'injury', 'injured', 'out', 'questionable', 'doubtful', 
      'hurt', 'return', 'sidelined', 'miss', 'status', 
      'limited', 'DNP', 'game-time decision', 'ruled out'
    ];
    
    const { data: news } = await supabase
      .from('news_articles')
      .select('*')
      .or(injuryKeywords.map(kw => `title.ilike.%${kw}%`).join(','))
      .order('created_at', { ascending: false })
      .limit(500); // More articles for better coverage
      
    // Get all players with team info
    const { data: players } = await supabase
      .from('players')
      .select(`
        id, 
        firstname, 
        lastname, 
        position, 
        team_id,
        teams!inner(name, abbreviation)
      `);
      
    if (!news || !players) {
      console.log(chalk.red('No news or players found'));
      return;
    }
    
    console.log(`Found ${news.length} injury-related articles`);
    console.log(`Checking against ${players.length} players`);
    
    // Build search index for faster matching
    const playerIndex = new Map();
    for (const player of players) {
      const variations = getNameVariations(player.firstname, player.lastname);
      for (const name of variations) {
        if (!playerIndex.has(name.toLowerCase())) {
          playerIndex.set(name.toLowerCase(), []);
        }
        playerIndex.get(name.toLowerCase()).push(player);
      }
    }
    
    const injuriesToInsert = [];
    const processedPairs = new Set(); // Track player-article pairs
    
    for (const article of news) {
      const title = article.title || '';
      const summary = article.summary || '';
      const fullText = `${title} ${summary}`;
      
      // Extract potential player mentions
      const matches = findPlayerMatches(fullText, playerIndex, players);
      
      for (const match of matches) {
        const pairKey = `${match.player.id}-${article.id}`;
        if (processedPairs.has(pairKey)) continue;
        
        // Analyze injury details
        const injury = analyzeInjuryFromContext(fullText, title, match.context);
        
        if (injury.type !== 'none') {
          injuriesToInsert.push({
            player_id: match.player.id,
            injury_type: injury.type,
            body_part: injury.bodyPart || injury.type,
            status: injury.status,
            notes: `${match.player.firstname} ${match.player.lastname}: ${title.substring(0, 200)}`,
            reported_at: article.created_at || new Date().toISOString(),
            return_date: injury.returnDate,
            source: article.source || 'News Article'
          });
          
          processedPairs.add(pairKey);
          
          console.log(chalk.gray(`  Found: ${match.player.firstname} ${match.player.lastname} - ${injury.type} (${injury.status})`));
        }
      }
      
      // Limit to prevent too many
      if (injuriesToInsert.length >= 300) break;
    }
    
    // Insert injuries in batches
    console.log(chalk.yellow(`\nInserting ${injuriesToInsert.length} injury records...`));
    
    let injuriesCreated = 0;
    for (let i = 0; i < injuriesToInsert.length; i += 50) {
      const batch = injuriesToInsert.slice(i, i + 50);
      
      const { data, error } = await supabase
        .from('player_injuries')
        .insert(batch)
        .select();
        
      if (error) {
        console.log(chalk.red(`Batch error: ${error.message}`));
      } else {
        injuriesCreated += data?.length || 0;
      }
      
      // Progress
      if (i > 0 && i % 100 === 0) {
        console.log(chalk.gray(`  Progress: ${i}/${injuriesToInsert.length}`));
      }
    }
    
    console.log(chalk.green(`✅ Created ${injuriesCreated} injury records`));
    
    // Show final count
    const { count } = await supabase
      .from('player_injuries')
      .select('*', { count: 'exact', head: true });
      
    console.log(chalk.cyan(`\n📊 Total injuries in database: ${count}`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

/**
 * Get name variations for matching
 */
function getNameVariations(firstname: string, lastname: string): string[] {
  const variations = [
    `${firstname} ${lastname}`,
    lastname,
    `${firstname.charAt(0)}. ${lastname}`, // J. Smith
  ];
  
  // Add common nicknames
  const nicknames = NAME_VARIATIONS[firstname] || [];
  for (const nick of nicknames) {
    variations.push(`${nick} ${lastname}`);
  }
  
  // Add last name only for common references
  if (lastname.length > 4) {
    variations.push(lastname);
  }
  
  return variations;
}

/**
 * Find player matches in text with context
 */
function findPlayerMatches(text: string, playerIndex: Map<string, any[]>, allPlayers: any[]) {
  const matches = [];
  const lowerText = text.toLowerCase();
  
  // Method 1: Direct name matching using index
  for (const [name, players] of playerIndex) {
    if (lowerText.includes(name)) {
      // Get context around the match
      const index = lowerText.indexOf(name);
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(text.length, index + name.length + 50);
      const context = text.substring(contextStart, contextEnd);
      
      for (const player of players) {
        // Verify it's likely this player (check team name nearby)
        const teamName = player.teams?.name?.toLowerCase() || '';
        const teamAbbr = player.teams?.abbreviation?.toLowerCase() || '';
        
        if (lowerText.includes(teamName) || lowerText.includes(teamAbbr) || 
            context.toLowerCase().includes(player.position?.[0]?.toLowerCase())) {
          matches.push({
            player,
            context,
            confidence: 'high'
          });
        } else {
          // Still include but with lower confidence
          matches.push({
            player,
            context,
            confidence: 'medium'
          });
        }
      }
    }
  }
  
  // Method 2: Look for "LastName (Position)" pattern
  const positionPattern = /(\w+)\s*\(([A-Z]{1,3})\)/g;
  let match;
  while ((match = positionPattern.exec(text)) !== null) {
    const lastName = match[1];
    const position = match[2];
    
    const player = allPlayers.find(p => 
      p.lastname.toLowerCase() === lastName.toLowerCase() &&
      p.position?.[0] === position
    );
    
    if (player && !matches.some(m => m.player.id === player.id)) {
      matches.push({
        player,
        context: match[0],
        confidence: 'high'
      });
    }
  }
  
  return matches;
}

/**
 * Enhanced injury analysis with better detection
 */
function analyzeInjuryFromContext(fullText: string, title: string, context: string) {
  const text = (context + ' ' + title).toLowerCase();
  
  // Body parts and injury types
  const bodyParts = {
    'hamstring': ['hamstring', 'hammy'],
    'knee': ['knee', 'mcl', 'acl', 'meniscus', 'patella'],
    'ankle': ['ankle', 'achilles'],
    'shoulder': ['shoulder', 'rotator cuff', 'labrum'],
    'concussion': ['concussion', 'head injury', 'protocol'],
    'back': ['back', 'spine', 'lumbar'],
    'groin': ['groin', 'hip flexor'],
    'foot': ['foot', 'toe', 'plantar', 'turf toe'],
    'calf': ['calf', 'lower leg'],
    'quad': ['quad', 'quadricep', 'thigh'],
    'wrist': ['wrist', 'hand'],
    'elbow': ['elbow', 'forearm'],
    'illness': ['illness', 'sick', 'flu', 'covid', 'virus']
  };
  
  let injuryType = 'unspecified';
  let bodyPart = null;
  
  for (const [part, keywords] of Object.entries(bodyParts)) {
    if (keywords.some(kw => text.includes(kw))) {
      injuryType = part;
      bodyPart = part;
      break;
    }
  }
  
  // Injury status with more patterns
  let status = 'questionable';
  let returnDate = null;
  
  const statusPatterns = [
    { pattern: /ruled out|will not play|out for/i, status: 'out' },
    { pattern: /doubtful|unlikely to play/i, status: 'doubtful' },
    { pattern: /questionable|game-time decision|uncertain/i, status: 'questionable' },
    { pattern: /probable|expected to play|likely/i, status: 'probable' },
    { pattern: /day-to-day|day to day/i, status: 'day-to-day' },
    { pattern: /injured reserve|IR/i, status: 'injured_reserve' },
    { pattern: /out indefinitely|season-ending/i, status: 'out' },
    { pattern: /limited practice|limited in practice/i, status: 'questionable' },
    { pattern: /did not practice|DNP/i, status: 'doubtful' },
    { pattern: /full practice|full participant/i, status: 'probable' }
  ];
  
  for (const { pattern, status: s } of statusPatterns) {
    if (pattern.test(text)) {
      status = s;
      break;
    }
  }
  
  // Return date estimation
  if (text.includes('week-to-week')) {
    returnDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  } else if (text.includes('season')) {
    returnDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    const weekMatch = text.match(/(\d+)[- ]?weeks?/i);
    if (weekMatch) {
      const weeks = parseInt(weekMatch[1]);
      returnDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }
  
  // Skip if no clear injury indication
  if (injuryType === 'unspecified' && status === 'questionable' && 
      !text.includes('injury') && !text.includes('hurt')) {
    return { type: 'none', status: 'none', bodyPart: null, returnDate: null };
  }
  
  return { type: injuryType, status, bodyPart, returnDate };
}

// Run the fixer
fixPlayerInjuries().catch(console.error);