import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logger } from '../../../../lib/logging/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate required completion data
    const {
      platform,
      experienceLevel,
      selectedSports,
      completionTime,
      stepsCompleted,
      userJourney
    } = body

    if (!platform || !experienceLevel || !selectedSports?.length) {
      return NextResponse.json(
        { error: 'Missing required onboarding completion data' },
        { status: 400 }
      )
    }

    // Create comprehensive completion record
    const completionData = {
      userId: 'user_123', // Would come from authentication
      platform,
      experienceLevel,
      selectedSports,
      favoriteTeams: body.favoriteTeams || {},
      followingPlayers: body.followingPlayers || [],
      playerPreferences: body.playerPreferences || {
        riskTolerance: 'moderate',
        playStyle: 'mixed'
      },
      bankroll: {
        initial: body.initialBankroll || 100,
        current: body.initialBankroll || 100,
        riskTolerance: body.riskTolerance || 'medium',
        maxSingleEntry: body.maxSingleEntry || Math.round((body.initialBankroll || 100) * 0.05)
      },
      contestPreferences: body.contestPreferences || [],
      profile: body.profile || {
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        autoOptimize: true,
        dataSharing: false
      },
      importData: {
        importedLeagues: body.importedLeagues || [],
        importPlatform: body.importPlatform || null,
        skippedImport: body.skippedImport || false
      },
      completionMetrics: {
        totalTime: completionTime || 0,
        stepsCompleted: stepsCompleted || 0,
        userJourney: userJourney || [],
        completedAt: new Date().toISOString(),
        version: '2.0' // Onboarding version for analytics
      },
      status: 'completed'
    }

    // In a real implementation, you would:
    // 1. Get the user ID from session/auth
    // 2. Save complete onboarding data to database
    // 3. Update user status and permissions
    // 4. Trigger welcome email/notifications
    // 5. Initialize user's dashboard and preferences
    // 6. Set up any required integrations

    // Set completion cookies
    const cookieStore = cookies()
    
    // Mark onboarding as completed
    cookieStore.set('fantasy-ai-onboarding', 'completed', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    })

    // Save user preferences for quick access
    cookieStore.set('fantasy-ai-user-data', JSON.stringify({
      platform: completionData.platform,
      experienceLevel: completionData.experienceLevel,
      sports: completionData.selectedSports,
      hasImportedLeagues: completionData.importData.importedLeagues.length > 0,
      followingPlayersCount: completionData.followingPlayers.length,
      completedAt: completionData.completionMetrics.completedAt
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    // Log completion analytics
    logger.info('Onboarding completed:', { data: {
      userId: completionData.userId,
      platform: completionData.platform,
      experienceLevel: completionData.experienceLevel,
      sportsCount: completionData.selectedSports.length,
      teamsCount: Object.keys(completionData.favoriteTeams).length,
      playersCount: completionData.followingPlayers.length,
      hasImportedLeagues: completionData.importData.importedLeagues.length > 0,
      completionTime: completionData.completionMetrics.totalTime,
      timestamp: completionData.completionMetrics.completedAt
    })

    // Generate comprehensive post-onboarding recommendations
    const recommendations = generateCompletionRecommendations(completionData)
    
    // Generate personalized dashboard configuration
    const dashboardConfig = generateDashboardConfig(completionData)

    // Create welcome package
    const welcomePackage = createWelcomePackage(completionData)

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully! Welcome to Fantasy AI! 🚀',
      data: {
        user: {
          platform: completionData.platform,
          experienceLevel: completionData.experienceLevel,
          sports: completionData.selectedSports,
          followingCount: completionData.followingPlayers.length,
          leaguesImported: completionData.importData.importedLeagues.length
        },
        recommendations,
        dashboardConfig,
        welcomePackage,
        nextSteps: generateNextSteps(completionData)
      }
    })

  } catch (error) {
    logger.error('Onboarding completion error:', { error: error })
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const cookieStore = cookies()
    const onboardingStatus = cookieStore.get('fantasy-ai-onboarding')?.value
    const userData = cookieStore.get('fantasy-ai-user-data')?.value
    
    let userInfo = null
    if (userData) {
      try {
        userInfo = JSON.parse(userData)
      } catch (e) {
        logger.error('Error parsing user data:', { error: e })
      }
    }
    
    return NextResponse.json({
      completed: onboardingStatus === 'completed',
      status: onboardingStatus || 'not-started',
      user: userInfo,
      completedAt: userInfo?.completedAt || null
    })
    
  } catch (error) {
    logger.error('Error checking completion status:', { error: error })
    return NextResponse.json(
      { error: 'Failed to check completion status' },
      { status: 500 }
    )
  }
}

function generateCompletionRecommendations(data: any) {
  const recommendations = []

  // Platform-specific first steps
  if (data.platform === 'dfs' || data.platform === 'both') {
    recommendations.push({
      id: 'dfs-terminal',
      type: 'feature',
      priority: 'high',
      title: 'Explore DFS Trading Terminal',
      description: 'Start with our Bloomberg-quality trading interface',
      action: '/dfs/terminal',
      icon: 'trending-up',
      estimatedTime: '5 min',
      category: 'getting-started'
    })

    recommendations.push({
      id: 'first-lineup',
      type: 'action',
      priority: 'high',
      title: 'Build Your First Optimized Lineup',
      description: 'Use AI to create your first winning lineup',
      action: '/dfs/optimizer',
      icon: 'target',
      estimatedTime: '10 min',
      category: 'getting-started'
    })
  }

  if (data.platform === 'traditional' || data.platform === 'both') {
    recommendations.push({
      id: 'draft-prep',
      type: 'feature',
      priority: 'high',
      title: 'Prepare for Your Next Draft',
      description: 'Access draft rankings and strategies',
      action: '/draft/prep',
      icon: 'trophy',
      estimatedTime: '15 min',
      category: 'getting-started'
    })

    if (data.importData.importedLeagues.length > 0) {
      recommendations.push({
        id: 'league-analysis',
        type: 'insight',
        priority: 'medium',
        title: 'Analyze Your Imported Leagues',
        description: `Get insights from your ${data.importData.importedLeagues.length} imported leagues`,
        action: '/leagues/analysis',
        icon: 'bar-chart',
        estimatedTime: '8 min',
        category: 'insights'
      })
    }
  }

  // Player-specific recommendations
  if (data.followingPlayers.length > 0) {
    recommendations.push({
      id: 'player-dashboard',
      type: 'feature',
      priority: 'medium',
      title: 'Check Your Player Dashboard',
      description: `Track performance for ${data.followingPlayers.length} followed players`,
      action: '/players/dashboard',
      icon: 'users',
      estimatedTime: '5 min',
      category: 'insights'
    })

    recommendations.push({
      id: 'player-alerts',
      type: 'setting',
      priority: 'low',
      title: 'Set Up Player Alerts',
      description: 'Get notified about your followed players',
      action: '/settings/alerts',
      icon: 'bell',
      estimatedTime: '3 min',
      category: 'settings'
    })
  }

  // Sport-specific recommendations
  data.selectedSports.forEach((sport: string) => {
    recommendations.push({
      id: `${sport}-projections`,
      type: 'feature',
      priority: 'medium',
      title: `Today's ${sport.toUpperCase()} Projections`,
      description: `View AI-powered predictions for ${sport.toUpperCase()}`,
      action: `/predictions?sport=${sport}`,
      icon: 'zap',
      estimatedTime: '5 min',
      category: 'daily'
    })
  })

  // Experience-based recommendations
  if (data.experienceLevel === 'beginner') {
    recommendations.push({
      id: 'fundamentals',
      type: 'education',
      priority: 'medium',
      title: 'Learn Fantasy Fundamentals',
      description: 'Master the basics with our comprehensive guide',
      action: '/education/fundamentals',
      icon: 'book',
      estimatedTime: '20 min',
      category: 'learning'
    })
  }

  return recommendations.slice(0, 6) // Return top 6 recommendations
}

function generateDashboardConfig(data: any) {
  const widgets = []

  // Always include performance overview
  widgets.push({
    id: 'performance-overview',
    type: 'chart',
    title: 'Performance Overview',
    size: 'large',
    position: { row: 0, col: 0 }
  })

  // Platform-specific widgets
  if (data.platform === 'dfs' || data.platform === 'both') {
    widgets.push({
      id: 'dfs-portfolio',
      type: 'portfolio',
      title: 'DFS Portfolio',
      size: 'medium',
      position: { row: 0, col: 1 }
    })

    widgets.push({
      id: 'bankroll-tracker',
      type: 'metric',
      title: 'Bankroll Tracker',
      size: 'small',
      position: { row: 1, col: 0 }
    })
  }

  if (data.platform === 'traditional' || data.platform === 'both') {
    widgets.push({
      id: 'league-standings',
      type: 'table',
      title: 'League Standings',
      size: 'medium',
      position: { row: 1, col: 1 }
    })
  }

  // Sport-specific widgets
  data.selectedSports.forEach((sport: string, index: number) => {
    widgets.push({
      id: `${sport}-predictions`,
      type: 'predictions',
      title: `${sport.toUpperCase()} Predictions`,
      size: 'small',
      position: { row: 2, col: index }
    })
  })

  // Following players widget
  if (data.followingPlayers.length > 0) {
    widgets.push({
      id: 'following-players',
      type: 'players',
      title: 'Following Players',
      size: 'medium',
      position: { row: 3, col: 0 }
    })
  }

  return {
    layout: 'grid',
    widgets,
    theme: 'dark',
    refreshInterval: 300000 // 5 minutes
  }
}

function createWelcomePackage(data: any) {
  return {
    welcomeMessage: {
      title: `Welcome to Fantasy AI, ${data.experienceLevel} player! 🚀`,
      subtitle: `You're all set up for ${data.platform} with ${data.selectedSports.length} sports`,
      highlights: [
        `Following ${data.followingPlayers.length} players`,
        `${data.importData.importedLeagues.length} leagues imported`,
        `${data.selectedSports.join(', ')} sports enabled`,
        `${data.experienceLevel} mode activated`
      ]
    },
    quickTips: [
      {
        title: 'Daily Workflow',
        description: 'Check projections → Build lineups → Track performance',
        icon: 'workflow'
      },
      {
        title: 'Optimization',
        description: 'Use our AI tools to maximize your win rate',
        icon: 'optimization'
      },
      {
        title: 'Community',
        description: 'Join our Discord for strategy discussions',
        icon: 'community'
      }
    ],
    bonuses: {
      freeTrialDays: data.experienceLevel === 'beginner' ? 14 : 7,
      bonusCredits: data.importData.importedLeagues.length > 0 ? 100 : 50,
      unlockFeatures: data.experienceLevel === 'expert' ? ['advanced-analytics', 'custom-models'] : ['basic-optimization']
    }
  }
}

function generateNextSteps(data: any) {
  const steps = []

  // Immediate next steps (first 24 hours)
  steps.push({
    timeframe: 'next-24h',
    title: 'Get Started Today',
    actions: [
      {
        title: 'Complete your profile',
        description: 'Add profile picture and bio',
        action: '/profile/edit',
        priority: 'low'
      },
      {
        title: 'Check today\'s projections',
        description: 'Review AI predictions for today\'s games',
        action: '/predictions/today',
        priority: 'high'
      },
      {
        title: 'Build your first lineup',
        description: 'Use the optimizer to create a winning lineup',
        action: data.platform === 'dfs' ? '/dfs/optimizer' : '/draft/rankings',
        priority: 'high'
      }
    ]
  })

  // First week steps
  steps.push({
    timeframe: 'first-week',
    title: 'Master the Basics',
    actions: [
      {
        title: 'Join the community',
        description: 'Connect with other fantasy players',
        action: '/community/join',
        priority: 'medium'
      },
      {
        title: 'Set up notifications',
        description: 'Get alerts for lineup changes and player news',
        action: '/settings/notifications',
        priority: 'medium'
      },
      {
        title: 'Try different strategies',
        description: 'Experiment with conservative and aggressive plays',
        action: '/strategies/explore',
        priority: 'medium'
      }
    ]
  })

  return steps
}