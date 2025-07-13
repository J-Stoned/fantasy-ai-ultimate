#!/usr/bin/env tsx
/**
 * CHECK ESPN ID COMPATIBILITY
 * Verifies the actual state of ESPN ID standardization in our database
 */

import { createClient } from '@supabase/supabase-js'
import chalk from 'chalk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkEspnIdCompatibility() {
  console.log(chalk.bold.cyan('🔍 ESPN ID COMPATIBILITY CHECK\n'))
  
  // Check games table
  console.log(chalk.yellow('📊 CHECKING GAMES TABLE...'))
  
  const { data: games } = await supabase
    .from('games')
    .select('external_id, sport')
    .not('external_id', 'is', null)
    .like('external_id', '%espn%')
    .limit(2000)
    
  console.log(`Total ESPN games sampled: ${games?.length || 0}`)
  
  const gameFormats = new Map<string, number>()
  const gameFormatSamples = new Map<string, string[]>()
  
  games?.forEach(g => {
    let format: string
    
    if (g.external_id.match(/^espn_[a-z]+_\d+$/)) {
      format = 'STANDARD'
    } else if (g.external_id.match(/^espn_\d+$/)) {
      format = 'NO_SPORT'
    } else if (g.external_id.match(/.*_dup\d*$/)) {
      format = 'DUPLICATE_MARKED'
    } else if (g.external_id.match(/^[a-z]+_\d+$/)) {
      format = 'LEGACY'
    } else {
      format = 'OTHER'
    }
    
    gameFormats.set(format, (gameFormats.get(format) || 0) + 1)
    
    if (!gameFormatSamples.has(format)) {
      gameFormatSamples.set(format, [])
    }
    if (gameFormatSamples.get(format)!.length < 3) {
      gameFormatSamples.get(format)!.push(`${g.external_id} (${g.sport || 'no sport'})`)
    }
  })
  
  console.log(chalk.cyan('\nGames format breakdown:'))
  gameFormats.forEach((count, format) => {
    const percentage = ((count / (games?.length || 1)) * 100).toFixed(1)
    console.log(`  ${format}: ${count} (${percentage}%)`)
    
    if (gameFormatSamples.has(format)) {
      gameFormatSamples.get(format)!.forEach(sample => {
        console.log(`    Sample: ${sample}`)
      })
    }
  })
  
  // Check teams table
  console.log(chalk.yellow('\n🏟️ CHECKING TEAMS TABLE...'))
  
  const { data: teams } = await supabase
    .from('teams')
    .select('external_id, sport')
    .not('external_id', 'is', null)
    .like('external_id', '%espn%')
    .limit(1000)
    
  console.log(`Total ESPN teams sampled: ${teams?.length || 0}`)
  
  const teamFormats = new Map<string, number>()
  const teamSamples = new Map<string, string[]>()
  
  teams?.forEach(t => {
    let format: string
    
    if (t.external_id.match(/^espn_[a-z]+_\d+$/)) {
      format = 'STANDARD'
    } else if (t.external_id.match(/^espn_\d+$/)) {
      format = 'NO_SPORT'
    } else {
      format = 'OTHER'
    }
    
    teamFormats.set(format, (teamFormats.get(format) || 0) + 1)
    
    if (!teamSamples.has(format)) {
      teamSamples.set(format, [])
    }
    if (teamSamples.get(format)!.length < 3) {
      teamSamples.get(format)!.push(`${t.external_id} (${t.sport || 'no sport'})`)
    }
  })
  
  console.log(chalk.cyan('\nTeams format breakdown:'))
  teamFormats.forEach((count, format) => {
    const percentage = ((count / (teams?.length || 1)) * 100).toFixed(1)
    console.log(`  ${format}: ${count} (${percentage}%)`)
    
    if (teamSamples.has(format)) {
      teamSamples.get(format)!.forEach(sample => {
        console.log(`    Sample: ${sample}`)
      })
    }
  })
  
  // Check players table
  console.log(chalk.yellow('\n👥 CHECKING PLAYERS TABLE...'))
  
  const { data: players } = await supabase
    .from('players')
    .select('external_id, sport')
    .not('external_id', 'is', null)
    .like('external_id', '%espn%')
    .limit(1000)
    
  console.log(`Total ESPN players sampled: ${players?.length || 0}`)
  
  const playerFormats = new Map<string, number>()
  const playerSamples = new Map<string, string[]>()
  
  players?.forEach(p => {
    let format: string
    
    if (p.external_id.match(/^espn_[a-z]+_\d+$/)) {
      format = 'STANDARD'
    } else if (p.external_id.match(/^espn_\d+$/)) {
      format = 'NO_SPORT'
    } else {
      format = 'OTHER'
    }
    
    playerFormats.set(format, (playerFormats.get(format) || 0) + 1)
    
    if (!playerSamples.has(format)) {
      playerSamples.set(format, [])
    }
    if (playerSamples.get(format)!.length < 3) {
      playerSamples.get(format)!.push(`${p.external_id} (${p.sport || 'no sport'})`)
    }
  })
  
  console.log(chalk.cyan('\nPlayers format breakdown:'))
  playerFormats.forEach((count, format) => {
    const percentage = ((count / (players?.length || 1)) * 100).toFixed(1)
    console.log(`  ${format}: ${count} (${percentage}%)`)
    
    if (playerSamples.has(format)) {
      playerSamples.get(format)!.forEach(sample => {
        console.log(`    Sample: ${sample}`)
      })
    }
  })
  
  // Overall compatibility assessment
  console.log(chalk.bold.yellow('\n📋 COMPATIBILITY ASSESSMENT:'))
  
  const totalStandard = (gameFormats.get('STANDARD') || 0) + 
                       (teamFormats.get('STANDARD') || 0) + 
                       (playerFormats.get('STANDARD') || 0)
                       
  const totalNonStandard = (gameFormats.get('NO_SPORT') || 0) + 
                          (gameFormats.get('LEGACY') || 0) + 
                          (gameFormats.get('OTHER') || 0) +
                          (teamFormats.get('NO_SPORT') || 0) + 
                          (teamFormats.get('OTHER') || 0) +
                          (playerFormats.get('NO_SPORT') || 0) + 
                          (playerFormats.get('OTHER') || 0)
                          
  const totalRecords = totalStandard + totalNonStandard + (gameFormats.get('DUPLICATE_MARKED') || 0)
  const standardPercentage = ((totalStandard / totalRecords) * 100).toFixed(1)
  
  if (parseFloat(standardPercentage) >= 95) {
    console.log(chalk.green(`✅ EXCELLENT: ${standardPercentage}% of ESPN IDs are standardized`))
  } else if (parseFloat(standardPercentage) >= 80) {
    console.log(chalk.yellow(`⚠️  GOOD: ${standardPercentage}% of ESPN IDs are standardized`))
  } else {
    console.log(chalk.red(`❌ NEEDS WORK: Only ${standardPercentage}% of ESPN IDs are standardized`))
  }
  
  console.log(chalk.gray(`Total ESPN records checked: ${totalRecords}`))
  console.log(chalk.gray(`Standard format: ${totalStandard}`))
  console.log(chalk.gray(`Non-standard: ${totalNonStandard}`))
  console.log(chalk.gray(`Duplicates marked: ${gameFormats.get('DUPLICATE_MARKED') || 0}`))
  
  // Recommendations
  console.log(chalk.bold.cyan('\n🎯 RECOMMENDATIONS:'))
  
  if (totalNonStandard > 0) {
    console.log(chalk.yellow('- Run standardization migration script again'))
    console.log(chalk.yellow('- Focus on NO_SPORT and OTHER format records'))
  }
  
  if ((gameFormats.get('LEGACY') || 0) > 0) {
    console.log(chalk.yellow('- Legacy format games still need migration'))
  }
  
  if (parseFloat(standardPercentage) >= 95) {
    console.log(chalk.green('- ESPN ID standardization is ready for production!'))
  }
}

// Run the check
checkEspnIdCompatibility().catch(console.error)