import React from 'react'
import { Card } from './Card'

export interface PlayerCardProps {
  player: {
    id: string
    firstName: string
    lastName: string
    position?: string[]
    jerseyNumber?: string
    team?: string
    imageUrl?: string
    stats?: {
      label: string
      value: string | number
    }[]
  }
  onClick?: () => void
  compact?: boolean
}

// Memoized component to prevent unnecessary re-renders in lists
export const PlayerCard: React.FC<PlayerCardProps> = React.memo(({
  player,
  onClick,
  compact = false,
}) => {
  if (compact) {
    return (
      <Card 
        hover={!!onClick} 
        className="p-4 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold">
            {player.firstName[0]}{player.lastName[0]}
          </div>
          <div className="flex-1">
            <h4 className="text-white font-semibold">
              {player.firstName} {player.lastName}
              {player.jerseyNumber && (
                <span className="text-gray-400 ml-1">#{player.jerseyNumber}</span>
              )}
            </h4>
            <p className="text-sm text-gray-400">
              {player.position?.join(', ')} • {player.team}
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card 
      hover={!!onClick} 
      gradient 
      className="p-6 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
          {player.firstName[0]}{player.lastName[0]}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">
            {player.firstName} {player.lastName}
            {player.jerseyNumber && (
              <span className="text-gray-400 ml-2">#{player.jerseyNumber}</span>
            )}
          </h3>
          <p className="text-gray-300 mb-3">
            {player.position?.join(', ')} • {player.team}
          </p>
          
          {player.stats && player.stats.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {player.stats.slice(0, 3).map((stat, index) => (
                <div key={index}>
                  <p className="text-xs text-gray-400">{stat.label}</p>
                  <p className="text-lg font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
})

// Display name for debugging
PlayerCard.displayName = 'PlayerCard'