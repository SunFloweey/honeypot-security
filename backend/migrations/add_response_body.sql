-- Migration: Add response_body column to logs table
-- Date: 2026-01-23
-- This migration adds tracking of server responses for forensic analysis

-- Add the response_body column
ALTER TABLE logs 
ADD COLUMN response_body TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'logs' AND column_name = 'response_body';
