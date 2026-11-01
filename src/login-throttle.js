import { createHash } from 'node:crypto';
import { pool } from './db.js';

// Do not trust client-supplied forwarding headers. Behind a proxy this groups
// requests by proxy address until a platform-specific trusted proxy is configured.
export async function loginLimit(req, res, next) {
  const peer = req.socket.remoteAddress;
  if (!peer) return res.status(503).json({error:'Sign-in temporarily unavailable'});
  const key = createHash('sha256').update(peer).digest('hex');
  try {
    const result = await pool.query(`INSERT INTO login_throttles AS t(peer_hash,window_start,attempts)
      VALUES($1,clock_timestamp(),1)
      ON CONFLICT(peer_hash) DO UPDATE SET
        window_start = CASE WHEN t.window_start <= clock_timestamp() - interval '15 minutes' THEN clock_timestamp() ELSE t.window_start END,
        attempts = CASE WHEN t.window_start <= clock_timestamp() - interval '15 minutes' THEN 1 ELSE t.attempts + 1 END
      RETURNING attempts`, [key]);
    if (result.rows[0].attempts > 20) return res.status(429).json({error:'Too many sign-in attempts. Try again later.'});
    return next();
  } catch {
    // Do not silently fall back to per-instance counters if the shared store fails.
    return res.status(503).json({error:'Sign-in temporarily unavailable'});
  }
}
