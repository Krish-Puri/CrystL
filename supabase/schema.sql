-- CrystL Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Schema changes (run these on existing DBs first)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add updated_at + personality_version to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS personality_version INTEGER DEFAULT 1 NOT NULL;

-- 2. Fix safety_events.safety_level CHECK to include 0 (was 1, 2 only)
ALTER TABLE safety_events DROP CONSTRAINT IF EXISTS safety_events_safety_level_check;
ALTER TABLE safety_events ADD CONSTRAINT safety_events_safety_level_check
  CHECK (safety_level IN (0, 1, 2));

-- 3. Make reflection_feedback.reflection_id NOT NULL
ALTER TABLE reflection_feedback ALTER COLUMN reflection_id SET NOT NULL;

-- 4. Add validated_at to theme_trends
ALTER TABLE theme_trends ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ DEFAULT now();

-- 5. Add user_id index to safety_events
CREATE INDEX IF NOT EXISTS idx_safety_events_user ON safety_events(user_id);

-- 6. Add was_regenerated to reflection_feedback
ALTER TABLE reflection_feedback ADD COLUMN IF NOT EXISTS was_regenerated BOOLEAN DEFAULT false NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- sessions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  ended_at TIMESTAMPTZ,
  mood_at_start TEXT CHECK (mood_at_start IN ('calm', 'okay', 'low', 'sad', 'overwhelmed')),
  memory_summary TEXT,
  theme TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  personality_version INTEGER DEFAULT 1 NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- conversation_states (runtime state per active session)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_states (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  current_mood TEXT CHECK (current_mood IN ('calm', 'okay', 'low', 'sad', 'overwhelmed')),
  current_intent TEXT CHECK (current_intent IN ('vent', 'reflection', 'advice', 'grounding', 'checkin', 'context', 'pause')),
  conversation_phase TEXT DEFAULT 'checkin' NOT NULL CHECK (conversation_phase IN ('start', 'checkin', 'explore', 'clarify', 'support', 'reflection', 'close')),
  current_theme TEXT,
  safety_level INTEGER DEFAULT 0 NOT NULL CHECK (safety_level IN (0, 1, 2)),
  last_reflection_saved BOOLEAN DEFAULT false NOT NULL,
  message_count INTEGER DEFAULT 0 NOT NULL,
  grounding_recommended BOOLEAN DEFAULT false NOT NULL,
  is_paused BOOLEAN DEFAULT false NOT NULL,
  mode TEXT DEFAULT 'default' NOT NULL CHECK (mode IN ('vent', 'reflection', 'advice', 'default')),
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- messages
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  intent TEXT CHECK (intent IN ('vent', 'reflection', 'advice', 'grounding', 'checkin', 'context', 'pause')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- reflections (user-saved summary cards)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  theme TEXT NOT NULL,
  mood TEXT CHECK (mood IN ('calm', 'okay', 'low', 'sad', 'overwhelmed')),
  next_step TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- theme_trends (semantic memory — aggregated per user)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS theme_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  conversation_count INTEGER DEFAULT 1 NOT NULL,
  trend TEXT DEFAULT 'stable' NOT NULL CHECK (trend IN ('improving', 'stable', 'worsening', 'new')),
  last_mood TEXT CHECK (last_mood IN ('calm', 'okay', 'low', 'sad', 'overwhelmed')),
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, theme)
);

-- ─────────────────────────────────────────────────────────────
-- safety_events (flag only — no message content stored)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  safety_level INTEGER NOT NULL CHECK (safety_level IN (0, 1, 2)),
  resolved BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- reflection_feedback (product learning)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reflection_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_id UUID NOT NULL REFERENCES reflections(id) ON DELETE CASCADE,
  was_helpful BOOLEAN,
  was_edited BOOLEAN DEFAULT false NOT NULL,
  was_discarded BOOLEAN DEFAULT false NOT NULL,
  was_regenerated BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- themes (normalized theme lookup)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Seed initial themes
INSERT INTO themes (slug, display_name) VALUES
  ('presentation-anxiety', 'Presentation Anxiety'),
  ('career-growth', 'Career & Growth'),
  ('self-confidence', 'Self-Confidence'),
  ('relationship-stress', 'Relationship Stress'),
  ('family', 'Family'),
  ('loneliness', 'Loneliness'),
  ('burnout', 'Burnout'),
  ('breakup', 'Breakup & Loss'),
  ('general', 'General')
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- reflection_drafts (AI owns the draft, user owns the final)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reflection_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  theme_slug TEXT NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('calm', 'okay', 'low', 'sad', 'overwhelmed')),
  next_step TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days') NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- ai_usage (observability — no PII)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('orchestrator', 'safety', 'reflection', 'summary')),
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- session_events (product analytics)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'session_start', 'session_end', 'reflection_saved', 'reflection_discarded',
    'reflection_regenerated', 'voice_used', 'transcript_edited',
    'grounding_used', 'safety_triggered', 'pause_together_used'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_theme ON reflections(user_id, theme);
CREATE INDEX IF NOT EXISTS idx_theme_trends_user ON theme_trends(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_session ON safety_events(session_id);
CREATE INDEX IF NOT EXISTS idx_reflection_feedback_reflection ON reflection_feedback(reflection_id);
CREATE INDEX IF NOT EXISTS idx_reflection_drafts_session ON reflection_drafts(session_id);
CREATE INDEX IF NOT EXISTS idx_reflection_drafts_user ON reflection_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_session ON ai_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_operation ON ai_usage(operation);
CREATE INDEX IF NOT EXISTS idx_session_events_user ON session_events(user_id);
CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events(event_type);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_feedback ENABLE ROW LEVEL SECURITY;

-- Sessions: users can only see their own
CREATE POLICY "Users can manage own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Messages: users can only see messages from their own sessions
CREATE POLICY "Users can manage own messages" ON messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = messages.session_id AND sessions.user_id = auth.uid())
  );

-- Conversation states: users can only see states from their own sessions
CREATE POLICY "Users can manage own conversation states" ON conversation_states
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = conversation_states.session_id AND sessions.user_id = auth.uid())
  );

-- Reflections: users can only see their own
CREATE POLICY "Users can manage own reflections" ON reflections
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Theme trends: users can only see their own
CREATE POLICY "Users can manage own theme trends" ON theme_trends
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Safety events: users can only see their own
CREATE POLICY "Users can manage own safety events" ON safety_events
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reflection feedback: users can only manage feedback on their own reflections
CREATE POLICY "Users can manage own reflection feedback" ON reflection_feedback
  FOR ALL USING (
    EXISTS (SELECT 1 FROM reflections WHERE reflections.id = reflection_feedback.reflection_id AND reflections.user_id = auth.uid())
  );

-- Reflection drafts: users can only manage their own drafts
CREATE POLICY "Users can manage own reflection drafts" ON reflection_drafts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- AI usage: users can only see their own usage
CREATE POLICY "Users can view own ai_usage" ON ai_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Session events: users can only see their own events
CREATE POLICY "Users can manage own session events" ON session_events
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Themes: read-only lookup, no RLS needed (public table)
