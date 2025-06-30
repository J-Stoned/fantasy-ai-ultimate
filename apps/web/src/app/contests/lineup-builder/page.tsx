'use client';

import { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createComponentLogger } from '../../../../../lib/utils/client-logger';

const logger = createComponentLogger('LineupBuilderPage');

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  salary: number;
  projectedPoints: number;
  ownership: number;
  value: number; // Points per $1000
}

interface LineupSlot {
  position: string;
  player?: Player;
}

function PlayerCard({ player, onAdd }: { player: Player; onAdd?: () => void }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'player',
    item: player,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`bg-white dark:bg-gray-800 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={onAdd}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold">{player.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {player.position} • {player.team}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold">${player.salary.toLocaleString()}</div>
          <div className="text-sm text-green-600">{player.projectedPoints} pts</div>
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{player.ownership}% owned</span>
        <span>{player.value.toFixed(1)} value</span>
      </div>
    </div>
  );
}

function LineupSlotComponent({ 
  slot, 
  onDrop, 
  onRemove 
}: { 
  slot: LineupSlot; 
  onDrop: (player: Player) => void;
  onRemove: () => void;
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'player',
    drop: (player: Player) => onDrop(player),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
        isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'
      }`}
    >
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {slot.position}
      </div>
      {slot.player ? (
        <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold">{slot.player.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {slot.player.team}
              </div>
            </div>
            <button
              onClick={onRemove}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span>${slot.player.salary.toLocaleString()}</span>
            <span className="text-green-600">{slot.player.projectedPoints} pts</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          Drop player here
        </div>
      )}
    </div>
  );
}

export default function LineupBuilderPage() {
  const [lineup, setLineup] = useState<LineupSlot[]>([
    { position: 'QB' },
    { position: 'RB' },
    { position: 'RB' },
    { position: 'WR' },
    { position: 'WR' },
    { position: 'WR' },
    { position: 'TE' },
    { position: 'FLEX' },
    { position: 'DST' },
  ]);

  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('projectedPoints');
  const [salaryCap] = useState(50000);

  useEffect(() => {
    // Load available players
    loadPlayers();
  }, []);

  const loadPlayers = () => {
    // Mock player data
    const mockPlayers: Player[] = [
      {
        id: '1',
        name: 'Patrick Mahomes',
        position: 'QB',
        team: 'KC',
        salary: 8500,
        projectedPoints: 28.5,
        ownership: 18.5,
        value: 3.35,
      },
      {
        id: '2',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        salary: 8200,
        projectedPoints: 27.2,
        ownership: 22.1,
        value: 3.32,
      },
      {
        id: '3',
        name: 'Christian McCaffrey',
        position: 'RB',
        team: 'SF',
        salary: 9000,
        projectedPoints: 24.5,
        ownership: 35.2,
        value: 2.72,
      },
      {
        id: '4',
        name: 'Austin Ekeler',
        position: 'RB',
        team: 'LAC',
        salary: 7800,
        projectedPoints: 19.8,
        ownership: 28.7,
        value: 2.54,
      },
      {
        id: '5',
        name: 'Tyreek Hill',
        position: 'WR',
        team: 'MIA',
        salary: 8800,
        projectedPoints: 22.3,
        ownership: 31.2,
        value: 2.53,
      },
      {
        id: '6',
        name: 'Justin Jefferson',
        position: 'WR',
        team: 'MIN',
        salary: 8600,
        projectedPoints: 21.8,
        ownership: 29.5,
        value: 2.53,
      },
      {
        id: '7',
        name: 'Travis Kelce',
        position: 'TE',
        team: 'KC',
        salary: 7500,
        projectedPoints: 18.5,
        ownership: 42.3,
        value: 2.47,
      },
      {
        id: '8',
        name: 'Bills DST',
        position: 'DST',
        team: 'BUF',
        salary: 3200,
        projectedPoints: 9.5,
        ownership: 15.2,
        value: 2.97,
      },
      // Add more players...
    ];

    setAvailablePlayers(mockPlayers);
  };

  const handleAddPlayer = (player: Player, slotIndex: number) => {
    const newLineup = [...lineup];
    
    // Check if player fits position requirements
    const slot = newLineup[slotIndex];
    if (!canPlayPosition(player.position, slot.position)) {
      return;
    }

    // Remove player from other slots
    newLineup.forEach((s, i) => {
      if (s.player?.id === player.id) {
        newLineup[i] = { ...s, player: undefined };
      }
    });

    // Add player to new slot
    newLineup[slotIndex] = { ...slot, player };
    setLineup(newLineup);
  };

  const handleRemovePlayer = (slotIndex: number) => {
    const newLineup = [...lineup];
    newLineup[slotIndex] = { ...newLineup[slotIndex], player: undefined };
    setLineup(newLineup);
  };

  const canPlayPosition = (playerPos: string, slotPos: string): boolean => {
    if (playerPos === slotPos) return true;
    if (slotPos === 'FLEX' && ['RB', 'WR', 'TE'].includes(playerPos)) return true;
    return false;
  };

  const calculateSalaryUsed = (): number => {
    return lineup.reduce((total, slot) => total + (slot.player?.salary || 0), 0);
  };

  const calculateProjectedPoints = (): number => {
    return lineup.reduce((total, slot) => total + (slot.player?.projectedPoints || 0), 0);
  };

  const calculateAverageOwnership = (): number => {
    const filledSlots = lineup.filter(s => s.player);
    if (filledSlots.length === 0) return 0;
    
    const totalOwnership = filledSlots.reduce((total, slot) => total + (slot.player?.ownership || 0), 0);
    return totalOwnership / filledSlots.length;
  };

  const getFilteredPlayers = (): Player[] => {
    let filtered = availablePlayers;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by position
    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(p => p.position === positionFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'salary':
          return b.salary - a.salary;
        case 'projectedPoints':
          return b.projectedPoints - a.projectedPoints;
        case 'value':
          return b.value - a.value;
        case 'ownership':
          return a.ownership - b.ownership;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const optimizeLineup = () => {
    // Simple optimization algorithm
    logger.info('Optimizing lineup', { 
      currentSalaryUsed: currentSalary,
      playersInLineup: lineup.filter(p => p !== null).length
    });
    // Implementation would use dynamic programming or genetic algorithm
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">🏗️ Lineup Builder</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Build your winning lineup with our drag-and-drop interface
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Player Pool */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Player Pool</h2>
              
              {/* Filters */}
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border rounded-lg dark:bg-gray-700"
                />
                
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg dark:bg-gray-700"
                >
                  <option value="ALL">All Positions</option>
                  <option value="QB">QB</option>
                  <option value="RB">RB</option>
                  <option value="WR">WR</option>
                  <option value="TE">TE</option>
                  <option value="DST">DST</option>
                </select>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border rounded-lg dark:bg-gray-700"
                >
                  <option value="projectedPoints">Projected Points</option>
                  <option value="salary">Salary</option>
                  <option value="value">Value</option>
                  <option value="ownership">Ownership</option>
                </select>
              </div>

              {/* Player List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {getFilteredPlayers().map(player => (
                  <PlayerCard 
                    key={player.id} 
                    player={player}
                    onAdd={() => {
                      // Find first empty slot that fits
                      const emptySlotIndex = lineup.findIndex(s => 
                        !s.player && canPlayPosition(player.position, s.position)
                      );
                      if (emptySlotIndex !== -1) {
                        handleAddPlayer(player, emptySlotIndex);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Lineup */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">Your Lineup</h2>
              
              {/* Salary Info */}
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex justify-between mb-2">
                  <span>Salary Used</span>
                  <span className={`font-bold ${
                    calculateSalaryUsed() > salaryCap ? 'text-red-600' : 'text-green-600'
                  }`}>
                    ${calculateSalaryUsed().toLocaleString()} / ${salaryCap.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      calculateSalaryUsed() > salaryCap ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (calculateSalaryUsed() / salaryCap) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {calculateProjectedPoints().toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Projected Points
                  </div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                  <div className="text-2xl font-bold text-purple-600">
                    {calculateAverageOwnership().toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Avg Ownership
                  </div>
                </div>
              </div>

              {/* Lineup Slots */}
              <div className="space-y-2 mb-4">
                {lineup.map((slot, index) => (
                  <LineupSlotComponent
                    key={index}
                    slot={slot}
                    onDrop={(player) => handleAddPlayer(player, index)}
                    onRemove={() => handleRemovePlayer(index)}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={optimizeLineup}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  🤖 Optimize Lineup
                </button>
                <button
                  onClick={() => setLineup(lineup.map(s => ({ position: s.position })))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Clear All
                </button>
                <button
                  disabled={calculateSalaryUsed() > salaryCap || lineup.some(s => !s.player)}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                >
                  Submit Lineup
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
}