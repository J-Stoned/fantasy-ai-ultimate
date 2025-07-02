'use client';

import { VoiceInterface } from '@/lib/components/VoiceInterface';

export default function VoiceTestPage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">
          🎤 Voice Assistant Test
        </h1>
        
        <div className="mb-8 p-6 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">🔑 Setup Instructions:</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Add your Anthropic API key to <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">.env.local</code></li>
            <li>Look for <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">ANTHROPIC_API_KEY=</code> and paste your key after the equals sign</li>
            <li>Restart the development server with <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">npm run dev</code></li>
            <li>Allow microphone access when prompted</li>
          </ol>
        </div>
        
        <VoiceInterface />
        
        <div className="mt-8 p-6 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">🚀 Features:</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Web Speech API for voice recognition (no external dependencies)</li>
            <li>Anthropic Claude for natural language understanding</li>
            <li>Browser speech synthesis for responses</li>
            <li>Wake word detection ("Hey Fantasy")</li>
            <li>Real-time voice commands for fantasy football</li>
          </ul>
        </div>
      </div>
    </div>
  );
}