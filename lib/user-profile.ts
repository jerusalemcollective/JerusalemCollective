import type { SupabaseClient, User } from '@supabase/supabase-js'

export type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  is_host: boolean
  created_at: string
  updated_at: string
}

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

export async function ensureProfile(supabase: SupabaseClient, user: User): Promise<Profile | null> {
  // First try to get existing profile
  const existing = await getProfile(supabase, user.id)
  if (existing) return existing

  // Create new profile
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'User'

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
    console.error('Error creating profile:', error)
    return null
  }

  return data
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating profile:', error)
    return null
  }

  return data
}

export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split('.').pop()
  // Store under the user's own folder so the storage policy can scope writes to
  // the owner: (storage.foldername(name))[1] = auth.uid().
  const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    console.error('Error uploading avatar:', uploadError)
    return null
  }

  // Get public URL
  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)

  // Update profile with new avatar URL
  await updateProfile(supabase, userId, { avatar_url: data.publicUrl })

  return data.publicUrl
}
