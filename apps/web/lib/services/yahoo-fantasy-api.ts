import axios, { AxiosInstance } from 'axios'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '../utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface YahooPlayer {
  player_key: string
  position: string
}

interface LineupChange {
  playerId: string
  position: string
}

interface TransactionPlayer {
  playerId: string
  transactionType: 'add' | 'drop'
  faabBid?: number
}

interface TradeProposal {
  sendingPlayers: string[]
  receivingPlayers: string[]
  targetTeamKey: string
  message?: string
}

export class YahooFantasyAPI {
  private apiUrl = 'https://fantasysports.yahooapis.com/fantasy/v2'
  private axiosInstance: AxiosInstance
  private accessToken: string
  private userId: string

  constructor(accessToken: string, userId: string) {
    this.accessToken = accessToken
    this.userId = userId
    
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/xml',
        'Accept': 'application/json'
      }
    })

    // Add response interceptor for token refresh
    this.axiosInstance.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const newToken = await this.refreshAccessToken()
          if (newToken) {
            error.config.headers['Authorization'] = `Bearer ${newToken}`
            return this.axiosInstance.request(error.config)
          }
        }
        return Promise.reject(error)
      }
    )
  }

  /**
   * Update lineup positions for a fantasy team
   */
  async updateLineup(
    teamKey: string,
    changes: LineupChange[],
    coverageType: 'week' | 'date',
    coverageValue: string | number
  ) {
    try {
      // Build XML payload for lineup changes
      const xmlPayload = this.buildLineupXML(changes, coverageType, coverageValue)
      
      apiLogger.info('Updating Yahoo lineup', { teamKey, changes: changes.length })
      
      const response = await this.axiosInstance.put(
        `/team/${teamKey}/roster`,
        xmlPayload,
        {
          headers: {
            'Content-Type': 'application/xml'
          }
        }
      )

      // Update last write timestamp
      await this.updateLastWrite()

      return {
        success: true,
        data: response.data
      }
    } catch (error: any) {
      apiLogger.error('Failed to update lineup', error)
      return {
        success: false,
        error: error.response?.data || error.message
      }
    }
  }

  /**
   * Add/Drop players (waiver wire transactions)
   */
  async addDropPlayers(
    leagueKey: string,
    teamKey: string,
    transactions: TransactionPlayer[]
  ) {
    try {
      const adds = transactions.filter(t => t.transactionType === 'add')
      const drops = transactions.filter(t => t.transactionType === 'drop')

      if (adds.length === 0 && drops.length === 0) {
        return { success: false, error: 'No transactions to process' }
      }

      // Build transaction XML
      const xmlPayload = this.buildTransactionXML(teamKey, adds, drops)
      
      apiLogger.info('Processing Yahoo transactions', { 
        leagueKey, 
        adds: adds.length, 
        drops: drops.length 
      })

      const response = await this.axiosInstance.post(
        `/league/${leagueKey}/transactions`,
        xmlPayload,
        {
          headers: {
            'Content-Type': 'application/xml'
          }
        }
      )

      // Log transaction in our database
      await this.logTransaction(leagueKey, teamKey, transactions, response.data)
      await this.updateLastWrite()

      return {
        success: true,
        transactionId: response.data?.fantasy_content?.transaction?.transaction_id,
        data: response.data
      }
    } catch (error: any) {
      apiLogger.error('Failed to process transactions', error)
      return {
        success: false,
        error: error.response?.data || error.message
      }
    }
  }

  /**
   * Propose a trade
   */
  async proposeTrade(
    leagueKey: string,
    teamKey: string,
    trade: TradeProposal
  ) {
    try {
      const xmlPayload = this.buildTradeXML(teamKey, trade)
      
      apiLogger.info('Proposing Yahoo trade', { 
        leagueKey,
        sending: trade.sendingPlayers.length,
        receiving: trade.receivingPlayers.length
      })

      const response = await this.axiosInstance.post(
        `/league/${leagueKey}/transactions`,
        xmlPayload,
        {
          headers: {
            'Content-Type': 'application/xml'
          }
        }
      )

      await this.updateLastWrite()

      return {
        success: true,
        tradeId: response.data?.fantasy_content?.transaction?.transaction_id,
        data: response.data
      }
    } catch (error: any) {
      apiLogger.error('Failed to propose trade', error)
      return {
        success: false,
        error: error.response?.data || error.message
      }
    }
  }

  /**
   * Get current roster with positions
   */
  async getCurrentRoster(teamKey: string, date?: string) {
    try {
      const params = date ? `?date=${date}` : ''
      const response = await this.axiosInstance.get(`/team/${teamKey}/roster${params}`)
      
      return {
        success: true,
        roster: this.parseRosterResponse(response.data)
      }
    } catch (error: any) {
      apiLogger.error('Failed to fetch roster', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Build XML for lineup changes
   */
  private buildLineupXML(
    changes: LineupChange[],
    coverageType: 'week' | 'date',
    coverageValue: string | number
  ): string {
    const players = changes.map(change => `
      <player>
        <player_key>${change.playerId}</player_key>
        <position>${change.position}</position>
      </player>
    `).join('')

    return `<?xml version="1.0"?>
<fantasy_content>
  <roster>
    <coverage_type>${coverageType}</coverage_type>
    <${coverageType}>${coverageValue}</${coverageType}>
    <players>
      ${players}
    </players>
  </roster>
</fantasy_content>`
  }

  /**
   * Build XML for add/drop transactions
   */
  private buildTransactionXML(
    teamKey: string,
    adds: TransactionPlayer[],
    drops: TransactionPlayer[]
  ): string {
    const players = []

    // Add players
    for (const add of adds) {
      players.push(`
        <player>
          <player_key>${add.playerId}</player_key>
          <transaction_data>
            <type>add</type>
            <destination_team_key>${teamKey}</destination_team_key>
            ${add.faabBid ? `<faab_bid>${add.faabBid}</faab_bid>` : ''}
          </transaction_data>
        </player>
      `)
    }

    // Drop players
    for (const drop of drops) {
      players.push(`
        <player>
          <player_key>${drop.playerId}</player_key>
          <transaction_data>
            <type>drop</type>
            <source_team_key>${teamKey}</source_team_key>
          </transaction_data>
        </player>
      `)
    }

    return `<?xml version="1.0"?>
<fantasy_content>
  <transaction>
    <type>${adds.length > 0 && drops.length > 0 ? 'add/drop' : adds.length > 0 ? 'add' : 'drop'}</type>
    <players>
      ${players.join('')}
    </players>
  </transaction>
</fantasy_content>`
  }

  /**
   * Build XML for trade proposal
   */
  private buildTradeXML(teamKey: string, trade: TradeProposal): string {
    const players = []

    // Players being sent
    for (const playerId of trade.sendingPlayers) {
      players.push(`
        <player>
          <player_key>${playerId}</player_key>
          <transaction_data>
            <type>pending_trade</type>
            <source_team_key>${teamKey}</source_team_key>
            <destination_team_key>${trade.targetTeamKey}</destination_team_key>
          </transaction_data>
        </player>
      `)
    }

    // Players being received
    for (const playerId of trade.receivingPlayers) {
      players.push(`
        <player>
          <player_key>${playerId}</player_key>
          <transaction_data>
            <type>pending_trade</type>
            <source_team_key>${trade.targetTeamKey}</source_team_key>
            <destination_team_key>${teamKey}</destination_team_key>
          </transaction_data>
        </player>
      `)
    }

    return `<?xml version="1.0"?>
<fantasy_content>
  <transaction>
    <type>pending_trade</type>
    ${trade.message ? `<trader_team_message>${trade.message}</trader_team_message>` : ''}
    <players>
      ${players.join('')}
    </players>
  </transaction>
</fantasy_content>`
  }

  /**
   * Refresh expired access token
   */
  private async refreshAccessToken(): Promise<string | null> {
    try {
      // Get refresh token from database
      const { data: connection } = await supabase
        .from('platform_connections')
        .select('refresh_token')
        .eq('user_id', this.userId)
        .eq('platform', 'yahoo')
        .single()

      if (!connection?.refresh_token) {
        throw new Error('No refresh token available')
      }

      // Exchange refresh token for new access token
      const response = await axios.post('https://api.login.yahoo.com/oauth2/get_token', {
        client_id: process.env.YAHOO_CLIENT_ID,
        client_secret: process.env.YAHOO_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token'
      })

      const { access_token, expires_in } = response.data

      // Update stored tokens
      await supabase
        .from('platform_connections')
        .update({
          access_token: access_token,
          token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
        })
        .eq('user_id', this.userId)
        .eq('platform', 'yahoo')

      this.accessToken = access_token
      this.axiosInstance.defaults.headers['Authorization'] = `Bearer ${access_token}`

      return access_token
    } catch (error) {
      apiLogger.error('Failed to refresh Yahoo token', error)
      return null
    }
  }

  /**
   * Parse roster response from Yahoo API
   */
  private parseRosterResponse(data: any): YahooPlayer[] {
    try {
      const players = data?.fantasy_content?.team?.[1]?.roster?.[0]?.players || {}
      const roster: YahooPlayer[] = []

      // Yahoo returns players in a numbered object
      for (let i = 0; i < players.count; i++) {
        const player = players[i]?.player
        if (player) {
          roster.push({
            player_key: player[0].player_key,
            position: player[1]?.selected_position?.[1]?.position || 'BN'
          })
        }
      }

      return roster
    } catch (error) {
      apiLogger.error('Failed to parse roster response', error)
      return []
    }
  }

  /**
   * Log transaction to database
   */
  private async logTransaction(
    leagueKey: string,
    teamKey: string,
    transactions: TransactionPlayer[],
    response: any
  ) {
    try {
      await supabase.from('yahoo_transactions').insert({
        user_id: this.userId,
        league_key: leagueKey,
        team_key: teamKey,
        transaction_type: transactions.some(t => t.transactionType === 'add') ? 
          (transactions.some(t => t.transactionType === 'drop') ? 'add_drop' : 'add') : 'drop',
        players: transactions,
        response_data: response,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      apiLogger.error('Failed to log transaction', error)
    }
  }

  /**
   * Update last write timestamp
   */
  private async updateLastWrite() {
    try {
      await supabase
        .from('platform_connections')
        .update({
          lastWriteAt: new Date().toISOString()
        })
        .eq('user_id', this.userId)
        .eq('platform', 'yahoo')
    } catch (error) {
      apiLogger.error('Failed to update last write timestamp', error)
    }
  }
}