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

async function checkPlayerPhotos() {
    try {
        console.log('Checking for players with photo URLs...\n');
        
        // Count players with photo_url
        const { count: totalWithPhotos } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .not('photo_url', 'is', null);

        console.log(`Players with photo_url: ${totalWithPhotos}`);

        // Get sample of players with photos
        const { data: playersWithPhotos, error } = await supabase
            .from('players')
            .select('id, name, firstname, lastname, team, position, photo_url')
            .not('photo_url', 'is', null)
            .limit(10);

        if (error) {
            console.error('Error fetching players with photos:', error);
            return;
        }

        if (playersWithPhotos && playersWithPhotos.length > 0) {
            console.log('\nSample players with photo URLs:');
            console.log('================================');
            playersWithPhotos.forEach(player => {
                console.log(`\n${player.name || `${player.firstname} ${player.lastname}`}`);
                console.log(`  Team: ${player.team || 'N/A'}`);
                console.log(`  Position: ${JSON.stringify(player.position)}`);
                console.log(`  Photo URL: ${player.photo_url}`);
            });
        } else {
            console.log('\nNo players found with photo URLs.');
        }

        // Check for popular NFL players without photos
        const popularPlayers = [
            'Patrick Mahomes',
            'Josh Allen', 
            'Lamar Jackson',
            'Justin Jefferson',
            'Tyreek Hill',
            'Travis Kelce',
            'Christian McCaffrey',
            'Saquon Barkley'
        ];

        console.log('\n\nChecking popular players:');
        console.log('========================');

        for (const playerName of popularPlayers) {
            const { data: player, error } = await supabase
                .from('players')
                .select('id, name, firstname, lastname, team, position, photo_url')
                .or(`name.ilike.%${playerName}%,firstname.ilike.%${playerName.split(' ')[0]}%`)
                .limit(1)
                .single();

            if (!error && player) {
                console.log(`\n${player.name || `${player.firstname} ${player.lastname}`}:`);
                console.log(`  Has photo: ${player.photo_url ? 'YES' : 'NO'}`);
                if (player.photo_url) {
                    console.log(`  URL: ${player.photo_url}`);
                }
            }
        }

        // Check what kind of data is in photo_url for non-null entries
        const { data: urlPatterns } = await supabase
            .from('players')
            .select('photo_url')
            .not('photo_url', 'is', null)
            .limit(20);

        if (urlPatterns && urlPatterns.length > 0) {
            console.log('\n\nURL patterns found:');
            console.log('==================');
            const patterns = new Set();
            urlPatterns.forEach(p => {
                if (p.photo_url) {
                    try {
                        const url = new URL(p.photo_url);
                        patterns.add(url.hostname);
                    } catch {
                        // Not a valid URL
                        if (p.photo_url.length < 50) {
                            patterns.add('Invalid URL: ' + p.photo_url);
                        } else {
                            patterns.add('Invalid URL: ' + p.photo_url.substring(0, 50) + '...');
                        }
                    }
                }
            });
            
            patterns.forEach(pattern => console.log(`- ${pattern}`));
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkPlayerPhotos();