import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  priceId: string;
  features: string[];
  limits: {
    apiCalls: number;
    dfsLineups: number;
    propAnalysis: number;
    historicalData: number; // days
  };
}

export class SubscriptionService {
  private stripe: Stripe;
  private supabase: any;
  
  private tiers: Record<string, SubscriptionTier> = {
    free: {
      id: 'free',
      name: 'Free Tier',
      price: 0,
      priceId: '',
      features: [
        '10 API calls per day',
        '1 DFS lineup optimization per day',
        '5 prop analyses per day',
        '7 days historical data'
      ],
      limits: {
        apiCalls: 10,
        dfsLineups: 1,
        propAnalysis: 5,
        historicalData: 7
      }
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      price: 29.99,
      priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
      features: [
        '1000 API calls per day',
        'Unlimited DFS lineup optimizations',
        'Unlimited prop analyses',
        '90 days historical data',
        'Advanced ML models',
        'Real-time ownership projections',
        'Correlation analysis',
        'Email support'
      ],
      limits: {
        apiCalls: 1000,
        dfsLineups: -1, // unlimited
        propAnalysis: -1,
        historicalData: 90
      }
    },
    elite: {
      id: 'elite',
      name: 'Elite',
      price: 99.99,
      priceId: process.env.STRIPE_ELITE_PRICE_ID || 'price_elite_monthly',
      features: [
        'Unlimited API calls',
        'Unlimited everything',
        '365 days historical data',
        'Premium ML models',
        'Custom model training',
        'Dedicated Discord channel',
        'Early access to features',
        'Priority support',
        'Backtesting tools'
      ],
      limits: {
        apiCalls: -1,
        dfsLineups: -1,
        propAnalysis: -1,
        historicalData: 365
      }
    }
  };
  
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia'
    });
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  
  async createUser(email: string, name?: string): Promise<{ userId: string; apiKey: string }> {
    // Generate API key
    const apiKey = this.generateApiKey();
    
    // Create user in database
    const { data, error } = await this.supabase
      .from('users')
      .insert({
        email,
        name,
        api_key: apiKey,
        subscription_tier: 'free',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Create Stripe customer
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: {
        userId: data.id
      }
    });
    
    // Update user with Stripe customer ID
    await this.supabase
      .from('users')
      .update({ stripe_customer_id: customer.id })
      .eq('id', data.id);
    
    return { userId: data.id, apiKey };
  }
  
  async createCheckoutSession(userId: string, tierId: 'pro' | 'elite', successUrl: string, cancelUrl: string) {
    const tier = this.tiers[tierId];
    
    // Get user
    const { data: user } = await this.supabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();
    
    if (!user) throw new Error('User not found');
    
    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: user.stripe_customer_id,
      payment_method_types: ['card'],
      line_items: [{
        price: tier.priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tierId
      }
    });
    
    return session;
  }
  
  async handleWebhook(signature: string, rawBody: string) {
    let event: Stripe.Event;
    
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      throw new Error('Invalid webhook signature');
    }
    
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;
        
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
    }
  }
  
  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const tierId = session.metadata?.tierId;
    
    if (!userId || !tierId) return;
    
    // Update user subscription
    await this.supabase
      .from('users')
      .update({
        subscription_tier: tierId,
        subscription_status: 'active',
        subscription_id: session.subscription,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    // Log subscription event
    await this.logSubscriptionEvent(userId, 'subscription_created', { tierId });
  }
  
  private async handleSubscriptionChange(subscription: Stripe.Subscription) {
    // Find user by subscription ID
    const { data: user } = await this.supabase
      .from('users')
      .select('id')
      .eq('subscription_id', subscription.id)
      .single();
    
    if (!user) return;
    
    const status = subscription.status === 'active' ? 'active' : 'inactive';
    const tier = subscription.status === 'active' 
      ? this.getTierFromPriceId(subscription.items.data[0].price.id)
      : 'free';
    
    await this.supabase
      .from('users')
      .update({
        subscription_status: status,
        subscription_tier: tier,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    
    await this.logSubscriptionEvent(user.id, 'subscription_updated', { status, tier });
  }
  
  async validateApiKey(apiKey: string): Promise<{ valid: boolean; userId?: string; tier?: string; limits?: any }> {
    const { data: user } = await this.supabase
      .from('users')
      .select('id, subscription_tier, subscription_status')
      .eq('api_key', apiKey)
      .single();
    
    if (!user) {
      return { valid: false };
    }
    
    const tier = user.subscription_status === 'active' ? user.subscription_tier : 'free';
    const limits = this.tiers[tier].limits;
    
    return {
      valid: true,
      userId: user.id,
      tier,
      limits
    };
  }
  
  async checkRateLimit(userId: string, endpoint: string): Promise<{ allowed: boolean; remaining?: number }> {
    const today = new Date().toISOString().split('T')[0];
    const key = `rate_limit:${userId}:${endpoint}:${today}`;
    
    // Get current usage
    const { data: usage } = await this.supabase
      .from('api_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .eq('date', today)
      .single();
    
    const currentCount = usage?.count || 0;
    
    // Get user's tier limits
    const { data: user } = await this.supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    
    const tier = this.tiers[user?.subscription_tier || 'free'];
    const limit = this.getEndpointLimit(endpoint, tier);
    
    if (limit === -1 || currentCount < limit) {
      // Increment usage
      await this.supabase
        .from('api_usage')
        .upsert({
          user_id: userId,
          endpoint,
          date: today,
          count: currentCount + 1
        });
      
      return { allowed: true, remaining: limit === -1 ? -1 : limit - currentCount - 1 };
    }
    
    return { allowed: false, remaining: 0 };
  }
  
  private getEndpointLimit(endpoint: string, tier: SubscriptionTier): number {
    if (endpoint.includes('optimize')) return tier.limits.dfsLineups;
    if (endpoint.includes('prop')) return tier.limits.propAnalysis;
    return tier.limits.apiCalls;
  }
  
  private getTierFromPriceId(priceId: string): string {
    for (const [key, tier] of Object.entries(this.tiers)) {
      if (tier.priceId === priceId) return key;
    }
    return 'free';
  }
  
  private generateApiKey(): string {
    return 'fai_' + crypto.randomBytes(32).toString('hex');
  }
  
  private async logSubscriptionEvent(userId: string, event: string, metadata: any) {
    await this.supabase
      .from('subscription_events')
      .insert({
        user_id: userId,
        event,
        metadata,
        created_at: new Date().toISOString()
      });
  }
  
  getTiers() {
    return this.tiers;
  }
}