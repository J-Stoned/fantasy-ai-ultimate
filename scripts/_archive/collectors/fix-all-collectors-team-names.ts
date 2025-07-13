#!/usr/bin/env tsx
/**
 * 🔧 FIX ALL COLLECTORS TEAM NAMES
 * Ensure all sport collectors create teams with full names
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

// Team naming best practices for each sport
const NAMING_GUIDELINES = {
  NBA: "Use full team names (e.g., 'Los Angeles Lakers' not 'Lakers')",
  NFL: "Use full team names (e.g., 'Dallas Cowboys' not 'Cowboys')",
  MLB: "Use full team names (e.g., 'New York Yankees' not 'Yankees')",
  NHL: "Use full team names (e.g., 'Toronto Maple Leafs' not 'Maple Leafs')",
  NCAA: "Use school name + mascot (e.g., 'Alabama Crimson Tide')"
};

async function analyzCollector(filePath: string) {
  const content = await readFile(filePath, 'utf-8');
  const fileName = filePath.split('/').pop()!;
  const sport = fileName.split('-')[0].toUpperCase();
  
  console.log(chalk.cyan(`\n📋 Analyzing ${fileName}:`));
  
  // Check if it uses short names
  const hasShortNames = /name:\s*['"](\w+)['"],\s*city:/.test(content);
  const hasFullNames = /fullName:\s*['"][\w\s]+['"]/.test(content);
  
  if (hasShortNames && !hasFullNames) {
    console.log(chalk.yellow(`  ⚠️  Uses short names - needs update`));
    console.log(chalk.gray(`  Guideline: ${NAMING_GUIDELINES[sport as keyof typeof NAMING_GUIDELINES] || 'Use full team names'}`));
    
    // Check sample team definitions
    const teamMatches = content.match(/{\s*id:\s*['"][\w\d]+['"],.*?name:\s*['"](\w+)['"].*?}/g);
    if (teamMatches) {
      console.log(chalk.gray(`  Sample teams found:`));
      teamMatches.slice(0, 3).forEach(match => {
        const nameMatch = match.match(/name:\s*['"](\w+)['"]/);
        if (nameMatch) {
          console.log(chalk.gray(`    - ${nameMatch[1]}`));
        }
      });
    }
  } else if (hasFullNames) {
    console.log(chalk.green(`  ✅ Already uses full names`));
  } else {
    console.log(chalk.gray(`  🔍 Team structure not clear`));
  }
  
  return { sport, hasShortNames, hasFullNames };
}

async function main() {
  console.log(chalk.bold.blue('🔧 ANALYZING SPORT COLLECTORS FOR TEAM NAMING\n'));
  
  const collectors = [
    'nba-master-collector.ts',
    'nfl-master-collector.ts',
    'mlb-master-collector.ts',
    'nhl-master-collector.ts',
    'ncaa-master-collector.ts'
  ];
  
  const results = [];
  
  for (const collector of collectors) {
    const filePath = join(process.cwd(), 'scripts', 'collectors', collector);
    try {
      const result = await analyzCollector(filePath);
      results.push({ file: collector, ...result });
    } catch (error) {
      console.log(chalk.red(`  ❌ Error reading ${collector}`));
    }
  }
  
  // Summary
  console.log(chalk.bold.cyan('\n\n📊 SUMMARY:\n'));
  
  const needsUpdate = results.filter(r => r.hasShortNames && !r.hasFullNames);
  const good = results.filter(r => r.hasFullNames);
  
  if (good.length > 0) {
    console.log(chalk.green(`✅ Collectors with full names (${good.length}):`));
    good.forEach(r => console.log(chalk.green(`   - ${r.file}`)));
  }
  
  if (needsUpdate.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Collectors needing updates (${needsUpdate.length}):`));
    needsUpdate.forEach(r => console.log(chalk.yellow(`   - ${r.file}`)));
    
    console.log(chalk.cyan('\n💡 Recommendation:'));
    console.log(chalk.cyan('   Update these collectors to use fullName field'));
    console.log(chalk.cyan('   This prevents duplicate teams in the database'));
  }
  
  // Base collector recommendation
  console.log(chalk.bold.blue('\n\n🛠️  BASE COLLECTOR RECOMMENDATION:\n'));
  console.log(chalk.cyan('Consider adding a helper method to base-collector.ts:'));
  console.log(chalk.gray(`
  protected formatTeamName(name: string, city?: string): string {
    // Ensure full team names
    if (city && !name.includes(city)) {
      return \`\${city} \${name}\`;
    }
    return name;
  }
  `));
}

main().catch(console.error);