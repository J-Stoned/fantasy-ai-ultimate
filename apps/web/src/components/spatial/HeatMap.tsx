'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface HeatMapProps {
  data: number[][];
  width?: number;
  height?: number;
  sport: 'basketball' | 'soccer' | 'football' | 'hockey';
  title?: string;
  playerName?: string;
  showLabels?: boolean;
  colorScheme?: 'heat' | 'cool' | 'diverging';
}

export function HeatMap({
  data,
  width = 600,
  height = 400,
  sport,
  title,
  playerName,
  showLabels = true,
  colorScheme = 'heat'
}: HeatMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number; value: number } | null>(null);

  // Field/court dimensions by sport (relative units)
  const fieldDimensions = {
    basketball: { length: 94, width: 50, unit: 'ft' },
    soccer: { length: 105, width: 68, unit: 'm' },
    football: { length: 120, width: 53.3, unit: 'yd' },
    hockey: { length: 200, width: 85, unit: 'ft' }
  };

  const field = fieldDimensions[sport];
  const margin = { top: 40, right: 40, bottom: 40, left: 40 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add title
    if (title || playerName) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('class', 'text-lg font-bold fill-white')
        .text(title || `${playerName} Heat Map`);
    }

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, field.length])
      .range([0, plotWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, field.width])
      .range([plotHeight, 0]);

    // Color scale
    const maxValue = d3.max(data.flat()) || 1;
    let colorScale: d3.ScaleSequential<string>;

    if (colorScheme === 'heat') {
      colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
        .domain([0, maxValue]);
    } else if (colorScheme === 'cool') {
      colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, maxValue]);
    } else {
      colorScale = d3.scaleSequential(d3.interpolateRdBu)
        .domain([-maxValue, maxValue]);
    }

    // Draw field/court outline
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', plotWidth)
      .attr('height', plotHeight)
      .attr('fill', 'none')
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('opacity', 0.3);

    // Draw sport-specific markings
    drawFieldMarkings(g, sport, xScale, yScale, plotWidth, plotHeight);

    // Create heat map cells
    const cellWidth = plotWidth / data[0].length;
    const cellHeight = plotHeight / data.length;

    const cells = g.selectAll('.cell')
      .data(data.flatMap((row, i) => 
        row.map((value, j) => ({
          row: i,
          col: j,
          value: value,
          x: j * cellWidth,
          y: i * cellHeight
        }))
      ))
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('width', cellWidth)
      .attr('height', cellHeight)
      .attr('fill', d => colorScale(d.value))
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', 'white')
          .attr('stroke-width', 2);
        
        const fieldX = (d.col / data[0].length) * field.length;
        const fieldY = field.width - (d.row / data.length) * field.width;
        
        setHoveredCell({
          x: fieldX,
          y: fieldY,
          value: d.value
        });
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', 'none');
        setHoveredCell(null);
      });

    // Add axes if showLabels
    if (showLabels) {
      // X axis
      const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => `${d}${field.unit}`);

      g.append('g')
        .attr('transform', `translate(0,${plotHeight})`)
        .attr('class', 'text-gray-400')
        .call(xAxis);

      // Y axis
      const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => `${d}${field.unit}`);

      g.append('g')
        .attr('class', 'text-gray-400')
        .call(yAxis);
    }

    // Add color legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legendX = width - legendWidth - 20;
    const legendY = height - 40;

    const legendScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d3.format('.1f'));

    // Create gradient for legend
    const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;
    
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    // Add gradient stops
    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      const offset = i / numStops;
      const value = offset * maxValue;
      gradient.append('stop')
        .attr('offset', `${offset * 100}%`)
        .attr('stop-color', colorScale(value));
    }

    // Draw legend
    const legendGroup = svg.append('g')
      .attr('transform', `translate(${legendX},${legendY})`);

    legendGroup.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', `url(#${gradientId})`);

    legendGroup.append('g')
      .attr('transform', `translate(0,${legendHeight})`)
      .attr('class', 'text-gray-400 text-xs')
      .call(legendAxis);

    legendGroup.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('class', 'text-gray-400 text-xs')
      .text('Activity Intensity');

  }, [data, width, height, sport, title, playerName, showLabels, colorScheme]);

  // Helper function to draw field markings
  function drawFieldMarkings(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    sport: string,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    height: number
  ) {
    const markingStyle = {
      stroke: 'white',
      strokeWidth: 1,
      fill: 'none',
      opacity: 0.3
    };

    if (sport === 'basketball') {
      // Center line
      g.append('line')
        .attr('x1', xScale(47))
        .attr('y1', 0)
        .attr('x2', xScale(47))
        .attr('y2', height)
        .attr('stroke', markingStyle.stroke)
        .attr('stroke-width', markingStyle.strokeWidth)
        .attr('opacity', markingStyle.opacity);

      // Center circle
      g.append('circle')
        .attr('cx', xScale(47))
        .attr('cy', yScale(25))
        .attr('r', xScale(6) - xScale(0))
        .attr('fill', markingStyle.fill)
        .attr('stroke', markingStyle.stroke)
        .attr('stroke-width', markingStyle.strokeWidth)
        .attr('opacity', markingStyle.opacity);

      // Three-point lines (simplified arcs)
      [5.25, 88.75].forEach(x => {
        g.append('path')
          .attr('d', d3.arc()({
            innerRadius: xScale(23.75) - xScale(0),
            outerRadius: xScale(23.75) - xScale(0),
            startAngle: -Math.PI / 3,
            endAngle: Math.PI / 3
          }))
          .attr('transform', `translate(${xScale(x)},${yScale(25)})`)
          .attr('stroke', markingStyle.stroke)
          .attr('stroke-width', markingStyle.strokeWidth)
          .attr('fill', markingStyle.fill)
          .attr('opacity', markingStyle.opacity);
      });
    } else if (sport === 'soccer') {
      // Center line
      g.append('line')
        .attr('x1', xScale(52.5))
        .attr('y1', 0)
        .attr('x2', xScale(52.5))
        .attr('y2', height)
        .attr('stroke', markingStyle.stroke)
        .attr('stroke-width', markingStyle.strokeWidth)
        .attr('opacity', markingStyle.opacity);

      // Center circle
      g.append('circle')
        .attr('cx', xScale(52.5))
        .attr('cy', yScale(34))
        .attr('r', xScale(9.15) - xScale(0))
        .attr('fill', markingStyle.fill)
        .attr('stroke', markingStyle.stroke)
        .attr('stroke-width', markingStyle.strokeWidth)
        .attr('opacity', markingStyle.opacity);

      // Penalty boxes
      [0, 88.5].forEach(x => {
        g.append('rect')
          .attr('x', xScale(x))
          .attr('y', yScale(54.16))
          .attr('width', xScale(16.5) - xScale(0))
          .attr('height', yScale(40.32) - yScale(13.84))
          .attr('fill', markingStyle.fill)
          .attr('stroke', markingStyle.stroke)
          .attr('stroke-width', markingStyle.strokeWidth)
          .attr('opacity', markingStyle.opacity);
      });
    }
  }

  return (
    <div className="relative">
      <svg ref={svgRef} className="bg-gray-900 rounded-lg" />
      
      {hoveredCell && (
        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-sm">
          <div className="text-white font-semibold">
            Position: ({hoveredCell.x.toFixed(1)}, {hoveredCell.y.toFixed(1)}) {field.unit}
          </div>
          <div className="text-gray-300">
            Intensity: {(hoveredCell.value * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}