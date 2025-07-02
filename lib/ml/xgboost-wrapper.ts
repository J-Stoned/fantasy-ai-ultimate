/**
 * 🌲 XGBoost Wrapper for Node.js
 * 
 * Wraps gradient boosting for structured data predictions
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface XGBoostParams {
  max_depth?: number;
  learning_rate?: number;
  n_estimators?: number;
  objective?: string;
  booster?: string;
  n_jobs?: number;
  random_state?: number;
  eval_metric?: string;
}

export class XGBoostModel {
  private params: XGBoostParams;
  private modelPath?: string;
  private isTrained = false;
  
  // In-memory simple gradient boosting implementation
  private trees: DecisionTree[] = [];
  
  constructor(params: XGBoostParams = {}) {
    this.params = {
      max_depth: 6,
      learning_rate: 0.1,
      n_estimators: 100,
      objective: 'binary:logistic',
      booster: 'gbtree',
      n_jobs: -1,
      random_state: 42,
      eval_metric: 'logloss',
      ...params
    };
    
    console.log(chalk.green('🌲 XGBoost model initialized'));
  }
  
  /**
   * Train the XGBoost model
   */
  async train(
    features: number[][], 
    labels: number[],
    valFeatures?: number[][],
    valLabels?: number[]
  ) {
    console.log(chalk.yellow('Training XGBoost model...'));
    
    const startTime = Date.now();
    
    // Simple gradient boosting implementation
    let predictions = new Array(features.length).fill(0.5);
    
    for (let i = 0; i < this.params.n_estimators!; i++) {
      // Calculate residuals
      const residuals = labels.map((label, idx) => 
        label - this.sigmoid(predictions[idx])
      );
      
      // Build tree on residuals
      const tree = new DecisionTree(this.params.max_depth!);
      tree.fit(features, residuals);
      
      // Update predictions
      for (let j = 0; j < features.length; j++) {
        predictions[j] += this.params.learning_rate! * tree.predict(features[j]);
      }
      
      this.trees.push(tree);
      
      // Validation metrics every 10 trees
      if (i % 10 === 0 && valFeatures && valLabels) {
        const valPreds = await this.predict(valFeatures);
        const accuracy = this.calculateAccuracy(valPreds, valLabels);
        console.log(chalk.gray(`  Tree ${i}: val_accuracy=${accuracy.toFixed(4)}`));
      }
    }
    
    this.isTrained = true;
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`✅ XGBoost training complete in ${elapsed}s`));
    
    // Final validation metrics
    if (valFeatures && valLabels) {
      const valPreds = await this.predict(valFeatures);
      const finalAccuracy = this.calculateAccuracy(valPreds, valLabels);
      console.log(chalk.green(`   Final validation accuracy: ${(finalAccuracy * 100).toFixed(1)}%`));
    }
  }
  
  /**
   * Make predictions
   */
  async predict(features: number[][]): Promise<number[]> {
    if (!this.isTrained || this.trees.length === 0) {
      // Return default predictions if not trained
      return features.map(() => 0.5);
    }
    
    const predictions = features.map(feature => {
      let score = 0.5; // Base prediction
      
      for (const tree of this.trees) {
        score += this.params.learning_rate! * tree.predict(feature);
      }
      
      return this.sigmoid(score);
    });
    
    return predictions;
  }
  
  /**
   * Save model to disk
   */
  async save(modelPath: string) {
    this.modelPath = modelPath;
    await fs.mkdir(modelPath, { recursive: true });
    
    // Save model parameters
    await fs.writeFile(
      path.join(modelPath, 'params.json'),
      JSON.stringify(this.params, null, 2)
    );
    
    // Save trees
    const treesData = this.trees.map(tree => tree.toJSON());
    await fs.writeFile(
      path.join(modelPath, 'trees.json'),
      JSON.stringify(treesData, null, 2)
    );
    
    console.log(chalk.green(`✅ XGBoost model saved to ${modelPath}`));
  }
  
  /**
   * Load model from disk
   */
  async load(modelPath: string) {
    this.modelPath = modelPath;
    
    // Load parameters
    const paramsJson = await fs.readFile(
      path.join(modelPath, 'params.json'),
      'utf-8'
    );
    this.params = JSON.parse(paramsJson);
    
    // Load trees
    const treesJson = await fs.readFile(
      path.join(modelPath, 'trees.json'),
      'utf-8'
    );
    const treesData = JSON.parse(treesJson);
    
    this.trees = treesData.map((data: any) => DecisionTree.fromJSON(data));
    this.isTrained = true;
    
    console.log(chalk.green(`✅ XGBoost model loaded from ${modelPath}`));
  }
  
  /**
   * Sigmoid activation
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }
  
  /**
   * Calculate accuracy
   */
  private calculateAccuracy(predictions: number[], labels: number[]): number {
    let correct = 0;
    for (let i = 0; i < predictions.length; i++) {
      const predicted = predictions[i] > 0.5 ? 1 : 0;
      if (predicted === labels[i]) correct++;
    }
    return correct / labels.length;
  }
}

/**
 * Simple Decision Tree implementation
 */
class DecisionTree {
  private maxDepth: number;
  private tree: TreeNode | null = null;
  
  constructor(maxDepth: number = 5) {
    this.maxDepth = maxDepth;
  }
  
  fit(features: number[][], targets: number[]) {
    this.tree = this.buildTree(features, targets, 0);
  }
  
  predict(feature: number[]): number {
    if (!this.tree) return 0;
    return this.predictNode(this.tree, feature);
  }
  
  private buildTree(
    features: number[][], 
    targets: number[], 
    depth: number
  ): TreeNode {
    // Base cases
    if (depth >= this.maxDepth || features.length < 10) {
      return {
        type: 'leaf',
        value: this.mean(targets)
      };
    }
    
    // Find best split
    const { featureIdx, threshold, leftIdx, rightIdx } = this.findBestSplit(features, targets);
    
    if (leftIdx.length === 0 || rightIdx.length === 0) {
      return {
        type: 'leaf',
        value: this.mean(targets)
      };
    }
    
    // Split data
    const leftFeatures = leftIdx.map(i => features[i]);
    const leftTargets = leftIdx.map(i => targets[i]);
    const rightFeatures = rightIdx.map(i => features[i]);
    const rightTargets = rightIdx.map(i => targets[i]);
    
    // Recursive build
    return {
      type: 'split',
      featureIdx,
      threshold,
      left: this.buildTree(leftFeatures, leftTargets, depth + 1),
      right: this.buildTree(rightFeatures, rightTargets, depth + 1)
    };
  }
  
  private findBestSplit(features: number[][], targets: number[]) {
    let bestGain = -Infinity;
    let bestFeatureIdx = 0;
    let bestThreshold = 0;
    let bestLeftIdx: number[] = [];
    let bestRightIdx: number[] = [];
    
    const nFeatures = features[0].length;
    
    // Try each feature
    for (let featureIdx = 0; featureIdx < nFeatures; featureIdx++) {
      const values = features.map(f => f[featureIdx]);
      const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
      
      // Try thresholds between unique values
      for (let i = 0; i < uniqueValues.length - 1; i++) {
        const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
        
        const leftIdx: number[] = [];
        const rightIdx: number[] = [];
        
        for (let j = 0; j < features.length; j++) {
          if (features[j][featureIdx] <= threshold) {
            leftIdx.push(j);
          } else {
            rightIdx.push(j);
          }
        }
        
        if (leftIdx.length === 0 || rightIdx.length === 0) continue;
        
        const leftTargets = leftIdx.map(i => targets[i]);
        const rightTargets = rightIdx.map(i => targets[i]);
        
        const gain = this.calculateGain(targets, leftTargets, rightTargets);
        
        if (gain > bestGain) {
          bestGain = gain;
          bestFeatureIdx = featureIdx;
          bestThreshold = threshold;
          bestLeftIdx = leftIdx;
          bestRightIdx = rightIdx;
        }
      }
    }
    
    return { 
      featureIdx: bestFeatureIdx, 
      threshold: bestThreshold, 
      leftIdx: bestLeftIdx,
      rightIdx: bestRightIdx
    };
  }
  
  private calculateGain(parent: number[], left: number[], right: number[]): number {
    const parentVar = this.variance(parent);
    const leftVar = this.variance(left);
    const rightVar = this.variance(right);
    
    const leftWeight = left.length / parent.length;
    const rightWeight = right.length / parent.length;
    
    return parentVar - (leftWeight * leftVar + rightWeight * rightVar);
  }
  
  private variance(values: number[]): number {
    const mean = this.mean(values);
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private predictNode(node: TreeNode, feature: number[]): number {
    if (node.type === 'leaf') {
      return node.value;
    }
    
    if (feature[node.featureIdx!] <= node.threshold!) {
      return this.predictNode(node.left!, feature);
    } else {
      return this.predictNode(node.right!, feature);
    }
  }
  
  toJSON(): any {
    return this.tree;
  }
  
  static fromJSON(data: any): DecisionTree {
    const tree = new DecisionTree();
    tree.tree = data;
    return tree;
  }
}

interface TreeNode {
  type: 'split' | 'leaf';
  featureIdx?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number;
}