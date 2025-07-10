import NBAMasterCollector from './collectors/nba-master-collector';

async function runNBACollector() {
  console.log('🏀 Running NBA Master Collector...\n');
  
  const collector = new NBAMasterCollector();
  
  try {
    await collector.collect();
    console.log('\n✅ NBA collection completed successfully!');
  } catch (error) {
    console.error('\n❌ NBA collection failed:', error);
    process.exit(1);
  }
}

runNBACollector();