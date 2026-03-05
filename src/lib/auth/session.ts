import { getDb } from '../db';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'devhub_session';
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// In-memory session store (simple for V1)
const sessions = new Map<string, { createdAt: number }>();

export function isAuthEnabled(): boolean {
  const db = getDb();
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'auth_enabled'").get() as any;
  return setting?.value === 'true';
}

export function hasPasscode(): boolean {
  const db = getDb();
  const auth = db.prepare('SELECT passcode_hash FROM auth WHERE id = 1').get() as any;
  return !!auth;
}

export async function setPasscode(passcode: string): Promise<void> {
  const db = getDb();
  const hash = await bcrypt.hash(passcode, 12);
  db.prepare(`
    INSERT INTO auth (id, passcode_hash) VALUES (1, ?)
    ON CONFLICT (id) DO UPDATE SET passcode_hash = ?, created_at = datetime('now')
  `).run(hash, hash);

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auth_enabled', 'true')").run();
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  const db = getDb();
  const auth = db.prepare('SELECT passcode_hash FROM auth WHERE id = 1').get() as any;
  if (!auth) return false;
  return bcrypt.compare(passcode, auth.passcode_hash);
}

export function createSession(): string {
  const sessionId = uuid();
  sessions.set(sessionId, { createdAt: Date.now() });
  return sessionId;
}

export function validateSession(sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export async function requireAuth(): Promise<boolean> {
  if (!isAuthEnabled()) return true;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  return validateSession(sessionId);
}
