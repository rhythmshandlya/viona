-- Add low-res video proxy keys + status to `assets`.
-- The asset-metadata worker now generates a ~480p H.264 proxy alongside the
-- thumbnail/waveform. The editor prefers proxy_key for preview playback so
-- it doesn't stream the original full-quality bytes on every seek.

ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "proxy_key" varchar(500),
  ADD COLUMN IF NOT EXISTS "proxy_status" varchar(20) NOT NULL DEFAULT 'pending';
