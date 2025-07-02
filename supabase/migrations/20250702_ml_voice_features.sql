-- =====================================================
-- ML AND VOICE FEATURES MIGRATION
-- Adds missing tables for ML predictions tracking and voice features
-- Created: 2025-07-02
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ML OUTCOME TRACKING TABLES
-- =====================================================

-- ML Outcomes table - tracks actual results vs predictions
CREATE TABLE IF NOT EXISTS ml_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES ml_predictions(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prediction_type TEXT NOT NULL,
  predicted_value JSONB NOT NULL,
  actual_value JSONB NOT NULL,
  accuracy_score FLOAT,
  error_margin FLOAT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event-level predictions for granular tracking
CREATE TABLE IF NOT EXISTS event_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES game_events(event_id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  player_id INTEGER,
  team_id INTEGER,
  model_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  prediction JSONB NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  features JSONB,
  latency_ms FLOAT,
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML model performance tracking
CREATE TABLE IF NOT EXISTS ml_model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  model_version INTEGER NOT NULL,
  evaluation_date DATE NOT NULL,
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy FLOAT,
  precision_score FLOAT,
  recall_score FLOAT,
  f1_score FLOAT,
  confusion_matrix JSONB,
  feature_importance JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model_name, model_version, evaluation_date)
);

-- =====================================================
-- VOICE FEATURE TABLES
-- =====================================================

-- Voice commands history and processing
CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  command_text TEXT NOT NULL,
  command_intent TEXT,
  entities JSONB DEFAULT '{}',
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  audio_duration_ms INTEGER,
  processing_time_ms FLOAT,
  response_text TEXT,
  response_audio_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice training data for custom models
CREATE TABLE IF NOT EXISTS voice_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  sample_text TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  audio_format TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  sample_rate INTEGER,
  emotion TEXT CHECK (emotion IN ('neutral', 'excited', 'calm', 'urgent', 'friendly')),
  quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 1),
  is_approved BOOLEAN DEFAULT FALSE,
  training_status TEXT CHECK (training_status IN ('pending', 'training', 'completed', 'failed')),
  model_version INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- User voice preferences and settings
CREATE TABLE IF NOT EXISTS voice_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  voice_provider TEXT NOT NULL DEFAULT 'elevenlabs' CHECK (voice_provider IN ('elevenlabs', 'aws_polly', 'google_tts', 'azure_tts')),
  voice_id TEXT NOT NULL,
  voice_name TEXT,
  speaking_rate FLOAT DEFAULT 1.0 CHECK (speaking_rate >= 0.5 AND speaking_rate <= 2.0),
  pitch FLOAT DEFAULT 1.0 CHECK (pitch >= 0.5 AND pitch <= 2.0),
  volume FLOAT DEFAULT 1.0 CHECK (volume >= 0 AND volume <= 1),
  language TEXT DEFAULT 'en-US',
  wake_word TEXT DEFAULT 'Hey Fantasy',
  auto_listen BOOLEAN DEFAULT FALSE,
  sound_effects BOOLEAN DEFAULT TRUE,
  personality_traits JSONB DEFAULT '{"enthusiasm": 0.7, "formality": 0.5, "humor": 0.6}',
  custom_responses JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice interaction analytics
CREATE TABLE IF NOT EXISTS voice_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  command_id UUID REFERENCES voice_commands(id),
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('command', 'response', 'clarification', 'error')),
  duration_ms INTEGER,
  satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
  intent_accuracy FLOAT,
  response_relevance FLOAT,
  user_feedback TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- ML Outcomes indexes
CREATE INDEX IF NOT EXISTS idx_ml_outcomes_game_id ON ml_outcomes(game_id);
CREATE INDEX IF NOT EXISTS idx_ml_outcomes_model_name ON ml_outcomes(model_name);
CREATE INDEX IF NOT EXISTS idx_ml_outcomes_created_at ON ml_outcomes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_outcomes_prediction_id ON ml_outcomes(prediction_id);

-- Event predictions indexes
CREATE INDEX IF NOT EXISTS idx_event_predictions_game_id ON event_predictions(game_id);
CREATE INDEX IF NOT EXISTS idx_event_predictions_event_id ON event_predictions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_predictions_model ON event_predictions(model_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_predictions_player ON event_predictions(player_id) WHERE player_id IS NOT NULL;

-- ML model performance indexes
CREATE INDEX IF NOT EXISTS idx_ml_model_performance_lookup ON ml_model_performance(model_name, model_version, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_ml_model_performance_date ON ml_model_performance(evaluation_date DESC);

-- Voice commands indexes
CREATE INDEX IF NOT EXISTS idx_voice_commands_user ON voice_commands(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_commands_session ON voice_commands(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_commands_status ON voice_commands(status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_voice_commands_intent ON voice_commands(command_intent);

-- Voice training data indexes
CREATE INDEX IF NOT EXISTS idx_voice_training_user ON voice_training_data(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_training_status ON voice_training_data(training_status) WHERE training_status != 'completed';
CREATE INDEX IF NOT EXISTS idx_voice_training_voice ON voice_training_data(voice_id);

-- Voice preferences index
CREATE INDEX IF NOT EXISTS idx_voice_preferences_user ON voice_preferences(user_id);

-- Voice analytics indexes
CREATE INDEX IF NOT EXISTS idx_voice_analytics_user ON voice_analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_analytics_command ON voice_analytics(command_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to automatically update ML model performance
CREATE OR REPLACE FUNCTION update_ml_model_performance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update model performance metrics when new outcomes are recorded
  INSERT INTO ml_model_performance (
    model_name,
    model_version,
    evaluation_date,
    total_predictions,
    correct_predictions,
    accuracy
  )
  SELECT 
    NEW.model_name,
    1, -- Default version, should be enhanced to track actual versions
    CURRENT_DATE,
    COUNT(*),
    COUNT(*) FILTER (WHERE accuracy_score > 0.5),
    AVG(accuracy_score)
  FROM ml_outcomes
  WHERE model_name = NEW.model_name
    AND DATE(created_at) = CURRENT_DATE
  GROUP BY model_name
  ON CONFLICT (model_name, model_version, evaluation_date)
  DO UPDATE SET
    total_predictions = EXCLUDED.total_predictions,
    correct_predictions = EXCLUDED.correct_predictions,
    accuracy = EXCLUDED.accuracy,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update model performance
CREATE TRIGGER update_model_performance_trigger
AFTER INSERT ON ml_outcomes
FOR EACH ROW
EXECUTE FUNCTION update_ml_model_performance();

-- Function to update voice preferences timestamp
CREATE OR REPLACE FUNCTION update_voice_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for voice preferences updates
CREATE TRIGGER voice_preferences_updated
BEFORE UPDATE ON voice_preferences
FOR EACH ROW
EXECUTE FUNCTION update_voice_preferences_timestamp();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE ml_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_analytics ENABLE ROW LEVEL SECURITY;

-- ML tables are generally accessible for reading (analytics)
CREATE POLICY "ML outcomes readable by authenticated users" ON ml_outcomes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Event predictions readable by authenticated users" ON event_predictions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ML performance readable by all" ON ml_model_performance
  FOR SELECT USING (true);

-- Voice tables are user-specific
CREATE POLICY "Users can manage their own voice commands" ON voice_commands
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own voice training data" ON voice_training_data
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own voice preferences" ON voice_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own voice analytics" ON voice_analytics
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE ml_outcomes IS 'Tracks actual outcomes vs ML predictions for continuous learning';
COMMENT ON TABLE event_predictions IS 'Granular event-level predictions for real-time game analysis';
COMMENT ON TABLE ml_model_performance IS 'Daily performance metrics for each ML model';
COMMENT ON TABLE voice_commands IS 'Complete history of voice commands and their processing';
COMMENT ON TABLE voice_training_data IS 'Voice samples used to train custom voice models';
COMMENT ON TABLE voice_preferences IS 'User-specific voice assistant settings and preferences';
COMMENT ON TABLE voice_analytics IS 'Analytics and feedback for voice interactions';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This migration adds comprehensive ML outcome tracking and voice features:
-- - ML predictions can now be validated against actual outcomes
-- - Voice commands are fully tracked with analytics
-- - Custom voice training is supported
-- - User preferences enable personalized voice experiences