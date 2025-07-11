import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function discoverAllSportsFields() {
    console.log('🔍 DISCOVERING FIELD NAMES ACROSS ALL SPORTS');
    console.log('==============================================\n');
    
    const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAA_BB', 'NCAA_FB'];
    const fieldMappings: any = {};
    
    for (const sport of sports) {
        console.log(`📊 Analyzing ${sport}...`);
        
        // Get sample logs with stats for this sport
        const { data: logs, error } = await supabase
            .from('player_game_logs')
            .select(`
                id,
                stats,
                minutes_played,
                players!inner(sport)
            `)
            .eq('players.sport', sport)
            .not('stats', 'eq', '{}')
            .not('stats', 'is', null)
            .limit(10);
        
        if (error) {
            console.error(`❌ Error fetching ${sport} logs:`, error);
            continue;
        }
        
        if (!logs || logs.length === 0) {
            console.log(`❌ No ${sport} logs found with stats\n`);
            continue;
        }
        
        console.log(`Found ${logs.length} ${sport} logs with stats`);
        
        // Analyze field patterns
        const allFields = new Set<string>();
        const fieldTypes: any = {};
        const fieldSamples: any = {};
        
        logs.forEach(log => {
            if (log.stats && typeof log.stats === 'object') {
                Object.keys(log.stats).forEach(field => {
                    allFields.add(field);
                    
                    const value = log.stats[field];
                    if (!fieldTypes[field]) {
                        fieldTypes[field] = new Set();
                        fieldSamples[field] = [];
                    }
                    
                    fieldTypes[field].add(typeof value);
                    if (fieldSamples[field].length < 3) {
                        fieldSamples[field].push(value);
                    }
                });
            }
        });
        
        // Store field mapping for this sport
        fieldMappings[sport] = {
            totalLogs: logs.length,
            fieldCount: allFields.size,
            fields: Array.from(allFields).sort(),
            fieldTypes: Object.fromEntries(
                Object.entries(fieldTypes).map(([field, types]: [string, any]) => [
                    field, 
                    Array.from(types)
                ])
            ),
            fieldSamples
        };
        
        console.log(`✅ Found ${allFields.size} unique fields`);
        console.log('Field types distribution:');
        
        const typeStats = { string: 0, number: 0, boolean: 0, object: 0 };
        Object.values(fieldTypes).forEach((types: any) => {
            types.forEach((type: string) => {
                if (type in typeStats) typeStats[type as keyof typeof typeStats]++;
            });
        });
        
        console.log(`  - Strings: ${typeStats.string} fields`);
        console.log(`  - Numbers: ${typeStats.number} fields`);
        console.log(`  - Booleans: ${typeStats.boolean} fields`);
        console.log(`  - Objects: ${typeStats.object} fields`);
        
        // Show sample field names and values
        console.log('\nSample fields and values:');
        Array.from(allFields).slice(0, 8).forEach(field => {
            const samples = fieldSamples[field];
            const types = Array.from(fieldTypes[field]).join('/');
            console.log(`  ${field} (${types}): ${samples.join(', ')}`);
        });
        
        if (allFields.size > 8) {
            console.log(`  ... and ${allFields.size - 8} more fields`);
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
    }
    
    // Generate comprehensive report
    console.log('📋 COMPREHENSIVE FIELD ANALYSIS REPORT');
    console.log('======================================\n');
    
    Object.entries(fieldMappings).forEach(([sport, data]: [string, any]) => {
        console.log(`## ${sport} (${data.totalLogs} logs, ${data.fieldCount} fields)`);
        
        // Categorize fields by naming pattern
        const camelCase = data.fields.filter((f: string) => /^[a-z][a-zA-Z]*$/.test(f));
        const snakeCase = data.fields.filter((f: string) => /^[a-z]+(_[a-z]+)+$/.test(f));
        const lowercase = data.fields.filter((f: string) => /^[a-z]+$/.test(f) && !camelCase.includes(f));
        const other = data.fields.filter((f: string) => 
            !camelCase.includes(f) && !snakeCase.includes(f) && !lowercase.includes(f)
        );
        
        console.log(`- **Naming Pattern**: ${camelCase.length} camelCase, ${snakeCase.length} snake_case, ${lowercase.length} lowercase, ${other.length} other`);
        
        // Identify key stats fields
        const keyFields = data.fields.filter((f: string) => 
            f.includes('point') || f.includes('goal') || f.includes('attempt') || 
            f.includes('yard') || f.includes('pass') || f.includes('rush') ||
            f.includes('hit') || f.includes('run') || f.includes('assist') ||
            f.includes('shot') || f.includes('save') || f.includes('minute')
        );
        
        console.log(`- **Key Stats Fields**: ${keyFields.join(', ')}`);
        
        // Data type analysis
        const stringFields = Object.entries(data.fieldTypes)
            .filter(([_, types]: [string, any]) => types.includes('string'))
            .map(([field, _]) => field);
        
        if (stringFields.length > 0) {
            console.log(`- **String Fields Needing Conversion**: ${stringFields.slice(0, 5).join(', ')}${stringFields.length > 5 ? '...' : ''}`);
        }
        
        console.log('');
    });
    
    // Generate field mapping suggestions
    console.log('🎯 FIELD MAPPING RECOMMENDATIONS');
    console.log('=================================\n');
    
    Object.entries(fieldMappings).forEach(([sport, data]: [string, any]) => {
        console.log(`### ${sport} Calculator Updates Needed:`);
        
        const fields = data.fields;
        
        // Basketball-specific mappings
        if (sport === 'NBA' || sport === 'NCAA_BB') {
            const fgFields = fields.filter((f: string) => 
                f.toLowerCase().includes('field') && f.toLowerCase().includes('goal')
            );
            const ptFields = fields.filter((f: string) => 
                f.toLowerCase().includes('point')
            );
            const minFields = fields.filter((f: string) => 
                f.toLowerCase().includes('minute')
            );
            
            console.log(`  - Field Goals: ${fgFields.join(', ')}`);
            console.log(`  - Points: ${ptFields.join(', ')}`);
            console.log(`  - Minutes: ${minFields.join(', ')}`);
        }
        
        // Football-specific mappings
        if (sport === 'NFL' || sport === 'NCAA_FB') {
            const passFields = fields.filter((f: string) => 
                f.toLowerCase().includes('pass')
            );
            const rushFields = fields.filter((f: string) => 
                f.toLowerCase().includes('rush')
            );
            const recFields = fields.filter((f: string) => 
                f.toLowerCase().includes('rec')
            );
            
            console.log(`  - Passing: ${passFields.slice(0, 3).join(', ')}...`);
            console.log(`  - Rushing: ${rushFields.slice(0, 3).join(', ')}...`);
            console.log(`  - Receiving: ${recFields.slice(0, 3).join(', ')}...`);
        }
        
        // String conversion warnings
        const stringFields = Object.entries(data.fieldTypes)
            .filter(([_, types]: [string, any]) => types.includes('string'))
            .map(([field, _]) => field);
        
        if (stringFields.length > 0) {
            console.log(`  - ⚠️  String→Number conversion needed for: ${stringFields.length} fields`);
        }
        
        console.log('');
    });
    
    // Save detailed mapping to file
    console.log('💾 Saving detailed field mappings to sports-field-mappings.json');
    const fs = require('fs');
    fs.writeFileSync(
        '/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate/sports-field-mappings.json',
        JSON.stringify(fieldMappings, null, 2)
    );
    
    console.log('\n🎉 FIELD DISCOVERY COMPLETE!');
    console.log('Next steps:');
    console.log('1. Review sports-field-mappings.json for detailed analysis');
    console.log('2. Update calculator functions with correct field names');
    console.log('3. Add string→number conversion where needed');
    console.log('4. Test calculations with sample data');
}

discoverAllSportsFields()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Field discovery failed:', error);
        process.exit(1);
    });