#!/usr/bin/env tsx
/**
 * Add missing columns to platform_connections table
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function addColumns() {
  console.log(chalk.yellow('🔄 Adding columns to platform_connections...\n'))

  try {
    // First, let's check what columns exist
    const { data: existingData, error: checkError } = await supabase
      .from('platform_connections')
      .select('*')
      .limit(1)

    if (checkError) {
      console.log(chalk.red(`Error checking table: ${checkError.message}`))
      return
    }

    console.log(chalk.blue('Current columns:'), Object.keys(existingData?.[0] || {}))

    // Update existing records to add default values for new columns
    const { data: connections, error: fetchError } = await supabase
      .from('platform_connections')
      .select('id, platform')

    if (!fetchError && connections) {
      console.log(chalk.blue(`\nFound ${connections.length} connections to update\n`))

      for (const conn of connections) {
        try {
          // Add scopes based on platform
          const scopes = conn.platform === 'yahoo' ? 'fspt-w' : null
          
          // Try to update with new fields
          const { error: updateError } = await supabase
            .from('platform_connections')
            .update({
              ...conn,
              scopes: scopes,
              lastWriteAt: null
            })
            .eq('id', conn.id)

          if (updateError) {
            // If columns don't exist, this will fail
            console.log(chalk.yellow(`Note: ${updateError.message}`))
          } else {
            console.log(chalk.green(`✓ Updated connection ${conn.id}`))
          }
        } catch (err: any) {
          console.log(chalk.yellow(`Skipping ${conn.id}: ${err.message}`))
        }
      }
    }

    console.log(chalk.green('\n✅ Process completed!\n'))
    console.log(chalk.yellow('Note: If columns do not exist, you may need to add them manually through Supabase dashboard:'))
    console.log(chalk.gray('1. Go to your Supabase dashboard'))
    console.log(chalk.gray('2. Navigate to Table Editor > platform_connections'))
    console.log(chalk.gray('3. Add column "scopes" (text, nullable)'))
    console.log(chalk.gray('4. Add column "lastWriteAt" (timestamp with timezone, nullable)'))

  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message)
  }
}

addColumns().catch(console.error)