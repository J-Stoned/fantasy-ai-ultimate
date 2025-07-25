import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logger } from '../../../../lib/logging/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate preferences data
    const {
      sports,
      favoriteTeams,
      riskTolerance,
      platform,
      experienceLevel,
      notifications,
      autoOptimize,
      customSettings
    } = body

    // In a real implementation, you would:
    // 1. Get the current user ID from session/auth
    // 2. Validate user permissions
    // 3. Save to database with proper schema validation
    
    const preferencesData = {
      userId: 'user_123', // Would come from auth
      sports: sports || [],
      favoriteTeams: favoriteTeams || {},
      riskTolerance: riskTolerance || 'medium',
      platform: platform || 'both',
      experienceLevel: experienceLevel || 'intermediate',
      notifications: {
        email: notifications?.email ?? true,
        push: notifications?.push ?? true,
        sms: notifications?.sms ?? false,
        ...notifications
      },
      features: {
        autoOptimize: autoOptimize ?? true,
        dataSharing: body.dataSharing ?? false,
        advancedAnalytics: true,
        realTimeUpdates: true
      },
      customSettings: customSettings || {},
      updatedAt: new Date().toISOString()
    }

    // Log the preferences update
    logger.info('User preferences updated:', { data: {
      sports: preferencesData.sports,
      platform: preferencesData.platform,
      riskTolerance: preferencesData.riskTolerance,
      notificationsEnabled: Object.values(preferencesData.notifications }).some(Boolean),
      timestamp: new Date().toISOString()
    })

    // Set preference cookie for quick access
    const cookieStore = cookies()
    cookieStore.set('user-preferences', JSON.stringify({
      sports: preferencesData.sports,
      platform: preferencesData.platform,
      riskTolerance: preferencesData.riskTolerance
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      data: preferencesData
    })

  } catch (error) {
    logger.error('Preferences update error:', { error: error })
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // In a real implementation, you would:
    // 1. Get the current user ID from session/auth
    // 2. Fetch from database
    // 3. Return user's current preferences
    
    const cookieStore = cookies()
    const preferencesCookie = cookieStore.get('user-preferences')
    
    // Default preferences if none exist
    const defaultPreferences = {
      userId: 'user_123',
      sports: ['nfl'],
      favoriteTeams: {},
      riskTolerance: 'medium',
      platform: 'both',
      experienceLevel: 'intermediate',
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      features: {
        autoOptimize: true,
        dataSharing: false,
        advancedAnalytics: true,
        realTimeUpdates: true
      },
      customSettings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    let preferences = defaultPreferences
    
    if (preferencesCookie) {
      try {
        const cookieData = JSON.parse(preferencesCookie.value)
        preferences = {
          ...defaultPreferences,
          ...cookieData
        }
      } catch (e) {
        logger.error('Error parsing preferences cookie:', { error: e })
      }
    }

    return NextResponse.json({
      success: true,
      data: preferences
    })

  } catch (error) {
    logger.error('Error fetching preferences:', { error: error })
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    
    // Get current preferences
    const cookieStore = cookies()
    const preferencesCookie = cookieStore.get('user-preferences')
    
    let currentPreferences = {}
    if (preferencesCookie) {
      try {
        currentPreferences = JSON.parse(preferencesCookie.value)
      } catch (e) {
        logger.error('Error parsing current preferences:', { error: e })
      }
    }

    // Merge with updates
    const updatedPreferences = {
      ...currentPreferences,
      ...body,
      updatedAt: new Date().toISOString()
    }

    // Update cookie
    cookieStore.set('user-preferences', JSON.stringify(updatedPreferences), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    logger.info('User preferences partially updated:', { data: {
      updatedFields: Object.keys(body }),
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      data: updatedPreferences
    })

  } catch (error) {
    logger.error('Partial preferences update error:', { error: error })
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}