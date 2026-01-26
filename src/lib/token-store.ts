import { kv } from '@vercel/kv';

const TOKEN_KEY = 'cafe24_tokens';

export interface Tokens {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
}

export async function getTokens(): Promise<Tokens> {
    try {
        const tokens = await kv.get<Tokens>(TOKEN_KEY);
        if (tokens) {
            console.log('✅ Tokens retrieved from Vercel KV');
            return tokens;
        }
    } catch (error) {
        console.error('⚠️ KV get error:', error);
    }

    // Fallback to env vars
    console.log('ℹ️ Using tokens from environment variables');
    return {
        access_token: process.env.CAFE24_ACCESS_TOKEN || '',
        refresh_token: process.env.CAFE24_REFRESH_TOKEN || '',
    };
}

export async function saveTokens(tokens: Tokens): Promise<void> {
    try {
        await kv.set(TOKEN_KEY, tokens);
        console.log('✅ Tokens saved to Vercel KV');
    } catch (error) {
        console.error('❌ KV save error:', error);
    }
}
