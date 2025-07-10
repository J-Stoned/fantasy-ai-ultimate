#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testColumns() {
  console.log(chalk.yellow('Testing platform_connections columns...\n'))

  // Try different column name variations
  const columnVariations = [
    'lastWriteAt',
    'lastwriteat', 
    'last_write_at',
    'lastWriteat',
    'LastWriteAt'
  ]

  for (const columnName of columnVariations) {
    try {
      const query = `id, platform, scopes, ${columnName}`
      console.log(chalk.blue(`Testing: ${columnName}`))
      
      const { data, error } = await supabase
        .from('platform_connections')
        .select(query)
        .limit(1)

      if (!error) {
        console.log(chalk.green(`✓ Column '${columnName}' exists!\n`))
        
        // Test insert with dummy data
        console.log(chalk.blue('Testing insert...'))
        const { error: insertError } = await supabase
          .from('platform_connections')
          .insert({
            userId: '00000000-0000-0000-0000-000000000000',
            platform: 'yahoo',
            platformUserId: 'test',
            accessToken: 'test',
            refreshToken: 'test',
            isActive: true,
            scopes: 'fspt-w',
            [columnName]: new Date().toISOString()
          })

        if (insertError) {
          console.log(chalk.yellow(`Insert test: ${insertError.message}`))
        } else {
          console.log(chalk.green('✓ Insert successful!'))
          
          // Clean up
          await supabase
            .from('platform_connections')
            .delete()
            .eq('platformUserId', 'test')
        }
        
        return columnName
      }
    } catch (err) {
      // Column doesn't exist with this name
    }
  }
  
  console.log(chalk.red('\n❌ Could not find the lastWriteAt column with any variation'))
  console.log(chalk.yellow('\nPlease check the Supabase dashboard for the exact column name'))
}

testColumns().catch(console.error)