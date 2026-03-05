import { NextRequest, NextResponse } from 'next/server';
import { verifyPasscode, createSession, setPasscode, isAuthEnabled, hasPasscode, destroySession } from '@/lib/auth/session';

export async function GET() {
  return NextResponse.json({
    authEnabled: isAuthEnabled(),
    hasPasscode: hasPasscode(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === 'setup') {
    if (!body.passcode || body.passcode.length < 4) {
      return NextResponse.json({ error: 'Passcode must be at least 4 characters' }, { status: 400 });
    }
    await setPasscode(body.passcode);
    const sessionId = createSession();

    const res = NextResponse.json({ ok: true });
    res.cookies.set('devhub_session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
    return res;
  }

  if (body.action === 'login') {
    const valid = await verifyPasscode(body.passcode);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
    }
    const sessionId = createSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set('devhub_session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
    return res;
  }

  if (body.action === 'logout') {
    const sessionId = req.cookies.get('devhub_session')?.value;
    if (sessionId) destroySession(sessionId);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete('devhub_session');
    return res;
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
