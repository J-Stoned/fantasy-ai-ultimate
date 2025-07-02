#!/usr/bin/env tsx
/**
 * Debug why injury matching isn't working
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugMatching() {
  console.log(chalk.blue.bold('\n🔍 DEBUGGING INJURY MATCHING\n'));
  
  // 1. Check player data structure
  console.log(chalk.yellow('1. Checking player data...'));
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('*')
    .limit(5);
    
  console.log('Sample players:');
  for (const player of samplePlayers || []) {
    console.log(`  ${player.firstname} ${player.lastname} (${player.position}) - Team: ${player.team_id}`);
  }
  
  // 2. Check news article structure
  console.log(chalk.yellow('\n2. Checking injury news...'));
  const { data: sampleNews } = await supabase
    .from('news_articles')
    .select('*')
    .or('title.ilike.%injury%,title.ilike.%injured%,title.ilike.%out%')
    .limit(5);
    
  console.log('Sample injury articles:');
  for (const article of sampleNews || []) {
    console.log(`\n  Title: ${article.title}`);
    console.log(`  Summary: ${(article.summary || '').substring(0, 100)}...`);
  }
  
  // 3. Try to find any player names in news
  console.log(chalk.yellow('\n3. Looking for player names in news...'));
  
  const { data: topPlayers } = await supabase
    .from('players')
    .select('id, firstname, lastname')
    .in('lastname', ['Mahomes', 'Allen', 'Jackson', 'Burrow', 'Herbert', 'Hurts'])
    .limit(10);
    
  if (topPlayers && sampleNews) {
    console.log('\nSearching for these players in news:');
    for (const player of topPlayers) {
      console.log(`  Looking for: ${player.firstname} ${player.lastname}`);
      
      for (const article of sampleNews) {
        const text = `${article.title} ${article.summary || ''}`.toLowerCase();
        const fullName = `${player.firstname} ${player.lastname}`.toLowerCase();
        const lastName = player.lastname.toLowerCase();
        
        if (text.includes(fullName)) {
          console.log(chalk.green(`    ✓ Found full name in: "${article.title.substring(0, 50)}..."`));
        } else if (text.includes(lastName)) {
          console.log(chalk.yellow(`    ~ Found last name in: "${article.title.substring(0, 50)}..."`));
        }
      }
    }
  }
  
  // 4. Check if teams table join is working
  console.log(chalk.yellow('\n4. Testing teams join...'));
  const { data: playerWithTeam, error: teamError } = await supabase
    .from('players')
    .select(`
      id, 
      firstname, 
      lastname,
      teams:team_id (
        id,
        name,
        abbreviation
      )
    `)
    .limit(1)
    .single();
    
  if (teamError) {
    console.log(chalk.red('Team join error:', teamError.message));
  } else {
    console.log('Player with team:', playerWithTeam);
  }
  
  // 5. Try simpler approach - just check if we have the right columns
  console.log(chalk.yellow('\n5. Checking player_injuries columns...'));
  
  // Try inserting a test record with minimal data
  const testInjury = {
    player_id: samplePlayers?.[0]?.id,
    injury_type: 'test',
    status: 'questionable'
  };
  
  console.log('Trying to insert:', testInjury);
  
  const { data: insertTest, error: insertError } = await supabase
    .from('player_injuries')
    .insert(testInjury)
    .select();
    
  if (insertError) {
    console.log(chalk.red('Insert error:', insertError.message));
    console.log('Error details:', insertError);
  } else {
    console.log(chalk.green('Insert successful!'));
    console.log('Inserted record:', insertTest);
    
    // Clean up
    if (insertTest?.[0]) {
      await supabase.from('player_injuries').delete().eq('id', insertTest[0].id);
    }
  }
}

debugMatching().catch(console.error);