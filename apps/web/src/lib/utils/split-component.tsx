import dynamic from 'next/dynamic';
import { ComponentLoader } from '@/components/ui/loading-spinner';
import type { ComponentType } from 'react';

interface SplitComponentOptions {
  threshold?: number; // Size threshold in KB
  preload?: boolean;
  priority?: 'low' | 'high';
}

// Helper to create split component boundaries
export function createSplitComponent<P = {}>(
  componentName: string,
  importPath: string,
  options: SplitComponentOptions = {}
): ComponentType<P> {
  const { preload = false, priority = 'low' } = options;

  const DynamicComponent = dynamic<P>(
    () => import(importPath).then(mod => ({
      default: mod[componentName] || mod.default
    })),
    {
      loading: () => <ComponentLoader label={`Loading ${componentName}...`} />,
      ssr: false,
    }
  );

  // Preload high priority components
  if (preload && priority === 'high' && typeof window !== 'undefined') {
    import(importPath);
  }

  return DynamicComponent;
}

// Utility to split large components into chunks
export function splitLargeComponent(componentPath: string, chunks: string[]) {
  return chunks.map(chunk => 
    createSplitComponent(chunk, `${componentPath}/${chunk}`, {
      preload: false,
      priority: 'low'
    })
  );
}

// Route-based code splitting helper
export function createRouteComponent<P = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: {
    fallback?: ComponentType;
    preload?: boolean;
    ssr?: boolean;
  } = {}
): ComponentType<P> {
  const { fallback, preload = false, ssr = false } = options;

  const Component = dynamic<P>(importFn, {
    loading: fallback || (() => <ComponentLoader label="Loading page..." />),
    ssr,
  });

  if (preload && typeof window !== 'undefined') {
    importFn();
  }

  return Component;
}