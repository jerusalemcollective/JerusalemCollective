-- Unified Profiles Schema for JLM Collective
-- This creates a profiles table that works for both guests and hosts

-- Create profiles table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_host BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_listings table for wishlists
CREATE TABLE IF NOT EXISTS saved_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  host_id UUID,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER DEFAULT 1,
  total_price DECIMAL(10,2),
  status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversations table for messaging
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id column to hosts table to link with profiles
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id);

-- Create storage bucket for avatars (run in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles: users can view any profile, but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Saved listings: users can only manage their own
CREATE POLICY "Users can view own saved listings" ON saved_listings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved listings" ON saved_listings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved listings" ON saved_listings FOR DELETE USING (auth.uid() = user_id);

-- Bookings: users can view their own bookings, hosts can view bookings for their listings
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings" ON bookings FOR UPDATE USING (auth.uid() = user_id);

-- Conversations: participants can view their conversations
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT 
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT 
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Messages: conversation participants can view and send messages
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = messages.conversation_id 
    AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
  ));
CREATE POLICY "Users can send messages in their conversations" ON messages FOR INSERT 
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id 
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
