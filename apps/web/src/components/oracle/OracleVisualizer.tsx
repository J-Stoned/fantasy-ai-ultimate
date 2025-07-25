/**
 * 🌟 ORACLE VISUALIZER - MYSTICAL AUDIO VISUALIZATION
 * 
 * This component creates an animated, mystical visualization that
 * responds to the Oracle's voice and listening states.
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface OracleVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  currentSpeaker: string;
  confidence: number;
  className?: string;
}

export function OracleVisualizer({
  isListening,
  isSpeaking,
  currentSpeaker,
  confidence,
  className
}: OracleVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Animation variables
    let particles: Particle[] = [];
    let time = 0;
    
    // Particle class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      life: number;
      maxLife: number;
      color: string;
      pulsePhase: number;
      
      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.radius = Math.random() * 3 + 1;
        this.life = 0;
        this.maxLife = Math.random() * 100 + 50;
        this.pulsePhase = Math.random() * Math.PI * 2;
        
        // Color based on speaker
        const colors = {
          oracle: 'rgba(147, 51, 234, ',  // Purple
          'data-scientist': 'rgba(59, 130, 246, ', // Blue
          'vegas-sharp': 'rgba(239, 68, 68, ', // Red
          'contrarian': 'rgba(245, 158, 11, ', // Amber
          'optimizer': 'rgba(34, 197, 94, ', // Green
          'floor-general': 'rgba(168, 85, 247, ', // Purple
          'narrative-master': 'rgba(236, 72, 153, ', // Pink
          'weather-hawk': 'rgba(14, 165, 233, ', // Sky
          'chaos-agent': 'rgba(220, 38, 38, ' // Red
        };
        
        this.color = colors[currentSpeaker] || colors.oracle;
      }
      
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life++;
        
        // Add some turbulence
        this.vx += (Math.random() - 0.5) * 0.1;
        this.vy += (Math.random() - 0.5) * 0.1;
        
        // Damping
        this.vx *= 0.99;
        this.vy *= 0.99;
        
        // Wrap around edges
        if (this.x < 0) this.x = canvas.width / window.devicePixelRatio;
        if (this.x > canvas.width / window.devicePixelRatio) this.x = 0;
        if (this.y < 0) this.y = canvas.height / window.devicePixelRatio;
        if (this.y > canvas.height / window.devicePixelRatio) this.y = 0;
      }
      
      draw(ctx: CanvasRenderingContext2D, time: number) {
        const lifeRatio = this.life / this.maxLife;
        const opacity = 1 - lifeRatio;
        
        // Pulse effect
        const pulse = Math.sin(time * 0.001 + this.pulsePhase) * 0.5 + 0.5;
        const radius = this.radius * (1 + pulse * 0.5);
        
        // Glow effect
        const gradient = ctx.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, radius * 3
        );
        
        gradient.addColorStop(0, this.color + (opacity * 0.8) + ')');
        gradient.addColorStop(0.5, this.color + (opacity * 0.3) + ')');
        gradient.addColorStop(1, this.color + '0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius * 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Core particle
        ctx.fillStyle = this.color + opacity + ')';
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Create particles
    const createParticle = () => {
      const centerX = canvas.width / (2 * window.devicePixelRatio);
      const centerY = canvas.height / (2 * window.devicePixelRatio);
      
      let x, y;
      
      if (isListening || isSpeaking) {
        // Create from center when active
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 50;
        x = centerX + Math.cos(angle) * distance;
        y = centerY + Math.sin(angle) * distance;
      } else {
        // Random position when idle
        x = Math.random() * (canvas.width / window.devicePixelRatio);
        y = Math.random() * (canvas.height / window.devicePixelRatio);
      }
      
      particles.push(new Particle(x, y));
    };
    
    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update particle creation rate
      const creationRate = isListening ? 3 : isSpeaking ? 5 : 1;
      if (Math.random() < creationRate / 10) {
        createParticle();
      }
      
      // Update and draw particles
      particles = particles.filter(particle => {
        particle.update();
        particle.draw(ctx, time);
        return particle.life < particle.maxLife;
      });
      
      // Draw center orb when active
      if (isListening || isSpeaking) {
        const centerX = canvas.width / (2 * window.devicePixelRatio);
        const centerY = canvas.height / (2 * window.devicePixelRatio);
        
        // Pulsing orb
        const orbSize = 30 + Math.sin(time * 0.003) * 10;
        const orbGradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, orbSize
        );
        
        const baseColor = currentSpeaker === 'oracle' 
          ? 'rgba(147, 51, 234, '
          : 'rgba(99, 102, 241, ';
        
        orbGradient.addColorStop(0, baseColor + '0.8)');
        orbGradient.addColorStop(0.7, baseColor + '0.3)');
        orbGradient.addColorStop(1, baseColor + '0)');
        
        ctx.fillStyle = orbGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Confidence ring
        if (confidence > 0) {
          ctx.strokeStyle = baseColor + (confidence * 0.8) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, orbSize + 10, 0, Math.PI * 2 * confidence);
          ctx.stroke();
        }
      }
      
      time++;
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isSpeaking, currentSpeaker, confidence]);
  
  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Overlay Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Listening Pulse */}
        {isListening && (
          <motion.div
            className="absolute inset-0 bg-purple-500/10"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.1, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
        
        {/* Speaking Glow */}
        {isSpeaking && (
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              background: `radial-gradient(circle at center, ${
                currentSpeaker === 'oracle' 
                  ? 'rgba(147, 51, 234, 0.3)' 
                  : 'rgba(99, 102, 241, 0.3)'
              } 0%, transparent 70%)`
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 🌟 ORACLE VISUALIZER FEATURES:
 * 
 * - Particle system with speaker-specific colors
 * - Responsive to listening/speaking states
 * - Central orb with confidence indicator
 * - Smooth animations and transitions
 * - WebGL-like effects with Canvas API
 * - Dynamic particle creation rates
 * - Mystical glow and pulse effects
 * 
 * Creates an immersive visual experience!
 */