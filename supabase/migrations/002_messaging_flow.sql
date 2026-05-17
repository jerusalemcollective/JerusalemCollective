-- Messaging flow hardening

CREATE UNIQUE INDEX IF NOT EXISTS conversations_guest_host_listing_unique
  ON conversations (participant_1, participant_2, listing_id);

CREATE INDEX IF NOT EXISTS messages_conversation_created_at_idx
  ON messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS conversations_participant_1_updated_at_idx
  ON conversations (participant_1, updated_at DESC);

CREATE INDEX IF NOT EXISTS conversations_participant_2_updated_at_idx
  ON conversations (participant_2, updated_at DESC);
