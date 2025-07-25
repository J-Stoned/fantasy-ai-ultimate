/**
 * 📊 DYNAMIC CHART - INTELLIGENT CHART RENDERING
 * 
 * This component dynamically renders different chart types based on
 * the data and configuration provided by voice analytics.
 */

'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Pie, Scatter, Radar, Doughnut } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend,
  Filler
);

interface DynamicChartProps {
  config: {
    type: 'line' | 'bar' | 'pie' | 'scatter' | 'radar' | 'doughnut' | 'area';
    data: any;
    title?: string;
    options?: any;
  };
  className?: string;
  height?: number;
}

export function DynamicChart({ config, className, height = 400 }: DynamicChartProps) {
  // Enhanced chart data with gradients and styling
  const chartData = useMemo(() => {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return config.data;
    
    // Create gradients for different chart types
    const createGradient = (colors: string[]) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      colors.forEach((color, index) => {
        gradient.addColorStop(index / (colors.length - 1), color);
      });
      return gradient;
    };
    
    // Apply styling based on chart type
    const styledData = { ...config.data };
    
    if (config.type === 'line' || config.type === 'area') {
      styledData.datasets = styledData.datasets.map((dataset: any, index: number) => ({
        ...dataset,
        borderColor: dataset.borderColor || getChartColor(index),
        backgroundColor: config.type === 'area' 
          ? createGradient([`${getChartColor(index)}40`, `${getChartColor(index)}10`])
          : dataset.backgroundColor,
        borderWidth: 3,
        tension: 0.4,
        fill: config.type === 'area',
        pointBackgroundColor: dataset.borderColor || getChartColor(index),
        pointBorderColor: '#1a1a1a',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }));
    } else if (config.type === 'bar') {
      styledData.datasets = styledData.datasets.map((dataset: any, index: number) => ({
        ...dataset,
        backgroundColor: dataset.backgroundColor || getChartColors(dataset.data.length),
        borderColor: '#1a1a1a',
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: dataset.hoverBackgroundColor || getChartColors(dataset.data.length, 0.8)
      }));
    } else if (config.type === 'pie' || config.type === 'doughnut') {
      styledData.datasets = styledData.datasets.map((dataset: any) => ({
        ...dataset,
        backgroundColor: dataset.backgroundColor || getChartColors(dataset.data.length),
        borderColor: '#1a1a1a',
        borderWidth: 2,
        hoverOffset: 4
      }));
    }
    
    return styledData;
  }, [config, height]);
  
  // Enhanced chart options
  const chartOptions = useMemo(() => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: '#fff',
            font: {
              size: 12,
              family: 'Inter, sans-serif'
            },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(147, 51, 234, 0.5)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          mode: 'index' as const,
          intersect: false
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeInOutQuart' as const
      }
    };
    
    // Type-specific options
    if (config.type === 'line' || config.type === 'area' || config.type === 'bar') {
      return {
        ...baseOptions,
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#9ca3af',
              font: {
                size: 11
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#9ca3af',
              font: {
                size: 11
              }
            }
          }
        },
        ...config.options
      };
    } else if (config.type === 'radar') {
      return {
        ...baseOptions,
        scales: {
          r: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            angleLines: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            pointLabels: {
              color: '#fff',
              font: {
                size: 12
              }
            },
            ticks: {
              color: '#9ca3af',
              backdropColor: 'transparent'
            }
          }
        },
        ...config.options
      };
    }
    
    return { ...baseOptions, ...config.options };
  }, [config]);
  
  // Render appropriate chart type
  const renderChart = () => {
    const chartProps = {
      data: chartData,
      options: chartOptions,
      height
    };
    
    switch (config.type) {
      case 'line':
      case 'area':
        return <Line {...chartProps} />;
      case 'bar':
        return <Bar {...chartProps} />;
      case 'pie':
        return <Pie {...chartProps} />;
      case 'doughnut':
        return <Doughnut {...chartProps} />;
      case 'scatter':
        return <Scatter {...chartProps} />;
      case 'radar':
        return <Radar {...chartProps} />;
      default:
        return <Line {...chartProps} />;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={cn("relative", className)}
      style={{ height }}
    >
      {renderChart()}
      
      {/* Gradient Overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-lg" />
    </motion.div>
  );
}

// Chart color palette
function getChartColor(index: number): string {
  const colors = [
    '#8b5cf6', // Purple
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316'  // Orange
  ];
  return colors[index % colors.length];
}

function getChartColors(count: number, opacity = 1): string[] {
  return Array.from({ length: count }, (_, i) => {
    const color = getChartColor(i);
    if (opacity === 1) return color;
    // Convert hex to rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  });
}

/**
 * 📊 DYNAMIC CHART FEATURES:
 * 
 * - Supports 7 chart types (line, bar, pie, etc.)
 * - Beautiful gradients and styling
 * - Smooth animations
 * - Responsive design
 * - Dark theme optimized
 * - Interactive tooltips
 * - Legend customization
 * - Area charts with gradients
 * 
 * Intelligent chart rendering based on data!
 */