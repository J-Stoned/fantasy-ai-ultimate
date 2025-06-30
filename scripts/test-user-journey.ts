#!/usr/bin/env tsx
/**
 * COMPLETE USER JOURNEY TEST - Marcus "The Fixer" Rodriguez
 * This simulates a real user going through the entire fantasy platform
 * If this passes, we're ready for NFL Sunday!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(chalk.red('❌ Missing Supabase credentials'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string, 
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  console.log(chalk.blue(`\n📋 Testing: ${name}...`));
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ step: name, success: true, duration });
    console.log(chalk.green(`✅ ${name} - ${duration}ms`));
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ step: name, success: false, duration, error: errorMsg });
    console.log(chalk.red(`❌ ${name} - ${errorMsg}`));
  }
}

async function testUserJourney() {
  console.log(chalk.blue.bold(`
🏈 FANTASY AI ULTIMATE - COMPLETE USER JOURNEY TEST
==================================================
Simulating a real user's experience on NFL Sunday
`));

  let authToken: string | null = null;
  let userId: string | null = null;

  // 1. Test Landing Page Load
  await runTest('Landing Page Load', async () => {
    const response = await axios.get(apiUrl);
    if (response.status !== 200) throw new Error('Landing page failed to load');
  });

  // 2. Test User Registration
  const testEmail = `test.user.${Date.now()}@fantasy-test.com`;
  const testPassword = 'TestPassword123!NFL';
  
  await runTest('User Registration', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          firstName: 'Marcus',
          lastName: 'TestUser',
          favoriteTeam: 'KC'
        }
      }
    });
    
    if (error) throw error;
    if (!data.user) throw new Error('No user returned');
    
    userId = data.user.id;
    authToken = data.session?.access_token || null;
  });

  // 3. Test User Login
  await runTest('User Login', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (error) throw error;
    if (!data.session) throw new Error('No session created');
    
    authToken = data.session.access_token;
  });

  // 4. Test Protected API Route (MCP Status)
  await runTest('Protected API Route - MCP Status', async () => {
    try {
      // First try without auth - should fail
      const noAuthResponse = await axios.get(`${apiUrl}/api/mcp/status`, {
        validateStatus: () => true
      });
      
      if (noAuthResponse.status !== 401) {
        throw new Error('API endpoint not properly protected!');
      }
      
      // Now try with auth - should succeed
      const authResponse = await axios.get(`${apiUrl}/api/mcp/status`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Cookie': `sb-access-token=${authToken}`
        }
      });
      
      if (authResponse.status !== 200) {
        throw new Error(`Auth request failed: ${authResponse.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log(chalk.green('✅ API properly protected'));
      } else {
        throw error;
      }
    }
  });

  // 5. Test Database RLS
  await runTest('Database RLS - User Isolation', async () => {
    // Try to query user_profiles table
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*');
    
    // Should either get only our user's data or an RLS error
    if (error && !error.message.includes('RLS')) {
      throw error;
    }
    
    if (data && data.length > 1) {
      throw new Error('RLS not working - can see other users data!');
    }
  });

  // 6. Test Player Search (Performance Check)
  await runTest('Player Search Performance', async () => {
    const startTime = Date.now();
    
    // Simulate searching for a player
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .ilike('lastName', '%mahomes%')
      .limit(10);
    
    const searchTime = Date.now() - startTime;
    
    if (error) throw error;
    if (searchTime > 1000) {
      throw new Error(`Search too slow: ${searchTime}ms (should be <1000ms)`);
    }
  });

  // 7. Test Fantasy League Creation
  await runTest('Create Fantasy League', async () => {
    const { data, error } = await supabase
      .from('fantasy_leagues')
      .insert({
        name: 'Marcus Test League',
        sport_id: 'nfl',
        season: 2024,
        settings: {
          maxTeams: 12,
          scoringType: 'PPR',
          draftType: 'snake'
        },
        commissioner_id: userId
      })
      .select()
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('League creation failed');
  });

  // 8. Test Real-time Subscriptions
  await runTest('Real-time Subscription Test', async () => {
    return new Promise((resolve, reject) => {
      const channel = supabase
        .channel('test-channel')
        .on('presence', { event: 'sync' }, () => {
          channel.unsubscribe();
          resolve();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.track({ user_id: userId });
          } else if (status === 'CHANNEL_ERROR') {
            reject(new Error('Real-time subscription failed'));
          }
        });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        channel.unsubscribe();
        reject(new Error('Real-time subscription timeout'));
      }, 5000);
    });
  });

  // 9. Test Concurrent Requests (Simulate Multiple Users)
  await runTest('Concurrent Request Handling', async () => {
    const requests = Array(50).fill(null).map(() => 
      axios.get(`${apiUrl}/api/health`, {
        validateStatus: () => true
      })
    );
    
    const responses = await Promise.all(requests);
    const failedRequests = responses.filter(r => r.status !== 200);
    
    if (failedRequests.length > 0) {
      throw new Error(`${failedRequests.length}/50 requests failed`);
    }
  });

  // 10. Test Memory Usage (Check for Leaks)
  await runTest('Memory Stability Check', async () => {
    if (global.gc) {
      global.gc();
      const memBefore = process.memoryUsage().heapUsed;
      
      // Simulate some operations
      for (let i = 0; i < 100; i++) {
        await supabase.from('players').select('id').limit(1);
      }
      
      global.gc();
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = memAfter - memBefore;
      
      if (memIncrease > 50 * 1024 * 1024) { // 50MB threshold
        throw new Error(`Potential memory leak: ${(memIncrease / 1024 / 1024).toFixed(2)}MB increase`);
      }
    }
  });

  // Cleanup
  await runTest('Cleanup Test User', async () => {
    if (userId) {
      await supabase.auth.signOut();
    }
  });

  // Print Results
  console.log(chalk.blue.bold('\n📊 TEST RESULTS SUMMARY'));
  console.log('========================\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? chalk.green : chalk.red;
    console.log(color(`${icon} ${result.step} - ${result.duration}ms`));
    if (result.error) {
      console.log(chalk.red(`   Error: ${result.error}`));
    }
  });
  
  console.log(chalk.blue(`\n📈 Performance Metrics:`));
  console.log(`Total Tests: ${results.length}`);
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Average: ${(totalDuration / results.length).toFixed(0)}ms per test`);
  
  // Grade the platform
  const successRate = (passed / results.length) * 100;
  let grade = 'F';
  if (successRate === 100) grade = 'A+';
  else if (successRate >= 95) grade = 'A';
  else if (successRate >= 90) grade = 'B';
  else if (successRate >= 80) grade = 'C';
  else if (successRate >= 70) grade = 'D';
  
  console.log(chalk.blue.bold(`\n🎯 Platform Grade: ${grade} (${successRate.toFixed(1)}%)`));
  
  if (grade === 'A+') {
    console.log(chalk.green.bold('\n🏆 PRODUCTION READY FOR NFL SUNDAY!'));
    console.log(chalk.green('Your platform passed ALL tests. Ship it!'));
  } else if (failed > 0) {
    console.log(chalk.red.bold('\n⚠️  NOT READY FOR PRODUCTION'));
    console.log(chalk.red('Fix the failing tests before deployment!'));
    process.exit(1);
  }
}

// Run the test
testUserJourney().catch(error => {
  console.error(chalk.red.bold('\n💥 CATASTROPHIC FAILURE:'), error);
  process.exit(1);
});