const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

// Test different Client Secret formats
const SECRETS_TO_TEST = [
    'UHF95YG2GFXk0njZYbZcCB',
    '4dce36cd-8c57-45dc-880d-d067ffd84880',
    'GIYib6feK0vCm4mevXpf7i'
];

async function testSecrets() {
    const MALL_ID = process.env.MALL_ID;
    const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
    const REDIRECT_URI = 'https://web-cadalog-ver10.vercel.app/api/auth/callback';

    console.log('🔍 Testing different Client Secret formats...\n');
    console.log('Mall ID:', MALL_ID);
    console.log('Client ID:', CLIENT_ID);
    console.log('Redirect URI:', REDIRECT_URI);
    console.log('\n' + '='.repeat(60) + '\n');

    for (let i = 0; i < SECRETS_TO_TEST.length; i++) {
        const secret = SECRETS_TO_TEST[i];
        console.log(`Test ${i + 1}/${SECRETS_TO_TEST.length}: ${secret}`);

        const credentials = Buffer.from(`${CLIENT_ID}:${secret}`).toString('base64');

        try {
            const response = await axios.post(
                `https://${MALL_ID}.cafe24api.com/api/v2/oauth/token`,
                new URLSearchParams({
                    grant_type: 'client_credentials',
                }),
                {
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            console.log('✅ SUCCESS! This is the correct Client Secret!\n');
            console.log('Update .env.local with:');
            console.log(`CAFE24_CLIENT_SECRET=${secret}\n`);
            return;
        } catch (error) {
            console.log(`❌ Failed: ${error.response?.data?.error_description || error.message}`);
        }
        console.log('');
    }

    console.log('⚠️  None of the secrets worked. Please verify:');
    console.log('1. Client Secret from Cafe24 Developer Center');
    console.log('2. App type is "Server-side App"');
    console.log('3. App has correct permissions');
}

testSecrets();
