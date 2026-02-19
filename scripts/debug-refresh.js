const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const MALL_ID = process.env.MALL_ID;
const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.CAFE24_REFRESH_TOKEN;

async function testManualRefresh() {
    console.log('Testing Manual Refresh...');
    console.log('MALL_ID:', MALL_ID);
    console.log('CLIENT_ID:', CLIENT_ID);

    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    try {
        const response = await axios.post(
            `https://${MALL_ID}.cafe24api.com/api/v2/oauth/token`,
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: REFRESH_TOKEN,
            }),
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        console.log('Success!');
        console.log('Access Token:', response.data.access_token);
    } catch (error) {
        console.error('Failed:', error.response?.data || error.message);
    }
}

testManualRefresh();
