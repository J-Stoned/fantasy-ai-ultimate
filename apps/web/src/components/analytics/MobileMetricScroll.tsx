/**
 * 📱 MOBILE METRIC SCROLL - HORIZONTAL SCROLLING METRICS
 * 
 * This component displays metrics in a horizontal scrolling
 * format optimized for mobile devices.
 */

'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Metric } from './MetricCards';

interface MobileMetricScrollProps {
  metrics: Metric[];
  className?: string;
}

export function MobileMetricScroll({ metrics, className }: MobileMetricScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  const checkScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };
  
  useEffect(() => {
    checkScroll();
    const element = scrollRef.current;
    if (element) {
      element.addEventListener('scroll', checkScroll);
      return () => element.removeEventListener('scroll', checkScroll);
    }
  }, [metrics]);
  
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };
  
  return (
    <div className={cn("relative", className)}>
      {/* Scroll Indicators */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-black/80 backdrop-blur-sm rounded-r-lg"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      )}
      
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-black/80 backdrop-blur-sm rounded-l-lg"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      )}
      
      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-4 -mx-4"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="flex-shrink-0 w-[200px]"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              {/* Icon */}
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  {metric.icon}
                </div>
                
                {metric.trend && (
                  <div className={cn(
                    "text-xs font-medium",
                    metric.change && metric.change > 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {metric.change && metric.change > 0 ? '+' : ''}{metric.change?.toFixed(1)}%
                  </div>
                )}
              </div>
              
              {/* Value */}
              <div className="mb-1">
                <p className="text-xl font-bold text-white">
                  {metric.value}
                </p>
              </div>
              
              {/* Label */}
              <p className="text-xs text-gray-400">
                {metric.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Scroll Dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {Array.from({ length: Math.ceil(metrics.length / 2) }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all",
              i === 0 ? "bg-purple-400 w-4" : "bg-white/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 📱 MOBILE METRIC SCROLL FEATURES:
 * 
 * - Horizontal scrolling on mobile
 * - Snap-to-card behavior
 * - Scroll indicators (arrows)
 * - Scroll position dots
 * - Touch-friendly cards
 * - Smooth animations
 * - Gradient backgrounds
 * 
 * Perfect for mobile data display!
 */