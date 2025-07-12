'use client'

import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface PitchControlProps {
  controlSurface: number[][];
  playerPositions: Array<{
    id: string;
    team: 'home' | 'away';
    x: number;
    y: number;
    name?: string;
  }>;
  ballPosition: { x: number; y: number };
  width?: number;
  height?: number;
  sport: 'basketball' | 'soccer' | 'football';
}

export function PitchControl({
  controlSurface,
  playerPositions,
  ballPosition,
  width = 800,
  height = 500,
  sport
}: PitchControlProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !controlSurface) return;

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Field dimensions
    const fieldDims = {
      basketball: { length: 94, width: 50 },
      soccer: { length: 105, width: 68 },
      football: { length: 120, width: 53.3 }
    };
    const field = fieldDims[sport];

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, field.length])
      .range([0, plotWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, field.width])
      .range([plotHeight, 0]);

    // Draw control surface as contours
    const contourData = d3.contours()
      .size([controlSurface[0].length, controlSurface.length])
      .thresholds(d3.range(0, 1, 0.1))
      (controlSurface.flat());

    const colorScale = d3.scaleSequential(d3.interpolateRdBu)
      .domain([0, 1]);

    // Draw contours
    g.selectAll('.contour')
      .data(contourData)
      .enter()
      .append('path')
      .attr('class', 'contour')
      .attr('d', d3.geoPath(d3.geoIdentity()
        .scale(plotWidth / controlSurface[0].length)
        .translate([0, 0])))
      .attr('fill', d => colorScale(d.value))
      .attr('opacity', 0.6)
      .attr('stroke', 'none');

    // Field outline
    g.append('rect')
      .attr('width', plotWidth)
      .attr('height', plotHeight)
      .attr('fill', 'none')
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // Draw players
    const homeColor = '#3b82f6';
    const awayColor = '#ef4444';

    playerPositions.forEach(player => {
      const playerG = g.append('g')
        .attr('transform', `translate(${xScale(player.x)},${yScale(player.y)})`);

      // Player circle
      playerG.append('circle')
        .attr('r', 8)
        .attr('fill', player.team === 'home' ? homeColor : awayColor)
        .attr('stroke', 'white')
        .attr('stroke-width', 2);

      // Player name (if provided)
      if (player.name) {
        playerG.append('text')
          .attr('y', -12)
          .attr('text-anchor', 'middle')
          .attr('fill', 'white')
          .attr('font-size', '10px')
          .text(player.name);
      }
    });

    // Draw ball
    g.append('circle')
      .attr('cx', xScale(ballPosition.x))
      .attr('cy', yScale(ballPosition.y))
      .attr('r', 6)
      .attr('fill', '#fbbf24')
      .attr('stroke', 'black')
      .attr('stroke-width', 2);

    // Legend
    const legendWidth = 200;
    const legendHeight = 15;
    
    const legendScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d => `${(d * 100).toFixed(0)}%`);

    const legend = svg.append('g')
      .attr('transform', `translate(${(width - legendWidth) / 2},${height - 40})`);

    // Gradient
    const gradientId = 'control-gradient';
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', gradientId);

    for (let i = 0; i <= 10; i++) {
      gradient.append('stop')
        .attr('offset', `${i * 10}%`)
        .attr('stop-color', colorScale(i / 10));
    }

    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', `url(#${gradientId})`);

    legend.append('g')
      .attr('transform', `translate(0,${legendHeight})`)
      .attr('class', 'text-xs text-gray-400')
      .call(legendAxis);

    legend.append('text')
      .attr('x', 0)
      .attr('y', -5)
      .attr('fill', homeColor)
      .attr('font-size', '12px')
      .text('Home');

    legend.append('text')
      .attr('x', legendWidth)
      .attr('y', -5)
      .attr('text-anchor', 'end')
      .attr('fill', awayColor)
      .attr('font-size', '12px')
      .text('Away');

  }, [controlSurface, playerPositions, ballPosition, width, height, sport]);

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-white text-lg font-semibold mb-2">Pitch Control</h3>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
}