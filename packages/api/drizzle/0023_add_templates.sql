-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  tags JSONB DEFAULT '[]',
  aspect_ratio VARCHAR(10) NOT NULL DEFAULT '16:9',
  duration_frames INTEGER NOT NULL DEFAULT 360,
  fps INTEGER NOT NULL DEFAULT 30,
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  props_schema JSONB,
  default_props JSONB,
  screenshot_url VARCHAR(1024),
  bundle_key VARCHAR(1024),
  source_key VARCHAR(1024),
  version INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_is_published ON templates(is_published);
CREATE INDEX idx_templates_slug ON templates(slug);

-- Template exports table
CREATE TABLE IF NOT EXISTS template_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  props JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  output_url VARCHAR(1024),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

CREATE INDEX idx_template_exports_user ON template_exports(user_id);
CREATE INDEX idx_template_exports_status ON template_exports(status);
