#!/usr/bin/env tsx
/**
 * Fix email confirmation for users
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function fixEmailConfirmation() {
  console.log(chalk.yellow('🔧 Fixing email confirmation for recent users...\n'));

  try {
    // Get recent unconfirmed users
    const { data: users, error } = await supabase
      .from('auth.users')
      .select('id, email, email_confirmed_at, created_at')
      .is('email_confirmed_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error(chalk.red('Error fetching users:'), error);
      
      // Try direct auth admin API
      console.log(chalk.yellow('\nTrying auth admin API...'));
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 10
      });

      if (authError) {
        console.error(chalk.red('Auth error:'), authError);
        return;
      }

      const unconfirmedUsers = authUsers?.filter(u => !u.email_confirmed_at) || [];
      
      if (unconfirmedUsers.length === 0) {
        console.log(chalk.green('✅ No unconfirmed users found!'));
        return;
      }

      console.log(chalk.cyan(`Found ${unconfirmedUsers.length} unconfirmed users:\n`));
      
      for (const user of unconfirmedUsers) {
        console.log(`Email: ${user.email}`);
        console.log(`Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log(chalk.yellow('Confirming user...'));
        
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email_confirmed_at: new Date().toISOString() }
        );
        
        if (updateError) {
          console.error(chalk.red(`Failed to confirm ${user.email}:`), updateError);
        } else {
          console.log(chalk.green(`✅ Confirmed ${user.email}`));
        }
        console.log('---');
      }
      
      return;
    }

    if (!users || users.length === 0) {
      console.log(chalk.green('✅ No unconfirmed users found!'));
      return;
    }

    console.log(chalk.cyan(`Found ${users.length} unconfirmed users:\n`));

    for (const user of users) {
      console.log(`Email: ${user.email}`);
      console.log(`Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('---');
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Add command to confirm a specific email
const email = process.argv[2];
if (email) {
  console.log(chalk.yellow(`\n🎯 Confirming specific email: ${email}\n`));
  
  supabase.auth.admin.listUsers().then(({ data: { users }, error }) => {
    if (error) {
      console.error(chalk.red('Error:'), error);
      return;
    }
    
    const user = users?.find(u => u.email === email);
    if (!user) {
      console.error(chalk.red(`User not found: ${email}`));
      return;
    }
    
    if (user.email_confirmed_at) {
      console.log(chalk.green(`✅ Email already confirmed!`));
      return;
    }
    
    supabase.auth.admin.updateUserById(user.id, {
      email_confirmed_at: new Date().toISOString()
    }).then(({ error: updateError }) => {
      if (updateError) {
        console.error(chalk.red('Failed to confirm:'), updateError);
      } else {
        console.log(chalk.green(`✅ Successfully confirmed ${email}!`));
        console.log(chalk.cyan('\nYou can now log in with this email.'));
      }
    });
  });
} else {
  fixEmailConfirmation().catch(console.error);
}