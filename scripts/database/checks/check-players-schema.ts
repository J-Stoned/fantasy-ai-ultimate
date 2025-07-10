import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPlayersSchema() {
    try {
        console.log('Checking players table schema...\n');
        
        // Query to get column information from information_schema
        const { data, error } = await supabase
            .rpc('get_table_schema', {
                table_name: 'players'
            })
            .single();

        if (error) {
            // If the function doesn't exist, use a direct query
            const { data: schemaData, error: schemaError } = await supabase
                .from('players')
                .select('*')
                .limit(0);

            if (schemaError) {
                console.error('Error fetching schema:', schemaError);
                return;
            }

            // Get a sample row to see the columns
            const { data: sampleRow, error: sampleError } = await supabase
                .from('players')
                .select('*')
                .limit(1)
                .single();

            if (!sampleError && sampleRow) {
                console.log('Players table columns:');
                console.log('===================');
                Object.keys(sampleRow).forEach(column => {
                    const value = sampleRow[column];
                    const type = value === null ? 'unknown' : typeof value;
                    console.log(`- ${column} (${type})`);
                    
                    // Check for image-related columns
                    if (column.toLowerCase().includes('image') || 
                        column.toLowerCase().includes('photo') || 
                        column.toLowerCase().includes('headshot') ||
                        column.toLowerCase().includes('picture') ||
                        column.toLowerCase().includes('avatar')) {
                        console.log(`  ⚡ IMAGE COLUMN FOUND: ${column}`);
                        if (value) {
                            console.log(`  Sample value: ${value}`);
                        }
                    }
                });
            }
        } else {
            console.log('Schema information:', data);
        }

        // Also check for any columns with URLs
        const { data: urlCheck, error: urlError } = await supabase
            .from('players')
            .select('*')
            .limit(5);

        if (!urlError && urlCheck && urlCheck.length > 0) {
            console.log('\n\nChecking for URL patterns in data:');
            console.log('==================================');
            
            const firstRow = urlCheck[0];
            Object.keys(firstRow).forEach(column => {
                const values = urlCheck.map(row => row[column]).filter(v => v);
                const hasUrls = values.some(v => 
                    typeof v === 'string' && (
                        v.includes('http://') || 
                        v.includes('https://') ||
                        v.includes('.jpg') ||
                        v.includes('.png') ||
                        v.includes('.jpeg') ||
                        v.includes('.gif') ||
                        v.includes('.webp')
                    )
                );
                
                if (hasUrls) {
                    console.log(`\n⚡ Column "${column}" contains URLs or image references:`);
                    values.slice(0, 3).forEach(v => {
                        if (v && typeof v === 'string' && (v.includes('http') || v.includes('.jpg') || v.includes('.png'))) {
                            console.log(`  - ${v}`);
                        }
                    });
                }
            });
        }

        // Get total count
        const { count } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true });

        console.log(`\n\nTotal players in database: ${count}`);

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkPlayersSchema();