# ⚡ Bundle Size Optimization Guide

## 🎯 Target: <500KB Initial Load

This guide documents the bundle optimization strategies implemented to reduce initial load from ~2MB to <500KB.

## 📊 Bundle Analysis

Run bundle analysis to see current state:
```bash
npm run analyze
npm run analyze:server  # Server bundle
npm run analyze:browser # Client bundle
```

## 🚀 Optimization Strategies Implemented

### 1. **Strategic Code Splitting**
- ✅ Route-based splitting for all major pages
- ✅ Dynamic imports for heavy components (>100KB)
- ✅ Lazy loading for admin features
- ✅ Component-level splitting for large components

### 2. **Webpack Configuration**
```javascript
// next.config.js optimizations:
- Framework chunk: React, Next.js core
- UI libraries chunk: Radix UI, Framer Motion
- Charts chunk: Chart.js, Recharts, D3
- 3D chunk: Three.js, React Three Fiber
- ML chunk: TensorFlow (workers only)
- Forms chunk: React Hook Form, Zod
- DnD chunk: DnD Kit, React Beautiful DnD
```

### 3. **Dynamic Imports**
Key components now use dynamic imports:
- **Trading Terminal**: `@/components/dfs/advanced-trading-terminal`
- **League Creation**: `@/components/leagues/LeagueCreationWizard`
- **ML Dashboard**: `@/components/admin/MLTrainingDashboard`
- **3D Visualizer**: `@/components/dfs/Portfolio3DVisualizer`
- **Charts**: All chart components lazy loaded

### 4. **Route Prefetching**
- Priority routes prefetched after initial load
- Link prefetching on hover
- Chunk preloading based on user navigation patterns

### 5. **Component Optimization**
- Loading states for all dynamic components
- Consistent loading UI with `loading-spinner.tsx`
- Image optimization with Next.js Image component
- Lazy chart loading with `lazy-chart.tsx`

## 📁 Key Files Created

### Utilities
- `/src/lib/utils/dynamic-import.tsx` - Dynamic import helper
- `/src/lib/utils/route-prefetch.ts` - Route prefetching logic
- `/src/lib/utils/split-component.tsx` - Component splitting utilities
- `/src/lib/utils/performance-monitor.ts` - Performance tracking

### Components
- `/src/components/ui/loading-spinner.tsx` - Consistent loading states
- `/src/components/ui/lazy-chart.tsx` - Lazy loaded charts
- `/src/components/ui/optimized-image.tsx` - Optimized images
- `/src/components/OptimizedLayout.tsx` - Layout optimization wrapper

## 🎯 Large Components to Split

These components should be split into smaller chunks:

1. **advanced-trading-terminal.tsx** (1,618 lines)
   - Split into: Header, Charts, Portfolio, Orders sections
   
2. **LeagueCreationWizard.tsx** (1,478 lines)
   - Split into: Steps, Forms, Preview sections
   
3. **ultimate-lineup-builder.tsx** (1,112 lines)
   - Split into: PlayerPool, Lineup, Optimization sections

## 🔧 Implementation Examples

### Dynamic Import Pattern
```typescript
// Instead of:
import HeavyComponent from './HeavyComponent';

// Use:
const HeavyComponent = dynamic(
  () => import('./HeavyComponent'),
  {
    loading: () => <ComponentLoader />,
    ssr: false,
  }
);
```

### Route-based Splitting
```typescript
// pages/heavy-page.tsx
const HeavyFeature = dynamic(
  () => import('@/components/HeavyFeature'),
  { ssr: false }
);

export default function Page() {
  return <HeavyFeature />;
}
```

### Conditional Loading
```typescript
const ChartComponent = dynamic(
  () => import('./ChartComponent'),
  { ssr: false }
);

function Dashboard() {
  const [showChart, setShowChart] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowChart(true)}>
        Show Chart
      </button>
      {showChart && <ChartComponent />}
    </>
  );
}
```

## 📈 Performance Monitoring

Use the performance monitor to track improvements:
```typescript
import { PerformanceMonitor } from '@/lib/utils/performance-monitor';

// Track bundle size
PerformanceMonitor.trackBundleSize();

// Monitor Web Vitals
PerformanceMonitor.initWebVitals();
```

## 🎯 Expected Results

- **Initial JS**: <500KB (from ~2MB)
- **FCP**: <1.5s on 3G
- **TTI**: <3s on 3G
- **Core Web Vitals**: All green

## 🚦 Next Steps

1. Split the three largest components
2. Implement resource hints (preconnect, prefetch)
3. Enable Next.js ISR for static content
4. Implement service worker for offline support
5. Add compression (Brotli) to server

## 🔍 Monitoring

Monitor bundle size changes:
```bash
# Before making changes
npm run analyze > before.txt

# After changes
npm run analyze > after.txt

# Compare
diff before.txt after.txt
```