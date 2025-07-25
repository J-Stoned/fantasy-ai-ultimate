import dynamic from 'next/dynamic';
import { ComponentLoader } from './loading-spinner';
import type { ChartData, ChartOptions } from 'chart.js';
import type { LineProps, BarProps, AreaProps, PieProps } from 'recharts';

// Lazy load Chart.js components
export const LazyLine = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Line),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

export const LazyBar = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Bar),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

export const LazyDoughnut = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Doughnut),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

export const LazyPie = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Pie),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

// Lazy load Recharts components
export const LazyLineChart = dynamic(
  () => import('recharts').then(mod => mod.LineChart),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

export const LazyBarChart = dynamic(
  () => import('recharts').then(mod => mod.BarChart),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

export const LazyAreaChart = dynamic(
  () => import('recharts').then(mod => mod.AreaChart),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

export const LazyPieChart = dynamic(
  () => import('recharts').then(mod => mod.PieChart),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

export const LazyComposedChart = dynamic(
  () => import('recharts').then(mod => mod.ComposedChart),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

// Lazy load Lightweight Charts
export const LazyLightweightChart = dynamic(
  () => import('./lightweight-chart-wrapper'),
  {
    loading: () => <ComponentLoader label="Loading chart..." />,
    ssr: false,
  }
);

// Chart configuration helpers
export function registerChartDefaults() {
  if (typeof window !== 'undefined') {
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      Chart.defaults.color = '#9CA3AF';
      Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    });
  }
}