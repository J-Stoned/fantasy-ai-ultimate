'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { 
  QuestionMarkCircleIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface GuideSection {
  id: string;
  title: string;
  description: string;
  tips: string[];
  warnings?: string[];
  examples?: { name: string; description: string; }[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'league-types',
    title: 'League Types Explained',
    description: 'Choose the right format for your group',
    tips: [
      'Redraft: Best for beginners, fresh start each year',
      'Keeper: Keep 1-5 players, adds strategy depth',
      'Dynasty: Keep entire roster, focus on young talent',
      'Salary Cap: Manage budgets, more complex but rewarding'
    ],
    examples: [
      { name: 'Casual Friends', description: 'Redraft with standard scoring' },
      { name: 'Competitive Group', description: 'Keeper with 3 players kept' },
      { name: 'Expert League', description: 'Dynasty with rookie drafts' }
    ]
  },
  
  {
    id: 'scoring-systems',
    title: 'Scoring Systems Guide',
    description: 'How different scoring affects strategy',
    tips: [
      'Standard: Traditional scoring, RBs most valuable',
      'PPR: Pass-catching backs and slot WRs gain value',
      'Half-PPR: Balanced approach, most popular format',
      'SuperFlex: QBs become premium positions'
    ],
    warnings: [
      'Custom scoring can break player valuations',
      'SuperFlex requires deeper QB knowledge'
    ]
  },
  
  {
    id: 'roster-construction',
    title: 'Roster Settings Strategy',
    description: 'Build the perfect starting lineup format',
    tips: [
      'Standard: 1 QB, 2 RB, 2 WR, 1 TE, 1 Flex, K, DEF',
      'More flex spots = more strategic decisions',
      'Larger benches = more competitive waiver wire',
      'IR spots are essential for injury management'
    ],
    examples: [
      { name: 'Traditional', description: '9 starters, 6 bench, 1 IR' },
      { name: 'Strategic', description: '10 starters, 7 bench, 2 IR, 2 Flex' },
      { name: 'Deep League', description: '12 starters, 10 bench, 3 IR' }
    ]
  },
  
  {
    id: 'draft-formats',
    title: 'Draft Format Comparison',
    description: 'Snake vs Auction vs Linear drafts',
    tips: [
      'Snake: Fair and familiar, reverses each round',
      'Auction: Most skill-based, get any player you want',
      'Linear: Simple but gives advantage to early picks'
    ],
    warnings: [
      'Auction drafts take 2-3x longer than snake',
      'Linear drafts are generally unfair'
    ]
  },
  
  {
    id: 'waiver-systems',
    title: 'Waiver Wire Management',
    description: 'FAAB vs Priority vs Free Agent systems',
    tips: [
      'FAAB: Most strategic, bid with season budget',
      'Priority: Simple, rotates based on claims',
      'Free Agent: No restrictions, first-come-first-served'
    ],
    examples: [
      { name: 'Competitive', description: 'FAAB with $100 budget' },
      { name: 'Casual', description: 'Rolling priority system' },
      { name: 'Active', description: 'Free agent with short waiver period' }
    ]
  },
  
  {
    id: 'playoff-structure',
    title: 'Playoff Structure Guide',
    description: 'Design exciting championship tournaments',
    tips: [
      '6 teams: Standard format, 2 byes for top seeds',
      '8 teams: No byes, more teams involved',
      '4 teams: Only for smaller leagues',
      'Week 16/17 championships avoid rest concerns'
    ],
    warnings: [
      'Too many playoff teams reduces regular season importance',
      'Week 18 championships risk resting starters'
    ]
  }
];

interface LeagueSettingsGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeagueSettingsGuide({ isOpen, onClose }: LeagueSettingsGuideProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-900 border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LightBulbIcon className="w-8 h-8 text-yellow-400" />
                  <h2 className="text-2xl font-bold text-white">League Settings Guide</h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Learn how to configure the perfect league for your group
              </p>
            </div>

            <div className="p-6 space-y-4">
              {GUIDE_SECTIONS.map((section) => (
                <Card key={section.id} variant="solid" className="border-gray-700">
                  <CardHeader className="pb-3">
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <div>
                        <CardTitle className="text-lg text-white">{section.title}</CardTitle>
                        <p className="text-gray-400 text-sm mt-1">{section.description}</p>
                      </div>
                      {expandedSection === section.id ? (
                        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </CardHeader>

                  <AnimatePresence>
                    {expandedSection === section.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            {/* Tips */}
                            <div>
                              <h4 className="font-medium text-green-300 mb-2 flex items-center gap-2">
                                <CheckCircleIcon className="w-4 h-4" />
                                Key Points
                              </h4>
                              <ul className="space-y-1">
                                {section.tips.map((tip, index) => (
                                  <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                                    <span className="text-green-400 mt-1">•</span>
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Warnings */}
                            {section.warnings && (
                              <div>
                                <h4 className="font-medium text-yellow-300 mb-2 flex items-center gap-2">
                                  <ExclamationTriangleIcon className="w-4 h-4" />
                                  Important Considerations
                                </h4>
                                <ul className="space-y-1">
                                  {section.warnings.map((warning, index) => (
                                    <li key={index} className="text-sm text-yellow-200 flex items-start gap-2">
                                      <span className="text-yellow-400 mt-1">⚠</span>
                                      {warning}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Examples */}
                            {section.examples && (
                              <div>
                                <h4 className="font-medium text-blue-300 mb-2">Popular Configurations</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {section.examples.map((example, index) => (
                                    <div key={index} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                                      <div className="font-medium text-white text-sm">{example.name}</div>
                                      <div className="text-gray-400 text-xs mt-1">{example.description}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              ))}
            </div>

            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-6 rounded-b-2xl">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-400">
                  💡 Pro tip: Start with a template and customize from there
                </div>
                <Button onClick={onClose} variant="outline">
                  Got it!
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}