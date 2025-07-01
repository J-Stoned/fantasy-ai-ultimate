import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteBatch(table: string, condition: any, batchSize = 5000): Promise<number> {
  let totalDeleted = 0;
  
  while (true) {
    const { error, count } = await supabase
      .from(table)
      .delete()
      .match(condition)
      .order('id')
      .limit(batchSize)
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    if (!count || count === 0) break;
    
    totalDeleted += count;
    console.log(chalk.gray(`  Deleted ${count} records from ${table} (${totalDeleted} total)`));
    
    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return totalDeleted;
}

async function cleanupSyntheticData() {
  console.log(chalk.yellow('\n🧹 Starting synthetic data cleanup in batches...\n'));

  try {
    // Delete synthetic players (those without external_id or with non-API external_ids)
    console.log(chalk.blue('Deleting synthetic players...'));
    const playersDeleted = await deleteBatch('players', { external_id: null });
    console.log(chalk.green(`✅ Deleted ${playersDeleted} synthetic players`));

    // Delete synthetic games
    console.log(chalk.blue('\nDeleting synthetic games...'));
    const gamesDeleted = await deleteBatch('games', { external_id: null });
    console.log(chalk.green(`✅ Deleted ${gamesDeleted} synthetic games`));

    // Delete synthetic news articles (keep only The Odds API, Reddit, ESPN sources)
    console.log(chalk.blue('\nDeleting synthetic news articles...'));
    const { data: syntheticNews } = await supabase
      .from('news_articles')
      .select('id')
      .not('source', 'in', '("The Odds API","Reddit","ESPN")')
      .limit(50000);

    let newsDeleted = 0;
    if (syntheticNews && syntheticNews.length > 0) {
      const ids = syntheticNews.map(n => n.id);
      const { error, count } = await supabase
        .from('news_articles')
        .delete()
        .in('id', ids)
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      newsDeleted = count || 0;
    }
    console.log(chalk.green(`✅ Deleted ${newsDeleted} synthetic news articles`));

    // Get final counts
    console.log(chalk.yellow('\n📊 Getting final database stats...\n'));

    const { count: finalPlayers } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });

    const { count: finalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    const { count: finalNews } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true });

    const totalDeleted = playersDeleted + gamesDeleted + newsDeleted;

    console.log(chalk.cyan('\n🎯 CLEANUP COMPLETE'));
    console.log(chalk.cyan('==================\n'));
    console.log(chalk.white(`🗑️  Deleted: ${totalDeleted.toLocaleString()} synthetic records`));
    console.log(chalk.white(`✨ Remaining real data:`));
    console.log(chalk.white(`   - Players: ${finalPlayers?.toLocaleString() || 0}`));
    console.log(chalk.white(`   - Games: ${finalGames?.toLocaleString() || 0}`));
    console.log(chalk.white(`   - News: ${finalNews?.toLocaleString() || 0}`));
    console.log(chalk.green(`\n✅ Database now contains only real API data!\n`));

  } catch (error) {
    console.error(chalk.red('❌ Cleanup error:'), error);
  }
}

cleanupSyntheticData();