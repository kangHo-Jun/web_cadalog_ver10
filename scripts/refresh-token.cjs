const dotenv = require('dotenv');
const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

// .env.local 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const mallId = process.env.CAFE24_MALL_ID;
const clientId = process.env.CAFE24_CLIENT_ID;
const clientSecret = process.env.CAFE24_CLIENT_SECRET;
const refreshToken = process.env.CAFE24_REFRESH_TOKEN;

console.log(`🔄 Refreshing token for ${mallId}`);

const data = querystring.stringify({
  grant_type: 'refresh_token',
  refresh_token: refreshToken
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

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`📡 Status: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
      const result = JSON.parse(body);
      console.log('✅ Token refreshed successfully!');
      console.log('New Access Token:', result.access_token);
      
      // .env.local 업데이트
      const envPath = path.join(process.cwd(), '.env.local');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      envContent = envContent.replace(
        /CAFE24_ACCESS_TOKEN=.*/,
        `CAFE24_ACCESS_TOKEN=${result.access_token}`
      );
      
      if (result.refresh_token) {
        envContent = envContent.replace(
          /CAFE24_REFRESH_TOKEN=.*/,
          `CAFE24_REFRESH_TOKEN=${result.refresh_token}`
        );
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ .env.local updated!');
    } else {
      console.error('❌ Refresh Failed!');
      console.error('Response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request Error:', e.message);
});

req.write(data);
req.end();
