/**
 * Stripe webhook handler
 * Processes subscription lifecycle events
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, handleSubscriptionEvent } from '../../lib/stripe/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: 'Missing webhook signature or secret' },
      { status: 400 }
    )
  }

  try {
    // Verify webhook signature
    const event = verifyWebhookSignature(body, signature, webhookSecret)
    
    console.log('Stripe webhook received:', event.type)

    // Handle the event
    const supabase = await createClient()
    
    await handleSubscriptionEvent(event, async (userId, data) => {
      // Update user subscription data in Supabase
      const { error } = await supabase
        .from('users')
        .update({
          stripe_customer_id: data.stripeCustomerId,
          stripe_subscription_id: data.stripeSubscriptionId,
          subscription_status: data.subscriptionStatus,
          subscription_current_period_end: data.subscriptionCurrentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) {
        console.error('Failed to update user subscription:', error)
      }
    })

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    )
  }
}

// Stripe webhooks require raw body
export const config = {
  api: {
    bodyParser: false,
  },
}