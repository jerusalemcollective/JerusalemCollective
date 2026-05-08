type AuthUser = {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string
    name?: string
  } | null
}

export async function ensureHostProfile(supabase: any, user: AuthUser) {
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Host'

  const profile = {
    id: user.id,
    name: fullName,
    display_name: fullName.split(' ')[0],
    email: user.email,
    host_type: 'owner',
    show_full_name: false,
    is_verified: false,
  }

  const { error } = await supabase
    .from('hosts')
    .upsert(profile, { onConflict: 'id' })
    .select('id')
    .single()

  if (error) {
    throw error
  }
}
