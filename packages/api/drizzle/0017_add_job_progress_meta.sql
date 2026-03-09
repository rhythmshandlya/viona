-- Add progress_meta JSONB column to jobs table for structured progress tracking
ALTER TABLE "jobs" ADD COLUMN "progress_meta" jsonb;
