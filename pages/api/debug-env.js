export const dynamic = 'force-dynamic';

export default function handler(req, res) {
  if (req.query.secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.status(200).json({
    EUROPEANA_KEY: process.env.EUROPEANA_KEY || 'NOT SET',
    EUROPEANA_KEY_LENGTH: (process.env.EUROPEANA_KEY || '').length,
    HAS_DPLA: !!process.env.DPLA_KEY,
    HAS_HARVARD: !!process.env.HARVARD_KEY,
  });
}
