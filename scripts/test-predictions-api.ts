import chalk from 'chalk';

async function testPredictionsAPI() {
  console.log(chalk.bold.cyan('🔥 TESTING PREDICTIONS API'));
  console.log(chalk.gray('='.repeat(40)));
  
  const baseUrl = 'http://localhost:3000/api/predictions';
  
  try {
    // Test 1: Get all predictions
    console.log(chalk.yellow('\n1. Fetching all predictions...'));
    const allResponse = await fetch(baseUrl);
    const allData = await allResponse.json();
    
    console.log(chalk.green(`✅ Found ${allData.count} predictions`));
    console.log(chalk.gray(`   Model: ${allData.modelInfo.name}`));
    console.log(chalk.gray(`   Accuracy: ${(allData.modelInfo.accuracy * 100).toFixed(1)}%`));
    
    if (allData.predictions.length > 0) {
      const pred = allData.predictions[0];
      console.log(chalk.cyan('\n   Sample prediction:'));
      console.log(`   ${pred.game.homeTeam.name} vs ${pred.game.awayTeam.name}`);
      console.log(`   Winner: ${pred.prediction.winner.toUpperCase()}`);
      console.log(`   Confidence: ${(pred.prediction.confidence * 100).toFixed(1)}%`);
    }
    
    // Test 2: Get predictions by sport
    console.log(chalk.yellow('\n2. Fetching NFL predictions...'));
    const nflResponse = await fetch(`${baseUrl}?sport=nfl`);
    const nflData = await nflResponse.json();
    console.log(chalk.green(`✅ Found ${nflData.count} NFL predictions`));
    
    // Test 3: Get predictions for today
    console.log(chalk.yellow('\n3. Fetching today\'s predictions...'));
    const today = new Date().toISOString().split('T')[0];
    const todayResponse = await fetch(`${baseUrl}?date=${today}`);
    const todayData = await todayResponse.json();
    console.log(chalk.green(`✅ Found ${todayData.count} predictions for today`));
    
    // Test 4: Get specific game prediction
    if (allData.predictions.length > 0) {
      const gameId = allData.predictions[0].gameId;
      console.log(chalk.yellow(`\n4. Fetching prediction for game ${gameId}...`));
      const gameResponse = await fetch(`${baseUrl}?game_id=${gameId}`);
      const gameData = await gameResponse.json();
      
      if (gameData.predictions.length > 0) {
        const p = gameData.predictions[0];
        console.log(chalk.green('✅ Game prediction details:'));
        console.log(`   ${p.game.homeTeam.name}: ${(p.prediction.homeWinProbability * 100).toFixed(1)}%`);
        console.log(`   ${p.game.awayTeam.name}: ${(p.prediction.awayWinProbability * 100).toFixed(1)}%`);
        console.log(`   Models: ${Object.keys(p.prediction.models).join(', ')}`);
      }
    }
    
    console.log(chalk.bold.green('\n✅ API is working perfectly!'));
    
  } catch (error) {
    console.error(chalk.red('❌ API Error:'), error);
    console.log(chalk.yellow('\nMake sure the Next.js server is running:'));
    console.log(chalk.gray('  npm run dev'));
  }
}

testPredictionsAPI().catch(console.error);