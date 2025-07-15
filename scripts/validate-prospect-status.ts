#!/usr/bin/env node
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('✅ PROSPECT STATUS VALIDATOR');
console.log('🔍 Checking which prospects are actually still in minors\n');

// Known players already in majors (to exclude)
const KNOWN_MLB_PLAYERS = [
  'Paul Skenes',
  'Jackson Holliday', 
  'Wyatt Langford',
  'Colt Keith',
  'Masyn Winn',
  'Junior Caminero',
  'Termarr Johnson',
  'Roman Anthony'
];

class ProspectStatusValidator {
  
  async validateProspects(): Promise<void> {
    console.log('📊 Querying our prospect database...\n');
    
    // Get all prospects from our database
    const { data: prospects } = await supabase
      .from('news_articles')
      .select('title, content')
      .ilike('content', '%prospect%')
      .limit(100);
    
    if (!prospects) {
      console.log('❌ No prospect data found');
      return;
    }
    
    // Extract prospect names
    const prospectNames = this.extractProspectNames(prospects);
    console.log(`🎯 Found ${prospectNames.length} potential prospects to validate\n`);
    
    // Validate each prospect
    const validatedProspects: any[] = [];
    
    for (const name of prospectNames.slice(0, 20)) { // Validate top 20
      const status = await this.checkProspectStatus(name);
      if (status.isMinorLeaguer) {
        validatedProspects.push(status);
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    }
    
    this.displayValidatedProspects(validatedProspects);
    await this.updateDatabase(validatedProspects);
  }
  
  extractProspectNames(prospects: any[]): string[] {
    const names = new Set<string>();
    
    prospects.forEach(prospect => {
      const text = prospect.title + ' ' + prospect.content;
      
      // Extract names using patterns
      const patterns = [
        /Prospect Report: ([A-Z][a-z]+ [A-Z][a-z]+)/g,
        /([A-Z][a-z]+ [A-Z][a-z]+) \(Pitcher\)/g,
        /stash ([A-Z][a-z]+ [A-Z][a-z]+)/gi,
        /prospect ([A-Z][a-z]+ [A-Z][a-z]+)/gi
      ];
      
      patterns.forEach(pattern => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length > 5) {
            names.add(match[1].trim());
          }
        }
      });
    });
    
    return Array.from(names).filter(name => !KNOWN_MLB_PLAYERS.includes(name));
  }
  
  async checkProspectStatus(playerName: string): Promise<any> {
    console.log(`🔍 Checking: ${playerName}`);
    
    try {
      // Check MLB.com roster API (free)
      const searchResponse = await axios.get(`https://www.mlb.com/api/v1/people/search?names=${encodeURIComponent(playerName)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (searchResponse.data?.people?.length > 0) {
        const player = searchResponse.data.people[0];
        
        // Get current team info
        const playerResponse = await axios.get(`https://www.mlb.com/api/v1/people/${player.id}?hydrate=currentTeam`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const playerData = playerResponse.data?.people?.[0];
        const currentTeam = playerData?.currentTeam;
        
        if (currentTeam) {
          const isMinorLeague = currentTeam.league?.name?.includes('Minor') || 
                               currentTeam.name?.includes('AAA') || 
                               currentTeam.name?.includes('AA') ||
                               currentTeam.name?.includes('A+') ||
                               currentTeam.sport?.name !== 'Major League Baseball';
          
          console.log(`   ${isMinorLeague ? '✅ Minor League' : '❌ Major League'} - ${currentTeam.name} (${currentTeam.league?.name})`);
          
          return {
            name: playerName,
            isMinorLeaguer: isMinorLeague,
            currentTeam: currentTeam.name,
            league: currentTeam.league?.name,
            level: isMinorLeague ? this.determineLevel(currentTeam.name) : 'MLB',
            mlbId: player.id
          };
        }
      }
      
      // If not found in MLB API, assume minor leaguer for now
      console.log(`   ⚠️ Not found in MLB API, treating as prospect`);
      return {
        name: playerName,
        isMinorLeaguer: true,
        currentTeam: 'Unknown',
        league: 'Minor League',
        level: 'Unknown',
        mlbId: null
      };
      
    } catch (error) {
      console.log(`   ❌ Error checking ${playerName}`);
      return {
        name: playerName,
        isMinorLeaguer: true,
        currentTeam: 'Unknown',
        league: 'Unknown',
        level: 'Unknown',
        mlbId: null
      };
    }
  }
  
  determineLevel(teamName: string): string {
    if (teamName.includes('AAA') || teamName.includes('Triple-A')) return 'Triple-A';
    if (teamName.includes('AA') || teamName.includes('Double-A')) return 'Double-A';
    if (teamName.includes('A+') || teamName.includes('High-A')) return 'High-A';
    if (teamName.includes('A ') || teamName.includes('Single-A')) return 'Single-A';
    return 'Minor League';
  }
  
  displayValidatedProspects(prospects: any[]): void {
    console.log('\n🎯 VALIDATED MINOR LEAGUE PROSPECTS\n');
    console.log('=' .repeat(60));
    
    if (prospects.length === 0) {
      console.log('❌ No valid minor league prospects found');
      return;
    }
    
    prospects.forEach((prospect, i) => {
      console.log(`${i + 1}. ${prospect.name}`);
      console.log(`   Team: ${prospect.currentTeam}`);
      console.log(`   Level: ${prospect.level}`);
      console.log(`   League: ${prospect.league}`);
      if (prospect.mlbId) {
        console.log(`   MLB ID: ${prospect.mlbId}`);
      }
      console.log();
    });
    
    console.log('=' .repeat(60));
    console.log(`✅ Total validated prospects: ${prospects.length}`);
  }
  
  async updateDatabase(prospects: any[]): Promise<void> {
    console.log('\n💾 Updating database with validated prospect status...\n');
    
    try {
      // Save validated prospects as player stats
      const statsData = prospects.map(prospect => ({
        stat_type: 'validated_prospect',
        stat_value: {
          name: prospect.name,
          current_team: prospect.currentTeam,
          level: prospect.level,
          league: prospect.league,
          mlb_id: prospect.mlbId,
          is_minor_leaguer: prospect.isMinorLeaguer,
          validation_date: new Date().toISOString()
        },
        fantasy_points: prospect.level === 'Triple-A' ? 90 : 
                       prospect.level === 'Double-A' ? 70 : 50
      }));
      
      const { data, error } = await supabase
        .from('player_stats')
        .insert(statsData);
      
      if (error) {
        console.log('⚠️ Database update failed:', error.message);
      } else {
        console.log(`✅ Updated database with ${prospects.length} validated prospects`);
      }
      
    } catch (error) {
      console.error('❌ Database update error:', error);
    }
  }
}

// Main execution
async function main() {
  const validator = new ProspectStatusValidator();
  await validator.validateProspects();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ProspectStatusValidator };