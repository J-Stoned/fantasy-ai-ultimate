/**
 * Example of using dependency injection in a service and component
 */

import { Injectable, Inject } from '../container';
import { SERVICE_TOKENS, IDatabase, ICache, ILogger } from '../interfaces';
import { useService, useLogger } from '../DIProvider';
import { useEffect, useState } from 'react';

// Player interface
interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  sport: string;
}

// Player service using dependency injection
@Injectable({ singleton: true })
export class PlayerService {
  constructor(
    @Inject(SERVICE_TOKENS.Database) private db: IDatabase,
    @Inject(SERVICE_TOKENS.Cache) private cache: ICache,
    @Inject(SERVICE_TOKENS.Logger) private logger: ILogger
  ) {}

  async getPlayer(id: string): Promise<Player | null> {
    // Check cache first
    const cacheKey = `player:${id}`;
    const cached = await this.cache.get<Player>(cacheKey);
    
    if (cached) {
      this.logger.debug('Player cache hit', { id });
      return cached;
    }

    // Query database
    try {
      const player = await this.db.queryOne<Player>(
        'SELECT * FROM players WHERE id = $1',
        [id]
      );

      if (player) {
        // Cache for 1 hour
        await this.cache.set(cacheKey, player, 3600);
      }

      return player;
    } catch (error) {
      this.logger.error('Failed to get player', error, { id });
      throw error;
    }
  }

  async searchPlayers(query: string, sport?: string): Promise<Player[]> {
    const cacheKey = `player-search:${query}:${sport || 'all'}`;
    const cached = await this.cache.get<Player[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      let sql = 'SELECT * FROM players WHERE name ILIKE $1';
      const params: any[] = [`%${query}%`];

      if (sport) {
        sql += ' AND sport = $2';
        params.push(sport);
      }

      sql += ' LIMIT 50';

      const players = await this.db.query<Player>(sql, params);
      
      // Cache for 5 minutes
      await this.cache.set(cacheKey, players, 300);
      
      return players;
    } catch (error) {
      this.logger.error('Failed to search players', error, { query, sport });
      throw error;
    }
  }
}

// React component using the service
export function PlayerSearch() {
  const logger = useLogger();
  const playerService = useService<PlayerService>(PlayerService);
  
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 3) {
      setPlayers([]);
      return;
    }

    const searchPlayers = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const results = await playerService.searchPlayers(query);
        setPlayers(results);
        logger.info('Player search completed', { query, results: results.length });
      } catch (err) {
        setError('Failed to search players');
        logger.error('Player search error', err);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchPlayers, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, playerService, logger]);

  return (
    <div className="player-search">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search players..."
        className="w-full p-2 border rounded"
      />
      
      {loading && <div>Searching...</div>}
      {error && <div className="text-red-500">{error}</div>}
      
      <div className="mt-4">
        {players.map((player) => (
          <div key={player.id} className="p-2 border-b">
            <div className="font-semibold">{player.name}</div>
            <div className="text-sm text-gray-600">
              {player.position} - {player.team} ({player.sport})
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Example of testing with dependency injection
export function createMockPlayerService(): PlayerService {
  const mockDb = {
    query: jest.fn().mockResolvedValue([]),
    queryOne: jest.fn().mockResolvedValue(null),
    execute: jest.fn().mockResolvedValue(0),
    transaction: jest.fn(),
  };

  const mockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    has: jest.fn().mockResolvedValue(false),
  };

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return new PlayerService(mockDb, mockCache, mockLogger);
}