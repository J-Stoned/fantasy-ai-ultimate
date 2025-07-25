import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '../../../../lib/logging/logger';

// Validation rules for different aspects of league settings
export async function POST(request: NextRequest) {
  try {
    const { step, settings } = await request.json();
    
    const validationResults = {
      isValid: true,
      errors: [] as Array<{ field: string; message: string; severity: 'error' | 'warning' }>,
      warnings: [] as Array<{ field: string; message: string; type: 'suggestion' | 'optimization' | 'compatibility' }>,
      suggestions: [] as Array<{ field: string; message: string; action?: string }>
    };
    
    // Step-specific validations
    switch (step) {
      case 'roster':
        validateRosterSettings(settings, validationResults);
        break;
      case 'draft':
        validateDraftSettings(settings, validationResults);
        break;
      case 'playoffs':
        validatePlayoffSettings(settings, validationResults);
        break;
      case 'scoring':
        validateScoringSettings(settings, validationResults);
        break;
      case 'advanced':
        validateAdvancedSettings(settings, validationResults);
        break;
      case 'compatibility':
        validateCompatibility(settings, validationResults);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid validation step' },
          { status: 400 }
        );
    }
    
    return NextResponse.json(validationResults);
    
  } catch (error) {
    logger.error('Validation error:', { error: error });
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    );
  }
}

function validateRosterSettings(settings: any, results: any) {
  const { rosterSettings, teamCount, leagueType, sport } = settings;
  
  // Calculate starting positions
  const starters = Object.entries(rosterSettings)
    .filter(([key]) => !['bench', 'ir', 'taxi'].includes(key))
    .reduce((sum, [, value]) => sum + (value || 0), 0);
  
  // Validate starter count
  if (starters < 7) {
    results.errors.push({
      field: 'rosterSettings',
      message: 'Must have at least 7 starting positions',
      severity: 'error'
    });
    results.isValid = false;
  }
  
  if (starters > 15) {
    results.errors.push({
      field: 'rosterSettings',
      message: 'Cannot exceed 15 starting positions',
      severity: 'error'
    });
    results.isValid = false;
  }
  
  // Sport-specific validations
  if (sport === 'nfl') {
    if (rosterSettings.qb === 0) {
      results.warnings.push({
        field: 'rosterSettings.qb',
        message: 'Most leagues require at least 1 QB',
        type: 'suggestion'
      });
    }
    
    if (rosterSettings.qb > 2) {
      results.warnings.push({
        field: 'rosterSettings.qb',
        message: 'More than 2 QB positions is uncommon',
        type: 'optimization'
      });
    }
    
    if (rosterSettings.k === 0 && rosterSettings.def === 0) {
      results.suggestions.push({
        field: 'rosterSettings',
        message: 'Consider adding K and DEF positions for traditional scoring',
        action: 'Add standard positions'
      });
    }
  }
  
  // League type specific validations
  if (leagueType === 'dynasty') {
    if (rosterSettings.bench < 10) {
      results.warnings.push({
        field: 'rosterSettings.bench',
        message: 'Dynasty leagues typically have larger benches (10-15 spots)',
        type: 'suggestion'
      });
    }
    
    if (!rosterSettings.taxi || rosterSettings.taxi < 3) {
      results.suggestions.push({
        field: 'rosterSettings.taxi',
        message: 'Consider adding taxi squad spots for rookie development',
        action: 'Add 3-5 taxi spots'
      });
    }
  }
  
  // Team count compatibility
  if (teamCount > 12 && rosterSettings.bench > 8) {
    results.warnings.push({
      field: 'rosterSettings.bench',
      message: 'Large leagues with big benches may thin the player pool significantly',
      type: 'optimization'
    });
  }
  
  // Calculate total roster size
  const totalRoster = starters + rosterSettings.bench + rosterSettings.ir + (rosterSettings.taxi || 0);
  if (totalRoster > 30) {
    results.warnings.push({
      field: 'rosterSettings',
      message: 'Very large rosters may make waiver wire too thin',
      type: 'optimization'
    });
  }
}

function validateDraftSettings(settings: any, results: any) {
  const { draftType, auctionBudget, teamCount, sport } = settings;
  
  if (draftType === 'auction') {
    if (!auctionBudget || auctionBudget < 100) {
      results.errors.push({
        field: 'auctionBudget',
        message: 'Auction budget must be at least $100',
        severity: 'error'
      });
      results.isValid = false;
    }
    
    if (auctionBudget && auctionBudget < 200) {
      results.warnings.push({
        field: 'auctionBudget',
        message: 'Most auction leagues use $200+ budgets for better granularity',
        type: 'suggestion'
      });
    }
  }
  
  // Team count draft considerations
  if (teamCount < 8) {
    results.warnings.push({
      field: 'teamCount',
      message: 'Small leagues may have too many elite players available',
      type: 'optimization'
    });
  }
  
  if (teamCount > 16) {
    results.warnings.push({
      field: 'teamCount',
      message: 'Large leagues may make finding quality players very difficult',
      type: 'optimization'
    });
  }
  
  // Sport-specific draft advice
  if (sport === 'nfl' && draftType === 'linear') {
    results.suggestions.push({
      field: 'draftType',
      message: 'Snake drafts are more popular and fair for NFL leagues',
      action: 'Consider snake draft'
    });
  }
}

function validatePlayoffSettings(settings: any, results: any) {
  const { playoffTeams, teamCount, playoffWeeks, championshipWeek, sport } = settings;
  
  if (playoffTeams >= teamCount) {
    results.errors.push({
      field: 'playoffTeams',
      message: 'Playoff teams must be less than total teams',
      severity: 'error'
    });
    results.isValid = false;
  }
  
  if (playoffTeams < 4) {
    results.warnings.push({
      field: 'playoffTeams',
      message: 'Very small playoffs may not be exciting enough',
      type: 'suggestion'
    });
  }
  
  if (playoffTeams > teamCount / 2) {
    results.warnings.push({
      field: 'playoffTeams',
      message: 'More than half the teams making playoffs reduces regular season importance',
      type: 'optimization'
    });
  }
  
  // Sport-specific playoff validations
  if (sport === 'nfl') {
    if (championshipWeek === 18) {
      results.warnings.push({
        field: 'championshipWeek',
        message: 'Week 18 may have resting starters - Week 16/17 recommended',
        type: 'suggestion'
      });
    }
    
    if (playoffWeeks > 3) {
      results.warnings.push({
        field: 'playoffWeeks',
        message: 'NFL playoffs longer than 3 weeks may extend past regular season',
        type: 'compatibility'
      });
    }
  }
  
  // Bracket math validation
  const validBracketSizes = [2, 4, 6, 8, 12, 16];
  if (!validBracketSizes.includes(playoffTeams)) {
    results.suggestions.push({
      field: 'playoffTeams',
      message: 'Consider standard bracket sizes (4, 6, 8) for cleaner tournaments',
      action: 'Adjust to standard size'
    });
  }
}

function validateScoringSettings(settings: any, results: any) {
  const { scoringType, customScoring, leagueType, rosterSettings } = settings;
  
  if (scoringType === 'custom' && !customScoring) {
    results.errors.push({
      field: 'customScoring',
      message: 'Custom scoring rules are required',
      severity: 'error'
    });
    results.isValid = false;
  }
  
  if (scoringType === 'superflex' && !rosterSettings.superflex) {
    results.errors.push({
      field: 'rosterSettings.superflex',
      message: 'SuperFlex scoring requires SuperFlex roster position',
      severity: 'error'
    });
    results.isValid = false;
  }
  
  // Dynasty-specific scoring advice
  if (leagueType === 'dynasty') {
    if (scoringType === 'standard') {
      results.suggestions.push({
        field: 'scoringType',
        message: 'PPR scoring increases player values for dynasty leagues',
        action: 'Consider PPR or Half-PPR'
      });
    }
  }
  
  // Balance suggestions
  if (customScoring) {
    if (customScoring.passingTd > 6) {
      results.warnings.push({
        field: 'customScoring.passingTd',
        message: 'High passing TD values may overvalue QBs',
        type: 'optimization'
      });
    }
    
    if (customScoring.reception > 1.5) {
      results.warnings.push({
        field: 'customScoring.reception',
        message: 'Very high reception values may make RBs less valuable',
        type: 'optimization'
      });
    }
  }
}

function validateAdvancedSettings(settings: any, results: any) {
  const { leagueType, minimumKeepers, maximumKeepers, rookieDraft, contractSystem } = settings;
  
  if (leagueType === 'keeper' || leagueType === 'dynasty') {
    if (minimumKeepers && maximumKeepers && minimumKeepers > maximumKeepers) {
      results.errors.push({
        field: 'keeperSettings',
        message: 'Minimum keepers cannot exceed maximum keepers',
        severity: 'error'
      });
      results.isValid = false;
    }
    
    if (leagueType === 'keeper' && maximumKeepers && maximumKeepers > 8) {
      results.warnings.push({
        field: 'maximumKeepers',
        message: 'Keeper leagues typically keep 1-5 players',
        type: 'suggestion'
      });
    }
    
    if (leagueType === 'dynasty' && maximumKeepers && maximumKeepers < 15) {
      results.warnings.push({
        field: 'maximumKeepers',
        message: 'Dynasty leagues typically keep most or all players',
        type: 'suggestion'
      });
    }
    
    if (leagueType === 'dynasty' && !rookieDraft) {
      results.suggestions.push({
        field: 'rookieDraft',
        message: 'Most dynasty leagues have separate rookie drafts',
        action: 'Enable rookie draft'
      });
    }
  } else {
    // Non-keeper leagues
    if (minimumKeepers || maximumKeepers || rookieDraft || contractSystem) {
      results.warnings.push({
        field: 'advancedSettings',
        message: 'Advanced settings only apply to keeper/dynasty leagues',
        type: 'compatibility'
      });
    }
  }
}

function validateCompatibility(settings: any, results: any) {
  const { leagueType, sport, draftType, waiverType, teamCount, rosterSettings } = settings;
  
  // Check for common incompatibilities
  if (sport === 'nba' && rosterSettings.k > 0) {
    results.warnings.push({
      field: 'rosterSettings.k',
      message: 'NBA leagues do not use kickers',
      type: 'compatibility'
    });
  }
  
  if (sport === 'nba' && rosterSettings.def > 0) {
    results.warnings.push({
      field: 'rosterSettings.def',
      message: 'NBA leagues typically do not use team defenses',
      type: 'compatibility'
    });
  }
  
  // League size vs draft type
  if (teamCount > 14 && draftType === 'auction') {
    results.warnings.push({
      field: 'draftType',
      message: 'Large auction drafts can be very time consuming',
      type: 'optimization'
    });
  }
  
  // Waiver type recommendations
  if (leagueType === 'dynasty' && waiverType === 'priority') {
    results.suggestions.push({
      field: 'waiverType',
      message: 'FAAB waivers are more common in dynasty leagues',
      action: 'Consider FAAB system'
    });
  }
  
  // Performance warnings
  if (teamCount > 16) {
    results.warnings.push({
      field: 'teamCount',
      message: 'Very large leagues may be difficult to manage',
      type: 'optimization'
    });
  }
}