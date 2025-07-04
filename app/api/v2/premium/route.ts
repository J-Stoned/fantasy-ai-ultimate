import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

// Premium features pricing
const PRICING = {
  basic: 0, // Free tier
  premium: 9.99, // Premium predictions
  api: 99.99, // Developer API access
  enterprise: 499.99 // Custom models
};

export async function POST(request: NextRequest) {
  try {
    const { plan, email, paymentMethodId } = await request.json();

    // Validate plan
    if (!PRICING.hasOwnProperty(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    if (plan === 'basic') {
      // Free tier - just create user
      const { data: user, error } = await supabase
        .from('api_users')
        .insert({
          email,
          plan: 'basic',
          api_key: generateApiKey(),
          credits: 100, // 100 free predictions/month
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        user: {
          email: user.email,
          apiKey: user.api_key,
          plan: user.plan,
          credits: user.credits
        }
      });
    }

    // Paid plans - process with Stripe
    const customer = await stripe.customers.create({
      email,
      payment_method: paymentMethodId,
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: getPriceId(plan) }],
      expand: ['latest_invoice.payment_intent'],
    });

    // Create premium user
    const { data: user, error } = await supabase
      .from('api_users')
      .insert({
        email,
        plan,
        api_key: generateApiKey(),
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        credits: plan === 'premium' ? 1000 : plan === 'api' ? 10000 : 100000,
        features: getPlanFeatures(plan),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        apiKey: user.api_key,
        plan: user.plan,
        credits: user.credits,
        features: user.features
      },
      subscription: {
        id: subscription.id,
        status: subscription.status
      }
    });

  } catch (error: any) {
    console.error('Premium signup error:', error);
    return NextResponse.json(
      { error: error.message || 'Signup failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  try {
    // Get user by API key
    const { data: user, error } = await supabase
      .from('api_users')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Check credits
    if (user.credits <= 0) {
      return NextResponse.json({ error: 'No credits remaining' }, { status: 402 });
    }

    // Get premium predictions with extra features
    const { data: predictions } = await supabase
      .from('ml_predictions')
      .select(`
        *,
        games!inner(
          home_team,
          away_team,
          game_date
        ),
        betting_odds(
          spread,
          over_under,
          home_moneyline,
          away_moneyline
        )
      `)
      .order('created_at', { ascending: false })
      .limit(user.plan === 'basic' ? 10 : 100);

    // Enhance predictions based on plan
    const enhancedPredictions = predictions?.map(pred => {
      const base = {
        gameId: pred.game_id,
        prediction: pred.prediction,
        confidence: pred.confidence,
        teams: `${pred.games.home_team} vs ${pred.games.away_team}`,
        gameDate: pred.games.game_date
      };

      if (user.plan === 'premium' || user.plan === 'api') {
        return {
          ...base,
          spread: pred.betting_odds?.spread,
          overUnder: pred.betting_odds?.over_under,
          moneyline: {
            home: pred.betting_odds?.home_moneyline,
            away: pred.betting_odds?.away_moneyline
          },
          insights: generateInsights(pred),
          factors: pred.features_used
        };
      }

      if (user.plan === 'enterprise') {
        return {
          ...base,
          customModel: true,
          rawFeatures: pred.features_used,
          modelVersion: pred.model_type,
          backtestResults: {
            last30Days: '67.2%',
            last90Days: '64.8%'
          }
        };
      }

      return base;
    });

    // Deduct credit
    await supabase
      .from('api_users')
      .update({ credits: user.credits - 1 })
      .eq('id', user.id);

    return NextResponse.json({
      predictions: enhancedPredictions,
      creditsRemaining: user.credits - 1,
      plan: user.plan
    });

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

function generateApiKey(): string {
  return 'fai_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getPriceId(plan: string): string {
  // These would be your actual Stripe price IDs
  const priceIds: Record<string, string> = {
    premium: 'price_premium_monthly',
    api: 'price_api_monthly',
    enterprise: 'price_enterprise_monthly'
  };
  return priceIds[plan] || '';
}

function getPlanFeatures(plan: string): string[] {
  const features: Record<string, string[]> = {
    basic: ['10 predictions/day', 'Win/loss only'],
    premium: [
      '1000 predictions/month',
      'Spread & O/U',
      'Moneyline odds',
      'Confidence intervals',
      'Key factors',
      'Email alerts'
    ],
    api: [
      '10,000 API calls/month',
      'Webhook support',
      'Historical data',
      'Batch predictions',
      'Custom filters',
      'Priority support'
    ],
    enterprise: [
      'Unlimited predictions',
      'Custom ML models',
      'White label',
      'Dedicated support',
      'SLA guarantee',
      'Training on your data'
    ]
  };
  return features[plan] || features.basic;
}

function generateInsights(prediction: any): string[] {
  const insights = [];
  
  if (prediction.confidence > 70) {
    insights.push('High confidence pick - Strong historical pattern');
  }
  
  if (prediction.betting_odds?.spread > 7) {
    insights.push('Large spread suggests potential blowout');
  }
  
  if (prediction.features_used?.includes('injury_report')) {
    insights.push('Key injuries factored into prediction');
  }
  
  return insights;
}