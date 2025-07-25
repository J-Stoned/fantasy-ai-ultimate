import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Priority routes that should be prefetched
const PRIORITY_ROUTES = [
  '/dashboard',
  '/leagues',
  '/lineup-builder',
  '/dfs',
];

// Route chunks mapping
const ROUTE_CHUNKS: Record<string, () => Promise<any>> = {
  '/admin/ml-training': () => import('@/components/admin/MLTrainingDashboard'),
  '/admin/dfs-training': () => import('@/components/admin/dfs/DFSTrainingDashboard'),
  '/admin/trading': () => import('@/components/admin/dfs/TradingDashboard'),
  '/dfs/terminal': () => import('@/components/dfs/advanced-trading-terminal'),
  '/leagues/create': () => import('@/components/leagues/LeagueCreationWizard'),
  '/lineup-builder': () => import('@/app/lineup-builder/page'),
};

// Prefetch route chunks based on user behavior
export function usePrefetchRoutes() {
  const router = useRouter();

  useEffect(() => {
    // Prefetch priority routes after initial load
    const prefetchTimer = setTimeout(() => {
      PRIORITY_ROUTES.forEach(route => {
        router.prefetch(route);
      });
    }, 2000);

    return () => clearTimeout(prefetchTimer);
  }, [router]);
}

// Prefetch specific route chunk
export function prefetchRouteChunk(route: string) {
  const chunkLoader = ROUTE_CHUNKS[route];
  if (chunkLoader && typeof window !== 'undefined') {
    // Use requestIdleCallback for non-blocking prefetch
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => chunkLoader());
    } else {
      setTimeout(() => chunkLoader(), 1);
    }
  }
}

// Intersection Observer for link prefetching
export function useLinkPrefetch() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const link = entry.target as HTMLAnchorElement;
            const href = link.getAttribute('href');
            if (href && ROUTE_CHUNKS[href]) {
              prefetchRouteChunk(href);
              observer.unobserve(link);
            }
          }
        });
      },
      {
        rootMargin: '50px',
      }
    );

    // Observe all internal links
    const links = document.querySelectorAll('a[href^="/"]');
    links.forEach(link => observer.observe(link));

    return () => observer.disconnect();
  }, []);
}

// Route-based chunk preloading strategy
export function getChunkPreloadStrategy(currentRoute: string): string[] {
  const strategies: Record<string, string[]> = {
    '/': ['/dashboard', '/leagues', '/dfs'],
    '/dashboard': ['/lineup-builder', '/leagues', '/dfs'],
    '/leagues': ['/leagues/create', '/leagues/import'],
    '/dfs': ['/dfs/terminal', '/dfs/trading'],
    '/admin': ['/admin/ml-training', '/admin/dfs-training', '/admin/trading'],
  };

  return strategies[currentRoute] || [];
}