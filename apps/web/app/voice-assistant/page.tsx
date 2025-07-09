'use client';

import { VoiceInterface } from '../../lib/components/VoiceInterface';
import { useState } from 'react';

export default function VoiceAssistantPage() {
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>();
  const [selectedLeague, setSelectedLeague] = useState<string | undefined>();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            🎤 Hey Fantasy Voice Assistant
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Your AI-powered fantasy sports assistant. Just ask!
          </p>
        </div>

        <VoiceInterface 
          fantasyTeamId={selectedTeam}
          leagueId={selectedLeague}
        />

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <div className="text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-semibold mb-2">Pattern Analysis</h3>
            <p className="text-gray-600 dark:text-gray-400">
              65.2% accuracy pattern engine integration
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold mb-2">Daily Fantasy</h3>
            <p className="text-gray-600 dark:text-gray-400">
              DraftKings & FanDuel optimized lineups
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-4xl mb-4">🗣️</div>
            <h3 className="text-lg font-semibold mb-2">Voice Commands</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Web Speech API with "Hey Fantasy" wake word
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-4xl mb-4">💎</div>
            <h3 className="text-lg font-semibold mb-2">Value Plays</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Sleeper picks & contrarian strategies
            </p>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="mt-16 max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">🔧 Setup Instructions</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Enable Microphone Access</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Allow microphone permissions when prompted for voice input
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">2. Wake Word Detection</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enable wake word to activate with "Hey Fantasy"
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">3. ElevenLabs API (Optional)</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Add your ElevenLabs API key in settings for voice responses
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}