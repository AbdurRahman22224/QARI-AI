-- Run this in Supabase Dashboard → SQL Editor → New Query → Run

-- Users table (lightweight anchor)
CREATE TABLE IF NOT EXISTS users (
  qf_user_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) DEFAULT 'Student',
  email VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Practice sessions table
CREATE TABLE IF NOT EXISTS practice_sessions (
  id SERIAL PRIMARY KEY,
  qf_user_id VARCHAR(255) REFERENCES users(qf_user_id),
  surah_number INT NOT NULL,
  ayah_number INT NOT NULL,
  score INT DEFAULT 0,
  accuracy FLOAT DEFAULT 0,
  grade VARCHAR(20) DEFAULT 'N/A',
  raw_text TEXT DEFAULT '',
  duration_secs FLOAT DEFAULT 0,
  audio_url VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tajweed scores (per-rule breakdown per session)
CREATE TABLE IF NOT EXISTS tajweed_scores (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES practice_sessions(id) ON DELETE CASCADE,
  rule_name VARCHAR(50) NOT NULL,
  score INT DEFAULT 0,
  status VARCHAR(20) DEFAULT '',
  feedback TEXT DEFAULT ''
);

-- Word Lab attempts
CREATE TABLE IF NOT EXISTS word_lab_attempts (
  id SERIAL PRIMARY KEY,
  qf_user_id VARCHAR(255) REFERENCES users(qf_user_id),
  word_text VARCHAR(255) DEFAULT '',
  surah_number INT,
  ayah_number INT,
  word_position INT,
  difficulty VARCHAR(20) DEFAULT 'intermediate',
  score INT DEFAULT 0,
  tajweed_json JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_practice_user ON practice_sessions(qf_user_id);
CREATE INDEX IF NOT EXISTS idx_practice_date ON practice_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_tajweed_session ON tajweed_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_wordlab_user ON word_lab_attempts(qf_user_id);
