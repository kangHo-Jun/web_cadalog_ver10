import { NextResponse } from 'next/server';
import { saveTokens } from '@/lib/token-store';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { access_token, refresh_token, expires_at, refresh_token_expires_at } = body;

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }

    await saveTokens({
      access_token,
      refresh_token,
      expires_at,
      refresh_token_expires_at
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
