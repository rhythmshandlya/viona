import { sql } from 'drizzle-orm';
import { db } from './src/db/index.js';

async function check() {
  const result = await db.execute(sql`
    SELECT ti.id, ti.data
    FROM timeline_items ti
    JOIN tracks t ON ti.track_id = t.id
    WHERE t.project_id = '4c940e28-c479-4287-9ab0-2f0d950c61c8'
    AND ti.type = 'visual'
  `);

  console.log('Found', result.rows.length, 'visual items\n');

  for (const row of result.rows) {
    const data = row.data as any;
    console.log('Item:', row.id);
    console.log('  sourceSceneId:', data.sourceSceneId);
    console.log('  type:', data.type);
    console.log('  description:', data.description?.substring(0, 80) + '...');
    console.log('  sourceVideoUrl:', data.sourceVideoUrl);
    console.log('  videoUrl:', data.videoUrl);
    console.log('  templateId:', data.templateId);
    console.log('---');
  }

  process.exit(0);
}

check();
