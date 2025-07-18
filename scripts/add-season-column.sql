-- Add season column to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS season INTEGER;