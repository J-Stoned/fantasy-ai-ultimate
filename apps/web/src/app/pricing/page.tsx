'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PRICING_TIERS, stripePromise } from '../../../../lib/stripe/client'
import { useAuth } from '../../../../lib/hooks/useAuth'

export default function PricingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async (tier: typeof PRICING_TIERS[keyof typeof PRICING_TIERS]) => {
    if (!user) {
      router.push('/auth?redirect=/pricing')
      return
    }

    if (tier.price === 0) {
      // Free tier - just redirect
      router.push('/dashboard')
      return
    }

    if (!tier.priceId) {
      setError('This plan is not yet available. Please check back soon!')
      return
    }

    setLoading(tier.id)
    setError(null)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: tier.priceId,
          tier: tier.id,
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Redirect to Stripe Checkout
      if (stripePromise && data.sessionId) {
        const stripe = await stripePromise
        const { error } = await stripe!.redirectToCheckout({
          sessionId: data.sessionId,
        })
        
        if (error) {
          throw error
        }
      } else {
        // Fallback to URL redirect
        window.location.href = data.url
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Choose Your Championship Plan
          </h1>
          <p className="text-xl text-gray-300">
            Start free, upgrade when you're ready to dominate
          </p>
          <p className="text-sm text-yellow-400 mt-2">
            🎉 Launch Special: Free for all users during MVP!
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Object.values(PRICING_TIERS).map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-2xl p-8 ${
                tier.id === 'pro'
                  ? 'bg-gradient-to-b from-purple-600 to-purple-800 scale-105 shadow-2xl'
                  : 'bg-white/10 backdrop-blur-lg'
              }`}
            >
              {tier.id === 'pro' && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black px-4 py-1 rounded-full text-sm font-bold">
                  MOST POPULAR
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <div className="text-4xl font-bold text-white">
                  ${tier.price}
                  <span className="text-lg font-normal text-gray-300">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-200">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier)}
                disabled={loading !== null}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                  tier.id === 'pro'
                    ? 'bg-white text-purple-700 hover:bg-gray-100'
                    : tier.id === 'elite'
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                } ${loading === tier.id ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading === tier.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Processing...
                  </span>
                ) : tier.price === 0 ? (
                  'Start Free'
                ) : (
                  'Subscribe Now'
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-8">
            Why Fantasy AI Ultimate?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-xl font-bold text-white mb-2">
                Continuous Learning AI
              </h3>
              <p className="text-gray-300">
                Our AI gets smarter every week, learning from millions of data points
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <div className="text-4xl mb-4">🎤</div>
              <h3 className="text-xl font-bold text-white mb-2">
                Voice Assistant
              </h3>
              <p className="text-gray-300">
                Just say "Hey Fantasy" and get instant advice on any decision
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-bold text-white mb-2">
                RTX 4060 Powered
              </h3>
              <p className="text-gray-300">
                GPU-accelerated predictions process data 10x faster
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-gray-400">
          <p className="mb-2">
            Cancel anytime. No hidden fees. Secure payment by Stripe.
          </p>
          <p className="text-sm">
            Questions? Email support@fantasyai.com
          </p>
        </div>
      </div>
    </div>
  )
}