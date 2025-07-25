import dynamic from 'next/dynamic';
import { ComponentLoader } from '@/components/ui/loading-spinner';

// Lazy load the 3D visualizer only when needed
export const Portfolio3DVisualizer = dynamic(
  () => import('./Portfolio3DVisualizer'),
  {
    loading: () => (
      <div className="flex items-center justify-center h-[600px] bg-gray-900 rounded-lg">
        <ComponentLoader label="Loading 3D Visualization..." />
      </div>
    ),
    ssr: false, // 3D components should not be server-rendered
  }
);

// Preload the 3D libraries when user hovers over the trigger
export function preload3DLibraries() {
  if (typeof window !== 'undefined') {
    // Preload Three.js and React Three Fiber
    import('three');
    import('@react-three/fiber');
    import('@react-three/drei');
  }
}