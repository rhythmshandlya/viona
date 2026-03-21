-- Add template type column (varchar for consistency with existing schema)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'scene';

-- Create themes table
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color_palette JSONB,
  font_recommendations JSONB,
  style_guidance TEXT,
  preview_url VARCHAR(1024),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_themes_slug ON themes(slug);
CREATE INDEX IF NOT EXISTS idx_themes_is_published ON themes(is_published);

-- Create template_themes join table (many-to-many)
CREATE TABLE IF NOT EXISTS template_themes (
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  PRIMARY KEY (theme_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_template_themes_template ON template_themes(template_id);
