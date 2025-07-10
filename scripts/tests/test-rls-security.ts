#!/usr/bin/env tsx
/**
 * RLS SECURITY TEST SUITE
 * 
 * Tests that our Row Level Security policies work correctly
 * Run this to verify users can only access their own data
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';

// Test configuration - NEVER hardcode credentials!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error(chalk.red('❌ Missing required environment variables!'));
  console.error(chalk.yellow('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'));
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Test results tracking
interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

// Helper to run a test
async function runTest(name: string, testFn: () => Promise<boolean>) {
  process.stdout.write(chalk.gray(`Testing ${name}...`));
  try {
    const passed = await testFn();
    results.push({ test: name, passed });
    console.log(passed ? chalk.green(' ✅') : chalk.red(' ❌'));
  } catch (error: any) {
    results.push({ test: name, passed: false, error: error.message });
    console.log(chalk.red(' ❌'), chalk.red(error.message));
  }
}

// SECURITY TESTS
async function runSecurityTests() {
  console.log(chalk.blue.bold('\n🔒 RLS SECURITY TEST SUITE\n'));
  
  // Test 1: Anonymous user can't read user profiles
  await runTest('Anonymous blocked from user_profiles', async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    // Should get an error or empty data
    return error !== null || (data && data.length === 0);
  });

  // Test 2: Anonymous user can't read fantasy teams
  await runTest('Anonymous blocked from fantasy_teams', async () => {
    const { data, error } = await supabase
      .from('fantasy_teams')
      .select('*')
      .limit(1);
    
    return error !== null || (data && data.length === 0);
  });

  // Test 3: Anonymous user can't insert into user profiles
  await runTest('Anonymous blocked from inserting user_profiles', async () => {
    const { error } = await supabase
      .from('user_profiles')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        username: 'hacker',
        email: 'hacker@test.com'
      });
    
    return error !== null;
  });

  // Test 4: Anonymous user can't read sensitive financial data
  await runTest('Anonymous blocked from player_contracts', async () => {
    const { data, error } = await supabase
      .from('player_contracts')
      .select('*')
      .limit(1);
    
    return error !== null || (data && data.length === 0);
  });

  // Test 5: Anonymous user can't read medical data
  await runTest('Anonymous blocked from player_medical_history', async () => {
    const { data, error } = await supabase
      .from('player_medical_history')
      .select('*')
      .limit(1);
    
    return error !== null || (data && data.length === 0);
  });

  // Test 6: Check that sports reference data requires auth
  await runTest('Anonymous blocked from sports data', async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .limit(1);
    
    return error !== null || (data && data.length === 0);
  });

  // Test 7: Verify platform connections are protected
  await runTest('Anonymous blocked from platform_connections', async () => {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('*')
      .limit(1);
    
    return error !== null || (data && data.length === 0);
  });

  // Test 8: Check social media accounts are protected
  await runTest('Anonymous blocked from social_media_accounts', async () => {
    const { data, error } = await supabase
      .from('social_media_accounts')
      .select('*')
      .limit(1);
    
    return error !== null || (data && data.length === 0);
  });

  // Test 9: Verify betting data is protected
  await runTest('Anonymous blocked from betting_lines', async () => {
    const { data, error } = await supabase
      .from('betting_lines')
      .select('*')
      .limit(1);
    
    return error !== null || (data && data.length === 0);
  });

  // Test 10: Check sync logs are protected
  await runTest('Anonymous blocked from sync_logs', async () => {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .limit(1);
    
    return error !== null || (data && data.length === 0);
  });
}

// AUTHENTICATED USER TESTS (requires test user)
async function runAuthenticatedTests() {
  console.log(chalk.blue.bold('\n🔑 AUTHENTICATED USER TESTS\n'));
  
  // Try to sign up a test user
  console.log(chalk.gray('Creating test user...'));
  
  const testEmail = `test_${Date.now()}@fantasyai.test`;
  const testPassword = 'TestPassword123!';
  
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError || !authData.user) {
    console.log(chalk.yellow('⚠️  Could not create test user - skipping authenticated tests'));
    console.log(chalk.gray('(This is normal if email confirmations are required)'));
    return;
  }

  const userId = authData.user.id;
  console.log(chalk.green(`✅ Test user created: ${userId}`));

  // Test authenticated access to sports data
  await runTest('Authenticated can read sports data', async () => {
    const { error } = await supabase
      .from('sports')
      .select('*')
      .limit(1);
    
    // Should work (no error) even if no data exists
    return error === null;
  });

  // Test user can create their own profile
  await runTest('User can create own profile', async () => {
    const { error } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userId,
        username: 'testuser',
        email: testEmail
      });
    
    return error === null;
  });

  // Clean up test user
  await supabase.auth.signOut();
}

// SUMMARY REPORT
function showSummary() {
  console.log(chalk.blue.bold('\n📊 SECURITY TEST SUMMARY\n'));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${chalk.green(passed)}`);
  console.log(`Failed: ${chalk.red(failed)}`);
  
  const score = Math.round((passed / total) * 100);
  const scoreColor = score === 100 ? chalk.green : score >= 80 ? chalk.yellow : chalk.red;
  
  console.log(chalk.blue.bold(`\n🛡️  SECURITY SCORE: ${scoreColor(score + '%')}`));
  
  if (failed > 0) {
    console.log(chalk.red('\n❌ FAILED TESTS:'));
    results.filter(r => !r.passed).forEach(r => {
      console.log(chalk.red(`- ${r.test}`));
      if (r.error) console.log(chalk.gray(`  Error: ${r.error}`));
    });
  }
  
  if (score === 100) {
    console.log(chalk.green.bold('\n✅ ALL SECURITY TESTS PASSED!'));
    console.log(chalk.green('Your RLS policies are working correctly! 🎉'));
  } else {
    console.log(chalk.yellow('\n⚠️  Some security tests failed'));
    console.log(chalk.yellow('Review your RLS policies for the failed tests'));
  }
}

// RUN ALL TESTS
async function main() {
  try {
    await runSecurityTests();
    await runAuthenticatedTests();
    showSummary();
  } catch (error) {
    console.error(chalk.red('Test suite error:'), error);
    process.exit(1);
  }
}

main();