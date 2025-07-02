#!/usr/bin/env tsx
/**
 * 🏥 GENERATE REALISTIC INJURY DATA
 * 
 * Creates injury records based on actual players and realistic patterns
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Realistic injury distributions by position
const INJURY_PATTERNS = {
  QB: {
    injuries: [
      { type: 'shoulder', weight: 25 },
      { type: 'ankle', weight: 20 },
      { type: 'knee', weight: 15 },
      { type: 'concussion', weight: 15 },
      { type: 'thumb', weight: 10 },
      { type: 'ribs', weight: 10 },
      { type: 'back', weight: 5 }
    ]
  },
  RB: {
    injuries: [
      { type: 'hamstring', weight: 25 },
      { type: 'knee', weight: 20 },
      { type: 'ankle', weight: 20 },
      { type: 'calf', weight: 15 },
      { type: 'groin', weight: 10 },
      { type: 'shoulder', weight: 5 },
      { type: 'concussion', weight: 5 }
    ]
  },
  WR: {
    injuries: [
      { type: 'hamstring', weight: 30 },
      { type: 'ankle', weight: 25 },
      { type: 'knee', weight: 15 },
      { type: 'groin', weight: 10 },
      { type: 'calf', weight: 10 },
      { type: 'shoulder', weight: 5 },
      { type: 'foot', weight: 5 }
    ]
  },
  TE: {
    injuries: [
      { type: 'knee', weight: 25 },
      { type: 'ankle', weight: 20 },
      { type: 'hamstring', weight: 20 },
      { type: 'back', weight: 15 },
      { type: 'shoulder', weight: 10 },
      { type: 'concussion', weight: 10 }
    ]
  },
  K: {
    injuries: [
      { type: 'hamstring', weight: 40 },
      { type: 'groin', weight: 30 },
      { type: 'quad', weight: 20 },
      { type: 'hip', weight: 10 }
    ]
  },
  DEF: {
    injuries: [
      { type: 'knee', weight: 25 },
      { type: 'shoulder', weight: 20 },
      { type: 'ankle', weight: 20 },
      { type: 'hamstring', weight: 15 },
      { type: 'concussion', weight: 10 },
      { type: 'wrist', weight: 5 },
      { type: 'elbow', weight: 5 }
    ]
  }
};

// Status probabilities
const STATUS_WEIGHTS = [
  { status: 'questionable', weight: 40 },
  { status: 'doubtful', weight: 20 },
  { status: 'out', weight: 15 },
  { status: 'day-to-day', weight: 15 },
  { status: 'probable', weight: 5 },
  { status: 'injured_reserve', weight: 5 }
];

async function generateRealisticInjuries() {
  console.log(chalk.blue.bold('\n🏥 GENERATING REALISTIC INJURY DATA\n'));
  
  try {
    // Get all fantasy-relevant players
    const { data: allPlayers } = await supabase
      .from('players')
      .select(`
        id,
        firstname,
        lastname,
        position,
        team_id,
        teams:team_id (
          name,
          abbreviation
        )
      `)
      .order('lastname');
      
    // Filter for fantasy positions in memory
    const players = allPlayers?.filter(p => 
      p.position && ['QB', 'RB', 'WR', 'TE', 'K'].includes(p.position[0])
    ) || [];
      
    if (!players || players.length === 0) {
      console.log(chalk.red('No players found'));
      return;
    }
    
    console.log(`Found ${players.length} fantasy-relevant players`);
    
    // Determine injury rate (roughly 15-20% of players have some injury status)
    const injuryRate = 0.18;
    const numInjuries = Math.floor(players.length * injuryRate);
    
    // Randomly select players to injure
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const injuredPlayers = shuffled.slice(0, numInjuries);
    
    console.log(`\nGenerating injuries for ${injuredPlayers.length} players...`);
    
    const injuriesToInsert = [];
    const now = new Date();
    
    for (const player of injuredPlayers) {
      const position = player.position?.[0] || 'DEF';
      const injuryPattern = INJURY_PATTERNS[position] || INJURY_PATTERNS.DEF;
      
      // Select injury type based on position-specific weights
      const injuryType = selectWeighted(injuryPattern.injuries);
      
      // Select status
      const status = selectWeighted(STATUS_WEIGHTS);
      
      // Generate return date based on status
      let returnDate = null;
      let daysOut = 0;
      
      switch (status) {
        case 'probable':
          daysOut = 0; // Expected to play
          break;
        case 'questionable':
          daysOut = Math.random() < 0.5 ? 0 : 7; // 50/50 for this week
          break;
        case 'doubtful':
          daysOut = 7 + Math.floor(Math.random() * 7); // 1-2 weeks
          break;
        case 'day-to-day':
          daysOut = 3 + Math.floor(Math.random() * 4); // 3-7 days
          break;
        case 'out':
          daysOut = 14 + Math.floor(Math.random() * 21); // 2-5 weeks
          break;
        case 'injured_reserve':
          daysOut = 28 + Math.floor(Math.random() * 56); // 4-12 weeks
          break;
      }
      
      if (daysOut > 0) {
        returnDate = new Date(now.getTime() + daysOut * 24 * 60 * 60 * 1000).toISOString();
      }
      
      // Generate injury notes
      const teamName = player.teams?.abbreviation || 'Team';
      const notes = generateInjuryNotes(player, injuryType, status, teamName);
      
      // Report date (injuries reported in last 2 weeks)
      const daysAgo = Math.floor(Math.random() * 14);
      const reportedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      injuriesToInsert.push({
        player_id: player.id,
        injury_type: injuryType,
        body_part: injuryType, // Using same value for both
        status: status,
        notes: notes,
        reported_at: reportedAt.toISOString(),
        return_date: returnDate
      });
      
      console.log(chalk.gray(`  ${player.firstname} ${player.lastname} (${position}) - ${injuryType} (${status})`));
    }
    
    // Insert injuries in batches
    console.log(chalk.yellow(`\nInserting ${injuriesToInsert.length} injury records...`));
    
    let created = 0;
    for (let i = 0; i < injuriesToInsert.length; i += 50) {
      const batch = injuriesToInsert.slice(i, i + 50);
      
      const { data, error } = await supabase
        .from('player_injuries')
        .insert(batch)
        .select();
        
      if (error) {
        console.log(chalk.red(`Batch error: ${error.message}`));
      } else {
        created += data?.length || 0;
      }
    }
    
    console.log(chalk.green(`\n✅ Created ${created} injury records`));
    
    // Show distribution
    console.log(chalk.cyan('\n📊 Injury Distribution:'));
    
    const byStatus = injuriesToInsert.reduce((acc, inj) => {
      acc[inj.status] = (acc[inj.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`  ${status}: ${count} players`);
    }
    
    // Final count
    const { count } = await supabase
      .from('player_injuries')
      .select('*', { count: 'exact', head: true });
      
    console.log(chalk.green.bold(`\n✅ Total injuries in database: ${count}`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

/**
 * Select item based on weights
 */
function selectWeighted<T extends { weight: number }>(items: T[]): any {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return 'type' in item ? (item as any).type : (item as any).status;
    }
  }
  
  return 'type' in items[0] ? (items[0] as any).type : (items[0] as any).status;
}

/**
 * Generate realistic injury notes
 */
function generateInjuryNotes(player: any, injury: string, status: string, team: string): string {
  const templates = {
    questionable: [
      `${player.firstname} ${player.lastname} (${injury}) was limited in practice this week`,
      `${team} ${player.position?.[0]} ${player.lastname} dealing with ${injury} issue, game-time decision`,
      `${player.lastname} (${injury}) practiced on limited basis, listed as questionable`
    ],
    doubtful: [
      `${player.firstname} ${player.lastname} unlikely to play due to ${injury} injury`,
      `${team} ${player.position?.[0]} ${player.lastname} (${injury}) did not practice, doubtful for Sunday`,
      `${player.lastname} still recovering from ${injury}, chances of playing are slim`
    ],
    out: [
      `${player.firstname} ${player.lastname} ruled out with ${injury} injury`,
      `${team} will be without ${player.position?.[0]} ${player.lastname} (${injury})`,
      `${player.lastname} officially inactive due to ${injury} issue`
    ],
    'day-to-day': [
      `${player.firstname} ${player.lastname} considered day-to-day with ${injury}`,
      `${team} monitoring ${player.lastname}'s ${injury} on daily basis`,
      `${player.position?.[0]} ${player.lastname} (${injury}) progress being evaluated daily`
    ],
    probable: [
      `${player.firstname} ${player.lastname} (${injury}) expected to play despite injury`,
      `${player.lastname} should be good to go despite ${injury} concern`,
      `${team} ${player.position?.[0]} likely to play through ${injury}`
    ],
    injured_reserve: [
      `${player.firstname} ${player.lastname} placed on IR with ${injury}`,
      `${team} loses ${player.position?.[0]} ${player.lastname} to IR (${injury})`,
      `${player.lastname} headed to injured reserve with significant ${injury}`
    ]
  };
  
  const statusTemplates = templates[status] || templates.questionable;
  return statusTemplates[Math.floor(Math.random() * statusTemplates.length)];
}

// Run the generator
generateRealisticInjuries().catch(console.error);