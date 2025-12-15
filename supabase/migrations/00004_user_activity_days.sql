-- Track daily user activity for streaks (KST day_key)
CREATE TABLE IF NOT EXISTS user_activity_days (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, day_key)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_days_created
  ON user_activity_days (user_id, created_at DESC);

ALTER TABLE user_activity_days ENABLE ROW LEVEL SECURITY;

-- Read only own rows
CREATE POLICY "Users can read own activity days" ON user_activity_days
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));

-- Insert only own rows
CREATE POLICY "Users can insert own activity days" ON user_activity_days
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE identity_id = auth.uid()::text));

