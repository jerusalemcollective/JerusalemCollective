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
  request?: BookingRequestSummary | null
}

export type BookingRequestSummary = {
  id: string
  conversation_id: string | null
  listing_id: string | null
  host_id?: string | null
  guest_id?: string | null
  status: 'new' | 'host_replied' | 'accepted' | 'declined' | 'closed'
  check_in: string | null
  check_out: string | null
  guests: number
  message: string | null
  created_at: string
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

export async function createListingEnquiry(
  supabase: SupabaseClient,
  listingId: string,
  checkIn: string | null,
  checkOut: string | null,
  guests: number,
  message: string,
) {
  const { data, error } = await supabase.rpc('create_listing_enquiry', {
    target_listing_id: listingId,
    check_in_date: checkIn,
    check_out_date: checkOut,
    guest_count: guests,
    message_body: message,
  })

  if (error) throw error

  const result = Array.isArray(data) ? data[0] : data
  return {
    requestId: result?.request_id as string,
    conversationId: result?.conversation_id as string,
  }
}

export async function updateBookingRequestStatus(
  supabase: SupabaseClient,
  requestId: string,
  status: 'host_replied' | 'accepted' | 'declined' | 'closed',
) {
  const { error } = await supabase.rpc('update_booking_request_status', {
    request_uuid: requestId,
    new_status: status,
  })

  if (error) throw error
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

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  if (updateError) throw updateError
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
  return (data || []).map((message: ConversationMessage) => ({
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    content: message.content,
    read: message.read,
    created_at: message.created_at,
  }))
}
