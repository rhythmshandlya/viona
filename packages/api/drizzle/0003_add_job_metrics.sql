-- Add metrics columns to jobs table for cost tracking and logging
ALTER TABLE jobs ADD COLUMN metrics JSONB;
-- metrics schema: {
--   inputTokens: number,
--   outputTokens: number,
--   estimatedCostUsd: number,
--   durationMs: number,
--   llmModel: string,
--   filesWritten: number,
--   screenshotsTaken: number
-- }

ALTER TABLE jobs ADD COLUMN logs TEXT[];
-- Array of log entries for debugging
