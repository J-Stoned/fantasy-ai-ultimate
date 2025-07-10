#!/usr/bin/env tsx
/**
 * FINAL PLAYER LOADER - Using correct column names
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.magenta.bold('\n🏈 FINAL PLAYER LOADER'));
console.log(chalk.magenta('======================\n'));

// NFL Stars
const nflStars = [
  { first: 'Justin', last: 'Jefferson', pos: 'WR', team: 'Minnesota Vikings' },
  { first: 'Nick', last: 'Chubb', pos: 'RB', team: 'Cleveland Browns' },
  { first: 'T.J.', last: 'Watt', pos: 'LB', team: 'Pittsburgh Steelers' },
  { first: 'Davante', last: 'Adams', pos: 'WR', team: 'Las Vegas Raiders' },
  { first: 'Derrick', last: 'Henry', pos: 'RB', team: 'Tennessee Titans' },
  { first: 'Aaron', last: 'Donald', pos: 'DL', team: 'Los Angeles Rams' },
  { first: 'Cooper', last: 'Kupp', pos: 'WR', team: 'Los Angeles Rams' },
  { first: 'Jonathan', last: 'Taylor', pos: 'RB', team: 'Indianapolis Colts' },
  { first: 'Myles', last: 'Garrett', pos: 'DL', team: 'Cleveland Browns' },
  { first: 'Ja\'Marr', last: 'Chase', pos: 'WR', team: 'Cincinnati Bengals' },
  { first: 'Joe', last: 'Burrow', pos: 'QB', team: 'Cincinnati Bengals' },
  { first: 'Trevor', last: 'Lawrence', pos: 'QB', team: 'Jacksonville Jaguars' },
  { first: 'Sauce', last: 'Gardner', pos: 'CB', team: 'New York Jets' },
  { first: 'Jalen', last: 'Ramsey', pos: 'CB', team: 'Miami Dolphins' },
  { first: 'Deebo', last: 'Samuel', pos: 'WR', team: 'San Francisco 49ers' }
];

// NBA Stars
const nbaStars = [
  { first: 'LeBron', last: 'James', pos: 'SF', team: 'Los Angeles Lakers' },
  { first: 'Stephen', last: 'Curry', pos: 'PG', team: 'Golden State Warriors' },
  { first: 'Giannis', last: 'Antetokounmpo', pos: 'PF', team: 'Milwaukee Bucks' },
  { first: 'Kevin', last: 'Durant', pos: 'SF', team: 'Phoenix Suns' },
  { first: 'Jayson', last: 'Tatum', pos: 'SF', team: 'Boston Celtics' },
  { first: 'Luka', last: 'Doncic', pos: 'PG', team: 'Dallas Mavericks' },
  { first: 'Joel', last: 'Embiid', pos: 'C', team: 'Philadelphia 76ers' },
  { first: 'Nikola', last: 'Jokic', pos: 'C', team: 'Denver Nuggets' },
  { first: 'Jimmy', last: 'Butler', pos: 'SF', team: 'Miami Heat' },
  { first: 'Damian', last: 'Lillard', pos: 'PG', team: 'Milwaukee Bucks' }
];

async function loadFinalPlayers() {
  let totalAdded = 0;
  
  // Load NFL stars
  console.log(chalk.yellow('Loading NFL stars...'));
  
  for (const player of nflStars) {
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('name', player.team)
      .single();
    
    if (team) {
      const { error } = await supabase.from('players').insert({
        firstname: player.first,
        lastname: player.last,
        position: [player.pos],
        team_id: team.id,
        jersey_number: Math.floor(Math.random() * 99) + 1,
        sport_id: 'nfl',
        status: 'active',
        heightinches: 74,
        weightlbs: 220
      });
      
      if (!error) totalAdded++;
    }
  }
  
  console.log(chalk.green(`✅ Added ${totalAdded} NFL stars`));
  
  // Load NBA stars
  console.log(chalk.yellow('\nLoading NBA stars...'));
  let nbaAdded = 0;
  
  for (const player of nbaStars) {
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('name', player.team)
      .single();
    
    if (team) {
      const { error } = await supabase.from('players').insert({
        firstname: player.first,
        lastname: player.last,
        position: [player.pos],
        team_id: team.id,
        jersey_number: Math.floor(Math.random() * 99) + 1,
        sport_id: 'nba',
        status: 'active',
        heightinches: 78,
        weightlbs: 220
      });
      
      if (!error) {
        nbaAdded++;
        totalAdded++;
      }
    }
  }
  
  console.log(chalk.green(`✅ Added ${nbaAdded} NBA stars`));
  
  // Generate more generic players
  console.log(chalk.yellow('\nGenerating additional players...'));
  
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, sport_id')
    .in('sport_id', ['nfl', 'nba', 'mlb', 'nhl']);
  
  if (allTeams) {
    const firstNames = ['Mike', 'Jake', 'Ryan', 'Matt', 'Alex', 'Ben', 'Sam', 'Will', 'Joe', 'Tom'];
    const lastNames = ['Johnson', 'Smith', 'Williams', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas'];
    
    let genericAdded = 0;
    
    for (const team of allTeams) {
      // Add 5 players per team
      for (let i = 0; i < 5; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        
        const positions = {
          nfl: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'],
          nba: ['PG', 'SG', 'SF', 'PF', 'C'],
          mlb: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'],
          nhl: ['C', 'LW', 'RW', 'D', 'G']
        };
        
        const sportPositions = positions[team.sport_id] || ['Player'];
        const position = sportPositions[Math.floor(Math.random() * sportPositions.length)];
        
        const { error } = await supabase.from('players').insert({
          firstname: firstName,
          lastname: `${lastName}${totalAdded}`, // Make unique
          position: [position],
          team_id: team.id,
          jersey_number: (i + 1) + (totalAdded % 80),
          sport_id: team.sport_id,
          status: 'active',
          heightinches: 72 + Math.floor(Math.random() * 8),
          weightlbs: 180 + Math.floor(Math.random() * 60)
        });
        
        if (!error) {
          genericAdded++;
          totalAdded++;
        }
      }
    }
    
    console.log(chalk.green(`✅ Added ${genericAdded} additional players`));
  }
  
  console.log(chalk.green.bold(`\n🎉 TOTAL PLAYERS ADDED: ${totalAdded}`));
  
  // Final database summary
  console.log(chalk.blue.bold('\n📊 COMPLETE DATABASE SUMMARY:'));
  
  const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
  const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { count: newsCount } = await supabase.from('news_articles').select('*', { count: 'exact', head: true });
  const { count: gameCount } = await supabase.from('games').select('*', { count: 'exact', head: true });
  
  const total = (teamCount || 0) + (playerCount || 0) + (newsCount || 0) + (gameCount || 0);
  
  console.log(chalk.cyan(`
  🏟️  Teams: ${teamCount}
  🏃 Players: ${playerCount}
  📰 News: ${newsCount}
  🏈 Games: ${gameCount}
  ━━━━━━━━━━━━━━━━━━━
  📈 TOTAL: ${total} records!
  `));
  
  if (total > 500) {
    console.log(chalk.green.bold('✨ EXCELLENT! Your database is now fully loaded!'));
    console.log(chalk.green('✨ The Fantasy AI app has plenty of data to work with!'));
  }
}

loadFinalPlayers().catch(console.error);