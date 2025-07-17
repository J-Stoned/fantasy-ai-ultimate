'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const [stats, setStats] = useState({
    players: 0,
    teams: 0,
    games: 0,
    news: 0,
    total: 0
  })

  useEffect(() => {
    // Fetch stats from API
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.stats) {
          setStats(data.stats)
        }
      })
      .catch(console.error)
  }, [])

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(to bottom, #0f0f23, #1a1a2e)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '800px', padding: '2rem' }}>
        <h1 style={{ 
          fontSize: '4rem', 
          marginBottom: '1rem',
          background: 'linear-gradient(45deg, #ff6b6b, #ff8787)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🔥 FANTASY AI ULTIMATE
        </h1>
        
        <p style={{ fontSize: '1.5rem', marginBottom: '3rem', opacity: 0.9 }}>
          65.2% Pattern Accuracy | 48K+ Games Analyzed | $1.15M Profit Potential
        </p>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '3rem'
        }}>
          <div style={{ 
            background: 'rgba(255,255,255,0.1)', 
            padding: '1.5rem', 
            borderRadius: '10px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>519K+</div>
            <div style={{ opacity: 0.8 }}>Player Stats</div>
          </div>
          
          <div style={{ 
            background: 'rgba(255,255,255,0.1)', 
            padding: '1.5rem', 
            borderRadius: '10px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>48K+</div>
            <div style={{ opacity: 0.8 }}>Games</div>
          </div>
          
          <div style={{ 
            background: 'rgba(255,255,255,0.1)', 
            padding: '1.5rem', 
            borderRadius: '10px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>65.2%</div>
            <div style={{ opacity: 0.8 }}>Pattern Accuracy</div>
          </div>
          
          <div style={{ 
            background: 'rgba(255,255,255,0.1)', 
            padding: '1.5rem', 
            borderRadius: '10px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>76.8%</div>
            <div style={{ opacity: 0.8 }}>Best Pattern</div>
          </div>
        </div>

        <div style={{ 
          fontSize: '3rem', 
          fontWeight: 'bold',
          marginBottom: '2rem',
          color: '#ff6b6b'
        }}>
          583K+ Total Records
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{ 
            background: 'linear-gradient(45deg, #ff6b6b, #ff8787)',
            color: 'white',
            padding: '1rem 2rem',
            borderRadius: '50px',
            textDecoration: 'none',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            display: 'inline-block',
            transition: 'transform 0.2s',
          }}>
            Enter Dashboard
          </Link>
          
          <Link href="/data-hub" style={{ 
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            padding: '1rem 2rem',
            borderRadius: '50px',
            textDecoration: 'none',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            display: 'inline-block',
            border: '2px solid rgba(255,255,255,0.3)',
            transition: 'all 0.2s',
          }}>
            Data Hub
          </Link>
        </div>

        <div style={{ marginTop: '3rem', opacity: 0.6 }}>
          <p>🎯 Pattern Detection System with 5 Proven Strategies</p>
          <p>📊 Universal Sports Collector (NFL, NBA, MLB, NHL, NCAA)</p>
          <p>🚀 10X Dev Architecture - 32 Clean Scripts</p>
        </div>
      </div>
    </div>
  )
}