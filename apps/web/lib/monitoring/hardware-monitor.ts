import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class HardwareMonitor {
  async getGPUStats() {
    try {
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits'
      );
      
      const [utilization, memUsed, memTotal, temperature, powerDraw] = stdout.trim().split(', ');
      
      return {
        utilization: parseInt(utilization),
        memory: {
          used: parseInt(memUsed),
          total: parseInt(memTotal),
          percentage: Math.round((parseInt(memUsed) / parseInt(memTotal)) * 100)
        },
        temperature: parseInt(temperature),
        powerDraw: parseFloat(powerDraw)
      };
    } catch (error) {
      return null;
    }
  }
  
  async getCPUStats() {
    const { stdout: cpuInfo } = await execAsync('lscpu | grep "Model name" | cut -d: -f2');
    const { stdout: usage } = await execAsync('top -bn1 | grep "Cpu(s)" | awk '{print $2}'');
    
    return {
      model: cpuInfo.trim(),
      usage: parseFloat(usage)
    };
  }
}

export const monitor = new HardwareMonitor();
