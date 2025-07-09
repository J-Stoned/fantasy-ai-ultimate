/**
 * Stripe server-side configuration
 * Handles subscriptions, webhooks, and payment processing
 */

import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  Stripe secret key not configured - payments disabled')
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    })
  : null

// Create a checkout session
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  if (!stripe) {
    throw new Error('Stripe is not configured')
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: undefined, // Will be set from user data
    client_reference_id: userId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
    subscription_data: {
      trial_period_days: 7, // Free trial
      metadata: {
        userId,
      },
    },
  })

  return session
}

// Create a portal session for subscription management
export async function createPortalSession(
  customerId: string,
  returnUrl: string
) {
  if (!stripe) {
    throw new Error('Stripe is not configured')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}

// Get subscription details
export async function getSubscription(subscriptionId: string) {
  if (!stripe) {
    return null
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price', 'customer'],
    })
    return subscription
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return null
  }
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string) {
  if (!stripe) {
    throw new Error('Stripe is not configured')
  }

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })

  return subscription
}

// Webhook signature verification
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  if (!stripe) {
    throw new Error('Stripe is not configured')
  }

  return stripe.webhooks.constructEvent(payload, signature, secret)
}

// Handle subscription lifecycle events
export async function handleSubscriptionEvent(
  event: Stripe.Event,
  updateUser: (userId: string, data: any) => Promise<void>
) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata.userId
      
      if (userId) {
        await updateUser(userId, {
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        })
      }
      break
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata.userId
      
      if (userId) {
        await updateUser(userId, {
          stripeSubscriptionId: null,
          subscriptionStatus: 'canceled',
          subscriptionCurrentPeriodEnd: null,
        })
      }
      break
    }
    
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      // Log successful payment
      console.log('Payment succeeded for invoice:', invoice.id)
      break
    }
    
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // Handle failed payment - could send email notification
      console.error('Payment failed for invoice:', invoice.id)
      break
    }
  }
}