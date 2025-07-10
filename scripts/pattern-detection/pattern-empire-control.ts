#!/usr/bin/env tsx
/**
 * 🎮 PATTERN EMPIRE CONTROL CENTER
 * 
 * Master control for our pattern detection empire!
 * Monitor everything from one place.
 */

import chalk from 'chalk';
import axios from 'axios';
import Table from 'cli-table3';
import blessed from 'blessed';

// Service endpoints
const SERVICES = {
  unifiedAPI: 'http://localhost:3336',
  scanner: 'http://localhost:3337',
  dashboard: 'http://localhost:3338',
  betting: 'http://localhost:3339',
  monitoring: 'http://localhost:3340'
};

// Create blessed screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Pattern Empire Control Center'
});

// Title box
const titleBox = blessed.box({
  parent: screen,
  top: 0,
  left: 'center',
  width: '100%',
  height: 3,
  content: chalk.bold.red('🎮 PATTERN EMPIRE CONTROL CENTER 🎮'),
  tags: true,
  align: 'center',
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'red'
    }
  }
});

// Stats box
const statsBox = blessed.box({
  parent: screen,
  label: ' 📊 Live Statistics ',
  top: 3,
  left: 0,
  width: '50%',
  height: '40%',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'cyan'
    }
  },
  scrollable: true,
  alwaysScroll: true,
  mouse: true
});

// Alerts box
const alertsBox = blessed.box({
  parent: screen,
  label: ' 🚨 Pattern Alerts ',
  top: 3,
  right: 0,
  width: '50%',
  height: '40%',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'yellow'
    }
  },
  scrollable: true,
  alwaysScroll: true,
  mouse: true
});

// Performance box
const perfBox = blessed.box({
  parent: screen,
  label: ' 💰 Financial Performance ',
  top: '43%',
  left: 0,
  width: '50%',
  height: '30%',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'green'
    }
  }
});

// Services box
const servicesBox = blessed.box({
  parent: screen,
  label: ' 🌐 Service Status ',
  top: '43%',
  right: 0,
  width: '50%',
  height: '30%',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'magenta'
    }
  }
});

// Log box
const logBox = blessed.log({
  parent: screen,
  label: ' 📜 System Log ',
  bottom: 0,
  left: 0,
  width: '100%',
  height: '27%',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'gray'
    }
  },
  scrollable: true,
  alwaysScroll: true,
  mouse: true
});

// Quit on Escape, q, or Control-C
screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

// Update functions
async function updateStats() {
  try {
    const stats = await axios.get(`${SERVICES.unifiedAPI}/api/unified/stats`);
    const patterns = stats.data.patterns;
    
    let content = chalk.bold.white('Pattern Statistics:\n\n');
    content += chalk.cyan(`Total Patterns: ${stats.data.performance.totalPatterns}\n`);
    content += chalk.yellow(`Average ROI: +${(stats.data.performance.avgROI * 100).toFixed(1)}%\n`);
    content += chalk.green(`Best Pattern: ${stats.data.performance.bestPattern}\n`);
    content += chalk.magenta(`Best Category: ${stats.data.performance.bestCategory}\n\n`);
    
    content += chalk.bold.white('Top Patterns:\n');
    Object.values(patterns.ultimate).slice(0, 3).forEach((p: any) => {
      content += chalk.gray(`• ${p.name}: ${(p.roi * 100).toFixed(1)}% ROI\n`);
    });
    
    statsBox.setContent(content);
    screen.render();
  } catch (error) {
    logBox.log(chalk.red('Failed to update stats'));
  }
}

async function updateAlerts() {
  try {
    const alerts = await axios.get(`${SERVICES.scanner}/api/alerts`);
    const alertData = alerts.data.alerts || [];
    
    let content = chalk.bold.white('Recent Alerts:\n\n');
    
    if (alertData.length === 0) {
      content += chalk.gray('No active alerts\n');
    } else {
      alertData.slice(0, 5).forEach((alert: any) => {
        const urgencyColor = alert.urgency === 'CRITICAL' ? chalk.red :
                           alert.urgency === 'high' ? chalk.yellow :
                           chalk.green;
        
        content += urgencyColor(`[${alert.urgency}] ${alert.gameDetails.awayTeam} @ ${alert.gameDetails.homeTeam}\n`);
        content += chalk.white(`  Patterns: ${alert.patterns.map((p: any) => p.name).join(', ')}\n`);
        content += chalk.cyan(`  ROI: +${(alert.totalROI * 100).toFixed(1)}%\n`);
        content += chalk.gray(`  ${new Date(alert.timestamp).toLocaleString()}\n\n`);
      });
    }
    
    alertsBox.setContent(content);
    screen.render();
  } catch (error) {
    logBox.log(chalk.red('Failed to update alerts'));
  }
}

async function updatePerformance() {
  try {
    const betting = await axios.get(`${SERVICES.betting}/`);
    const bettingData = betting.data;
    
    let content = chalk.bold.white('Financial Performance:\n\n');
    content += chalk.cyan(`Mode: ${bettingData.mode}\n`);
    content += chalk.yellow(`Total Bets: ${bettingData.stats.totalBets}\n`);
    content += chalk.green(`Winning Bets: ${bettingData.stats.winningBets}\n`);
    content += chalk.white(`Win Rate: ${(bettingData.stats.winRate * 100).toFixed(1)}%\n`);
    content += chalk.bold.green(`Total Profit: $${bettingData.stats.totalProfit.toFixed(2)}\n\n`);
    
    // Projections
    content += chalk.bold.yellow('Monthly Projections:\n');
    content += chalk.white(`Pattern Licensing: $39,490\n`);
    content += chalk.white(`100 Clients: $3,949,000\n`);
    
    perfBox.setContent(content);
    screen.render();
  } catch (error) {
    logBox.log(chalk.red('Failed to update performance'));
  }
}

async function updateServices() {
  let content = chalk.bold.white('Service Health:\n\n');
  
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 1000 });
      content += chalk.green(`✅ ${name}: ONLINE\n`);
    } catch (error) {
      content += chalk.red(`❌ ${name}: OFFLINE\n`);
    }
  }
  
  content += chalk.bold.yellow('\n\nService URLs:\n');
  Object.entries(SERVICES).forEach(([name, url]) => {
    content += chalk.gray(`${name}: ${url}\n`);
  });
  
  servicesBox.setContent(content);
  screen.render();
}

// Main update loop
async function updateAll() {
  logBox.log(chalk.gray(`[${new Date().toLocaleTimeString()}] Updating all systems...`));
  
  await Promise.all([
    updateStats(),
    updateAlerts(),
    updatePerformance(),
    updateServices()
  ]);
}

// ASCII art intro
function showIntro() {
  console.clear();
  console.log(chalk.red(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██████╗  █████╗ ████████╗████████╗███████╗██████╗ ███╗   ██╗║
║   ██╔══██╗██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗████╗  ██║║
║   ██████╔╝███████║   ██║      ██║   █████╗  ██████╔╝██╔██╗ ██║║
║   ██╔═══╝ ██╔══██║   ██║      ██║   ██╔══╝  ██╔══██╗██║╚██╗██║║
║   ██║     ██║  ██║   ██║      ██║   ███████╗██║  ██║██║ ╚████║║
║   ╚═╝     ╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝║
║                                                               ║
║              ███████╗███╗   ███╗██████╗ ██╗██████╗ ███████╗   ║
║              ██╔════╝████╗ ████║██╔══██╗██║██╔══██╗██╔════╝   ║
║              █████╗  ██╔████╔██║██████╔╝██║██████╔╝█████╗     ║
║              ██╔══╝  ██║╚██╔╝██║██╔═══╝ ██║██╔══██╗██╔══╝     ║
║              ███████╗██║ ╚═╝ ██║██║     ██║██║  ██║███████╗   ║
║              ╚══════╝╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ║
║                                                               ║
║                    🚀 CONTROL CENTER 🚀                       ║
╚═══════════════════════════════════════════════════════════════╝
`));
  
  console.log(chalk.yellow('Loading control center...'));
  setTimeout(() => {
    console.clear();
    startControlCenter();
  }, 3000);
}

// Start the control center
function startControlCenter() {
  // Initial render
  screen.render();
  
  // Log startup
  logBox.log(chalk.bold.green('🚀 Pattern Empire Control Center ONLINE'));
  logBox.log(chalk.yellow('Press q or ESC to exit'));
  
  // Initial update
  updateAll();
  
  // Update every 5 seconds
  setInterval(updateAll, 5000);
  
  // Focus on screen
  screen.focus();
}

// Check if we should show intro
if (process.argv.includes('--no-intro')) {
  startControlCenter();
} else {
  showIntro();
}