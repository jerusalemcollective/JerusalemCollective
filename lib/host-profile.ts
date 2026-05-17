type AuthUser = {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string
    name?: string
    avatar_url?: string
  } | null
}

// Ensure profile exists in unified profiles table
export async function ensureProfile(supabase: any, user: AuthUser) {
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'User'

  // Check if profile exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existing) return existing

  // Create new profile
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      full_name: fullName,
      avatar_url: user.user_metadata?.avatar_url || null,
      is_host: false,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

// Ensure host profile exists (call this when user becomes a host)
export async function ensureHostProfile(supabase: any, user: AuthUser) {
  const { data, error } = await supabase.rpc('ensure_current_user_host_profile')

  if (error) {
    throw error
  }

  return data
}
