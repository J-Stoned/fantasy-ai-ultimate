#!/usr/bin/env tsx
/**
 * 🧪 TEST ESPN NHL ROSTER STRUCTURE
 */

import axios from 'axios';
import chalk from 'chalk';

async function testESPNRoster() {
  console.log(chalk.bold.blue('🏒 Testing ESPN NHL Roster Structure\n'));
  
  try {
    // Test with Maple Leafs
    const teamId = 21;
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/${teamId}/roster`;
    
    console.log(chalk.yellow('Testing Toronto Maple Leafs roster...'));
    console.log(chalk.gray(`URL: ${url}`));
    
    const response = await axios.get(url);
    console.log(chalk.green('✅ API call successful\n'));
    
    // Check the structure
    console.log('Response keys:', Object.keys(response.data));
    
    const athletes = response.data.athletes || [];
    console.log(`\nFound ${athletes.length} position groups`);
    
    // NHL groups players by position
    athletes.forEach((group: any, index: number) => {
      console.log(chalk.cyan(`\nGroup ${index + 1}: ${group.position}`));
      console.log(`  Players: ${group.items?.length || 0}`);
      
      // Show first player in each group
      if (group.items && group.items.length > 0) {
        const player = group.items[0];
        console.log(chalk.yellow('  Sample player:'));
        console.log('    ID:', player.id);
        console.log('    Full Name:', player.fullName);
        console.log('    Display Name:', player.displayName);
        console.log('    First Name:', player.firstName);
        console.log('    Last Name:', player.lastName);
        console.log('    Jersey:', player.jersey);
        console.log('    Position:', player.position?.abbreviation);
        console.log('    Height:', player.height);
        console.log('    Weight:', player.weight);
        console.log('    Birth Date:', player.dateOfBirth);
        console.log('    Headshot:', player.headshot?.href ? 'Available' : 'Not available');
      }
    });
    
    // Count total players
    const totalPlayers = athletes.reduce((sum: number, group: any) => {
      return sum + (group.items?.length || 0);
    }, 0);
    
    console.log(chalk.green(`\nTotal players: ${totalPlayers}`));
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
    if (error.response?.data) {
      console.log('Response data:', error.response.data);
    }
  }
}

testESPNRoster().catch(console.error);