/**
 * 🔥 NEXT.JS 15 PRODUCTION CONFIGURATION - 2025 BEST PRACTICES 🔥
 * Optimized for Fantasy AI Trading Platform
 * Target: <100ms response times for financial data
 */

// Bundle analyzer setup (optional)
let withBundleAnalyzer;
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
} catch (error) {
  // Fallback if bundle analyzer is not installed
  withBundleAnalyzer = (config) => config;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Performance optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Image optimization with latest formats
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year cache
    domains: ['draftkings.com', 'fanduel.com', 'espn.com'],
  },
  
  // SWC minification is enabled by default in Next.js 15
  // swcMinify: true, // Removed - deprecated
  
  // Experimental features for maximum performance
  experimental: {
    // Turbopack for faster builds (stable in Next.js 15)
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    // Optimize CSS delivery - disabled due to critters dependency issue
    // optimizeCss: true,
    // Partial Prerendering for hybrid static/dynamic
    // ppr: true, // Disabled - requires canary version
    // Server Actions optimizations
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Instrumentation is now enabled by default via instrumentation.js
  },
  
  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Fix Node.js modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        dns: false,
        net: false,
        tls: false,
        child_process: false,
        stream: false,
        util: false,
        buffer: false,
        process: false,
      };
    }
    
    // Handle TensorFlow and node-pre-gyp issues
    config.module.rules.push({
      test: /\.html$/,
      loader: 'ignore-loader',
      include: /node_modules\/@mapbox\/node-pre-gyp/,
    });
    
    // Externalize TensorFlow in server builds
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@tensorflow/tfjs-node': 'commonjs @tensorflow/tfjs-node',
        '@tensorflow/tfjs-node-gpu': 'commonjs @tensorflow/tfjs-node-gpu',
      });
    }
    
    // Optimize for production
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        minSize: 20000,
        cacheGroups: {
          default: false,
          vendors: false,
          // Framework chunk - React, Next.js core
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next|scheduler|prop-types|use-sync-external-store)[\\/]/,
            priority: 50,
            reuseExistingChunk: true,
          },
          // UI libraries chunk
          ui: {
            name: 'ui',
            test: /[\\/]node_modules[\\/](@radix-ui|framer-motion|react-spring|@react-spring|class-variance-authority|clsx|tailwind-merge)[\\/]/,
            priority: 45,
          },
          // Charting libraries (heavy)
          charts: {
            name: 'charts',
            test: /[\\/]node_modules[\\/](chart\.js|chartjs-adapter-date-fns|react-chartjs-2|recharts|d3|lightweight-charts)[\\/]/,
            priority: 40,
          },
          // 3D libraries (heavy)
          three: {
            name: 'three',
            test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
            priority: 40,
          },
          // ML libraries (heavy)
          ml: {
            name: 'ml',
            test: /[\\/]node_modules[\\/](@tensorflow)[\\/]/,
            priority: 40,
          },
          // Form & validation
          forms: {
            name: 'forms',
            test: /[\\/]node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/,
            priority: 35,
          },
          // DnD libraries
          dnd: {
            name: 'dnd',
            test: /[\\/]node_modules[\\/](@dnd-kit|react-beautiful-dnd|react-dnd)[\\/]/,
            priority: 35,
          },
          // Other vendor libraries
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            priority: 20,
          },
          // Common components
          common: {
            name: 'common',
            minChunks: 2,
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      };
      
      // Minimize bundle size
      // config.optimization.usedExports = true; // Conflicts with cacheUnaffected
      config.optimization.sideEffects = false;
    }
    
    return config;
  },
  
  // Security headers for production
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          // Cache static assets
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API routes - no caching for real-time data
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
    ];
  },
  
  // Redirects for legacy routes
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
  
  // Environment variables to expose to the browser
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  
  // Output configuration for deployment
  output: process.env.DEPLOY_TARGET === 'standalone' ? 'standalone' : undefined,
  
  // Disable x-powered-by header
  poweredByHeader: false,
  
  // Generate ETags for caching
  generateEtags: true,
  
  // Compress responses
  compress: true,
  
  // TypeScript and ESLint in production builds
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = withBundleAnalyzer(nextConfig);