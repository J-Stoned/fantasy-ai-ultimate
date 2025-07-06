import { createClient } from '../../../../lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeagueImportOnboarding } from '../../components/onboarding/LeagueImportOnboarding'

export default async function OnboardingPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth')
  }

  // Check if user already has leagues
  const { data: leagues } = await supabase
    .from('fantasy_leagues')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  // If they already have leagues, redirect to dashboard
  if (leagues && leagues.length > 0) {
    redirect('/dashboard')
  }

  return <LeagueImportOnboarding />
}