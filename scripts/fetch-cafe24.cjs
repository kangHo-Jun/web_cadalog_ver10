require('dotenv').config({ path: '.env.local' });
const https = require('https');

const mallId = process.env.CAFE24_MALL_ID;
const accessToken = process.env.CAFE24_ACCESS_TOKEN;

console.log('Mall ID:', mallId);
console.log('Access Token:', accessToken ? (accessToken.substring(0, 10) + '...') : 'undefined');

const options = {
  hostname: `${mallId}.cafe24api.com`,
  path: '/api/v2/admin/products?limit=10',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body.substring(0, 500));
  });
});

req.on('error', (e) => console.error('Error:', e));
req.end();
