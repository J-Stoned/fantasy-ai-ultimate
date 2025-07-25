import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logger } from '../../../lib/logging/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const {
      platform,
      experienceLevel,
      selectedSports,
      favoriteTeams,
      playerPreferences,
      initialBankroll,
      riskTolerance,
      contestPreferences,
      maxSingleEntry,
      profile
    } = body

    if (!platform || !experienceLevel || !selectedSports?.length) {
      return NextResponse.json(
        { error: 'Missing required onboarding data' },
        { status: 400 }
      )
    }

    // In a real implementation, you would:
    // 1. Get the current user ID from session/auth
    // 2. Save to database
    // 3. Update user profile
    
    // For now, we'll simulate saving the data
    const onboardingData = {
      userId: 'user_123', // Would come from auth
      platform,
      experienceLevel,
      selectedSports,
      favoriteTeams,
      playerPreferences,
      bankroll: {
        initial: initialBankroll,
        current: initialBankroll,
        riskTolerance,
        maxSingleEntry: maxSingleEntry || Math.round(initialBankroll * 0.05)
      },
      contestPreferences,
      profile,
      completedAt: new Date().toISOString(),
      status: 'completed'
    }

    // Set a cookie to track onboarding completion
    const cookieStore = cookies()
    cookieStore.set('fantasy-ai-onboarding', 'completed', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    })

    // Log the onboarding completion (in production, save to database)
    logger.info('Onboarding completed:', { data: {
      platform,
      experienceLevel,
      sportsCount: selectedSports.length,
      bankroll: initialBankroll,
      riskTolerance,
      timestamp: new Date().toISOString()
    }})

    // Calculate initial recommendations based on their preferences
    const recommendations = generateInitialRecommendations(onboardingData)

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: onboardingData,
      recommendations
    })

  } catch (error) {
    logger.error('Onboarding error:', { error: error })
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }
}

function generateInitialRecommendations(data: any) {
  const recommendations = []

  // Platform-specific recommendations
  if (data.platform === 'dfs' || data.platform === 'both') {
    recommendations.push({
      type: 'feature',
      title: 'Start with the DFS Trading Terminal',
      description: 'Explore our Bloomberg-quality trading interface',
      action: '/dfs/terminal',
      priority: 'high'
    })
  }

  if (data.platform === 'traditional' || data.platform === 'both') {
    recommendations.push({
      type: 'feature',
      title: 'Check out Draft Analysis',
      description: 'Get ready for your next draft with AI-powered insights',
      action: '/draft',
      priority: 'high'
    })
  }

  // Experience-based recommendations
  if (data.experienceLevel === 'beginner') {
    recommendations.push({
      type: 'education',
      title: 'Fantasy Sports Basics Guide',
      description: 'Learn the fundamentals with our comprehensive guide',
      action: '/education/basics',
      priority: 'medium'
    })
  }

  // Bankroll-based recommendations
  if (data.bankroll.initial < 100) {
    recommendations.push({
      type: 'strategy',
      title: 'Small Bankroll Strategy',
      description: 'Maximize your growth with conservative cash game strategies',
      action: '/strategies/small-bankroll',
      priority: 'high'
    })
  }

  // Sport-specific recommendations
  data.selectedSports.forEach((sport: string) => {
    recommendations.push({
      type: 'prediction',
      title: `${sport.toUpperCase()} Daily Projections`,
      description: `View today's AI-powered ${sport.toUpperCase()} predictions`,
      action: `/predictions?sport=${sport}`,
      priority: 'medium'
    })
  })

  return recommendations
}

export async function GET() {
  try {
    const cookieStore = cookies()
    const onboardingStatus = cookieStore.get('fantasy-ai-onboarding')
    
    return NextResponse.json({
      completed: onboardingStatus?.value === 'completed',
      status: onboardingStatus?.value || 'not-started'
    })
  } catch (error) {
    logger.error('Error checking onboarding status:', { error: error })
    return NextResponse.json(
      { error: 'Failed to check onboarding status' },
      { status: 500 }
    )
  }
}