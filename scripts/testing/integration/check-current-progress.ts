import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProgress() {
    const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
        
    console.log('\n📊 CURRENT COLLECTION STATUS');
    console.log('============================');
    console.log('Total logs:', count?.toLocaleString());
    console.log('Progress to 600K:', ((count || 0) / 600000 * 100).toFixed(1) + '%');
    console.log('Logs needed:', (600000 - (count || 0)).toLocaleString());
    
    // Calculate milestones
    const milestones = [150000, 200000, 250000, 300000, 400000, 500000, 600000];
    const nextMilestone = milestones.find(m => m > (count || 0));
    if (nextMilestone) {
        console.log('Next milestone:', nextMilestone.toLocaleString());
        console.log('Logs to milestone:', (nextMilestone - (count || 0)).toLocaleString());
    }
}

checkProgress();