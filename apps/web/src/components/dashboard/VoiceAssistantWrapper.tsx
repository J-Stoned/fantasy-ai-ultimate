'use client';

import { VoiceInterface } from '../VoiceInterface';
import { logger } from '../../lib/logging/logger';

interface VoiceAssistantWrapperProps {
  fantasyTeamId?: string;
  leagueId?: string;
}

export function VoiceAssistantWrapper({ fantasyTeamId, leagueId }: VoiceAssistantWrapperProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-1 border border-white/20 shadow-2xl">
        <VoiceInterface 
          fantasyTeamId={fantasyTeamId} 
          leagueId={leagueId}
          onCommandProcessed={(response) => {
            logger.info('Voice command processed:', { data: response });
            // TODO: Handle navigation or state updates based on response
          }}
        />
      </div>
    </div>
  );
}