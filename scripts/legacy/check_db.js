import pg from 'pg';
const { Pool } = pg;
const pool = new Pool();
async function check() {
  try {
    const res = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    console.log("Tables:", res.rows.map(r => r.tablename));
    const news = await pool.query("SELECT COUNT(*) FROM news");
    const videos = await pool.query("SELECT COUNT(*) FROM videos");
    const chants = await pool.query("SELECT COUNT(*) FROM chants");
    console.log("News count:", news.rows[0].count);
    console.log("Videos count:", videos.rows[0].count);
    console.log("Chants count:", chants.rows[0].count);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
check();
