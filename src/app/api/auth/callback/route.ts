import axios from 'axios';
import { NextResponse } from 'next/server';
import { saveTokens, type Tokens } from '@/lib/token-store';

const TOKEN_URL = 'https://daesan3833.cafe24api.com/api/v2/oauth/token';
const REDIRECT_URI = 'https://web-cadalog-ver10.vercel.app/api/auth/callback';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    if (error) {
        return NextResponse.json(
            {
                success: false,
                error,
                error_description: errorDescription || 'Cafe24 authorization failed',
            },
            { status: 400 }
        );
    }

    if (!code) {
        return NextResponse.json(
            {
                success: false,
                error: 'Missing code parameter',
            },
            { status: 400 }
        );
    }

    const clientId = process.env.CAFE24_CLIENT_ID;
    const clientSecret = process.env.CAFE24_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return NextResponse.json(
            {
                success: false,
                error: 'Missing Cafe24 client credentials',
            },
            { status: 500 }
        );
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post(
            TOKEN_URL,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
            }),
            {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const tokens: Tokens = {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_at: Date.now() + 2 * 60 * 60 * 1000,
            refresh_token_expires_at: response.data.refresh_token_expires_at
                ? new Date(response.data.refresh_token_expires_at).getTime()
                : undefined,
        };

        await saveTokens(tokens);

        return NextResponse.json({
            success: true,
            message: 'Cafe24 tokens exchanged and saved successfully',
            data: {
                expires_at: tokens.expires_at,
                refresh_token_expires_at: tokens.refresh_token_expires_at ?? null,
            },
        });
    } catch (err: any) {
        const status = err.response?.status ?? 500;
        const details = err.response?.data ?? err.message;

        console.error('❌ Cafe24 callback token exchange failed:', details);

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to exchange Cafe24 authorization code',
                details,
            },
            { status }
        );
    }
}
