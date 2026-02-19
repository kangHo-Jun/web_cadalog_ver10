const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const CODE = 'rL3FJUj0OFisXkQNS7eQeC'; // Authorization Code from user

async function exchangeCode() {
    const MALL_ID = process.env.MALL_ID;
    const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
    const CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
    const REDIRECT_URI = 'https://web-cadalog-ver10.vercel.app/api/auth/callback';

    console.log('🔄 Exchanging Authorization Code for Tokens...');
    console.log('Mall ID:', MALL_ID);
    console.log('Client ID:', CLIENT_ID);
    console.log('Redirect URI:', REDIRECT_URI);
    console.log('Code:', CODE);

    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    try {
        const response = await axios.post(
            `https://${MALL_ID}.cafe24api.com/api/v2/oauth/token`,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: CODE,
                redirect_uri: REDIRECT_URI,
            }),
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        console.log('\n✅ Token Exchange Successful!');
        console.log('Access Token:', response.data.access_token);
        console.log('Refresh Token:', response.data.refresh_token);
        console.log('Expires In:', response.data.expires_at);
        console.log('Scopes:', response.data.scope);

        console.log('\n📝 Update your .env.local with these values:');
        console.log(`CAFE24_ACCESS_TOKEN=${response.data.access_token}`);
        console.log(`CAFE24_REFRESH_TOKEN=${response.data.refresh_token}`);

        return response.data;
    } catch (error) {
        console.error('\n❌ Token Exchange Failed:');
        console.error('Status:', error.response?.status);
        console.error('Error:', error.response?.data || error.message);
        process.exit(1);
    }
}

exchangeCode();
