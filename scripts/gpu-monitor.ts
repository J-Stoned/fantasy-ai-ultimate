#!/usr/bin/env tsx
/**
 * 🎮 GPU MONITORING DASHBOARD
 * 
 * Real-time GPU metrics monitoring
 */

import chalk from 'chalk';
import * as si from 'systeminformation';
import blessed from 'blessed';
import contrib from 'blessed-contrib';

class GPUMonitor {
  private screen: blessed.Widgets.Screen;
  private grid: any;
  private gauges: {
    utilization: any;
    memory: any;
    temperature: any;
    power: any;
  };
  private chart: any;
  private table: any;
  private log: blessed.Widgets.Log;
  
  private metrics = {
    utilization: [] as number[],
    memory: [] as number[],
    temperature: [] as number[],
    timestamps: [] as string[]
  };
  
  constructor() {
    this.initializeUI();
    this.startMonitoring();
  }
  
  private initializeUI() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'GPU Monitor'
    });
    
    // Create grid
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });
    
    // Title
    this.grid.set(0, 0, 1, 12, blessed.box, {
      content: ' 🎮 GPU PERFORMANCE MONITOR ',
      style: {
        fg: 'white',
        bold: true,
        border: { fg: 'cyan' }
      }
    });
    
    // Gauges
    this.gauges = {
      utilization: this.grid.set(1, 0, 3, 3, contrib.gauge, {
        label: ' GPU Usage ',
        percent: 0,
        stroke: 'green',
        fill: 'white'
      }),
      memory: this.grid.set(1, 3, 3, 3, contrib.gauge, {
        label: ' Memory ',
        percent: 0,
        stroke: 'yellow',
        fill: 'white'
      }),
      temperature: this.grid.set(1, 6, 3, 3, contrib.gauge, {
        label: ' Temperature ',
        percent: 0,
        stroke: 'red',
        fill: 'white'
      }),
      power: this.grid.set(1, 9, 3, 3, contrib.gauge, {
        label: ' Power Draw ',
        percent: 0,
        stroke: 'magenta',
        fill: 'white'
      })
    };
    
    // Chart
    this.chart = this.grid.set(4, 0, 4, 8, contrib.line, {
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black'
      },
      showLegend: true,
      label: ' Performance History '
    });
    
    // Info table
    this.table = this.grid.set(4, 8, 4, 4, contrib.table, {
      label: ' GPU Info ',
      columnSpacing: 2,
      columnWidth: [15, 15],
      style: {
        border: { fg: 'blue' },
        header: { fg: 'bright-blue' }
      }
    });
    
    // Log
    this.log = this.grid.set(8, 0, 4, 12, blessed.log, {
      label: ' Activity Log ',
      scrollable: true,
      alwaysScroll: true,
      style: {
        border: { fg: 'gray' }
      }
    });
    
    // Quit on q or Ctrl-C
    this.screen.key(['q', 'C-c'], () => {
      process.exit(0);
    });
    
    this.screen.render();
  }
  
  private async startMonitoring() {
    this.log('Starting GPU monitoring...');
    
    // Check for GPU
    const graphics = await si.graphics();
    if (!graphics.controllers || graphics.controllers.length === 0) {
      this.log('No GPU detected!', 'error');
      return;
    }
    
    const gpu = graphics.controllers[0];
    this.log(`Detected: ${gpu.model}`, 'success');
    
    // Update info table
    this.table.setData({
      headers: ['Property', 'Value'],
      data: [
        ['Model', gpu.model || 'Unknown'],
        ['Vendor', gpu.vendor || 'Unknown'],
        ['Memory', `${gpu.vram || 0} MB`],
        ['Driver', gpu.driverVersion || 'Unknown']
      ]
    });
    
    // Start monitoring loop
    setInterval(async () => {
      await this.updateMetrics();
    }, 1000);
  }
  
  private async updateMetrics() {
    try {
      const graphics = await si.graphics();
      const gpu = graphics.controllers?.[0];
      
      if (!gpu) return;
      
      // Get current metrics
      const utilization = gpu.utilizationGpu || 0;
      const memoryUsed = gpu.memoryUsed || 0;
      const memoryTotal = gpu.memoryTotal || gpu.vram || 1;
      const temperature = gpu.temperatureGpu || 0;
      const powerDraw = gpu.powerDraw || 0;
      const maxPower = gpu.powerLimit || 100;
      
      // Update gauges
      this.gauges.utilization.setPercent(utilization);
      this.gauges.memory.setPercent((memoryUsed / memoryTotal) * 100);
      this.gauges.temperature.setPercent(Math.min(temperature, 100));
      this.gauges.power.setPercent((powerDraw / maxPower) * 100);
      
      // Update history
      this.metrics.utilization.push(utilization);
      this.metrics.memory.push((memoryUsed / memoryTotal) * 100);
      this.metrics.temperature.push(temperature);
      this.metrics.timestamps.push(new Date().toLocaleTimeString());
      
      // Keep last 60 data points
      if (this.metrics.utilization.length > 60) {
        this.metrics.utilization.shift();
        this.metrics.memory.shift();
        this.metrics.temperature.shift();
        this.metrics.timestamps.shift();
      }
      
      // Update chart
      this.chart.setData([
        {
          title: 'GPU %',
          x: this.metrics.timestamps,
          y: this.metrics.utilization,
          style: { line: 'green' }
        },
        {
          title: 'Memory %',
          x: this.metrics.timestamps,
          y: this.metrics.memory,
          style: { line: 'yellow' }
        },
        {
          title: 'Temp °C',
          x: this.metrics.timestamps,
          y: this.metrics.temperature,
          style: { line: 'red' }
        }
      ]);
      
      // Log high usage
      if (utilization > 80) {
        this.log(`High GPU usage: ${utilization}%`, 'warning');
      }
      if (temperature > 80) {
        this.log(`High temperature: ${temperature}°C`, 'warning');
      }
      
      this.screen.render();
      
    } catch (error) {
      this.log('Failed to update metrics', 'error');
    }
  }
  
  private log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let formatted = `[${timestamp}] `;
    
    switch (type) {
      case 'success':
        formatted += chalk.green(message);
        break;
      case 'warning':
        formatted += chalk.yellow(message);
        break;
      case 'error':
        formatted += chalk.red(message);
        break;
      default:
        formatted += message;
    }
    
    this.log.log(formatted);
  }
}

// Start monitor
console.log(chalk.bold.cyan('Starting GPU Monitor...'));
const monitor = new GPUMonitor();

process.on('SIGINT', () => {
  process.exit(0);
});