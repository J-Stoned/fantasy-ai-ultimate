'use client';

import { useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, Time, LineData, BarData } from 'lightweight-charts';

interface LightweightChartProps {
  type?: 'line' | 'bar' | 'area' | 'candlestick';
  data: (LineData | BarData)[];
  height?: number;
  options?: any;
}

export default function LightweightChartWrapper({ 
  type = 'line', 
  data, 
  height = 300,
  options = {}
}: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const initChart = async () => {
      const { createChart, ColorType } = await import('lightweight-charts');
      
      const chart = createChart(containerRef.current!, {
        width: containerRef.current!.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#9CA3AF',
        },
        grid: {
          vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
          horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
        },
        ...options,
      });

      chartRef.current = chart;

      // Create series based on type
      let series;
      switch (type) {
        case 'bar':
          series = chart.addBarSeries({
            thinBars: false,
            upColor: '#10B981',
            downColor: '#EF4444',
          });
          break;
        case 'area':
          series = chart.addAreaSeries({
            lineColor: '#3B82F6',
            topColor: 'rgba(59, 130, 246, 0.3)',
            bottomColor: 'rgba(59, 130, 246, 0.05)',
          });
          break;
        case 'candlestick':
          series = chart.addCandlestickSeries({
            upColor: '#10B981',
            downColor: '#EF4444',
            borderVisible: false,
            wickUpColor: '#10B981',
            wickDownColor: '#EF4444',
          });
          break;
        default:
          series = chart.addLineSeries({
            color: '#3B82F6',
            lineWidth: 2,
          });
      }

      seriesRef.current = series;
      series.setData(data as any);
      chart.timeScale().fitContent();

      // Handle resize
      const handleResize = () => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    };

    initChart();
  }, [type, height, options]);

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data as any);
    }
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}