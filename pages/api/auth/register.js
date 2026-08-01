import bcrypt from 'bcryptjs';
import { db, ensureAuthTables, getUserByEmail, createUser } from '../../../lib/authdb';

// Email/password sign-up. Credentials login needs a user row to authenticate
// against, so this creates it (with a bcrypt hash) plus a default 'free' tier.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, name } = req.body || {};
  const em = (email || '').toLowerCase().trim();
  if (!em || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const sql = db();
    await ensureAuthTables(sql);
    const existing = await getUserByEmail(sql, em);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
    const passwordHash = await bcrypt.hash(String(password), 10);
    await createUser(sql, { email: em, passwordHash, name: (name || '').trim() || null });
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('register error:', e.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}
