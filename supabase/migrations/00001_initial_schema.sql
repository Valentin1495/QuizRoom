-- QuizRoom Initial Schema Migration
-- Converted from Convex schema.ts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE deck_visibility AS ENUM ('public', 'unlisted', 'private');
CREATE TYPE deck_status AS ENUM ('draft', 'published', 'blocked');
CREATE TYPE question_type AS ENUM ('mcq', 'image', 'audio', 'boolean');
CREATE TYPE match_mode AS ENUM ('daily', 'swipe', 'live_match');
CREATE TYPE live_match_status AS ENUM (
  'lobby', 'countdown', 'question', 'grace', 
  'reveal', 'leaderboard', 'results', 'paused'
);
CREATE TYPE daily_category AS ENUM (
  'tech_it', 'variety_reality', 'drama_movie', 
  'sports_games', 'kpop_music', 'fashion_life', 'news_issues'
);
CREATE TYPE quiz_history_mode AS ENUM ('daily', 'swipe', 'live_match');

-- ============================================
-- CORE TABLES
-- ============================================

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  handle TEXT NOT NULL,
  avatar_url TEXT,
  interests TEXT[] DEFAULT '{}',
  streak INTEGER DEFAULT 0,
  last_streak_date DATE,
  xp INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_played INTEGER DEFAULT 0,
  cosmetics TEXT[] DEFAULT '{}',
  skill JSONB DEFAULT '{"global": 1200, "tags": []}',
  session_pref JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_identity ON users(identity_id);
CREATE INDEX idx_users_handle ON users(handle);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT NOT NULL,
  sample_tags TEXT[],
  neighbors JSONB, -- [{slug, weight}]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_created_at ON categories(created_at);

-- Decks table
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  visibility deck_visibility DEFAULT 'public',
  language TEXT DEFAULT 'ko',
  plays INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  status deck_status DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decks_slug ON decks(slug);
CREATE INDEX idx_decks_author ON decks(author_id);
CREATE INDEX idx_decks_status ON decks(status);
CREATE INDEX idx_decks_visibility ON decks(visibility);

-- Questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  type question_type DEFAULT 'mcq',
  prompt TEXT NOT NULL,
  prompt_hash TEXT NOT NULL, -- SHA256 hash for deduplication
  media_url TEXT,
  media_meta JSONB, -- {aspect, width, height}
  tags TEXT[],
  choices JSONB NOT NULL, -- [{id, text}]
  answer_index INTEGER NOT NULL,
  explanation TEXT,
  difficulty FLOAT DEFAULT 0.5,
  quality_score FLOAT DEFAULT 0.5,
  elo INTEGER DEFAULT 1200,
  choice_shuffle_seed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_deck ON questions(deck_id);
CREATE INDEX idx_questions_category_created ON questions(category, created_at);
CREATE INDEX idx_questions_elo_created ON questions(elo, created_at);
CREATE INDEX idx_questions_created_at ON questions(created_at);
CREATE INDEX idx_questions_prompt_hash ON questions(prompt_hash);

-- Live Match Decks table
CREATE TABLE live_match_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT NOT NULL,
  source_categories TEXT[] DEFAULT '{}',
  question_ids UUID[] DEFAULT '{}',
  total_questions INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_match_decks_slug ON live_match_decks(slug);
CREATE INDEX idx_live_match_decks_active_updated ON live_match_decks(is_active, updated_at);

-- ============================================
-- LIVE MATCH TABLES
-- ============================================

-- Live Match Rooms table
CREATE TABLE live_match_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES users(id) ON DELETE SET NULL,
  host_identity TEXT NOT NULL,
  status live_match_status DEFAULT 'lobby',
  deck_id UUID REFERENCES live_match_decks(id) ON DELETE SET NULL,
  rules JSONB NOT NULL DEFAULT '{
    "rounds": 10,
    "readSeconds": 3,
    "answerSeconds": 10,
    "graceSeconds": 2,
    "revealSeconds": 6,
    "leaderboardSeconds": 5
  }',
  current_round INTEGER DEFAULT 0,
  total_rounds INTEGER NOT NULL DEFAULT 10,
  server_now BIGINT,
  phase_ends_at BIGINT,
  expires_at BIGINT,
  version INTEGER DEFAULT 1,
  pending_action JSONB,
  pause_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_match_rooms_code ON live_match_rooms(code);
CREATE INDEX idx_live_match_rooms_host ON live_match_rooms(host_id);
CREATE INDEX idx_live_match_rooms_expires ON live_match_rooms(expires_at);

-- Live Match Participants table
CREATE TABLE live_match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES live_match_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  identity_id TEXT NOT NULL,
  is_guest BOOLEAN DEFAULT false,
  guest_avatar_id INTEGER,
  nickname TEXT NOT NULL,
  is_host BOOLEAN DEFAULT false,
  is_ready BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_score INTEGER DEFAULT 0,
  avg_response_ms FLOAT DEFAULT 0,
  answers INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  max_streak INTEGER DEFAULT 0,
  removed_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ
);

CREATE INDEX idx_live_match_participants_room ON live_match_participants(room_id);
CREATE INDEX idx_live_match_participants_room_user ON live_match_participants(room_id, user_id);
CREATE INDEX idx_live_match_participants_room_identity ON live_match_participants(room_id, identity_id);
CREATE INDEX idx_live_match_participants_identity ON live_match_participants(identity_id);

-- Live Match Rounds table
CREATE TABLE live_match_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES live_match_rooms(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  started_at BIGINT DEFAULT 0,
  closed_at BIGINT,
  reveal_at BIGINT,
  UNIQUE(room_id, index)
);

CREATE INDEX idx_live_match_rounds_room ON live_match_rounds(room_id);
CREATE INDEX idx_live_match_rounds_room_index ON live_match_rounds(room_id, index);

-- Live Match Answers table
CREATE TABLE live_match_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES live_match_rooms(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL,
  participant_id UUID REFERENCES live_match_participants(id) ON DELETE CASCADE,
  choice_index INTEGER NOT NULL,
  received_at BIGINT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  score_delta INTEGER DEFAULT 0
);

CREATE INDEX idx_live_match_answers_room_round ON live_match_answers(room_id, round_index);
CREATE INDEX idx_live_match_answers_room_participant ON live_match_answers(room_id, participant_id);
CREATE INDEX idx_live_match_answers_participant_round ON live_match_answers(participant_id, round_index);

-- Live Match Logs table
CREATE TABLE live_match_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES live_match_rooms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_match_logs_room ON live_match_logs(room_id);

-- Live Match Reactions table
CREATE TABLE live_match_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES live_match_rooms(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES live_match_participants(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL,
  emoji TEXT NOT NULL, -- 'clap' | 'fire' | 'skull' | 'laugh'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_match_reactions_room_round ON live_match_reactions(room_id, round_index);
CREATE INDEX idx_live_match_reactions_room ON live_match_reactions(room_id);

-- ============================================
-- USER ACTIVITY TABLES
-- ============================================

-- Answers table (swipe mode answers)
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  tags TEXT[],
  choice_id TEXT NOT NULL,
  answer_token TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_answers_user ON answers(user_id, created_at);
CREATE INDEX idx_answers_question ON answers(question_id, created_at);
CREATE INDEX idx_answers_user_question ON answers(user_id, question_id);

-- Quiz History table
CREATE TABLE quiz_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mode quiz_history_mode NOT NULL,
  session_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_history_user_created ON quiz_history(user_id, created_at);
CREATE INDEX idx_quiz_history_user_mode_created ON quiz_history(user_id, mode, created_at);
CREATE INDEX idx_quiz_history_user_mode_session ON quiz_history(user_id, mode, session_id);

-- Bookmarks table
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_bookmarks_user_question ON bookmarks(user_id, question_id);
CREATE INDEX idx_bookmarks_user_created ON bookmarks(user_id, created_at);

-- User Skill table
CREATE TABLE user_skill (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL, -- "category:kpop_music" or "tag:아이브"
  elo INTEGER DEFAULT 1200,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE INDEX idx_user_skill_user_key ON user_skill(user_id, key);

-- ============================================
-- DAILY QUIZ TABLES
-- ============================================

-- Daily Quizzes table
CREATE TABLE daily_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  available_date DATE UNIQUE NOT NULL,
  category daily_category NOT NULL,
  questions JSONB NOT NULL, -- [{id, prompt, correctAnswer, explanation, difficulty}]
  share_template JSONB NOT NULL, -- {headline, cta, emoji}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_quizzes_date ON daily_quizzes(available_date);

-- ============================================
-- REPORTING TABLES
-- ============================================

-- Reports table (authenticated users)
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  note TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_deck ON reports(deck_id);
CREATE INDEX idx_reports_question ON reports(question_id);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);

-- Guest Reports table (anonymous)
CREATE TABLE guest_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_slug TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  choice_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guest_reports_category ON guest_reports(category);

-- Guest Swipe Answers table
CREATE TABLE guest_swipe_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key TEXT NOT NULL,
  question_id TEXT NOT NULL,
  deck_slug TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_ms INTEGER,
  tags TEXT[],
  difficulty FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guest_swipe_answers_session ON guest_swipe_answers(session_key, created_at);

-- Tag Index table (for efficient tag-based queries)
CREATE TABLE tag_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tag_index_tag_created ON tag_index(tag, created_at);
CREATE INDEX idx_tag_index_tag_category ON tag_index(tag, category);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_match_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_match_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_match_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_match_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_match_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_match_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skill ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_swipe_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_index ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users: users can read all, update own
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (auth.uid()::text = identity_id);
CREATE POLICY "Users can insert own record" ON users FOR INSERT WITH CHECK (auth.uid()::text = identity_id);

-- Categories: public read
CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (true);

-- Decks: public decks readable, own decks manageable
CREATE POLICY "Public decks are viewable" ON decks FOR SELECT USING (visibility = 'public' OR author_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));
CREATE POLICY "Users can create decks" ON decks FOR INSERT WITH CHECK (author_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));
CREATE POLICY "Users can update own decks" ON decks FOR UPDATE USING (author_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));

-- Questions: readable with deck, manageable by deck author
CREATE POLICY "Questions readable with deck" ON questions FOR SELECT USING (true);
CREATE POLICY "Questions insertable by deck author" ON questions FOR INSERT 
  WITH CHECK (deck_id IN (SELECT id FROM decks WHERE author_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text)));

-- Live Match Decks: public read
CREATE POLICY "Live match decks viewable" ON live_match_decks FOR SELECT USING (true);

-- Live Match Rooms: participants can read
CREATE POLICY "Rooms viewable by participants" ON live_match_rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create rooms" ON live_match_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Hosts can update rooms" ON live_match_rooms FOR UPDATE USING (true);

-- Live Match Participants: room participants can read
CREATE POLICY "Participants viewable in room" ON live_match_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join as participant" ON live_match_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants can update self" ON live_match_participants FOR UPDATE USING (true);

-- Live Match Rounds, Answers, Logs, Reactions: room participants access
CREATE POLICY "Rounds viewable" ON live_match_rounds FOR SELECT USING (true);
CREATE POLICY "Rounds insertable" ON live_match_rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Rounds updatable" ON live_match_rounds FOR UPDATE USING (true);

CREATE POLICY "Answers viewable" ON live_match_answers FOR SELECT USING (true);
CREATE POLICY "Answers insertable" ON live_match_answers FOR INSERT WITH CHECK (true);

CREATE POLICY "Logs viewable" ON live_match_logs FOR SELECT USING (true);
CREATE POLICY "Logs insertable" ON live_match_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Reactions viewable" ON live_match_reactions FOR SELECT USING (true);
CREATE POLICY "Reactions insertable" ON live_match_reactions FOR INSERT WITH CHECK (true);

-- Answers: users can read/write own
CREATE POLICY "Users can read own answers" ON answers FOR SELECT 
  USING (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));
CREATE POLICY "Users can insert own answers" ON answers FOR INSERT 
  WITH CHECK (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));

-- Quiz History: users can read/write own
CREATE POLICY "Users can read own history" ON quiz_history FOR SELECT 
  USING (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));
CREATE POLICY "Users can insert own history" ON quiz_history FOR INSERT 
  WITH CHECK (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));
CREATE POLICY "Users can update own history" ON quiz_history FOR UPDATE 
  USING (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));

-- Bookmarks: users can read/write own
CREATE POLICY "Users can read own bookmarks" ON bookmarks FOR SELECT 
  USING (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));
CREATE POLICY "Users can manage own bookmarks" ON bookmarks FOR ALL 
  USING (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));

-- User Skill: users can read/write own
CREATE POLICY "Users can read own skill" ON user_skill FOR SELECT 
  USING (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));
CREATE POLICY "Users can manage own skill" ON user_skill FOR ALL 
  USING (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));

-- Daily Quizzes: public read
CREATE POLICY "Daily quizzes viewable" ON daily_quizzes FOR SELECT USING (true);

-- Reports: users can read/write own
CREATE POLICY "Users can read own reports" ON reports FOR SELECT 
  USING (reporter_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));
CREATE POLICY "Users can create reports" ON reports FOR INSERT 
  WITH CHECK (reporter_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));

-- Guest tables: anyone can insert, service role can read
CREATE POLICY "Anyone can submit guest reports" ON guest_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can log guest answers" ON guest_swipe_answers FOR INSERT WITH CHECK (true);

-- Tag Index: public read
CREATE POLICY "Tag index viewable" ON tag_index FOR SELECT USING (true);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for live match tables
ALTER PUBLICATION supabase_realtime ADD TABLE live_match_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE live_match_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE live_match_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE live_match_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE live_match_reactions;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_match_decks_updated_at BEFORE UPDATE ON live_match_decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired rooms
CREATE OR REPLACE FUNCTION cleanup_expired_live_rooms()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  room_record RECORD;
BEGIN
  FOR room_record IN 
    SELECT id FROM live_match_rooms 
    WHERE expires_at IS NOT NULL 
    AND expires_at <= extract(epoch from now()) * 1000
    LIMIT 20
  LOOP
    -- Delete related records
    DELETE FROM live_match_reactions WHERE room_id = room_record.id;
    DELETE FROM live_match_logs WHERE room_id = room_record.id;
    DELETE FROM live_match_answers WHERE room_id = room_record.id;
    DELETE FROM live_match_rounds WHERE room_id = room_record.id;
    DELETE FROM live_match_participants WHERE room_id = room_record.id;
    DELETE FROM live_match_rooms WHERE id = room_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TYPE DEFINITIONS FOR TYPESCRIPT
-- ============================================

COMMENT ON TABLE users IS 'User accounts linked to auth providers';
COMMENT ON TABLE live_match_rooms IS 'Active live match game rooms';
COMMENT ON TABLE live_match_participants IS 'Players in live match rooms';
COMMENT ON TABLE questions IS 'Quiz questions for all game modes';
COMMENT ON TABLE daily_quizzes IS 'Daily challenge quiz sets';
