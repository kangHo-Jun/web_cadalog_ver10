const code = 'EY5jOETYGNolP6QMhZ6g5B';
const CLIENT_ID = '5TbJGxFqFBOtlYEXoWL47D';
const CLIENT_SECRET = 'GIYib6feK0vCm4mevXpf7i';

fetch('https://daesan3833.cafe24api.com/api/v2/oauth/token', {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: 'https://daesan3833.cafe24.com'
  })
})
.then(r => r.json())
.then(d => console.log('ACCESS_TOKEN:', d.access_token))
