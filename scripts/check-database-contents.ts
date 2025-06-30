#!/usr/bin/env tsx
/**
 * CHECK DATABASE CONTENTS
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkDatabase() {
  console.log(chalk.blue.bold('\n📊 DATABASE CONTENTS CHECK'));
  console.log(chalk.blue('==========================\n'));
  
  // Check news articles
  const { data: news, count: newsCount } = await supabase
    .from('news_articles')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })
    .limit(5);
  
  console.log(chalk.yellow(`📰 NEWS ARTICLES: ${newsCount || 0} total`));
  if (news && news.length > 0) {
    news.forEach(article => {
      console.log(`  - ${article.title.substring(0, 60)}...`);
    });
  }
  
  // Check teams
  const { data: teams, count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact' })
    .limit(5);
  
  console.log(chalk.yellow(`\n🏟️  TEAMS: ${teamCount || 0} total`));
  if (teams && teams.length > 0) {
    teams.forEach(team => {
      console.log(`  - ${team.name} (${team.sport_id})`);
    });
  }
  
  // Check players
  const { data: players, count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact' })
    .limit(5);
  
  console.log(chalk.yellow(`\n🏃 PLAYERS: ${playerCount || 0} total`));
  if (players && players.length > 0) {
    players.forEach(player => {
      console.log(`  - ${player.firstName} ${player.lastName} (${player.sport_id})`);
    });
  }
  
  // Check games
  const { data: games, count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .limit(5);
  
  console.log(chalk.yellow(`\n🏈 GAMES: ${gameCount || 0} total`));
  
  // Summary
  console.log(chalk.green.bold('\n📈 SUMMARY:'));
  console.log(`Total Records: ${(newsCount || 0) + (teamCount || 0) + (playerCount || 0) + (gameCount || 0)}`);
  
  if ((newsCount || 0) < 10) {
    console.log(chalk.red('\n⚠️  Very little data collected!'));
    console.log(chalk.yellow('Run the enhanced collector for more data:'));
    console.log('tsx scripts/enhanced-data-collector.ts');
  }
}

checkDatabase().catch(console.error);