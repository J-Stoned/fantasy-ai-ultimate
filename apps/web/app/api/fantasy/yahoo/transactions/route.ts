import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { YahooFantasyAPI } from '../../../lib/services/yahoo-fantasy-api'
import { z } from 'zod'

// Request validation schemas
const TransactionPlayerSchema = z.object({
  playerId: z.string(),
  transactionType: z.enum(['add', 'drop']),
  faabBid: z.number().optional()
})

const AddDropSchema = z.object({
  leagueKey: z.string(),
  teamKey: z.string(),
  transactions: z.array(TransactionPlayerSchema).min(1)
})

const TradeSchema = z.object({
  leagueKey: z.string(),
  teamKey: z.string(),
  sendingPlayers: z.array(z.string()).min(1),
  receivingPlayers: z.array(z.string()).min(1),
  targetTeamKey: z.string(),
  message: z.string().optional()
})

// Add/Drop endpoint
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    
    // Determine transaction type
    const transactionType = request.nextUrl.searchParams.get('type') || 'add-drop'

    if (transactionType === 'trade') {
      return handleTradeRequest(user.id, body, supabase)
    } else {
      return handleAddDropRequest(user.id, body, supabase)
    }

  } catch (error: any) {
    console.error('Transaction error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

async function handleAddDropRequest(userId: string, body: any, supabase: any) {
  // Validate request
  const validatedData = AddDropSchema.parse(body)

  // Get Yahoo connection
  const { data: connection, error: connectionError } = await supabase
    .from('platform_connections')
    .select('accessToken, tokenExpiresAt, isActive')
    .eq('userId', userId)
    .eq('platform', 'yahoo')
    .single()

  if (connectionError || !connection) {
    return NextResponse.json(
      { error: 'No Yahoo connection found. Please connect your Yahoo account first.' },
      { status: 404 }
    )
  }

  if (!connection.isActive) {
    return NextResponse.json(
      { error: 'Yahoo connection is inactive. Please reconnect your account.' },
      { status: 403 }
    )
  }

  // Validate transaction rules
  const validationErrors = validateAddDropRules(validatedData.transactions)
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: 'Invalid transaction', validationErrors },
      { status: 400 }
    )
  }

  // Check league settings for FAAB/waivers
  const { data: league } = await supabase
    .from('fantasy_leagues')
    .select('leagueSettings')
    .eq('platformLeagueId', validatedData.leagueKey)
    .eq('platform', 'yahoo')
    .single()

  // Validate FAAB bids if league uses FAAB
  if (league?.leagueSettings?.uses_faab) {
    const faabErrors = validateFAABBids(validatedData.transactions, league.leagueSettings)
    if (faabErrors.length > 0) {
      return NextResponse.json(
        { error: 'Invalid FAAB bids', faabErrors },
        { status: 400 }
      )
    }
  }

  // Execute transaction
  const yahooAPI = new YahooFantasyAPI(connection.accessToken, userId)
  const result = await yahooAPI.addDropPlayers(
    validatedData.leagueKey,
    validatedData.teamKey,
    validatedData.transactions
  )

  if (!result.success) {
    return NextResponse.json(
      { error: 'Failed to process transaction', details: result.error },
      { status: 500 }
    )
  }

  // Log the transaction
  await supabase.from('fantasy_transactions').insert({
    user_id: userId,
    platform: 'yahoo',
    league_key: validatedData.leagueKey,
    team_key: validatedData.teamKey,
    transaction_type: 'add_drop',
    transaction_data: validatedData.transactions,
    transaction_id: result.transactionId,
    status: 'completed',
    created_at: new Date().toISOString()
  })

  return NextResponse.json({
    success: true,
    message: 'Transaction processed successfully',
    transactionId: result.transactionId,
    data: result.data
  })
}

async function handleTradeRequest(userId: string, body: any, supabase: any) {
  // Validate trade request
  const validatedData = TradeSchema.parse(body)

  // Get Yahoo connection
  const { data: connection, error: connectionError } = await supabase
    .from('platform_connections')
    .select('accessToken, tokenExpiresAt, isActive')
    .eq('userId', userId)
    .eq('platform', 'yahoo')
    .single()

  if (connectionError || !connection) {
    return NextResponse.json(
      { error: 'No Yahoo connection found' },
      { status: 404 }
    )
  }

  // Validate trade
  const tradeErrors = validateTrade(validatedData)
  if (tradeErrors.length > 0) {
    return NextResponse.json(
      { error: 'Invalid trade', tradeErrors },
      { status: 400 }
    )
  }

  // Execute trade proposal
  const yahooAPI = new YahooFantasyAPI(connection.accessToken, userId)
  const result = await yahooAPI.proposeTrade(
    validatedData.leagueKey,
    validatedData.teamKey,
    {
      sendingPlayers: validatedData.sendingPlayers,
      receivingPlayers: validatedData.receivingPlayers,
      targetTeamKey: validatedData.targetTeamKey,
      message: validatedData.message
    }
  )

  if (!result.success) {
    return NextResponse.json(
      { error: 'Failed to propose trade', details: result.error },
      { status: 500 }
    )
  }

  // Log the trade
  await supabase.from('fantasy_transactions').insert({
    user_id: userId,
    platform: 'yahoo',
    league_key: validatedData.leagueKey,
    team_key: validatedData.teamKey,
    transaction_type: 'trade',
    transaction_data: {
      sending: validatedData.sendingPlayers,
      receiving: validatedData.receivingPlayers,
      target_team: validatedData.targetTeamKey,
      message: validatedData.message
    },
    transaction_id: result.tradeId,
    status: 'pending',
    created_at: new Date().toISOString()
  })

  return NextResponse.json({
    success: true,
    message: 'Trade proposed successfully',
    tradeId: result.tradeId,
    data: result.data
  })
}

// Get transaction history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const leagueKey = searchParams.get('leagueKey')
    const teamKey = searchParams.get('teamKey')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build query
    let query = supabase
      .from('fantasy_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'yahoo')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (leagueKey) {
      query = query.eq('league_key', leagueKey)
    }

    if (teamKey) {
      query = query.eq('team_key', teamKey)
    }

    const { data: transactions, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      transactions: transactions || []
    })

  } catch (error: any) {
    console.error('Get transactions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * Validation functions
 */
function validateAddDropRules(transactions: any[]): string[] {
  const errors: string[] = []
  
  const adds = transactions.filter(t => t.transactionType === 'add')
  const drops = transactions.filter(t => t.transactionType === 'drop')

  // Can't add and drop the same player
  const addIds = new Set(adds.map(a => a.playerId))
  const dropIds = new Set(drops.map(d => d.playerId))
  
  for (const id of addIds) {
    if (dropIds.has(id)) {
      errors.push(`Cannot add and drop the same player: ${id}`)
    }
  }

  // Check for duplicates
  const allIds = transactions.map(t => t.playerId)
  const uniqueIds = new Set(allIds)
  if (allIds.length !== uniqueIds.size) {
    errors.push('Duplicate players in transaction')
  }

  return errors
}

function validateFAABBids(transactions: any[], leagueSettings: any): string[] {
  const errors: string[] = []
  const adds = transactions.filter(t => t.transactionType === 'add')
  
  for (const add of adds) {
    if (add.faabBid !== undefined) {
      if (add.faabBid < 0) {
        errors.push(`Invalid FAAB bid for ${add.playerId}: cannot be negative`)
      }
      
      // Check against league max bid if available
      if (leagueSettings.faab_balance && add.faabBid > leagueSettings.faab_balance) {
        errors.push(`FAAB bid exceeds available balance for ${add.playerId}`)
      }
    } else if (leagueSettings.uses_faab) {
      // FAAB bid required but not provided
      errors.push(`FAAB bid required for ${add.playerId}`)
    }
  }

  return errors
}

function validateTrade(trade: any): string[] {
  const errors: string[] = []

  // Can't trade with yourself
  if (trade.teamKey === trade.targetTeamKey) {
    errors.push('Cannot trade with yourself')
  }

  // Can't send and receive the same player
  const sendingSet = new Set(trade.sendingPlayers)
  const receivingSet = new Set(trade.receivingPlayers)
  
  for (const player of sendingSet) {
    if (receivingSet.has(player)) {
      errors.push(`Cannot send and receive the same player: ${player}`)
    }
  }

  // Check for duplicates
  if (trade.sendingPlayers.length !== sendingSet.size) {
    errors.push('Duplicate players in sending list')
  }

  if (trade.receivingPlayers.length !== receivingSet.size) {
    errors.push('Duplicate players in receiving list')
  }

  return errors
}