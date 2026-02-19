import axios from 'axios';
import { getTokens, saveTokens, type Tokens } from './token-store';

export { getTokens };

export async function refreshAccessToken() {
    const { refresh_token } = await getTokens();
    const mallId = process.env.MALL_ID;
    const clientId = process.env.CAFE24_CLIENT_ID;
    const clientSecret = process.env.CAFE24_CLIENT_SECRET;

    if (!mallId || !clientId || !clientSecret || !refresh_token) {
        throw new Error('Missing credentials for token refresh');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post(
            `https://${mallId}.cafe24api.com/api/v2/oauth/token`,
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refresh_token,
            }),
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const newTokens: Tokens = {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_at: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
            // Parse ISO string from Cafe24 API (e.g. "2026-03-05T08:26:51.000")
            refresh_token_expires_at: response.data.refresh_token_expires_at
                ? new Date(response.data.refresh_token_expires_at).getTime()
                : Date.now() + 14 * 24 * 60 * 60 * 1000, // fallback: 14 days
        };

        await saveTokens(newTokens);
        console.log('✅ Successfully refreshed and saved Cafe24 tokens');
        return newTokens.access_token;
    } catch (error: any) {
        console.error('❌ Failed to refresh tokens:', error.response?.data || error.message);
        throw error;
    }
}
