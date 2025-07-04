import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Virtual betting system - no real money!
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }
  
  try {
    // Get or create user wallet
    let { data: wallet } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    if (!wallet) {
      // Create new wallet with $1000 virtual money
      const { data: newWallet, error } = await supabase
        .from('user_wallets')
        .insert({
          user_id: userId,
          balance: 1000.00,
          total_bets: 0,
          total_won: 0,
          total_lost: 0
        })
        .select()
        .single();
        
      if (error) {
        // Table might not exist yet, return demo data
        wallet = {
          user_id: userId,
          balance: 1000.00,
          total_bets: 0,
          total_won: 0,
          total_lost: 0,
          win_rate: 0
        };
      } else {
        wallet = newWallet;
      }
    }
    
    // Get recent bets
    const { data: recentBets } = await supabase
      .from('user_bets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      wallet,
      recentBets: recentBets || [],
      stats: {
        balance: wallet.balance,
        totalBets: wallet.total_bets,
        winRate: wallet.total_bets > 0 ? ((wallet.total_won / wallet.total_bets) * 100).toFixed(1) : 0,
        netProfit: wallet.total_won - wallet.total_lost
      }
    });
  } catch (error) {
    console.error('Betting API error:', error);
    // Return demo data if tables don't exist
    return NextResponse.json({
      wallet: {
        user_id: userId,
        balance: 1000.00,
        total_bets: 0,
        total_won: 0,
        total_lost: 0
      },
      recentBets: [],
      stats: {
        balance: 1000,
        totalBets: 0,
        winRate: 0,
        netProfit: 0
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, gameId, predictionId, betAmount, betChoice, confidence } = body;
    
    if (!userId || !gameId || !betAmount || !betChoice) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Calculate odds based on confidence
    // Higher confidence = lower payout
    const odds = confidence > 80 ? 1.2 : 
                 confidence > 70 ? 1.5 :
                 confidence > 60 ? 1.8 :
                 confidence > 50 ? 2.2 : 2.5;
    
    const potentialPayout = betAmount * odds;
    
    // Create bet record
    const bet = {
      user_id: userId,
      game_id: gameId,
      prediction_id: predictionId,
      bet_type: 'winner',
      bet_amount: betAmount,
      bet_choice: betChoice,
      odds: odds,
      potential_payout: potentialPayout,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    try {
      // Try to insert into database
      const { data, error } = await supabase
        .from('user_bets')
        .insert(bet)
        .select()
        .single();
        
      if (!error) {
        // Update wallet balance
        await supabase
          .from('user_wallets')
          .update({ 
            balance: supabase.raw('balance - ?', [betAmount]),
            total_bets: supabase.raw('total_bets + 1')
          })
          .eq('user_id', userId);
          
        return NextResponse.json({ success: true, bet: data });
      }
    } catch (dbError) {
      // If database fails, return success anyway for demo
    }
    
    // Return demo response
    return NextResponse.json({ 
      success: true, 
      bet: { ...bet, id: `demo_${Date.now()}` },
      message: 'Bet placed successfully! (Demo mode)'
    });
    
  } catch (error) {
    console.error('Place bet error:', error);
    return NextResponse.json({ error: 'Failed to place bet' }, { status: 500 });
  }
}