/**
 * Stripe checkout session creation endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createCheckoutSession } from '../../lib/stripe/server'
import { PRICING_TIERS } from '../../lib/stripe/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, tier } = await request.json()

    // Validate price ID matches tier
    const selectedTier = Object.values(PRICING_TIERS).find(t => t.id === tier)
    if (!selectedTier || selectedTier.priceId !== priceId) {
      return NextResponse.json({ error: 'Invalid pricing tier' }, { status: 400 })
    }

    // Create checkout session
    const origin = request.headers.get('origin') || 'http://localhost:3000'
    const session = await createCheckoutSession(
      user.id,
      priceId,
      `${origin}/dashboard?upgraded=true`,
      `${origin}/pricing?canceled=true`
    )

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    
    if (error.message === 'Stripe is not configured') {
      return NextResponse.json({ 
        error: 'Payment system not configured. App is in free mode.' 
      }, { status: 503 })
    }
    
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}