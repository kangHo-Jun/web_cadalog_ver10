const { createClient } = require('redis');

const REDIS_URL = process.env.KV_REDIS_URL;
const KEY = 'catalog:snapshot:v1';

// 테스트 데이터
const testData = {
  "P0000CHJ": {
    "parentName": "프리미엄 단열재 PF보드LX지인",
    "children": [
      {
        "variantCode": "P0000CHJ000A",
        "variantName": "30T x 1000 x 1800",
        "price": "18150"
      }
    ]
  }
};

async function run() {
  const client = createClient({ url: REDIS_URL });
  
  try {
    await client.connect();
    console.log('✅ TEST 1: Redis 연결 성공');
    
    // 저장
    await client.set(KEY, JSON.stringify(testData));
    console.log('✅ TEST 2: 데이터 저장 성공');
    
    // TTL 확인
    const ttl = await client.ttl(KEY);
    console.log(ttl === -1 ? '✅ TEST 3: TTL 미설정 확인' : '❌ TEST 3: TTL 설정됨');
    
    // 읽기
    const data = await client.get(KEY);
    const parsed = JSON.parse(data);
    console.log(JSON.stringify(parsed) === JSON.stringify(testData) ? '✅ TEST 4: 데이터 일치' : '❌ TEST 4: 데이터 불일치');
    
    console.log('\n전체 테스트 완료');
    
  } catch (err) {
    console.error('❌ 에러:', err.message);
  } finally {
    await client.quit();
  }
}

run();
