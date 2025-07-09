/**
 * Simple Random Forest implementation that can load the existing JSON format
 */

interface TreeNode {
  type: 'split' | 'leaf';
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number;
}

interface Tree {
  tree: TreeNode;
}

export class SimpleRandomForest {
  private trees: Tree[];
  
  constructor(trees: Tree[]) {
    this.trees = trees;
  }
  
  static load(data: any): SimpleRandomForest {
    if (Array.isArray(data)) {
      // Direct array of trees
      return new SimpleRandomForest(data);
    } else if (data.trees) {
      // Object with trees property
      return new SimpleRandomForest(data.trees);
    }
    throw new Error('Invalid random forest data format');
  }
  
  predict(features: number[][]): number[] {
    return features.map(feature => this.predictOne(feature));
  }
  
  private predictOne(features: number[]): number {
    // Get predictions from all trees
    const predictions = this.trees.map(tree => 
      this.predictTree(tree.tree, features)
    );
    
    // Vote - return the most common prediction
    const sum = predictions.reduce((a, b) => a + b, 0);
    return sum / predictions.length;
  }
  
  private predictTree(node: TreeNode, features: number[]): number {
    if (node.type === 'leaf') {
      return node.value || 0;
    }
    
    if (node.type === 'split' && node.feature !== undefined && node.threshold !== undefined) {
      const featureValue = features[node.feature];
      if (featureValue <= node.threshold) {
        return node.left ? this.predictTree(node.left, features) : 0;
      } else {
        return node.right ? this.predictTree(node.right, features) : 0;
      }
    }
    
    return 0;
  }
}