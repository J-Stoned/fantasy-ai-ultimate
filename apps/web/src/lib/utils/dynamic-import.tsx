import dynamic from 'next/dynamic';
import { PageLoader, ComponentLoader } from '@/components/ui/loading-spinner';
import type { ComponentType } from 'react';

interface DynamicImportOptions {
  loading?: ComponentType;
  ssr?: boolean;
  loadingLabel?: string;
  type?: 'page' | 'component';
}

export function dynamicImport<P = {}>(
  importFn: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
  options: DynamicImportOptions = {}
) {
  const {
    loading,
    ssr = false,
    loadingLabel = 'Loading...',
    type = 'component'
  } = options;

  const LoadingComponent = loading || (
    type === 'page' 
      ? () => <PageLoader label={loadingLabel} />
      : () => <ComponentLoader label={loadingLabel} />
  );

  return dynamic(
    async () => {
      const mod = await importFn();
      return 'default' in mod ? mod : { default: mod };
    },
    {
      loading: LoadingComponent,
      ssr,
    }
  );
}

// Preload component utility
export function preloadComponent(
  importFn: () => Promise<any>
) {
  // Start loading the component
  importFn();
}