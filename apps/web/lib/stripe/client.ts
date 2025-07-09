/**
 * Stripe client configuration
 * Ready for payments when we decide to monetize
 */

import { loadStripe } from '@stripe/stripe-js'

// Publishable key - safe to expose client-side
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

// Initialize Stripe.js
export const stripePromise = stripePublishableKey 
  ? loadStripe(stripePublishableKey)
  : null

// Pricing tiers
export const PRICING_TIERS = {
  FREE: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      '1 Fantasy League',
      'Basic AI Predictions',
      'Manual Lineup Setting',
      'Limited Voice Commands',
      'Community Support',
    ],
    limits: {
      leagues: 1,
      aiPredictionsPerWeek: 10,
      voiceCommandsPerDay: 5,
    }
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    features: [
      'Unlimited Leagues',
      'Advanced AI Predictions',
      'Auto-Lineup Optimization',
      'Unlimited Voice Commands',
      'Real-time Injury Alerts',
      'Trade Analyzer',
      'Priority Support',
    ],
    limits: {
      leagues: -1, // unlimited
      aiPredictionsPerWeek: -1,
      voiceCommandsPerDay: -1,
    }
  },
  ELITE: {
    id: 'elite',
    name: 'Elite',
    price: 19.99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ELITE,
    features: [
      'Everything in Pro',
      'GPU-Accelerated AI Models',
      'Custom ML Training',
      'DFS Optimizer',
      'Betting Insights',
      'Discord VIP Access',
      'Phone Support',
      'Early Access Features',
    ],
    limits: {
      leagues: -1,
      aiPredictionsPerWeek: -1,
      voiceCommandsPerDay: -1,
      customModels: 5,
    }
  }
}

// Helper to get current user's tier
export function getUserTier(subscription?: any) {
  if (!subscription || subscription.status !== 'active') {
    return PRICING_TIERS.FREE
  }
  
  // Match price ID to tier
  const priceId = subscription.items?.[0]?.price?.id
  
  if (priceId === PRICING_TIERS.ELITE.priceId) {
    return PRICING_TIERS.ELITE
  } else if (priceId === PRICING_TIERS.PRO.priceId) {
    return PRICING_TIERS.PRO
  }
  
  return PRICING_TIERS.FREE
}

// Check if feature is available for tier
export function canUseFeature(userTier: string, feature: string): boolean {
  const tier = Object.values(PRICING_TIERS).find(t => t.id === userTier) || PRICING_TIERS.FREE
  
  switch (feature) {
    case 'unlimited_leagues':
      return tier.limits.leagues === -1
    case 'ai_predictions':
      return tier.limits.aiPredictionsPerWeek > 0
    case 'voice_commands':
      return tier.limits.voiceCommandsPerDay > 0
    case 'custom_models':
      return tier.id === 'elite'
    default:
      return false
  }
}