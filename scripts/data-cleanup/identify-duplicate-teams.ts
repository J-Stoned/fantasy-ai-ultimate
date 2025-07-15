#!/usr/bin/env tsx
/**
 * 🔍 IDENTIFY DUPLICATE TEAMS
 * 
 * Finds duplicate team entries in the MLB database
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Team {
  id: number;
  name: string;
  abbreviation: string;
  sport: string;
}

async function identifyDuplicateTeams() {
  console.log(chalk.cyan.bold('\n🔍 IDENTIFYING DUPLICATE MLB TEAMS\n'));
  
  try {
    // Get all MLB teams
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, abbreviation, sport')
      .eq('sport', 'MLB')
      .order('id');
    
    if (error) throw error;
    
    console.log(chalk.white(`📊 Total MLB teams in database: ${teams?.length || 0}`));
    
    if (!teams || teams.length === 0) {
      console.log(chalk.red('❌ No MLB teams found!'));
      return;
    }
    
    // Group teams by name similarity
    const teamGroups = new Map<string, Team[]>();
    
    teams.forEach(team => {
      // Use team name as primary key, fallback to abbreviation
      const key = (team.name || team.abbreviation || '').toLowerCase().trim();
      
      if (!teamGroups.has(key)) {
        teamGroups.set(key, []);
      }
      teamGroups.get(key)!.push(team);
    });
    
    console.log(chalk.white(`🏟️ Unique team names: ${teamGroups.size}`));
    
    // Find duplicates
    const duplicates: { name: string; teams: Team[] }[] = [];
    
    teamGroups.forEach((teamList, name) => {
      if (teamList.length > 1) {
        duplicates.push({ name, teams: teamList });
      }
    });
    
    console.log(chalk.yellow(`🔄 Teams with duplicate entries: ${duplicates.length}`));
    
    if (duplicates.length > 0) {
      console.log(chalk.white('\n📋 DUPLICATE TEAMS FOUND:'));
      console.log(chalk.gray('─'.repeat(70)));
      
      duplicates.forEach(duplicate => {
        console.log(chalk.cyan(`\n🏟️  Team: ${duplicate.name}`));
        duplicate.teams.forEach(team => {
          console.log(chalk.white(`     ID: ${team.id.toString().padStart(6)}, Name: ${team.name || 'N/A'}, Abbr: ${team.abbreviation || 'N/A'}`));
        });
      });
    }
    
    // Analyze ID patterns
    const idRanges = {
      low: teams.filter(t => t.id < 1000),
      high: teams.filter(t => t.id >= 1000)
    };
    
    console.log(chalk.white('\n📊 ID RANGE ANALYSIS:'));
    console.log(chalk.gray('─'.repeat(70)));
    console.log(chalk.white(`Low range IDs (< 1000): ${idRanges.low.length} teams`));
    console.log(chalk.white(`High range IDs (>= 1000): ${idRanges.high.length} teams`));
    
    // Check for overlapping team names between ranges
    const lowNames = new Set(idRanges.low.map(t => (t.name || t.abbreviation || '').toLowerCase()));
    const highNames = new Set(idRanges.high.map(t => (t.name || t.abbreviation || '').toLowerCase()));
    
    const overlapping = Array.from(lowNames).filter(name => highNames.has(name));
    
    if (overlapping.length > 0) {
      console.log(chalk.red(`\n⚠️  Overlapping team names between ID ranges: ${overlapping.length}`));
      overlapping.forEach(name => {
        console.log(chalk.red(`   - ${name}`));
      });
    }
    
    // Show sample teams from each range
    console.log(chalk.white('\n📝 SAMPLE TEAMS BY RANGE:'));
    console.log(chalk.gray('─'.repeat(70)));
    
    console.log(chalk.yellow('Low range (< 1000):'));
    idRanges.low.slice(0, 5).forEach(team => {
      console.log(chalk.white(`   ID: ${team.id}, Name: ${team.name}, Abbr: ${team.abbreviation}`));
    });
    
    console.log(chalk.yellow('\nHigh range (>= 1000):'));
    idRanges.high.slice(0, 5).forEach(team => {
      console.log(chalk.white(`   ID: ${team.id}, Name: ${team.name}, Abbr: ${team.abbreviation}`));
    });
    
    // Final recommendation
    console.log(chalk.white('\n💡 RECOMMENDATIONS:'));
    console.log(chalk.gray('─'.repeat(70)));
    
    if (duplicates.length > 0) {
      console.log(chalk.yellow('1. Remove duplicate team entries'));
      console.log(chalk.yellow('2. Standardize to single ID format (recommend high range)'));
      console.log(chalk.yellow('3. Update all games to use consistent team IDs'));
    }
    
    if (teams.length > 30) {
      console.log(chalk.yellow('4. Reduce to exactly 30 MLB teams'));
    }
    
    console.log(chalk.green('\n✅ Duplicate team analysis complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error identifying duplicates:'), error);
  }
}

identifyDuplicateTeams().catch(console.error);