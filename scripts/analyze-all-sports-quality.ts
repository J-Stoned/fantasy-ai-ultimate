#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE ALL SPORTS DATA QUALITY
 * 
 * Comprehensive analysis of all sports data to identify corruption, duplicates, and integrity issues
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TeamAnalysis {
  sport: string;
  totalTeams: number;
  duplicateCount: number;
  orphanedCount: number;
  issues: string[];
}

interface SportStandards {
  [key: string]: {
    expectedTeams: number;
    name: string;
  };
}

const SPORT_STANDARDS: SportStandards = {
  'MLB': { expectedTeams: 30, name: 'Major League Baseball' },
  'NFL': { expectedTeams: 32, name: 'National Football League' },
  'NBA': { expectedTeams: 30, name: 'National Basketball Association' },
  'NHL': { expectedTeams: 32, name: 'National Hockey League' },
  'NCAAF': { expectedTeams: 130, name: 'NCAA Football' },
  'NCAAB': { expectedTeams: 358, name: 'NCAA Basketball' }
};

async function analyzeAllSportsQuality() {
  console.log(chalk.cyan.bold('\n🔍 ANALYZING ALL SPORTS DATA QUALITY\n'));
  
  try {
    // 1. Get all teams with sport breakdown
    console.log(chalk.yellow('📊 TEAM ANALYSIS BY SPORT'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const { data: allTeams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, abbreviation, sport, city')
      .order('sport', { ascending: true });
    
    if (teamsError) throw teamsError;
    
    // Group teams by sport
    const teamsBySport: { [key: string]: any[] } = {};
    allTeams?.forEach(team => {
      const sport = team.sport || 'UNKNOWN';
      if (!teamsBySport[sport]) teamsBySport[sport] = [];
      teamsBySport[sport].push(team);
    });
    
    console.log(chalk.white(`Total teams in database: ${allTeams?.length || 0}`));
    console.log('');
    
    // Analyze each sport
    const analyses: TeamAnalysis[] = [];
    
    for (const [sport, teams] of Object.entries(teamsBySport)) {
      console.log(chalk.cyan(`🏈 ${sport.toUpperCase()} ANALYSIS`));
      
      // Find duplicates by name/abbreviation
      const nameMap = new Map<string, any[]>();
      const abbrevMap = new Map<string, any[]>();
      
      teams.forEach(team => {
        const name = team.name?.toLowerCase() || '';
        const abbrev = team.abbreviation?.toLowerCase() || '';
        
        if (!nameMap.has(name)) nameMap.set(name, []);
        if (!abbrevMap.has(abbrev)) abbrevMap.set(abbrev, []);
        
        nameMap.get(name)!.push(team);
        abbrevMap.get(abbrev)!.push(team);
      });
      
      // Count duplicates
      const duplicatesByName = Array.from(nameMap.values()).filter(teams => teams.length > 1);
      const duplicatesByAbbrev = Array.from(abbrevMap.values()).filter(teams => teams.length > 1);
      
      let duplicateCount = 0;
      duplicatesByName.forEach(dups => duplicateCount += dups.length - 1);
      duplicatesByAbbrev.forEach(dups => duplicateCount += dups.length - 1);
      
      // Check for orphaned teams (teams with 0 games)
      let orphanedCount = 0;
      const orphanedTeams = [];
      
      for (const team of teams) {
        const { count: homeGames } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('home_team_id', team.id);
        
        const { count: awayGames } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('away_team_id', team.id);
        
        const totalGames = (homeGames || 0) + (awayGames || 0);
        
        if (totalGames === 0) {
          orphanedCount++;
          orphanedTeams.push(team);
        }
      }
      
      const issues = [];
      const expected = SPORT_STANDARDS[sport]?.expectedTeams || 'Unknown';
      
      if (typeof expected === 'number' && teams.length !== expected) {
        issues.push(`Expected ${expected} teams, found ${teams.length}`);
      }
      
      if (duplicateCount > 0) {
        issues.push(`${duplicateCount} duplicate teams found`);
      }
      
      if (orphanedCount > 0) {
        issues.push(`${orphanedCount} orphaned teams (0 games)`);
      }
      
      // Display results
      console.log(chalk.white(`   Teams: ${teams.length}${expected !== 'Unknown' ? ` (expected: ${expected})` : ''}`));
      console.log(chalk.white(`   Duplicates: ${duplicateCount}`));
      console.log(chalk.white(`   Orphaned: ${orphanedCount}`));
      
      if (duplicatesByName.length > 0) {
        console.log(chalk.red('   📋 Duplicate Names:'));
        duplicatesByName.forEach(dups => {
          console.log(chalk.red(`     ${dups[0].name}: ${dups.map(d => d.id).join(', ')}`));
        });
      }
      
      if (duplicatesByAbbrev.length > 0) {
        console.log(chalk.red('   📋 Duplicate Abbreviations:'));
        duplicatesByAbbrev.forEach(dups => {
          console.log(chalk.red(`     ${dups[0].abbreviation}: ${dups.map(d => d.id).join(', ')}`));
        });
      }
      
      if (orphanedTeams.length > 0) {
        console.log(chalk.yellow('   👻 Orphaned Teams:'));
        orphanedTeams.forEach(team => {
          console.log(chalk.yellow(`     ${team.id}: ${team.name} (${team.abbreviation})`));
        });
      }
      
      console.log('');
      
      analyses.push({
        sport,
        totalTeams: teams.length,
        duplicateCount,
        orphanedCount,
        issues
      });
    }
    
    // 2. Check for cross-sport contamination
    console.log(chalk.yellow('🔀 CROSS-SPORT CONTAMINATION CHECK'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const { data: gamesWithTeams, error: gamesError } = await supabase
      .from('games')
      .select(`
        id,
        sport,
        home_team_id,
        away_team_id,
        home_team:home_team_id(name, sport),
        away_team:away_team_id(name, sport)
      `)
      .limit(100);
    
    if (gamesError) {
      console.log(chalk.red('   Error checking games:', gamesError));
    } else {
      let contaminationCount = 0;
      
      gamesWithTeams?.forEach(game => {
        const gameSpor = game.sport;
        const homeTeamSport = game.home_team?.sport;
        const awayTeamSport = game.away_team?.sport;
        
        if (gameSpor !== homeTeamSport || gameSpor !== awayTeamSport) {
          contaminationCount++;
        }
      });
      
      console.log(chalk.white(`   Games checked: ${gamesWithTeams?.length || 0}`));
      console.log(chalk.white(`   Contamination found: ${contaminationCount}`));
    }
    
    // 3. Summary Report
    console.log(chalk.yellow('📋 SUMMARY REPORT'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const totalDuplicates = analyses.reduce((sum, a) => sum + a.duplicateCount, 0);
    const totalOrphaned = analyses.reduce((sum, a) => sum + a.orphanedCount, 0);
    const totalIssues = analyses.reduce((sum, a) => sum + a.issues.length, 0);
    
    console.log(chalk.white(`📊 Total teams: ${allTeams?.length || 0}`));
    console.log(chalk.white(`📊 Sports covered: ${Object.keys(teamsBySport).length}`));
    console.log(chalk.red(`❌ Total duplicates: ${totalDuplicates}`));
    console.log(chalk.yellow(`👻 Total orphaned: ${totalOrphaned}`));
    console.log(chalk.red(`🚨 Total issues: ${totalIssues}`));
    
    console.log(chalk.white('\n🎯 SPORTS NEEDING CLEANUP:'));
    analyses.forEach(analysis => {
      if (analysis.issues.length > 0) {
        console.log(chalk.red(`   ${analysis.sport}: ${analysis.issues.join(', ')}`));
      }
    });
    
    // 4. Recommendations
    console.log(chalk.yellow('\n💡 CLEANUP RECOMMENDATIONS'));
    console.log(chalk.gray('═'.repeat(60)));
    
    const recommendations = [
      'Run clean-nfl-teams.ts to standardize NFL to 32 teams',
      'Run clean-nba-teams.ts to standardize NBA to 30 teams', 
      'Run clean-nhl-teams.ts to standardize NHL to 32 teams',
      'Remove orphaned teams with 0 games',
      'Fix cross-sport contamination in games table',
      'Standardize team names and abbreviations'
    ];
    
    recommendations.forEach(rec => {
      console.log(chalk.white(`   • ${rec}`));
    });
    
    console.log(chalk.green('\n✅ Sports data quality analysis complete!'));
    
    return analyses;
    
  } catch (error) {
    console.error(chalk.red('❌ Error analyzing sports data:'), error);
    throw error;
  }
}

// Run analysis
if (require.main === module) {
  analyzeAllSportsQuality()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default analyzeAllSportsQuality;