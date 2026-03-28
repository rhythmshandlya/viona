import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from the API package (has DATABASE_URL)
config({ path: resolve(import.meta.dirname, '../../api/.env') });

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const THEMES_DIR = join(import.meta.dirname, '..', 'themes');

interface ThemeDefinition {
  slug: string;
  name: string;
  description: string;
  colorPalette: Record<string, string>;
  fontRecommendations: Record<string, string>;
  styleGuidance: string;
}

async function seedThemes() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL required');

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  const files = readdirSync(THEMES_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} theme definitions`);

  for (const file of files) {
    const theme: ThemeDefinition = JSON.parse(
      readFileSync(join(THEMES_DIR, file), 'utf-8'),
    );

    const sql = `
      INSERT INTO themes (slug, name, description, color_palette, font_recommendations, style_guidance, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        color_palette = EXCLUDED.color_palette,
        font_recommendations = EXCLUDED.font_recommendations,
        style_guidance = EXCLUDED.style_guidance,
        updated_at = NOW()
    `;

    await client.query(sql, [
      theme.slug,
      theme.name,
      theme.description,
      JSON.stringify(theme.colorPalette),
      JSON.stringify(theme.fontRecommendations),
      theme.styleGuidance,
    ]);

    console.log(`Upserted theme: ${theme.slug}`);
  }

  await client.end();
  console.log('Done seeding themes');
}

seedThemes().catch(err => {
  console.error('Failed to seed themes:', err);
  process.exit(1);
});
