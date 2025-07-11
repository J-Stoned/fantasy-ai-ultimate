import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function comprehensiveFieldDiscovery() {
    console.log('🚀 COMPREHENSIVE FIELD DISCOVERY - FIXED QUERIES');
    console.log('================================================\n');
    
    // Use games.sport instead of players.sport to access all data
    const sports = [
        { name: 'NBA', query: 'NBA' },
        { name: 'NFL_uppercase', query: 'NFL' },
        { name: 'NFL_lowercase', query: 'nfl' },
        { name: 'NHL', query: 'NHL' },
        { name: 'MLB', query: 'MLB' }
    ];
    
    const fieldMappings: any = {};
    
    for (const sport of sports) {
        console.log(`📊 Analyzing ${sport.name} (games.sport = "${sport.query}")...`);
        
        // Get total logs for this sport
        const { count: totalLogs } = await supabase
            .from('player_game_logs')
            .select('*', { count: 'exact', head: true })
            .eq('games.sport', sport.query);
        
        // Get logs with stats
        const { data: logs, error } = await supabase
            .from('player_game_logs')
            .select(`
                id,
                stats,
                computed_metrics,
                games!inner(sport)
            `)
            .eq('games.sport', sport.query)
            .not('stats', 'eq', '{}')
            .not('stats', 'is', null)
            .limit(20);
        
        if (error) {
            console.error(`❌ Error fetching ${sport.name} logs:`, error);
            continue;
        }
        
        if (!logs || logs.length === 0) {
            console.log(`❌ No ${sport.name} logs found with stats\n`);
            continue;
        }
        
        console.log(`✅ Found ${logs.length} ${sport.name} logs with stats (${totalLogs} total)`);
        
        // Analyze field patterns across multiple logs
        const allFields = new Set<string>();
        const fieldTypes: any = {};
        const fieldSamples: any = {};
        const fieldFrequency: any = {};
        
        logs.forEach(log => {
            if (log.stats && typeof log.stats === 'object') {
                Object.entries(log.stats).forEach(([field, value]) => {
                    allFields.add(field);
                    
                    // Track field types
                    if (!fieldTypes[field]) {
                        fieldTypes[field] = new Set();
                        fieldSamples[field] = [];
                        fieldFrequency[field] = 0;
                    }
                    
                    fieldTypes[field].add(typeof value);
                    fieldFrequency[field]++;
                    
                    // Collect samples
                    if (fieldSamples[field].length < 5 && value !== null && value !== undefined) {
                        fieldSamples[field].push(value);
                    }
                });
            }
        });
        
        // Store comprehensive field mapping
        fieldMappings[sport.name] = {
            query: sport.query,
            totalLogs: totalLogs || 0,
            logsWithStats: logs.length,
            fieldCount: allFields.size,
            fields: Array.from(allFields).sort(),
            fieldTypes: Object.fromEntries(
                Object.entries(fieldTypes).map(([field, types]: [string, any]) => [
                    field, 
                    Array.from(types)
                ])
            ),
            fieldSamples,
            fieldFrequency
        };
        
        console.log(`  📋 ${allFields.size} unique fields discovered`);
        
        // Analyze field naming patterns
        const camelCase = Array.from(allFields).filter(f => /^[a-z][a-zA-Z]*$/.test(f));
        const snakeCase = Array.from(allFields).filter(f => /^[a-z]+(_[a-z]+)+$/.test(f));
        const lowercase = Array.from(allFields).filter(f => /^[a-z]+$/.test(f) && !camelCase.includes(f));
        const mixed = Array.from(allFields).filter(f => 
            !camelCase.includes(f) && !snakeCase.includes(f) && !lowercase.includes(f)
        );
        
        console.log(`  🏷️  Naming patterns: ${camelCase.length} camelCase, ${snakeCase.length} snake_case, ${lowercase.length} lowercase, ${mixed.length} mixed`);
        
        // Data type analysis
        const stringFields = Object.entries(fieldTypes)
            .filter(([_, types]: [string, any]) => Array.from(types).includes('string'))
            .map(([field, _]) => field);
        
        const numberFields = Object.entries(fieldTypes)
            .filter(([_, types]: [string, any]) => Array.from(types).includes('number'))
            .map(([field, _]) => field);
        
        console.log(`  📊 Data types: ${numberFields.length} numeric, ${stringFields.length} string`);
        
        // Show top fields by frequency
        const topFields = Object.entries(fieldFrequency)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 10);
        
        console.log(`  🔥 Most common fields:`);
        topFields.forEach(([field, freq], i) => {
            const types = Array.from(fieldTypes[field]).join('/');
            const samples = fieldSamples[field].slice(0, 3).join(', ');
            console.log(`    ${i + 1}. ${field} (${types}, ${freq}/${logs.length}): ${samples}`);
        });
        
        // String fields that need conversion
        if (stringFields.length > 0) {
            console.log(`  ⚠️  String fields needing conversion: ${stringFields.slice(0, 5).join(', ')}${stringFields.length > 5 ? '...' : ''}`);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
    }
    
    // Generate sport-specific calculator recommendations
    console.log('🎯 CALCULATOR FIELD MAPPING RECOMMENDATIONS');
    console.log('===========================================\n');
    
    Object.entries(fieldMappings).forEach(([sportName, data]: [string, any]) => {
        if (data.fieldCount === 0) return;
        
        console.log(`### ${sportName} Calculator Updates:`);
        console.log(`Query: games.sport = "${data.query}"`);
        console.log(`Data: ${data.logsWithStats}/${data.totalLogs} logs with stats (${(data.logsWithStats/data.totalLogs*100).toFixed(1)}%)`);
        
        const fields = data.fields;
        
        // Sport-specific field identification
        if (sportName.includes('NFL')) {
            const passingFields = fields.filter((f: string) => f.toLowerCase().includes('pass'));
            const rushingFields = fields.filter((f: string) => f.toLowerCase().includes('rush'));
            const receivingFields = fields.filter((f: string) => f.toLowerCase().includes('rec'));
            const defensiveFields = fields.filter((f: string) => f.toLowerCase().includes('def'));
            
            console.log(`  🏈 Passing: ${passingFields.join(', ')}`);
            console.log(`  🏃 Rushing: ${rushingFields.join(', ')}`);
            console.log(`  🙌 Receiving: ${receivingFields.join(', ')}`);
            console.log(`  🛡️  Defense: ${defensiveFields.join(', ')}`);
        }
        
        if (sportName === 'NHL') {
            const scoringFields = fields.filter((f: string) => 
                ['goals', 'assists', 'points', 'shots'].includes(f.toLowerCase())
            );
            const physicalFields = fields.filter((f: string) => 
                ['hits', 'blocks', 'penalty'].some(term => f.toLowerCase().includes(term))
            );
            const goalieFields = fields.filter((f: string) => 
                ['saves', 'goals_against', 'save_percentage'].some(term => f.toLowerCase().includes(term))
            );
            
            console.log(`  🥅 Scoring: ${scoringFields.join(', ')}`);
            console.log(`  💥 Physical: ${physicalFields.join(', ')}`);
            console.log(`  🥅 Goalie: ${goalieFields.join(', ')}`);
        }
        
        if (sportName === 'NBA') {
            const shootingFields = fields.filter((f: string) => 
                f.toLowerCase().includes('goal') || f.toLowerCase().includes('shot')
            );
            const assistFields = fields.filter((f: string) => 
                ['assists', 'rebounds', 'steals', 'blocks'].includes(f.toLowerCase())
            );
            
            console.log(`  🏀 Shooting: ${shootingFields.join(', ')}`);
            console.log(`  📊 Other: ${assistFields.join(', ')}`);
        }
        
        // String conversion requirements
        const stringFields = Object.entries(data.fieldTypes)
            .filter(([_, types]: [string, any]) => Array.from(types).includes('string'))
            .map(([field, _]) => field);
        
        if (stringFields.length > 0) {
            console.log(`  🔧 String→Number needed: ${stringFields.join(', ')}`);
        }
        
        console.log('');
    });
    
    // Save comprehensive mappings
    console.log('💾 Saving comprehensive field mappings...');
    const fs = require('fs');
    
    fs.writeFileSync(
        '/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate/comprehensive-field-mappings.json',
        JSON.stringify(fieldMappings, null, 2)
    );
    
    // Generate the corrected backfill query strategy
    console.log('\n🚀 CORRECTED BACKFILL STRATEGY:');
    console.log('===============================');
    
    Object.entries(fieldMappings).forEach(([sportName, data]: [string, any]) => {
        if (data.fieldCount > 0) {
            console.log(`${sportName}: Use games.sport = "${data.query}" (${data.logsWithStats} logs with stats)`);
        }
    });
    
    console.log('\n🎉 COMPREHENSIVE FIELD DISCOVERY COMPLETE!');
    console.log('✅ Fixed sport query strategy');
    console.log('✅ Discovered field patterns for all sports');
    console.log('✅ Identified data type conversion needs');
    console.log('✅ Ready for calculator updates and mega backfill!');
}

comprehensiveFieldDiscovery()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Comprehensive field discovery failed:', error);
        process.exit(1);
    });