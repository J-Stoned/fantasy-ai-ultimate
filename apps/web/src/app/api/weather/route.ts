/**
 * 🌤️ Weather Data API
 * Real-time weather conditions and impact analysis for DFS
 */

import { NextRequest, NextResponse } from 'next/server'
import { services } from '@/lib/services/init'

// GET endpoint - retrieve weather data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const gameId = searchParams.get('game_id')
    const sport = searchParams.get('sport')
    const threshold = searchParams.get('threshold')
    
    // Initialize services if needed
    await services.initialize()
    const { weatherService } = services.getServices()
    
    switch (action) {
      case 'game':
        // Get weather for specific game
        if (!gameId) {
          return NextResponse.json(
            { error: 'game_id required' },
            { status: 400 }
          )
        }
        
        const gameWeather = weatherService.getGameWeather(gameId)
        const weatherImpact = weatherService.getWeatherImpact(gameId)
        
        return NextResponse.json({
          game_id: gameId,
          weather: gameWeather,
          impact: weatherImpact,
          has_weather_data: gameWeather !== null
        })
        
      case 'significant':
        // Get games with significant weather impact
        const impactThreshold = threshold ? parseFloat(threshold) : -0.2
        const significantGames = weatherService.getSignificantWeatherGames(impactThreshold)
        
        return NextResponse.json({
          threshold: impactThreshold,
          games: significantGames,
          total: significantGames.length,
          message: `Games with weather impact <= ${impactThreshold}`
        })
        
      case 'report':
        // Get comprehensive weather report
        const report = weatherService.getWeatherReport(sport)
        
        return NextResponse.json({
          sport: sport || 'all',
          ...report,
          generated_at: new Date()
        })
        
      case 'mock':
        // Generate mock weather for testing
        if (!gameId || !sport) {
          return NextResponse.json(
            { error: 'game_id and sport required for mock data' },
            { status: 400 }
          )
        }
        
        await weatherService.generateMockWeather(gameId, sport)
        
        const mockWeather = weatherService.getGameWeather(gameId)
        const mockImpact = weatherService.getWeatherImpact(gameId)
        
        return NextResponse.json({
          success: true,
          game_id: gameId,
          weather: mockWeather,
          impact: mockImpact,
          message: 'Mock weather data generated'
        })
        
      default:
        // Return weather overview
        const allWeather = weatherService.getWeatherReport()
        
        return NextResponse.json({
          overview: allWeather,
          sports_affected: ['nfl', 'mlb'],
          last_updated: new Date(),
          features: {
            real_time_updates: true,
            impact_calculation: true,
            historical_trends: true,
            forecast_integration: false // Future feature
          }
        })
    }
    
  } catch (error: any) {
    console.error('Weather API error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve weather data', details: error.message },
      { status: 500 }
    )
  }
}

// POST endpoint - update weather data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      game_id,
      temperature,
      wind_speed,
      wind_direction,
      precipitation,
      humidity,
      conditions
    } = body
    
    // Validate required fields
    if (!game_id) {
      return NextResponse.json(
        { error: 'game_id is required' },
        { status: 400 }
      )
    }
    
    // Validate weather values
    if (temperature !== undefined && (temperature < -50 || temperature > 150)) {
      return NextResponse.json(
        { error: 'Temperature must be between -50 and 150°F' },
        { status: 400 }
      )
    }
    
    if (wind_speed !== undefined && (wind_speed < 0 || wind_speed > 100)) {
      return NextResponse.json(
        { error: 'Wind speed must be between 0 and 100 MPH' },
        { status: 400 }
      )
    }
    
    if (precipitation !== undefined && (precipitation < 0 || precipitation > 100)) {
      return NextResponse.json(
        { error: 'Precipitation must be between 0 and 100%' },
        { status: 400 }
      )
    }
    
    // Initialize services
    await services.initialize()
    const { weatherService } = services.getServices()
    
    // Update weather data
    await weatherService.updateGameWeather(game_id, {
      temperature,
      wind_speed,
      wind_direction,
      precipitation,
      humidity,
      conditions
    })
    
    // Get updated data
    const updatedWeather = weatherService.getGameWeather(game_id)
    const updatedImpact = weatherService.getWeatherImpact(game_id)
    
    return NextResponse.json({
      success: true,
      game_id,
      weather: updatedWeather,
      impact: updatedImpact,
      message: 'Weather data updated successfully'
    })
    
  } catch (error: any) {
    console.error('Weather update error:', error)
    return NextResponse.json(
      { error: 'Failed to update weather data', details: error.message },
      { status: 500 }
    )
  }
}