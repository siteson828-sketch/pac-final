// Art-retrieval kill switch. While frozen, no handler pulls new artworks from
// museum APIs. To thaw: set SYNC_ENABLED=true in Vercel env vars AND restore the
// sync crons in vercel.json (see git history before the "freeze" commit).
export const SYNC_FROZEN = process.env.SYNC_ENABLED !== 'true';

export function frozen(res) {
  if (!SYNC_FROZEN) return false;
  res.status(200).json({ ok: true, frozen: true, message: 'Art sync is frozen.' });
  return true;
}
