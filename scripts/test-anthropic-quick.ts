#!/usr/bin/env tsx

/**
 * Quick Anthropic API Test
 * Tests if the API key works without running the full server
 */

import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testAnthropic() {
  console.log(chalk.blue('🧪 Testing Anthropic API Connection...\n'));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.log(chalk.red('❌ ANTHROPIC_API_KEY not found in .env.local'));
    console.log(chalk.yellow('   Please add your API key to .env.local'));
    return;
  }

  console.log(chalk.green('✅ API key found'));
  console.log(`   Key starts with: ${apiKey.substring(0, 15)}...`);

  try {
    const anthropic = new Anthropic({ apiKey });
    
    console.log(chalk.blue('\n💬 Sending test message to Claude...\n'));
    
    const completion = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      system: 'You are a fantasy sports expert. Keep responses brief.',
      messages: [
        { 
          role: 'user', 
          content: 'What is the Back-to-Back Fade pattern in one sentence?' 
        }
      ],
      max_tokens: 100
    });

    const response = completion.content[0].type === 'text' 
      ? completion.content[0].text 
      : 'No response';

    console.log(chalk.green('✅ Claude responded:'));
    console.log(chalk.cyan(`   "${response}"`));
    console.log(chalk.gray(`\n   Tokens used: ${completion.usage.input_tokens + completion.usage.output_tokens}`));
    
    console.log(chalk.green('\n🎉 Anthropic API is working perfectly!'));
    console.log(chalk.yellow('   The AI Assistant will work when the server is running.'));

  } catch (error: any) {
    console.log(chalk.red('\n❌ API call failed:'));
    console.log(chalk.red(`   ${error.message}`));
    
    if (error.status === 401) {
      console.log(chalk.yellow('\n   Your API key might be invalid.'));
      console.log(chalk.yellow('   Get a new key at: https://console.anthropic.com/settings/keys'));
    }
  }
}

// Run the test
testAnthropic();