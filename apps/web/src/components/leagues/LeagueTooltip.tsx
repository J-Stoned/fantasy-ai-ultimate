'use client';

import { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  className?: string;
}

export function LeagueTooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children || <InformationCircleIcon className="w-4 h-4 text-gray-400 hover:text-gray-300" />}
      </div>
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-64 p-3 bg-gray-800 border border-gray-600 rounded-lg shadow-xl bottom-full left-1/2 transform -translate-x-1/2 mb-2"
          >
            <div className="text-sm text-gray-200">{content}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-4 border-transparent border-t-gray-800"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Predefined tooltips for common league settings
export const LEAGUE_TOOLTIPS = {
  ppr: 'Point Per Reception - Players get 1 point for each catch, making pass-catching backs and slot receivers more valuable.',
  halfPpr: 'Half Point Per Reception - Players get 0.5 points per catch, a balanced middle ground between standard and PPR.',
  superflex: 'SuperFlex position can start any player including QBs, making quarterback depth crucial.',
  faab: 'Free Agent Auction Budget - Bid on waiver wire players with a season-long budget instead of waiver priority.',
  snake: 'Snake Draft - Draft order reverses each round (1st pick in round 1 gets last pick in round 2).',
  auction: 'Auction Draft - Bid on any player at any time with a budget, allowing for flexible roster construction.',
  keeper: 'Keeper League - Keep a limited number of players from previous season, adding dynasty elements.',
  dynasty: 'Dynasty League - Keep your entire roster year-to-year, focusing on long-term player value.',
  idp: 'Individual Defensive Players - Start specific defensive players instead of team defenses.',
  taxi: 'Taxi Squad - Reserve spots for young/developing players who don\'t count against regular roster limits.',
  ir: 'Injured Reserve - Special roster spots for injured players, freeing up bench space.',
  flex: 'Flex Position - Can start RB, WR, or TE, adding strategic roster flexibility.',
  tradeDeadline: 'Trade Deadline - Last week trades are allowed, typically weeks 10-12 to prevent playoff manipulation.',
  waiverPeriod: 'Waiver Period - Days a dropped player must wait before becoming available to claim.',
  playoffSeeding: 'Determines playoff bracket order: Record (wins/losses), Points (total scoring), or Head-to-Head tiebreakers.',
  auctionBudget: 'Total money each team gets to bid on players in auction drafts. Standard is $200.',
  championshipWeek: 'Week of fantasy playoffs final. Week 17 is traditional, Week 16 avoids potential rest concerns.'
};

interface SettingWithTooltipProps {
  label: string;
  tooltip: string;
  children: React.ReactNode;
}

export function SettingWithTooltip({ label, tooltip, children }: SettingWithTooltipProps) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
        {label}
        <LeagueTooltip content={tooltip} />
      </label>
      {children}
    </div>
  );
}