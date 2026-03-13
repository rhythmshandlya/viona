import { sql } from 'drizzle-orm';
import { db } from './src/db/index.js';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=R3B4y0rCtQM';
const ITEM_ID = '558c3c18-a807-4bf7-94be-2bc09c44d446'; // Scene 5

async function fix() {
  // Get current data
  const result = await db.execute(sql`
    SELECT data FROM timeline_items WHERE id = ${ITEM_ID}
  `);

  if (result.rows.length === 0) {
    console.log('Item not found');
    process.exit(1);
  }

  const currentData = result.rows[0].data as any;
  console.log('Current data:', JSON.stringify(currentData, null, 2));

  // Add sourceVideoUrl
  const newData = {
    ...currentData,
    sourceVideoUrl: YOUTUBE_URL,
  };

  console.log('\nUpdating with sourceVideoUrl:', YOUTUBE_URL);

  await db.execute(sql`
    UPDATE timeline_items
    SET data = ${JSON.stringify(newData)}::jsonb
    WHERE id = ${ITEM_ID}
  `);

  console.log('Done! Restart server and refresh browser.');
  process.exit(0);
}

fix();
