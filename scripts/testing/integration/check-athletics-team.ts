#!/usr/bin/env tsx

import axios from 'axios';
import chalk from 'chalk';

async function checkAthletics() {
  console.log(chalk.bold.blue('Checking Athletics team data...\n'));
  
  const BASE_URL = 'https://statsapi.mlb.com/api/v1';
  
  try {
    // Get Athletics team info
    const teamId = 133; // Athletics ID
    const response = await axios.get(`${BASE_URL}/teams/${teamId}`);
    const team = response.data.teams?.[0];
    
    if (team) {
      console.log('Team ID:', team.id);
      console.log('Name:', team.name);
      console.log('Team Name:', team.teamName);
      console.log('Franchise Name:', team.franchiseName);
      console.log('Location Name:', team.locationName);
      console.log('Full constructed:', `${team.franchiseName} ${team.teamName}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAthletics().catch(console.error);