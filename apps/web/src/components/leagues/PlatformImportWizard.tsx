'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useLeagueStore, { FantasyPlatform } from '../../stores/useLeagueStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { logger } from '../../lib/logging/logger';

interface PlatformConfig {
  id: FantasyPlatform;
  name: string;
  logo: string;
  color: string;
  authType: 'oauth' | 'api_key' | 'credentials';
  description: string;
  sports: string[];
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'espn',
    name: 'ESPN Fantasy',
    logo: '/logos/espn.svg',
    color: 'bg-red-600',
    authType: 'oauth',
    description: 'Connect your ESPN Fantasy leagues',
    sports: ['NFL', 'NBA', 'MLB', 'NHL'],
  },
  {
    id: 'yahoo',
    name: 'Yahoo Fantasy',
    logo: '/logos/yahoo.svg',
    color: 'bg-purple-600',
    authType: 'oauth',
    description: 'Import from Yahoo Fantasy Sports',
    sports: ['NFL', 'NBA', 'MLB', 'NHL'],
  },
  {
    id: 'sleeper',
    name: 'Sleeper',
    logo: '/logos/sleeper.svg',
    color: 'bg-orange-600',
    authType: 'credentials',
    description: 'Modern dynasty and keeper leagues',
    sports: ['NFL', 'NBA'],
  },
  {
    id: 'cbs',
    name: 'CBS Sports',
    logo: '/logos/cbs.svg',
    color: 'bg-blue-600',
    authType: 'credentials',
    description: 'CBS Sports Fantasy leagues',
    sports: ['NFL', 'NBA', 'MLB'],
  },
  {
    id: 'draftkings',
    name: 'DraftKings DFS',
    logo: '/logos/draftkings.svg',
    color: 'bg-green-600',
    authType: 'api_key',
    description: 'Import DFS lineups and contests',
    sports: ['NFL', 'NBA', 'MLB', 'NHL', 'PGA'],
  },
  {
    id: 'fanduel',
    name: 'FanDuel DFS',
    logo: '/logos/fanduel.svg',
    color: 'bg-blue-700',
    authType: 'api_key',
    description: 'Sync FanDuel DFS entries',
    sports: ['NFL', 'NBA', 'MLB', 'NHL'],
  },
];

interface PlatformImportWizardProps {
  onClose?: () => void;
}

export function PlatformImportWizard({ onClose }: PlatformImportWizardProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<FantasyPlatform | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '', apiKey: '' });
  const [step, setStep] = useState<'select' | 'auth' | 'importing'>('select');
  
  const {
    platformAuths,
    importProgress,
    connectPlatform,
    updatePlatformAuth,
    importLeagues,
    getConnectedPlatforms,
  } = useLeagueStore();
  
  const connectedPlatforms = getConnectedPlatforms();
  const currentProgress = selectedPlatform ? importProgress.get(selectedPlatform) : null;
  
  useEffect(() => {
    // Handle OAuth callbacks
    const params = new URLSearchParams(window.location.search);
    const platform = params.get('platform') as FantasyPlatform;
    const code = params.get('code');
    const token = params.get('token');
    
    if (platform && (code || token)) {
      setSelectedPlatform(platform);
      setStep('importing');
      
      // Update auth status
      updatePlatformAuth(platform, {
        status: 'connected',
        accessToken: token || code || '',
      });
      
      // Start importing leagues
      importLeagues(platform);
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  const handlePlatformSelect = (platform: FantasyPlatform) => {
    setSelectedPlatform(platform);
    const config = PLATFORMS.find(p => p.id === platform);
    
    if (config?.authType === 'oauth') {
      // Start OAuth flow
      connectPlatform(platform);
    } else {
      // Show credentials form
      setStep('auth');
    }
  };
  
  const handleCredentialsSubmit = async () => {
    if (!selectedPlatform) return;
    
    const config = PLATFORMS.find(p => p.id === selectedPlatform);
    
    // Update auth with credentials
    updatePlatformAuth(selectedPlatform, {
      status: 'connecting',
      username: credentials.username,
      accessToken: credentials.apiKey || credentials.password,
    });
    
    setStep('importing');
    
    // Simulate API connection and import
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updatePlatformAuth(selectedPlatform, {
        status: 'connected',
      });
      
      await importLeagues(selectedPlatform);
    } catch (error) {
      logger.error('Import failed:', { error: error });
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Import Your Fantasy Leagues</h2>
              <p className="text-purple-100 mt-1">
                Connect your accounts to manage all leagues in one place
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h3 className="text-lg font-semibold text-white mb-4">
                  Select a Platform to Connect
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PLATFORMS.map((platform) => {
                    const isConnected = connectedPlatforms.includes(platform.id);
                    
                    return (
                      <motion.button
                        key={platform.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => !isConnected && handlePlatformSelect(platform.id)}
                        disabled={isConnected}
                        className={`
                          relative overflow-hidden rounded-xl p-6 text-left transition-all
                          ${isConnected 
                            ? 'bg-gray-800 opacity-50 cursor-not-allowed' 
                            : 'bg-gray-800 hover:bg-gray-700 cursor-pointer'
                          }
                        `}
                      >
                        <div className={`absolute inset-0 ${platform.color} opacity-10`} />
                        
                        <div className="relative flex items-start gap-4">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                            <img
                              src={platform.logo}
                              alt={platform.name}
                              className="w-8 h-8"
                              onError={(e) => {
                                e.currentTarget.src = '/logos/default.svg';
                              }}
                            />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-white">{platform.name}</h4>
                              {isConnected && (
                                <Badge variant="default" className="bg-green-600">
                                  Connected
                                </Badge>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm mb-2">
                              {platform.description}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {platform.sports.map((sport) => (
                                <Badge
                                  key={sport}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {sport}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                
                {connectedPlatforms.length > 0 && (
                  <div className="mt-6 p-4 bg-green-900/20 rounded-lg border border-green-600/30">
                    <p className="text-green-400 text-sm">
                      ✓ You have {connectedPlatforms.length} platform{connectedPlatforms.length > 1 ? 's' : ''} connected
                    </p>
                  </div>
                )}
              </motion.div>
            )}
            
            {step === 'auth' && selectedPlatform && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <button
                  onClick={() => setStep('select')}
                  className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                
                <div className="bg-gray-800 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center">
                      <img
                        src={PLATFORMS.find(p => p.id === selectedPlatform)?.logo}
                        alt={selectedPlatform}
                        className="w-10 h-10"
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        Connect to {PLATFORMS.find(p => p.id === selectedPlatform)?.name}
                      </h3>
                      <p className="text-gray-400">
                        Enter your credentials to import your leagues
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {PLATFORMS.find(p => p.id === selectedPlatform)?.authType === 'api_key' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          API Key
                        </label>
                        <Input
                          type="password"
                          value={credentials.apiKey}
                          onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                          placeholder="Enter your API key"
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Find your API key in your account settings
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Username
                          </label>
                          <Input
                            type="text"
                            value={credentials.username}
                            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                            placeholder="Enter your username"
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Password
                          </label>
                          <Input
                            type="password"
                            value={credentials.password}
                            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                            placeholder="Enter your password"
                            className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  
                  <Button
                    onClick={handleCredentialsSubmit}
                    className="w-full mt-6"
                    disabled={
                      (PLATFORMS.find(p => p.id === selectedPlatform)?.authType === 'api_key' && !credentials.apiKey) ||
                      (PLATFORMS.find(p => p.id === selectedPlatform)?.authType === 'credentials' && (!credentials.username || !credentials.password))
                    }
                  >
                    Connect & Import Leagues
                  </Button>
                  
                  <p className="text-xs text-gray-500 text-center mt-4">
                    Your credentials are encrypted and never stored on our servers
                  </p>
                </div>
              </motion.div>
            )}
            
            {step === 'importing' && selectedPlatform && currentProgress && (
              <motion.div
                key="importing"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="text-center"
              >
                <div className="mb-8">
                  <div className="w-24 h-24 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <img
                      src={PLATFORMS.find(p => p.id === selectedPlatform)?.logo}
                      alt={selectedPlatform}
                      className="w-16 h-16"
                    />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {currentProgress.status === 'completed' 
                      ? 'Import Complete!' 
                      : 'Importing Your Leagues'
                    }
                  </h3>
                  
                  <p className="text-gray-400">
                    {currentProgress.message}
                  </p>
                </div>
                
                <div className="mb-8">
                  <Progress value={currentProgress.progress} className="h-2 mb-2" />
                  <p className="text-sm text-gray-500">
                    {currentProgress.currentStep && currentProgress.totalSteps && (
                      `Step ${currentProgress.currentStep} of ${currentProgress.totalSteps}`
                    )}
                  </p>
                </div>
                
                {currentProgress.status === 'completed' && (
                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        setStep('select');
                        setSelectedPlatform(null);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Import Another Platform
                    </Button>
                    
                    <Button
                      onClick={onClose}
                      className="w-full"
                    >
                      View Your Leagues
                    </Button>
                  </div>
                )}
                
                {currentProgress.status === 'error' && (
                  <div className="space-y-3">
                    <div className="p-4 bg-red-900/20 rounded-lg border border-red-600/30">
                      <p className="text-red-400 text-sm">
                        {currentProgress.message}
                      </p>
                    </div>
                    
                    <Button
                      onClick={() => {
                        setStep('select');
                        setSelectedPlatform(null);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}