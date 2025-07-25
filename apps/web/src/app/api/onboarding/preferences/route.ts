import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logger } from '../../../../lib/logging/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate and structure the preferences data
    const preferences = {
      userId: 'user_123', // Would come from authentication
      sports: body.sports || [],
      favoriteTeams: body.favoriteTeams || {},
      followingPlayers: body.followingPlayers || [],
      platform: body.platform,
      experienceLevel: body.experienceLevel,
      riskTolerance: body.riskTolerance,
      playerPreferences: body.playerPreferences || {
        riskTolerance: 'moderate',
        playStyle: 'mixed'
      },
      notifications: body.notifications || {
        email: true,
        push: true,
        sms: false
      },
      autoOptimize: body.autoOptimize !== undefined ? body.autoOptimize : true,
      importedLeagues: body.importedLeagues || [],
      importPlatform: body.importPlatform || null,
      updatedAt: new Date().toISOString()
    }

    // In a real implementation, you would:
    // 1. Get the user ID from session/auth
    // 2. Update user preferences in database
    // 3. Validate the data structure
    // 4. Handle conflicts with existing preferences

    // For now, simulate saving preferences
    logger.info('Saving user preferences:', { data: {
      userId: preferences.userId,
      sportsCount: preferences.sports.length,
      teamsCount: Object.keys(preferences.favoriteTeams }).length,
      playersCount: preferences.followingPlayers.length,
      platform: preferences.platform,
      timestamp: preferences.updatedAt
    })

    // Set preferences cookie for session persistence
    const cookieStore = cookies()
    cookieStore.set('fantasy-ai-preferences', JSON.stringify({
      sports: preferences.sports,
      platform: preferences.platform,
      experienceLevel: preferences.experienceLevel
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    // Generate personalized recommendations based on preferences
    const recommendations = generatePreferenceRecommendations(preferences)

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
      preferences,
      recommendations
    })

  } catch (error) {
    logger.error('Error saving preferences:', { error: error })
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const cookieStore = cookies()
    const preferencesStr = cookieStore.get('fantasy-ai-preferences')?.value
    
    if (!preferencesStr) {
      return NextResponse.json({
        preferences: null,
        message: 'No preferences found'
      })
    }

    const preferences = JSON.parse(preferencesStr)
    
    return NextResponse.json({
      preferences,
      message: 'Preferences retrieved successfully'
    })
    
  } catch (error) {
    logger.error('Error retrieving preferences:', { error: error })
    return NextResponse.json(
      { error: 'Failed to retrieve preferences' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    
    // Get existing preferences
    const cookieStore = cookies()
    const existingPrefsStr = cookieStore.get('fantasy-ai-preferences')?.value
    const existingPrefs = existingPrefsStr ? JSON.parse(existingPrefsStr) : {}
    
    // Merge with updates
    const updatedPreferences = {
      ...existingPrefs,
      ...body,
      updatedAt: new Date().toISOString()
    }

    // Save updated preferences
    cookieStore.set('fantasy-ai-preferences', JSON.stringify(updatedPreferences), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: updatedPreferences
    })

  } catch (error) {
    logger.error('Error updating preferences:', { error: error })
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}

function generatePreferenceRecommendations(preferences: any) {
  const recommendations = []

  // Sport-specific recommendations
  preferences.sports.forEach((sport: string) => {
    recommendations.push({
      type: 'feature',
      category: 'sport',
      title: `${sport.toUpperCase()} Daily Projections`,
      description: `Get AI-powered player projections for ${sport.toUpperCase()}`,
      action: `/predictions?sport=${sport}`,
      priority: 'high',
      icon: 'target'
    })
  })

  // Platform-specific recommendations
  if (preferences.platform === 'dfs' || preferences.platform === 'both') {
    recommendations.push({
      type: 'feature',
      category: 'dfs',
      title: 'DFS Trading Terminal',
      description: 'Access professional-grade DFS tools and optimization',
      action: '/dfs/terminal',
      priority: 'high',
      icon: 'trending-up'
    })

    recommendations.push({
      type: 'strategy',
      category: 'bankroll',
      title: 'Bankroll Management Guide',
      description: 'Learn Kelly Criterion and risk management strategies',
      action: '/education/bankroll',
      priority: 'medium',
      icon: 'shield'
    })
  }

  if (preferences.platform === 'traditional' || preferences.platform === 'both') {
    recommendations.push({
      type: 'feature',
      category: 'draft',
      title: 'Draft Assistant',
      description: 'Get real-time draft recommendations and player rankings',
      action: '/draft',
      priority: 'high',
      icon: 'trophy'
    })

    if (preferences.importedLeagues?.length > 0) {
      recommendations.push({
        type: 'insight',
        category: 'leagues',
        title: 'League Analysis',
        description: 'View detailed analysis of your imported leagues',
        action: '/leagues/analysis',
        priority: 'medium',
        icon: 'bar-chart'
      })
    }
  }

  // Experience-based recommendations
  if (preferences.experienceLevel === 'beginner') {
    recommendations.push({
      type: 'education',
      category: 'learning',
      title: 'Fantasy Sports Fundamentals',
      description: 'Master the basics with our comprehensive guide',
      action: '/education/fundamentals',
      priority: 'high',
      icon: 'book'
    })
  } else if (preferences.experienceLevel === 'expert') {
    recommendations.push({
      type: 'feature',
      category: 'advanced',
      title: 'Advanced Analytics',
      description: 'Access pro-level analytics and custom models',
      action: '/analytics/advanced',
      priority: 'medium',
      icon: 'zap'
    })
  }

  // Player following recommendations
  if (preferences.followingPlayers?.length > 0) {
    recommendations.push({
      type: 'alert',
      category: 'players',
      title: 'Player Alerts Setup',
      description: 'Configure notifications for your followed players',
      action: '/settings/alerts',
      priority: 'medium',
      icon: 'bell'
    })

    recommendations.push({
      type: 'insight',
      category: 'players',
      title: 'Player Performance Dashboard',
      description: 'Track detailed stats for your followed players',
      action: '/players/dashboard',
      priority: 'medium',
      icon: 'users'
    })
  }

  // Risk tolerance recommendations
  if (preferences.playerPreferences?.riskTolerance === 'conservative') {
    recommendations.push({
      type: 'strategy',
      category: 'conservative',
      title: 'Cash Game Strategies',
      description: 'Maximize consistent returns with low-risk approaches',
      action: '/strategies/cash-games',
      priority: 'medium',
      icon: 'shield'
    })
  } else if (preferences.playerPreferences?.riskTolerance === 'aggressive') {
    recommendations.push({
      type: 'strategy',
      category: 'aggressive',
      title: 'Tournament Strategies',
      description: 'High-upside plays for GPP domination',
      action: '/strategies/tournaments',
      priority: 'medium',
      icon: 'trending-up'
    })
  }

  // Team-based recommendations
  const teamCount = Object.values(preferences.favoriteTeams || {}).flat().length
  if (teamCount > 0) {
    recommendations.push({
      type: 'insight',
      category: 'teams',
      title: 'Team Performance Tracker',
      description: `Follow performance insights for your ${teamCount} favorite teams`,
      action: '/teams/tracker',
      priority: 'medium',
      icon: 'heart'
    })
  }

  // Sort by priority and return top recommendations
  const priorityOrder = { high: 3, medium: 2, low: 1 }
  return recommendations
    .sort((a, b) => priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder])
    .slice(0, 8) // Return top 8 recommendations
}