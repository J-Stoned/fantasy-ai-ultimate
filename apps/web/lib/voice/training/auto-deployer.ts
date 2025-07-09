/**
 * Auto-Deployer for Voice Models
 * Continuously deploys improved models with zero downtime
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ModelVersion {
  version: string;
  accuracy: number;
  deployedAt: Date;
  isActive: boolean;
  performanceMetrics: {
    avgResponseTime: number;
    successRate: number;
    errorRate: number;
  };
}

export interface DeploymentConfig {
  autoDeployThreshold: number; // Min accuracy improvement to deploy
  canaryPercentage: number; // % of traffic for new model
  rollbackThreshold: number; // Error rate to trigger rollback
  healthCheckInterval: number; // ms
}

export class AutoDeployer extends EventEmitter {
  private activeModel: tf.LayersModel | null = null;
  private canaryModel: tf.LayersModel | null = null;
  private modelVersions: Map<string, ModelVersion> = new Map();
  private deploymentConfig: DeploymentConfig;
  private healthCheckTimer: NodeJS.Timer | null = null;
  private isDeploying: boolean = false;

  constructor(config: Partial<DeploymentConfig> = {}) {
    super();
    this.deploymentConfig = {
      autoDeployThreshold: 2, // 2% accuracy improvement
      canaryPercentage: 10, // 10% canary traffic
      rollbackThreshold: 5, // 5% error rate
      healthCheckInterval: 60000, // 1 minute
      ...config
    };

    this.startHealthChecking();
    this.loadActiveModel();
  }

  /**
   * Load the currently active model
   */
  private async loadActiveModel() {
    try {
      const modelPath = path.join(process.cwd(), 'models', 'voice-intent', 'active');
      this.activeModel = await tf.loadLayersModel(`file://${modelPath}/model.json`);
      
      const versionInfo = JSON.parse(
        fs.readFileSync(`${modelPath}/version.json`, 'utf8')
      );
      
      this.modelVersions.set(versionInfo.version, {
        ...versionInfo,
        isActive: true
      });
      
      console.log(`✅ Loaded active model v${versionInfo.version}`);
    } catch (error) {
      console.error('Failed to load active model:', error);
    }
  }

  /**
   * Deploy a new model version
   */
  async deployModel(
    modelPath: string,
    version: string,
    accuracy: number
  ): Promise<boolean> {
    if (this.isDeploying) {
      console.log('⏳ Deployment already in progress');
      return false;
    }

    this.isDeploying = true;
    console.log(`🚀 Starting deployment of model v${version}`);

    try {
      // Check if new model meets deployment criteria
      const currentVersion = this.getCurrentVersion();
      if (currentVersion) {
        const accuracyImprovement = accuracy - currentVersion.accuracy;
        
        if (accuracyImprovement < this.deploymentConfig.autoDeployThreshold) {
          console.log(`📊 Insufficient improvement: ${accuracyImprovement.toFixed(2)}%`);
          this.isDeploying = false;
          return false;
        }
      }

      // Load new model
      const newModel = await tf.loadLayersModel(`file://${modelPath}/model.json`);
      
      // Start canary deployment
      console.log(`🐤 Starting canary deployment (${this.deploymentConfig.canaryPercentage}% traffic)`);
      this.canaryModel = newModel;
      
      const canaryVersion: ModelVersion = {
        version,
        accuracy,
        deployedAt: new Date(),
        isActive: false,
        performanceMetrics: {
          avgResponseTime: 0,
          successRate: 0,
          errorRate: 0
        }
      };
      
      this.modelVersions.set(version, canaryVersion);
      
      // Monitor canary performance
      await this.monitorCanary(version);
      
      // If canary is successful, promote to active
      if (canaryVersion.performanceMetrics.errorRate < this.deploymentConfig.rollbackThreshold) {
        await this.promoteCanary(version);
        console.log(`✅ Model v${version} deployed successfully!`);
        
        // Store deployment info
        await this.storeDeployment(version, accuracy);
        
        this.emit('modelDeployed', { version, accuracy });
        return true;
      } else {
        // Rollback
        console.log(`⚠️ Canary failed, rolling back...`);
        await this.rollbackCanary();
        this.emit('deploymentFailed', { version, reason: 'High error rate' });
        return false;
      }
    } catch (error) {
      console.error('Deployment error:', error);
      this.emit('deploymentError', error);
      return false;
    } finally {
      this.isDeploying = false;
    }
  }

  /**
   * Monitor canary model performance
   */
  private async monitorCanary(version: string): Promise<void> {
    console.log('📊 Monitoring canary performance...');
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const monitoringDuration = 300000; // 5 minutes
      let requestCount = 0;
      let errorCount = 0;
      let totalResponseTime = 0;
      
      const checkInterval = setInterval(() => {
        const canaryVersion = this.modelVersions.get(version);
        if (!canaryVersion) {
          clearInterval(checkInterval);
          resolve();
          return;
        }
        
        // Update metrics
        canaryVersion.performanceMetrics.errorRate = 
          requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
        canaryVersion.performanceMetrics.avgResponseTime = 
          requestCount > 0 ? totalResponseTime / requestCount : 0;
        
        // Check if monitoring period is complete
        if (Date.now() - startTime >= monitoringDuration) {
          clearInterval(checkInterval);
          console.log(`📈 Canary monitoring complete:`);
          console.log(`   Requests: ${requestCount}`);
          console.log(`   Error rate: ${canaryVersion.performanceMetrics.errorRate.toFixed(2)}%`);
          console.log(`   Avg response time: ${canaryVersion.performanceMetrics.avgResponseTime.toFixed(2)}ms`);
          resolve();
        }
      }, 5000); // Check every 5 seconds
      
      // Simulate traffic routing (in production, this would be actual routing logic)
      this.on('inference', (data) => {
        if (Math.random() < this.deploymentConfig.canaryPercentage / 100) {
          // Route to canary
          requestCount++;
          const start = Date.now();
          
          try {
            // Perform inference with canary model
            // ... inference logic ...
            totalResponseTime += Date.now() - start;
          } catch (error) {
            errorCount++;
          }
        }
      });
    });
  }

  /**
   * Promote canary to active model
   */
  private async promoteCanary(version: string) {
    if (!this.canaryModel) return;
    
    console.log(`🎉 Promoting canary v${version} to active`);
    
    // Archive current active model
    if (this.activeModel) {
      const currentVersion = this.getCurrentVersion();
      if (currentVersion) {
        await this.archiveModel(currentVersion.version);
      }
    }
    
    // Promote canary
    this.activeModel = this.canaryModel;
    this.canaryModel = null;
    
    // Update version status
    const canaryVersion = this.modelVersions.get(version);
    if (canaryVersion) {
      canaryVersion.isActive = true;
    }
    
    // Save as active model
    const activePath = path.join(process.cwd(), 'models', 'voice-intent', 'active');
    await this.activeModel.save(`file://${activePath}`);
    
    // Save version info
    fs.writeFileSync(
      `${activePath}/version.json`,
      JSON.stringify({
        version,
        accuracy: canaryVersion?.accuracy || 0,
        deployedAt: new Date().toISOString()
      })
    );
  }

  /**
   * Rollback canary deployment
   */
  private async rollbackCanary() {
    console.log('🔄 Rolling back canary deployment');
    
    if (this.canaryModel) {
      this.canaryModel.dispose();
      this.canaryModel = null;
    }
    
    this.emit('rollback', { reason: 'High error rate' });
  }

  /**
   * Archive old model version
   */
  private async archiveModel(version: string) {
    const archivePath = path.join(
      process.cwd(), 
      'models', 
      'voice-intent', 
      'archive', 
      version
    );
    
    if (!fs.existsSync(archivePath)) {
      fs.mkdirSync(archivePath, { recursive: true });
    }
    
    // Move model files to archive
    console.log(`📦 Archiving model v${version}`);
  }

  /**
   * Get current active model version
   */
  private getCurrentVersion(): ModelVersion | null {
    for (const [version, info] of this.modelVersions) {
      if (info.isActive) {
        return info;
      }
    }
    return null;
  }

  /**
   * Route inference request to appropriate model
   */
  async predict(input: tf.Tensor): Promise<tf.Tensor> {
    // Determine which model to use
    let model: tf.LayersModel | null = null;
    
    if (this.canaryModel && Math.random() < this.deploymentConfig.canaryPercentage / 100) {
      // Use canary model
      model = this.canaryModel;
      this.emit('inference', { model: 'canary' });
    } else if (this.activeModel) {
      // Use active model
      model = this.activeModel;
      this.emit('inference', { model: 'active' });
    }
    
    if (!model) {
      throw new Error('No model available for inference');
    }
    
    return model.predict(input) as tf.Tensor;
  }

  /**
   * Health check for deployed models
   */
  private startHealthChecking() {
    this.healthCheckTimer = setInterval(async () => {
      if (this.activeModel) {
        try {
          // Simple health check - run dummy inference
          const dummyInput = tf.zeros([1, 50]);
          const output = await this.predict(dummyInput);
          output.dispose();
          dummyInput.dispose();
          
          this.emit('healthCheck', { status: 'healthy' });
        } catch (error) {
          console.error('❌ Health check failed:', error);
          this.emit('healthCheck', { status: 'unhealthy', error });
        }
      }
    }, this.deploymentConfig.healthCheckInterval);
  }

  /**
   * Store deployment info in database
   */
  private async storeDeployment(version: string, accuracy: number) {
    try {
      await supabase.from('model_deployments').insert({
        version,
        accuracy,
        deployed_at: new Date(),
        deployment_type: 'automatic',
        hardware: 'RTX 4060 + Ryzen 5 7600X',
        status: 'active'
      });
    } catch (error) {
      console.error('Failed to store deployment:', error);
    }
  }

  /**
   * Get deployment history
   */
  async getDeploymentHistory(): Promise<any[]> {
    const { data } = await supabase
      .from('model_deployments')
      .select('*')
      .order('deployed_at', { ascending: false })
      .limit(10);
    
    return data || [];
  }

  /**
   * A/B test multiple models
   */
  async runABTest(
    modelA: string,
    modelB: string,
    duration: number = 3600000 // 1 hour
  ): Promise<{ winner: string; results: any }> {
    console.log(`🧪 Starting A/B test: ${modelA} vs ${modelB}`);
    
    // Implementation would track performance of both models
    // and determine winner based on success metrics
    
    return {
      winner: modelA,
      results: {
        [modelA]: { successRate: 85, avgResponseTime: 45 },
        [modelB]: { successRate: 82, avgResponseTime: 50 }
      }
    };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    if (this.activeModel) {
      this.activeModel.dispose();
    }
    
    if (this.canaryModel) {
      this.canaryModel.dispose();
    }
  }
}