#!/usr/bin/env node

/**
 * Cafe24 OAuth Token Generator
 * 
 * This script helps you obtain fresh OAuth tokens from Cafe24.
 * 
 * Usage:
 * 1. Run: node scripts/get-cafe24-token.js
 * 2. Open the displayed URL in your browser
 * 3. Authorize the app
 * 4. Copy the 'code' from the redirect URL
 * 5. Paste it back into this script
 */

const https = require('https');
const readline = require('readline');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const MALL_ID = process.env.MALL_ID;
const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const REDIRECT_URI = process.env.CAFE24_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

if (!MALL_ID || !CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Missing required environment variables:');
    console.error('   MALL_ID, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET');
    console.error('   Please check your .env.local file.');
    process.exit(1);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n🔐 Cafe24 OAuth Token Generator\n');
console.log('━'.repeat(60));

// Step 1: Generate authorization URL
const authUrl = `https://${MALL_ID}.cafe24api.com/api/v2/oauth/authorize?` +
    `response_type=code&` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `scope=mall.read_product,mall.write_product`;

console.log('\n📋 Step 1: Open this URL in your browser:\n');
console.log(`   ${authUrl}\n`);
console.log('━'.repeat(60));
console.log('\n📋 Step 2: After authorizing, you will be redirected to:');
console.log(`   ${REDIRECT_URI}?code=XXXXX\n`);
console.log('   Copy the "code" parameter from the URL.\n');
console.log('━'.repeat(60));

// Step 2: Get authorization code from user
rl.question('\n✏️  Paste the authorization code here: ', (code) => {
    if (!code || code.trim() === '') {
        console.error('\n❌ No code provided. Exiting.');
        rl.close();
        process.exit(1);
    }

    console.log('\n🔄 Exchanging code for tokens...\n');

    // Step 3: Exchange code for tokens
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const postData = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code.trim(),
        redirect_uri: REDIRECT_URI
    }).toString();

    const options = {
        hostname: `${MALL_ID}.cafe24api.com`,
        path: '/api/v2/oauth/token',
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const response = JSON.parse(data);

                if (res.statusCode === 200 && response.access_token) {
                    console.log('✅ Success! Tokens generated:\n');
                    console.log('━'.repeat(60));
                    console.log('\n📝 Copy these values to your .env.local file:\n');
                    console.log(`CAFE24_ACCESS_TOKEN=${response.access_token}`);
                    console.log(`CAFE24_REFRESH_TOKEN=${response.refresh_token}`);
                    console.log('\n━'.repeat(60));
                    console.log('\n💡 Next steps:');
                    console.log('   1. Update .env.local with the tokens above');
                    console.log('   2. Restart your dev server (Ctrl+C, then npm run dev)');
                    console.log('   3. Refresh your browser\n');
                } else {
                    console.error('❌ Token exchange failed:');
                    console.error(JSON.stringify(response, null, 2));
                }
            } catch (error) {
                console.error('❌ Failed to parse response:', data);
            }
            rl.close();
        });
    });

    req.on('error', (error) => {
        console.error('❌ Request failed:', error.message);
        rl.close();
    });

    req.write(postData);
    req.end();
});
