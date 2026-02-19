const https = require('https');
const querystring = require('querystring');

const mallId = 'daesan3833';
const clientId = '5TbJGxFqFBOtlYEXoWL47D';
const clientSecret = 'UHF95YG2GFXk0njZYbZcCB';
const code = '9Rs3kR0PFtLhemMieTl7ee';
const redirectUri = 'https://web-cadalog-ver10.vercel.app/api/auth/callback';

const data = querystring.stringify({
  grant_type: 'authorization_code',
  code: code,
  redirect_uri: redirectUri
});

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const options = {
  hostname: `${mallId}.cafe24api.com`,
  path: '/api/v2/oauth/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${auth}`,
    'Content-Length': data.length
  }
};

console.log('🔄 Authorization Code → Access Token 교환 중...');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('📡 Status:', res.statusCode);
    console.log('Response:', body);

    if (res.statusCode === 200) {
      const result = JSON.parse(body);
      console.log('\n✅ 성공!');
      console.log('Access Token:', result.access_token);
      console.log('Refresh Token:', result.refresh_token || 'N/A');
      console.log('\n📝 .env.local에 사용할 값:');
      console.log(`CAFE24_ACCESS_TOKEN=${result.access_token}`);
      if (result.refresh_token) {
        console.log(`CAFE24_REFRESH_TOKEN=${result.refresh_token}`);
      }
    }
  });
});

req.on('error', (e) => console.error('❌ Error:', e));
req.write(data);
req.end();
