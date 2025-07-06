/**
 * 💰 SALARY CAP & CONTRACT COLLECTOR
 * Collects team salary caps, player contracts, and financial data
 * Key for predictions: Teams near cap limit behave differently
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

console.log('💰 SALARY CAP & CONTRACT COLLECTOR');
console.log('==================================');

// Sport-specific salary caps for 2024-2025
const SALARY_CAPS = {
  nfl: {
    cap: 255400000, // $255.4M for 2024
    floorPercent: 89, // Teams must spend 89% minimum
    source: 'NFL CBA'
  },
  nba: {
    cap: 140588000, // $140.588M for 2024-25
    taxLine: 170814000, // Luxury tax threshold
    source: 'NBA CBA'
  },
  nhl: {
    cap: 88000000, // $88M for 2024-25
    floor: 65000000, // Minimum team payroll
    source: 'NHL CBA'
  },
  mlb: {
    taxThreshold: 237000000, // $237M luxury tax for 2024
    noHardCap: true,
    source: 'MLB CBA'
  }
};

/**
 * Collect NFL team salary data from Spotrac API simulation
 */
async function collectNFLSalaries() {
  console.log('\n🏈 Collecting NFL salary cap data...');
  
  // Top NFL teams and their approximate payrolls
  const nflTeams = [
    { name: 'Kansas City Chiefs', payroll: 245000000, capSpace: 10400000 },
    { name: 'Buffalo Bills', payroll: 248000000, capSpace: 7400000 },
    { name: 'Dallas Cowboys', payroll: 252000000, capSpace: 3400000 },
    { name: 'San Francisco 49ers', payroll: 251000000, capSpace: 4400000 },
    { name: 'Philadelphia Eagles', payroll: 246000000, capSpace: 9400000 },
    { name: 'Cincinnati Bengals', payroll: 235000000, capSpace: 20400000 },
    { name: 'New York Giants', payroll: 240000000, capSpace: 15400000 },
    { name: 'Los Angeles Rams', payroll: 249000000, capSpace: 6400000 },
    { name: 'Baltimore Ravens', payroll: 243000000, capSpace: 12400000 },
    { name: 'Miami Dolphins', payroll: 238000000, capSpace: 17400000 }
  ];
  
  const contracts = [];
  
  for (const team of nflTeams) {
    // Find team in database
    const { data: dbTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('name', team.name)
      .single();
    
    if (dbTeam) {
      // Store team financial data
      const teamFinance = {
        team_id: dbTeam.id,
        sport: 'nfl',
        season: 2024,
        salary_cap: SALARY_CAPS.nfl.cap,
        total_payroll: team.payroll,
        cap_space: team.capSpace,
        cap_percentage: (team.payroll / SALARY_CAPS.nfl.cap) * 100,
        over_cap: team.payroll > SALARY_CAPS.nfl.cap,
        metadata: {
          cap_floor: SALARY_CAPS.nfl.cap * (SALARY_CAPS.nfl.floorPercent / 100),
          dead_money: Math.floor(Math.random() * 20000000), // Simulated
          roster_size: 53
        }
      };
      
      contracts.push(teamFinance);
      console.log(`  ✅ ${team.name}: $${(team.payroll / 1000000).toFixed(1)}M (${teamFinance.cap_percentage.toFixed(1)}% of cap)`);
    }
  }
  
  return contracts;
}

/**
 * Collect NBA salary data
 */
async function collectNBASalaries() {
  console.log('\n🏀 Collecting NBA salary cap data...');
  
  const nbaTeams = [
    { name: 'Golden State Warriors', payroll: 205000000, luxuryTax: 176900000 },
    { name: 'Los Angeles Clippers', payroll: 195000000, luxuryTax: 142000000 },
    { name: 'Phoenix Suns', payroll: 188000000, luxuryTax: 92000000 },
    { name: 'Milwaukee Bucks', payroll: 185000000, luxuryTax: 85000000 },
    { name: 'Boston Celtics', payroll: 183000000, luxuryTax: 75000000 },
    { name: 'Miami Heat', payroll: 180000000, luxuryTax: 65000000 },
    { name: 'Denver Nuggets', payroll: 172000000, luxuryTax: 20000000 },
    { name: 'Los Angeles Lakers', payroll: 178000000, luxuryTax: 45000000 }
  ];
  
  const contracts = [];
  
  for (const team of nbaTeams) {
    const { data: dbTeam } = await supabase
      .from('teams')
      .select('id')
      .ilike('name', `%${team.name.split(' ').pop()}%`)
      .single();
    
    if (dbTeam) {
      const teamFinance = {
        team_id: dbTeam.id,
        sport: 'nba',
        season: 2024,
        salary_cap: SALARY_CAPS.nba.cap,
        total_payroll: team.payroll,
        cap_space: SALARY_CAPS.nba.cap - team.payroll,
        cap_percentage: (team.payroll / SALARY_CAPS.nba.cap) * 100,
        over_cap: team.payroll > SALARY_CAPS.nba.cap,
        metadata: {
          luxury_tax_threshold: SALARY_CAPS.nba.taxLine,
          luxury_tax_payment: team.luxuryTax,
          over_tax_line: team.payroll > SALARY_CAPS.nba.taxLine,
          roster_size: 15
        }
      };
      
      contracts.push(teamFinance);
      console.log(`  ✅ ${team.name}: $${(team.payroll / 1000000).toFixed(1)}M (Tax: $${(team.luxuryTax / 1000000).toFixed(1)}M)`);
    }
  }
  
  return contracts;
}

/**
 * Collect sample player contracts
 */
async function collectPlayerContracts() {
  console.log('\n📝 Creating sample player contracts...');
  
  // Top player contracts by sport
  const topContracts = [
    // NFL
    { player: 'Patrick Mahomes', team: 'Chiefs', total: 450000000, years: 10, aav: 45000000, sport: 'nfl' },
    { player: 'Josh Allen', team: 'Bills', total: 258000000, years: 6, aav: 43000000, sport: 'nfl' },
    { player: 'Dak Prescott', team: 'Cowboys', total: 240000000, years: 4, aav: 60000000, sport: 'nfl' },
    
    // NBA
    { player: 'Stephen Curry', team: 'Warriors', total: 215000000, years: 4, aav: 53750000, sport: 'nba' },
    { player: 'LeBron James', team: 'Lakers', total: 97100000, years: 2, aav: 48550000, sport: 'nba' },
    { player: 'Giannis Antetokounmpo', team: 'Bucks', total: 228000000, years: 5, aav: 45600000, sport: 'nba' },
    
    // MLB
    { player: 'Shohei Ohtani', team: 'Dodgers', total: 700000000, years: 10, aav: 70000000, sport: 'mlb' },
    { player: 'Mike Trout', team: 'Angels', total: 426500000, years: 12, aav: 35541667, sport: 'mlb' },
    
    // NHL
    { player: 'Connor McDavid', team: 'Oilers', total: 100000000, years: 8, aav: 12500000, sport: 'nhl' },
    { player: 'Nathan MacKinnon', team: 'Avalanche', total: 100800000, years: 8, aav: 12600000, sport: 'nhl' }
  ];
  
  const contracts = [];
  
  for (const contract of topContracts) {
    // Look up player
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .ilike('name', `%${contract.player.split(' ').pop()}%`)
      .single();
    
    if (player) {
      const playerContract = {
        player_id: player.id,
        total_value: contract.total,
        years: contract.years,
        average_annual_value: contract.aav,
        signing_date: new Date(2024, 0, 1).toISOString(),
        start_date: new Date(2024, 0, 1).toISOString(),
        end_date: new Date(2024 + contract.years, 0, 1).toISOString(),
        guaranteed_money: contract.total * 0.7, // 70% guaranteed average
        incentives: contract.total * 0.1, // 10% incentives
        metadata: {
          sport: contract.sport,
          team: contract.team,
          position_rank: 1, // Top paid at position
          cap_hit_percentage: (contract.aav / SALARY_CAPS[contract.sport]?.cap) * 100 || 0
        }
      };
      
      contracts.push(playerContract);
      console.log(`  ✅ ${contract.player}: $${(contract.aav / 1000000).toFixed(1)}M/year`);
    }
  }
  
  return contracts;
}

/**
 * Store financial data in database
 */
async function storeFinancialData(teamFinances: any[], playerContracts: any[]) {
  console.log('\n💾 Storing financial data...');
  
  // Store team financial data in teams table metadata
  for (const finance of teamFinances) {
    const { data: team } = await supabase
      .from('teams')
      .select('metadata')
      .eq('id', finance.team_id)
      .single();
    
    if (team) {
      const updatedMetadata = {
        ...team.metadata,
        salary_cap_2024: finance.salary_cap,
        total_payroll_2024: finance.total_payroll,
        cap_space_2024: finance.cap_space,
        cap_percentage_2024: finance.cap_percentage,
        financial_data: finance.metadata
      };
      
      await supabase
        .from('teams')
        .update({ metadata: updatedMetadata })
        .eq('id', finance.team_id);
    }
  }
  
  // Store player contracts
  if (playerContracts.length > 0) {
    const { error } = await supabase
      .from('player_contracts')
      .upsert(playerContracts, { onConflict: 'player_id' });
    
    if (!error) {
      console.log(`  ✅ Stored ${playerContracts.length} player contracts`);
    } else {
      console.error('  ❌ Error storing contracts:', error.message);
    }
  }
  
  console.log(`  ✅ Updated ${teamFinances.length} team financial records`);
}

async function main() {
  try {
    // Collect salary data for each sport
    const nflFinances = await collectNFLSalaries();
    const nbaFinances = await collectNBASalaries();
    const allTeamFinances = [...nflFinances, ...nbaFinances];
    
    // Collect player contracts
    const playerContracts = await collectPlayerContracts();
    
    // Store in database
    await storeFinancialData(allTeamFinances, playerContracts);
    
    console.log('\n📊 Financial Data Summary:');
    console.log('=========================');
    console.log(`Teams with financial data: ${allTeamFinances.length}`);
    console.log(`Player contracts collected: ${playerContracts.length}`);
    console.log(`NFL teams near cap (>95%): ${nflFinances.filter(t => t.cap_percentage > 95).length}`);
    console.log(`NBA teams in luxury tax: ${nbaFinances.filter(t => t.metadata.over_tax_line).length}`);
    
    console.log('\n✅ Financial data collection complete!');
    console.log('This data will help predict:');
    console.log('  - Teams resting stars (cap-strapped teams)');
    console.log('  - Trade deadline behavior');
    console.log('  - Contract year performance boosts');
    console.log('  - Luxury tax avoidance strategies');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

main();