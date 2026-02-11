-- Add source_url column to visuals table for AI context restoration
ALTER TABLE "visuals" ADD COLUMN "source_url" varchar(500);
