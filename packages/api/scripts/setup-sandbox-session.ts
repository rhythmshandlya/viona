import 'dotenv/config';
import pg from 'pg';
import { randomBytes } from 'node:crypto';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://viona:viona123@localhost:5432/viona' });
const c = await pool.connect();
try {
  const cols = await c.query(
    "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='sandbox_sessions' ORDER BY ordinal_position",
  );
  console.log('sandbox_sessions schema:');
  for (const r of cols.rows) console.log(' ', r.column_name, 'nullable=' + r.is_nullable, 'default=' + (r.column_default || 'none'));

  const proj = await c.query('SELECT id, title, video_key, user_id FROM projects WHERE video_key IS NOT NULL AND user_id IS NOT NULL LIMIT 1');
  if (!proj.rows.length) {
    console.error('\nNO PROJECT with video_key + user_id. Upload a video first.');
    process.exit(1);
  }
  const p = proj.rows[0];
  console.log('\npicked project:', p.id, '| title:', p.title, '| video_key:', p.video_key, '| user_id:', p.user_id);

  const secret = 'test-' + randomBytes(16).toString('hex');
  const r = await c.query(
    `INSERT INTO sandbox_sessions (id, project_id, user_id, sandbox_secret, provider, status)
     VALUES (gen_random_uuid(), $1, $2, $3, 'test', 'ready')
     ON CONFLICT (project_id) DO UPDATE SET sandbox_secret = EXCLUDED.sandbox_secret, status = 'ready'
     RETURNING id`,
    [p.id, p.user_id, secret],
  );
  console.log('\n=== EXPORT THESE ===');
  console.log('export TEST_SANDBOX_ID=' + r.rows[0].id);
  console.log('export TEST_SANDBOX_SECRET=' + secret);
  console.log('export TEST_VIDEO_KEY=' + p.video_key);
} finally {
  c.release();
  await pool.end();
}
