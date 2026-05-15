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
  // First ensure unified profile exists
  await ensureProfile(supabase, user)

  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Host'

  // Check if host profile exists
  const { data: existingHost } = await supabase
    .from('hosts')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existingHost) return existingHost

  // Create host profile linked to unified profile
  const hostProfile = {
    id: user.id,
    user_id: user.id,
    name: fullName,
    display_name: fullName.split(' ')[0],
    email: user.email,
    host_type: 'owner',
    show_full_name: false,
    is_verified: false,
  }

  const { data, error } = await supabase
    .from('hosts')
    .insert(hostProfile)
    .select()
    .single()

  if (error) {
    throw error
  }

  // Mark unified profile as host
  await supabase
    .from('profiles')
    .update({ is_host: true })
    .eq('id', user.id)

  return data
}
