/**
 * 🔥 useCDN Hook - Elite CDN Integration
 * 
 * React hook for Cloudflare CDN features:
 * - Optimized image URLs
 * - Cache management
 * - Performance monitoring
 * - Smart preloading
 */

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  cloudflareCDNService, 
  ImageOptimization, 
  PerformanceMetrics 
} from '../lib/services/cdn/cloudflare-service';
import { ga4Service } from '../lib/analytics/ga4-service';
import { logger } from '../lib/logging/logger';

// Image sizes for responsive loading
export const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 300, height: 300 },
  medium: { width: 600, height: 600 },
  large: { width: 1200, height: 800 },
  hero: { width: 1920, height: 1080 }
} as const;

// Hook return interface
interface UseCDNReturn {
  // Image optimization
  getOptimizedImage: (
    url: string, 
    options?: Partial<ImageOptimization>
  ) => string;
  
  getResponsiveImage: (
    url: string,
    size: keyof typeof IMAGE_SIZES,
    format?: 'auto' | 'webp' | 'avif'
  ) => string;
  
  // Cache management
  purgeCache: (urls?: string[]) => Promise<void>;
  smartPurge: (url: string) => void;
  getCacheStatus: (url: string) => Promise<{
    cached: boolean;
    age: number;
    ttl: number;
  }>;
  
  // Preloading
  preloadImage: (url: string, priority?: 'high' | 'low') => void;
  preloadAsset: (url: string, as: 'script' | 'style' | 'font') => void;
  
  // Performance
  metrics: PerformanceMetrics | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Elite CDN hook
 */
export function useCDN(): UseCDNReturn {
  const pathname = usePathname();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preloadedUrls] = useState(new Set<string>());

  /**
   * Load performance metrics
   */
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoading(true);
        const data = await cloudflareCDNService.getPerformanceAnalytics('hour');
        setMetrics(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
        logger.error('Failed to load CDN metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
    
    // Refresh metrics every 5 minutes
    const interval = setInterval(loadMetrics, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  /**
   * Track route changes for smart purging
   */
  useEffect(() => {
    // Purge previous page assets after navigation
    const previousPath = sessionStorage.getItem('previousPath');
    if (previousPath && previousPath !== pathname) {
      cloudflareCDNService.smartPurge(previousPath);
    }
    
    sessionStorage.setItem('previousPath', pathname);
  }, [pathname]);

  /**
   * Get optimized image URL
   */
  const getOptimizedImage = useCallback((
    url: string,
    options: Partial<ImageOptimization> = {}
  ): string => {
    if (!url || url.startsWith('data:')) return url;
    
    // Default optimizations
    const defaultOptions: Partial<ImageOptimization> = {
      quality: 85,
      format: 'auto',
      ...options
    };
    
    const optimizedUrl = cloudflareCDNService.getOptimizedImageUrl(url, defaultOptions);
    
    // Track image optimization
    ga4Service.trackEvent('cdn_image_optimized', {
      original_url: url,
      format: defaultOptions.format,
      quality: defaultOptions.quality
    });
    
    return optimizedUrl;
  }, []);

  /**
   * Get responsive image URL
   */
  const getResponsiveImage = useCallback((
    url: string,
    size: keyof typeof IMAGE_SIZES,
    format: 'auto' | 'webp' | 'avif' = 'auto'
  ): string => {
    const dimensions = IMAGE_SIZES[size];
    
    return getOptimizedImage(url, {
      format,
      resize: {
        width: dimensions.width,
        height: dimensions.height,
        fit: 'cover'
      }
    });
  }, [getOptimizedImage]);

  /**
   * Purge cache
   */
  const purgeCache = useCallback(async (urls?: string[]) => {
    try {
      await cloudflareCDNService.purgeCache(urls);
      
      // Track purge
      ga4Service.trackEvent('cdn_cache_purged', {
        url_count: urls?.length || 0,
        purge_type: urls ? 'selective' : 'all'
      });
    } catch (err) {
      logger.error('Failed to purge cache:', err);
      throw err;
    }
  }, []);

  /**
   * Smart purge single URL
   */
  const smartPurge = useCallback((url: string) => {
    cloudflareCDNService.smartPurge(url);
  }, []);

  /**
   * Get cache status
   */
  const getCacheStatus = useCallback(async (url: string) => {
    try {
      const status = await cloudflareCDNService.getCacheStatus(url);
      return {
        cached: status.cached,
        age: status.age,
        ttl: status.ttl
      };
    } catch (err) {
      logger.error('Failed to get cache status:', err);
      return {
        cached: false,
        age: 0,
        ttl: 0
      };
    }
  }, []);

  /**
   * Preload image
   */
  const preloadImage = useCallback((url: string, priority: 'high' | 'low' = 'low') => {
    if (preloadedUrls.has(url)) return;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = getOptimizedImage(url);
    
    if (priority === 'high') {
      link.setAttribute('fetchpriority', 'high');
    }
    
    document.head.appendChild(link);
    preloadedUrls.add(url);
    
    // Track preload
    ga4Service.trackEvent('cdn_image_preloaded', {
      url,
      priority
    });
  }, [getOptimizedImage, preloadedUrls]);

  /**
   * Preload asset
   */
  const preloadAsset = useCallback((url: string, as: 'script' | 'style' | 'font') => {
    if (preloadedUrls.has(url)) return;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = as;
    link.href = url;
    
    if (as === 'font') {
      link.setAttribute('crossorigin', 'anonymous');
    }
    
    document.head.appendChild(link);
    preloadedUrls.add(url);
    
    // Track preload
    ga4Service.trackEvent('cdn_asset_preloaded', {
      url,
      type: as
    });
  }, [preloadedUrls]);

  return {
    getOptimizedImage,
    getResponsiveImage,
    purgeCache,
    smartPurge,
    getCacheStatus,
    preloadImage,
    preloadAsset,
    metrics,
    loading,
    error
  };
}

/**
 * Get srcset for responsive images
 */
export function getImageSrcSet(
  url: string,
  sizes: Array<keyof typeof IMAGE_SIZES> = ['small', 'medium', 'large']
): string {
  return sizes
    .map(size => {
      const { width } = IMAGE_SIZES[size];
      const optimizedUrl = cloudflareCDNService.getOptimizedImageUrl(url, {
        format: 'auto',
        resize: { width, fit: 'scale-down' }
      });
      return `${optimizedUrl} ${width}w`;
    })
    .join(', ');
}

/**
 * Lazy load image component helper
 */
export function lazyLoadImage(
  url: string,
  alt: string,
  className?: string,
  sizes?: string
): JSX.Element {
  return (
    <img
      src={cloudflareCDNService.getOptimizedImageUrl(url, {
        quality: 85,
        format: 'auto'
      })}
      srcSet={getImageSrcSet(url)}
      sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}