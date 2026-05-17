import type { SupabaseClient } from '@supabase/supabase-js'

export type ConversationSummary = {
  id: string
  listing_id: string | null
  participant_1: string
  participant_2: string
  created_at: string
  updated_at: string
  listing?: {
    id: string
    title: string
    area: string
    cover_photo_url?: string | null
  } | null
  other_participant?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
  last_message?: {
    content: string
    sender_id: string
    created_at: string
  } | null
}

export type ConversationMessage = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  read: boolean
  created_at: string
}

export async function getOrCreateConversation(
  supabase: SupabaseClient,
  guestId: string,
  hostId: string,
  listingId: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_1', guestId)
    .eq('participant_2', hostId)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return existing.id

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_1: guestId,
      participant_2: hostId,
      listing_id: listingId,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function sendConversationMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderId: string,
  content: string,
) {
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content,
  })

  if (error) throw error

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
}

export async function loadConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as ConversationMessage[]
}

