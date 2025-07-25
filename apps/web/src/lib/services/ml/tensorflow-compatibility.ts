/**
 * TensorFlow compatibility layer for Vercel deployment
 * Handles optional TensorFlow loading and provides fallbacks
 */

let tf: any = null;
let isAvailable = false;

// For any build environment, avoid TensorFlow imports to prevent webpack issues
if (typeof window === 'undefined' && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
  // Build environment - use mocks only
  isAvailable = false;
} else {
  // Only attempt TensorFlow loading in development runtime
  try {
    tf = eval('require')('@tensorflow/tfjs-node-gpu');
    isAvailable = true;
  } catch (error) {
    try {
      tf = eval('require')('@tensorflow/tfjs-node');
      isAvailable = true;
    } catch (error2) {
      console.warn('TensorFlow not available, using mock ML predictions');
      isAvailable = false;
    }
  }
}

export const tensorFlow = tf;
export const isTensorFlowAvailable = isAvailable;

export function mockPrediction(features: number[]): number {
  // Simple mock prediction based on feature average
  const avg = features.reduce((sum, val) => sum + val, 0) / features.length;
  return Math.max(0, avg + (Math.random() - 0.5) * 5);
}

export function createMockModel() {
  return {
    predict: (input: any) => {
      // Return mock tensor-like object
      return {
        dataSync: () => [mockPrediction([1, 2, 3, 4, 5])],
        dispose: () => {},
      };
    },
    dispose: () => {},
  };
}