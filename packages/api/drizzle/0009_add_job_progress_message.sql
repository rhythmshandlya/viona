-- Add progress_message column to jobs table for real-time progress tracking
ALTER TABLE "jobs" ADD COLUMN "progress_message" varchar(500);
