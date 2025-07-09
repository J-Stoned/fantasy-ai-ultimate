#!/usr/bin/env tsx

/**
 * Test AI Assistant Integration
 * Verifies OpenAI connection and chat functionality
 */

import chalk from 'chalk';

async function testAIAssistant() {
  console.log(chalk.blue('🤖 Testing AI Assistant Integration...\n'));

  // First check if the endpoint is configured
  console.log('📡 Checking AI endpoint configuration...');
  try {
    const configResponse = await fetch('http://localhost:3000/api/ai/chat');
    const config = await configResponse.json();
    
    console.log(`✅ Endpoint available: ${config.endpoint}`);
    console.log(`   Model: ${config.model}`);
    console.log(`   Status: ${config.configured ? chalk.green('Configured') : chalk.red('Not configured')}`);
    
    if (!config.configured) {
      console.log(chalk.yellow('\n⚠️  Anthropic API key not configured!'));
      console.log(chalk.yellow('   Add ANTHROPIC_API_KEY to your .env.local file'));
      console.log(chalk.yellow('   Get your key from: https://console.anthropic.com/settings/keys'));
      return;
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to reach API endpoint'));
    console.error(chalk.yellow('   Make sure the server is running: npm run dev:web'));
    return;
  }

  // Test actual chat functionality
  console.log(chalk.blue('\n💬 Testing chat functionality...\n'));

  const testQuestions = [
    "What is the Back-to-Back Fade pattern?",
    "Which patterns have the best ROI?",
    "Analyze a game between Lakers and Warriors"
  ];

  for (const question of testQuestions) {
    console.log(chalk.cyan(`Q: ${question}`));
    
    try {
      const response = await fetch('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: question }
          ]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.log(chalk.red(`A: ${data.content || data.error}`));
      } else {
        console.log(chalk.green(`A: ${data.content.substring(0, 150)}...`));
        
        if (data.usage) {
          console.log(chalk.gray(`   Tokens: ${data.usage.total_tokens}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Request failed:'), error);
    }
    
    console.log('');
  }

  // Test conversation context
  console.log(chalk.blue('🔄 Testing conversation context...\n'));
  
  const conversation = [
    { role: 'user', content: 'My name is Marcus' },
    { role: 'assistant', content: 'Nice to meet you, Marcus!' },
    { role: 'user', content: 'What is my name?' }
  ];

  try {
    const response = await fetch('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversation })
    });

    const data = await response.json();
    
    if (data.content.toLowerCase().includes('marcus')) {
      console.log(chalk.green('✅ AI maintains conversation context!'));
    } else {
      console.log(chalk.yellow('⚠️  AI may not be maintaining context properly'));
    }
    console.log(`Response: ${data.content}`);
  } catch (error) {
    console.error(chalk.red('❌ Context test failed:'), error);
  }
}

// Run the test
testAIAssistant()
  .then(() => {
    console.log(chalk.green('\n✅ AI Assistant test complete!'));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red('\n❌ Test failed!'), error);
    process.exit(1);
  });