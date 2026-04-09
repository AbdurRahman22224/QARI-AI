-- Run this in Supabase Dashboard → SQL Editor
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS total_words INT DEFAULT 0;
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS mistake_count INT DEFAULT 0;
