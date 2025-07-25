'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  CheckCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  TrophyIcon,
  UsersIcon,
  CogIcon,
  ClockIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  StarIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import { LeagueSettingsGuide } from './LeagueSettingsGuide';
import { SettingWithTooltip, LEAGUE_TOOLTIPS } from './LeagueTooltip';
import { logger } from '../../lib/logging/logger';

// Types
interface LeagueSettings {
  // Step 1: League Basics
  name: string;
  description: string;
  privacy: 'public' | 'private' | 'invite-only';
  password?: string;
  
  // Step 2: League Type
  leagueType: 'redraft' | 'keeper' | 'dynasty' | 'salary-cap' | 'idp';
  sport: 'nfl' | 'nba' | 'mlb' | 'nhl';
  
  // Step 3: Scoring System
  scoringType: 'standard' | 'ppr' | 'half-ppr' | 'custom' | 'superflex';
  customScoring?: Record<string, number>;
  
  // Step 4: Roster Settings
  teamCount: number;
  rosterSettings: {
    qb: number;
    rb: number;
    wr: number;
    te: number;
    flex: number;
    superflex?: number;
    k: number;
    def: number;
    bench: number;
    ir: number;
    taxi?: number;
  };
  
  // Step 5: Draft Settings
  draftType: 'snake' | 'auction' | 'linear';
  draftDate?: Date;
  draftTime?: string;
  draftOrderType: 'random' | 'custom';
  auctionBudget?: number;
  
  // Step 6: Playoff Settings
  playoffTeams: number;
  playoffWeeks: number;
  championshipWeek: number;
  playoffSeeding: 'record' | 'points' | 'h2h';
  
  // Step 7: Waiver Settings
  waiverType: 'faab' | 'priority' | 'free-agent';
  faabBudget?: number;
  waiverPeriod: number;
  waiverProcessing: 'daily' | 'sunday-tuesday' | 'manual';
  
  // Step 8: Trade Settings
  tradeDeadline: string;
  tradeReview: 'commissioner' | 'league-vote' | 'none';
  tradeVotingPeriod?: number;
  tradeProtests: boolean;
  
  // Step 9: Advanced Rules
  rookieDraft?: boolean;
  contractSystem?: boolean;
  salaryRetention?: number;
  minimumKeepers?: number;
  maximumKeepers?: number;
  
  // Step 10: Review
  confirmed: boolean;
}

const STEP_ICONS = [
  DocumentTextIcon, // League Basics
  TrophyIcon, // League Type
  StarIcon, // Scoring System
  UsersIcon, // Roster Settings
  ClockIcon, // Draft Settings
  ShieldCheckIcon, // Playoff Settings
  CogIcon, // Waiver Settings
  InformationCircleIcon, // Trade Settings
  SparklesIcon, // Advanced Rules
  CheckCircleIcon, // Review & Create
];

const STEPS = [
  { title: 'League Basics', description: 'Name, privacy, and description' },
  { title: 'League Type', description: 'Sport and league format' },
  { title: 'Scoring System', description: 'Scoring rules and bonuses' },
  { title: 'Roster Settings', description: 'Starting lineup and bench' },
  { title: 'Draft Settings', description: 'Draft type, date, and format' },
  { title: 'Playoff Structure', description: 'Tournament bracket setup' },
  { title: 'Waiver Settings', description: 'Free agent acquisition' },
  { title: 'Trade Settings', description: 'Trading rules and deadlines' },
  { title: 'Advanced Rules', description: 'Keepers, contracts, and extras' },
  { title: 'Review & Create', description: 'Confirm and launch league' },
];

const DEFAULT_SETTINGS: LeagueSettings = {
  name: '',
  description: '',
  privacy: 'private',
  leagueType: 'redraft',
  sport: 'nfl',
  scoringType: 'ppr',
  teamCount: 12,
  rosterSettings: {
    qb: 1,
    rb: 2,
    wr: 2,
    te: 1,
    flex: 1,
    k: 1,
    def: 1,
    bench: 6,
    ir: 1,
  },
  draftType: 'snake',
  draftOrderType: 'random',
  playoffTeams: 6,
  playoffWeeks: 3,
  championshipWeek: 17,
  playoffSeeding: 'record',
  waiverType: 'faab',
  faabBudget: 100,
  waiverPeriod: 1,
  waiverProcessing: 'daily',
  tradeDeadline: 'week-12',
  tradeReview: 'commissioner',
  tradeProtests: true,
  confirmed: false,
};

export function LeagueCreationWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [settings, setSettings] = useState<LeagueSettings>(DEFAULT_SETTINGS);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Validation
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    switch (step) {
      case 0: // League Basics
        if (!settings.name.trim()) errors.name = 'League name is required';
        if (settings.name.length > 50) errors.name = 'League name must be 50 characters or less';
        if (settings.privacy === 'private' && !settings.password) {
          errors.password = 'Password required for private leagues';
        }
        break;
      case 1: // League Type
        // Auto-valid with defaults
        break;
      case 2: // Scoring System
        if (settings.scoringType === 'custom' && !settings.customScoring) {
          errors.customScoring = 'Custom scoring rules required';
        }
        break;
      case 3: // Roster Settings
        const totalStarters = Object.values(settings.rosterSettings).reduce((sum, val) => sum + (val || 0), 0) - settings.rosterSettings.bench - settings.rosterSettings.ir - (settings.rosterSettings.taxi || 0);
        if (totalStarters < 7) errors.roster = 'Must have at least 7 starting positions';
        if (totalStarters > 15) errors.roster = 'Cannot have more than 15 starting positions';
        break;
      case 4: // Draft Settings
        if (settings.draftType !== 'auction' && settings.auctionBudget) {
          delete settings.auctionBudget;
        }
        break;
      case 5: // Playoff Settings
        if (settings.playoffTeams >= settings.teamCount) {
          errors.playoffs = 'Playoff teams must be less than total teams';
        }
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const updateSettings = (updates: Partial<LeagueSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setValidationErrors({});
    
    // Run real-time validation for certain fields
    if (updates.rosterSettings || updates.teamCount) {
      validateSettingsRealTime('roster', { ...settings, ...updates });
    }
  };

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/leagues/templates');
        const data = await response.json();
        if (data.success) {
          setTemplates(data.templates);
        }
      } catch (error) {
        logger.error('Failed to load templates:', { error: error });
      }
    };
    loadTemplates();
  }, []);

  // Apply template
  const applyTemplate = async (templateId: string) => {
    try {
      const response = await fetch('/api/leagues/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      
      const data = await response.json();
      if (data.success) {
        setSettings({ ...data.template.settings, name: '', description: data.template.description });
        setShowTemplates(false);
        setCurrentStep(0);
      }
    } catch (error) {
      logger.error('Failed to apply template:', { error: error });
    }
  };

  // Real-time validation
  const validateSettingsRealTime = async (step: string, currentSettings: LeagueSettings) => {
    try {
      const response = await fetch('/api/leagues/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, settings: currentSettings }),
      });
      
      const data = await response.json();
      setValidationResults(data);
    } catch (error) {
      logger.error('Validation failed:', { error: error });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/leagues/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        const league = await response.json();
        // Redirect to new league
        window.location.href = `/leagues/${league.id}`;
      } else {
        const error = await response.json();
        setValidationErrors({ submit: error.message });
      }
    } catch (error) {
      setValidationErrors({ submit: 'Failed to create league. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Card className="min-h-[600px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <TrophyIcon className="w-8 h-8 text-primary-500" />
            League Creation Wizard
          </CardTitle>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-2"
            >
              <QuestionMarkCircleIcon className="w-4 h-4" />
              Help Guide
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-2"
            >
              <SparklesIcon className="w-4 h-4" />
              Use Template
            </Button>
            <div className="text-sm text-gray-400">
              Step {currentStep + 1} of {STEPS.length}
            </div>
          </div>
        </div>
        <Progress value={progress} className="mt-4" />
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Steps Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {STEPS.map((step, index) => {
                const Icon = STEP_ICONS[index];
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                const isDisabled = index > currentStep;

                return (
                  <button
                    key={index}
                    onClick={() => !isDisabled && setCurrentStep(index)}
                    disabled={isDisabled}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
                      ${isActive ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' : ''}
                      ${isCompleted ? 'bg-green-500/10 border-green-500/30 text-green-300' : ''}
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5'}
                      border border-transparent
                    `}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{step.title}</div>
                      <div className="text-xs text-gray-500 truncate">{step.description}</div>
                    </div>
                    {isCompleted && (
                      <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Step Content */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {currentStep === 0 && <LeagueBasicsStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
                {currentStep === 1 && <LeagueTypeStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
                {currentStep === 2 && <ScoringSystemStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
                {currentStep === 3 && <RosterSettingsStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
                {currentStep === 4 && <DraftSettingsStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
                {currentStep === 5 && <PlayoffSettingsStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
                {currentStep === 6 && <WaiverSettingsStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
                {currentStep === 7 && <TradeSettingsStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
                {currentStep === 8 && <AdvancedRulesStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
                {currentStep === 9 && <ReviewStep settings={settings} updateSettings={updateSettings} errors={validationErrors} validationResults={validationResults} />}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-800">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-2"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Previous
              </Button>

              <div className="flex items-center gap-4">
                {validationErrors.submit && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    {validationErrors.submit}
                  </div>
                )}

                {currentStep === STEPS.length - 1 ? (
                  <Button
                    onClick={handleSubmit}
                    loading={isLoading}
                    className="flex items-center gap-2"
                  >
                    <TrophyIcon className="w-4 h-4" />
                    Create League
                  </Button>
                ) : (
                  <Button
                    onClick={nextStep}
                    className="flex items-center gap-2"
                  >
                    Next
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Template Selection Modal */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Choose a Template</h3>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <motion.button
                    key={template.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => applyTemplate(template.id)}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-left hover:border-primary-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-white text-lg">{template.name}</h4>
                      <div className="flex items-center gap-1 text-xs text-green-400">
                        <StarIcon className="w-3 h-3" />
                        {template.popularity}%
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{template.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                        {template.sport.toUpperCase()}
                      </span>
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                        {template.leagueType}
                      </span>
                      <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded">
                        {template.teamCount} teams
                      </span>
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded">
                        {template.scoringType}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Guide Modal */}
      <LeagueSettingsGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </Card>
  );
}

// Step Components
function LeagueBasicsStep({ settings, updateSettings, errors }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">League Basics</h3>
        <p className="text-gray-400 mb-6">Set up the fundamental details of your league</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            League Name *
          </label>
          <Input
            value={settings.name}
            onChange={(e) => updateSettings({ name: e.target.value })}
            placeholder="Enter your league name"
            variant={errors.name ? 'error' : 'default'}
          />
          {errors.name && (
            <p className="text-red-400 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            League Description
          </label>
          <textarea
            value={settings.description}
            onChange={(e) => updateSettings({ description: e.target.value })}
            placeholder="Describe your league (optional)"
            rows={3}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-gray-100 placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Privacy Setting
          </label>
          <Select
            value={settings.privacy}
            onChange={(e) => updateSettings({ privacy: e.target.value as any })}
          >
            <option value="public">Public - Anyone can join</option>
            <option value="private">Private - Password required</option>
            <option value="invite-only">Invite Only - Commissioner approval</option>
          </Select>
        </div>

        {settings.privacy === 'private' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              League Password *
            </label>
            <Input
              type="password"
              value={settings.password || ''}
              onChange={(e) => updateSettings({ password: e.target.value })}
              placeholder="Enter league password"
              variant={errors.password ? 'error' : 'default'}
            />
            {errors.password && (
              <p className="text-red-400 text-sm mt-1">{errors.password}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LeagueTypeStep({ settings, updateSettings, errors }: any) {
  const leagueTypeInfo = {
    redraft: 'Traditional league - draft all new players each year',
    keeper: 'Keep a limited number of players from previous season',
    dynasty: 'Keep entire roster, focus on long-term player value',
    'salary-cap': 'Manage a salary budget with player contracts',
    idp: 'Individual Defensive Players instead of team defenses'
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">League Type & Sport</h3>
        <p className="text-gray-400 mb-6">Choose your sport and league format</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Sport
          </label>
          <Select
            value={settings.sport}
            onChange={(e) => updateSettings({ sport: e.target.value as any })}
          >
            <option value="nfl">NFL - National Football League</option>
            <option value="nba">NBA - National Basketball Association</option>
            <option value="mlb">MLB - Major League Baseball</option>
            <option value="nhl">NHL - National Hockey League</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            League Format
          </label>
          <Select
            value={settings.leagueType}
            onChange={(e) => updateSettings({ leagueType: e.target.value as any })}
          >
            <option value="redraft">Redraft League</option>
            <option value="keeper">Keeper League</option>
            <option value="dynasty">Dynasty League</option>
            <option value="salary-cap">Salary Cap League</option>
            <option value="idp">IDP League</option>
          </Select>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-300 mb-1">
              {settings.leagueType.replace('-', ' ').toUpperCase()} League
            </h4>
            <p className="text-blue-200 text-sm">
              {leagueTypeInfo[settings.leagueType]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoringSystemStep({ settings, updateSettings, errors }: any) {
  const scoringInfo = {
    standard: 'Basic scoring - no points for receptions',
    ppr: 'Point Per Reception - 1 point for each catch',
    'half-ppr': 'Half Point Per Reception - 0.5 points per catch',
    superflex: 'Extra flex position that can start a QB',
    custom: 'Create your own scoring system'
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Scoring System</h3>
        <p className="text-gray-400 mb-6">Configure how players score points</p>
      </div>

      <div>
        <SettingWithTooltip 
          label="Scoring Type" 
          tooltip="Different scoring systems change player values significantly. PPR makes pass-catchers more valuable, SuperFlex makes QBs premium."
        >
          <div className="mt-3" /></SettingWithTooltip>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(scoringInfo).map(([type, info]) => (
            <button
              key={type}
              onClick={() => updateSettings({ scoringType: type as any })}
              className={`
                p-4 rounded-lg border-2 text-left transition-all
                ${settings.scoringType === type 
                  ? 'border-primary-500 bg-primary-500/10' 
                  : 'border-gray-700 hover:border-gray-600'
                }
              `}
            >
              <div className="font-medium text-white mb-1 capitalize">
                {type.replace('-', ' ')}
              </div>
              <div className="text-sm text-gray-400">{info}</div>
            </button>
          ))}
        </div>
      </div>

      {settings.scoringType === 'custom' && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Custom Scoring Rules</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Passing TD</label>
              <Input inputSize="sm" type="number" defaultValue="4" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rushing TD</label>
              <Input inputSize="sm" type="number" defaultValue="6" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Receiving TD</label>
              <Input inputSize="sm" type="number" defaultValue="6" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Reception</label>
              <Input inputSize="sm" type="number" step="0.1" defaultValue="1" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Pass Yard</label>
              <Input inputSize="sm" type="number" step="0.01" defaultValue="0.04" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rush/Rec Yard</label>
              <Input inputSize="sm" type="number" step="0.01" defaultValue="0.1" />
            </div>
          </div>
        </div>
      )}

      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <StarIcon className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-green-300 mb-1">Recommended: PPR Scoring</h4>
            <p className="text-green-200 text-sm">
              PPR scoring is the most popular format, making pass-catching backs and slot receivers more valuable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RosterSettingsStep({ settings, updateSettings, errors }: any) {
  const updateRosterSetting = (key: string, value: number) => {
    updateSettings({
      rosterSettings: {
        ...settings.rosterSettings,
        [key]: value
      }
    });
  };

  const totalStarters = Object.entries(settings.rosterSettings)
    .filter(([key]) => !['bench', 'ir', 'taxi'].includes(key))
    .reduce((sum, [, value]) => sum + (value || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibent text-white mb-4">Roster Settings</h3>
        <p className="text-gray-400 mb-6">Configure starting lineup and bench sizes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Number of Teams
          </label>
          <Select
            value={settings.teamCount.toString()}
            onChange={(e) => updateSettings({ teamCount: parseInt(e.target.value) })}
          >
            {[8, 10, 12, 14, 16].map(num => (
              <option key={num} value={num}>{num} Teams</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-white mb-4">Starting Lineup</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Quarterback (QB)</label>
            <Input
              type="number"
              min="1"
              max="3"
              value={settings.rosterSettings.qb}
              onChange={(e) => updateRosterSetting('qb', parseInt(e.target.value) || 1)}
              inputSize="sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Running Back (RB)</label>
            <Input
              type="number"
              min="1"
              max="4"
              value={settings.rosterSettings.rb}
              onChange={(e) => updateRosterSetting('rb', parseInt(e.target.value) || 2)}
              inputSize="sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Wide Receiver (WR)</label>
            <Input
              type="number"
              min="1"
              max="4"
              value={settings.rosterSettings.wr}
              onChange={(e) => updateRosterSetting('wr', parseInt(e.target.value) || 2)}
              inputSize="sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tight End (TE)</label>
            <Input
              type="number"
              min="0"
              max="3"
              value={settings.rosterSettings.te}
              onChange={(e) => updateRosterSetting('te', parseInt(e.target.value) || 1)}
              inputSize="sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Flex (RB/WR/TE)</label>
            <Input
              type="number"
              min="0"
              max="4"
              value={settings.rosterSettings.flex}
              onChange={(e) => updateRosterSetting('flex', parseInt(e.target.value) || 1)}
              inputSize="sm"
            />
          </div>
          {settings.scoringType === 'superflex' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">SuperFlex (QB/RB/WR/TE)</label>
              <Input
                type="number"
                min="0"
                max="2"
                value={settings.rosterSettings.superflex || 1}
                onChange={(e) => updateRosterSetting('superflex', parseInt(e.target.value) || 1)}
                inputSize="sm"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Kicker (K)</label>
            <Input
              type="number"
              min="0"
              max="2"
              value={settings.rosterSettings.k}
              onChange={(e) => updateRosterSetting('k', parseInt(e.target.value) || 1)}
              inputSize="sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Defense (DEF)</label>
            <Input
              type="number"
              min="0"
              max="2"
              value={settings.rosterSettings.def}
              onChange={(e) => updateRosterSetting('def', parseInt(e.target.value) || 1)}
              inputSize="sm"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-white mb-4">Bench & Reserves</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Bench Spots</label>
            <Input
              type="number"
              min="3"
              max="12"
              value={settings.rosterSettings.bench}
              onChange={(e) => updateRosterSetting('bench', parseInt(e.target.value) || 6)}
              inputSize="sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Injured Reserve (IR)</label>
            <Input
              type="number"
              min="0"
              max="4"
              value={settings.rosterSettings.ir}
              onChange={(e) => updateRosterSetting('ir', parseInt(e.target.value) || 1)}
              inputSize="sm"
            />
          </div>
          {(settings.leagueType === 'dynasty' || settings.leagueType === 'keeper') && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Taxi Squad</label>
              <Input
                type="number"
                min="0"
                max="6"
                value={settings.rosterSettings.taxi || 0}
                onChange={(e) => updateRosterSetting('taxi', parseInt(e.target.value) || 0)}
                inputSize="sm"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UsersIcon className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-blue-300">Total Starters: {totalStarters}</span>
          </div>
          {errors.roster && (
            <div className="text-red-400 text-sm">{errors.roster}</div>
          )}
        </div>
      </div>

      {/* Real-time Validation Results */}
      {validationResults && validationResults.warnings?.length > 0 && (
        <div className="space-y-2">
          {validationResults.warnings.map((warning: any, index: number) => (
            <div key={index} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-200">{warning.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {validationResults && validationResults.suggestions?.length > 0 && (
        <div className="space-y-2">
          {validationResults.suggestions.map((suggestion: any, index: number) => (
            <div key={index} className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-200">{suggestion.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DraftSettingsStep({ settings, updateSettings, errors, validationResults }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Draft Settings</h3>
        <p className="text-gray-400 mb-6">Configure your draft format and schedule</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingWithTooltip 
          label="Draft Type" 
          tooltip={LEAGUE_TOOLTIPS.snake + ' Auction drafts are most skill-based but take much longer.'}
        >
          <Select
            value={settings.draftType}
            onChange={(e) => updateSettings({ draftType: e.target.value as any })}
          >
            <option value="snake">Snake Draft</option>
            <option value="auction">Auction Draft</option>
            <option value="linear">Linear Draft</option>
          </Select>
        </SettingWithTooltip>

        {settings.draftType === 'auction' && (
          <SettingWithTooltip 
            label="Auction Budget" 
            tooltip={LEAGUE_TOOLTIPS.auctionBudget}
          >
            <Input
              type="number"
              value={settings.auctionBudget || 200}
              onChange={(e) => updateSettings({ auctionBudget: parseInt(e.target.value) })}
              placeholder="200"
            />
          </SettingWithTooltip>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Draft Order
          </label>
          <Select
            value={settings.draftOrderType}
            onChange={(e) => updateSettings({ draftOrderType: e.target.value as any })}
          >
            <option value="random">Randomized Order</option>
            <option value="custom">Custom Order</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Draft Date (Optional)
          </label>
          <Input
            type="date"
            value={settings.draftDate ? settings.draftDate.toISOString().split('T')[0] : ''}
            onChange={(e) => updateSettings({ draftDate: e.target.value ? new Date(e.target.value) : undefined })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Draft Time (Optional)
          </label>
          <Input
            type="time"
            value={settings.draftTime || ''}
            onChange={(e) => updateSettings({ draftTime: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ClockIcon className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-purple-300 mb-1">Draft Scheduling</h4>
            <p className="text-purple-200 text-sm">
              {settings.draftType === 'snake' && 'Snake drafts reverse order each round for fairness.'}
              {settings.draftType === 'auction' && 'Auction drafts let you bid on any player at any time.'}
              {settings.draftType === 'linear' && 'Linear drafts keep the same order every round.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayoffSettingsStep({ settings, updateSettings, errors }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Playoff Structure</h3>
        <p className="text-gray-400 mb-6">Set up your championship tournament</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Playoff Teams
          </label>
          <Select
            value={settings.playoffTeams.toString()}
            onChange={(e) => updateSettings({ playoffTeams: parseInt(e.target.value) })}
          >
            <option value="4">4 Teams</option>
            <option value="6">6 Teams</option>
            <option value="8">8 Teams</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Playoff Duration
          </label>
          <Select
            value={settings.playoffWeeks.toString()}
            onChange={(e) => updateSettings({ playoffWeeks: parseInt(e.target.value) })}
          >
            <option value="2">2 Weeks</option>
            <option value="3">3 Weeks</option>
            <option value="4">4 Weeks</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Championship Week
          </label>
          <Select
            value={settings.championshipWeek.toString()}
            onChange={(e) => updateSettings({ championshipWeek: parseInt(e.target.value) })}
          >
            <option value="16">Week 16</option>
            <option value="17">Week 17</option>
            <option value="18">Week 18</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Playoff Seeding
          </label>
          <Select
            value={settings.playoffSeeding}
            onChange={(e) => updateSettings({ playoffSeeding: e.target.value as any })}
          >
            <option value="record">Best Record</option>
            <option value="points">Most Points</option>
            <option value="h2h">Head-to-Head</option>
          </Select>
        </div>
      </div>

      {errors.playoffs && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{errors.playoffs}</span>
          </div>
        </div>
      )}

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TrophyIcon className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-yellow-300 mb-1">Playoff Preview</h4>
            <p className="text-yellow-200 text-sm">
              {settings.playoffTeams} of {settings.teamCount} teams will make the playoffs, 
              with the championship in week {settings.championshipWeek}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaiverSettingsStep({ settings, updateSettings, errors }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Waiver Settings</h3>
        <p className="text-gray-400 mb-6">Configure free agent acquisition rules</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Waiver System
          </label>
          <Select
            value={settings.waiverType}
            onChange={(e) => updateSettings({ waiverType: e.target.value as any })}
          >
            <option value="faab">FAAB (Free Agent Auction Budget)</option>
            <option value="priority">Waiver Priority</option>
            <option value="free-agent">Free Agent (No Waivers)</option>
          </Select>
        </div>

        {settings.waiverType === 'faab' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              FAAB Budget
            </label>
            <Input
              type="number"
              value={settings.faabBudget}
              onChange={(e) => updateSettings({ faabBudget: parseInt(e.target.value) })}
              placeholder="100"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Waiver Period (Days)
          </label>
          <Select
            value={settings.waiverPeriod.toString()}
            onChange={(e) => updateSettings({ waiverPeriod: parseInt(e.target.value) })}
          >
            <option value="0">No Waiver Period</option>
            <option value="1">1 Day</option>
            <option value="2">2 Days</option>
            <option value="3">3 Days</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Waiver Processing
          </label>
          <Select
            value={settings.waiverProcessing}
            onChange={(e) => updateSettings({ waiverProcessing: e.target.value as any })}
          >
            <option value="daily">Daily Processing</option>
            <option value="sunday-tuesday">Sunday & Tuesday Only</option>
            <option value="manual">Manual Processing</option>
          </Select>
        </div>
      </div>

      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CogIcon className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-green-300 mb-1">
              {settings.waiverType.toUpperCase()} System
            </h4>
            <p className="text-green-200 text-sm">
              {settings.waiverType === 'faab' && 'Bid on free agents with a season-long budget. Highest bid wins.'}
              {settings.waiverType === 'priority' && 'Teams take turns claiming players based on waiver priority order.'}
              {settings.waiverType === 'free-agent' && 'All dropped players immediately become free agents.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeSettingsStep({ settings, updateSettings, errors }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Trade Settings</h3>
        <p className="text-gray-400 mb-6">Configure trading rules and approval process</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Trade Deadline
          </label>
          <Select
            value={settings.tradeDeadline}
            onChange={(e) => updateSettings({ tradeDeadline: e.target.value })}
          >
            <option value="week-10">Week 10</option>
            <option value="week-11">Week 11</option>
            <option value="week-12">Week 12</option>
            <option value="week-13">Week 13</option>
            <option value="playoffs">Before Playoffs</option>
            <option value="never">No Deadline</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Trade Review Process
          </label>
          <Select
            value={settings.tradeReview}
            onChange={(e) => updateSettings({ tradeReview: e.target.value as any })}
          >
            <option value="none">No Review (Immediate)</option>
            <option value="commissioner">Commissioner Review</option>
            <option value="league-vote">League Vote</option>
          </Select>
        </div>

        {settings.tradeReview === 'league-vote' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Voting Period (Hours)
            </label>
            <Select
              value={(settings.tradeVotingPeriod || 24).toString()}
              onChange={(e) => updateSettings({ tradeVotingPeriod: parseInt(e.target.value) })}
            >
              <option value="12">12 Hours</option>
              <option value="24">24 Hours</option>
              <option value="48">48 Hours</option>
              <option value="72">72 Hours</option>
            </Select>
          </div>
        )}

        <div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.tradeProtests}
              onChange={(e) => updateSettings({ tradeProtests: e.target.checked })}
              className="w-4 h-4 text-primary-500 bg-gray-900 border-gray-700 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-300">Allow Trade Protests</span>
          </label>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-300 mb-1">Trade Protection</h4>
            <p className="text-blue-200 text-sm">
              {settings.tradeReview === 'none' && 'Trades process immediately without review.'}
              {settings.tradeReview === 'commissioner' && 'Commissioner must approve all trades.'}
              {settings.tradeReview === 'league-vote' && 'League votes to veto suspicious trades.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedRulesStep({ settings, updateSettings, errors }: any) {
  const isKeeperOrDynasty = ['keeper', 'dynasty'].includes(settings.leagueType);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Advanced Rules</h3>
        <p className="text-gray-400 mb-6">Configure special rules and keeper settings</p>
      </div>

      {isKeeperOrDynasty && (
        <div className="space-y-4">
          <h4 className="font-medium text-white">Keeper Rules</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Keepers
              </label>
              <Input
                type="number"
                min="0"
                max="10"
                value={settings.minimumKeepers || 0}
                onChange={(e) => updateSettings({ minimumKeepers: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Maximum Keepers
              </label>
              <Input
                type="number"
                min="1"
                max="15"
                value={settings.maximumKeepers || 3}
                onChange={(e) => updateSettings({ maximumKeepers: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.rookieDraft || false}
                onChange={(e) => updateSettings({ rookieDraft: e.target.checked })}
                className="w-4 h-4 text-primary-500 bg-gray-900 border-gray-700 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-300">Separate Rookie Draft</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.contractSystem || false}
                onChange={(e) => updateSettings({ contractSystem: e.target.checked })}
                className="w-4 h-4 text-primary-500 bg-gray-900 border-gray-700 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-300">Contract System</span>
            </label>
          </div>

          {settings.contractSystem && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Salary Retention %
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={settings.salaryRetention || 0}
                onChange={(e) => updateSettings({ salaryRetention: parseInt(e.target.value) })}
                placeholder="0"
              />
            </div>
          )}
        </div>
      )}

      {!isKeeperOrDynasty && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
          <SparklesIcon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h4 className="font-medium text-gray-300 mb-2">No Advanced Rules</h4>
          <p className="text-gray-500 text-sm">
            Advanced rules are available for Keeper and Dynasty leagues. 
            Your {settings.leagueType} league uses standard rules.
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewStep({ settings, updateSettings, errors }: any) {
  const summaryData = [
    { label: 'League Name', value: settings.name },
    { label: 'League Type', value: `${settings.leagueType} ${settings.sport.toUpperCase()}` },
    { label: 'Teams', value: settings.teamCount },
    { label: 'Scoring', value: settings.scoringType.replace('-', ' ').toUpperCase() },
    { label: 'Draft Type', value: settings.draftType.charAt(0).toUpperCase() + settings.draftType.slice(1) },
    { label: 'Playoffs', value: `${settings.playoffTeams} teams, ${settings.playoffWeeks} weeks` },
    { label: 'Waivers', value: settings.waiverType.toUpperCase() },
    { label: 'Trade Deadline', value: settings.tradeDeadline.replace('-', ' ').toUpperCase() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Review & Create</h3>
        <p className="text-gray-400 mb-6">Review your league settings and create your league</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {summaryData.map((item, index) => (
          <div key={index} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">{item.label}</div>
            <div className="font-medium text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-primary-500/10 to-purple-500/10 border border-primary-500/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <TrophyIcon className="w-8 h-8 text-primary-400 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-primary-300 mb-2">Your League is Ready!</h4>
            <p className="text-gray-300 text-sm mb-4">
              You've configured a comprehensive {settings.leagueType} league with {settings.teamCount} teams. 
              Once created, you can invite managers and finalize your draft schedule.
            </p>
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircleIcon className="w-4 h-4" />
              All required settings completed
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-yellow-300 mb-1">After Creation</h4>
            <p className="text-yellow-200 text-sm">
              You'll be able to invite managers, customize additional settings, and schedule your draft. 
              Some settings can be modified before the season starts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}