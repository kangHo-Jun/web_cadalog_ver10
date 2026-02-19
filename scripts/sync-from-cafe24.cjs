require('dotenv').config({ path: '.env.local' });
const https = require('https');
const fs = require('fs');
const path = require('path');

const mallId = process.env.CAFE24_MALL_ID;
const accessToken = process.env.CAFE24_ACCESS_TOKEN;

console.log('🔄 Cafe24에서 상품 데이터 수집 중...');
console.log('Mall ID:', mallId);

// 카테고리 325-333
const categories = [325, 326, 327, 328, 329, 330, 331, 332, 333];

const fetchCategory = (categoryNo) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `${mallId}.cafe24api.com`,
      path: `/api/v2/admin/products?category=${categoryNo}&limit=100`,
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
        if (res.statusCode === 200) {
          const result = JSON.parse(body);
          console.log(`✅ Category ${categoryNo}: ${result.products?.length || 0}개 상품`);
          resolve({ categoryNo, products: result.products || [] });
        } else {
          console.error(`❌ Category ${categoryNo}: Status ${res.statusCode}`);
          resolve({ categoryNo, products: [] });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Category ${categoryNo}: ${e.message}`);
      resolve({ categoryNo, products: [] });
    });

    req.end();
  });
};

(async () => {
  const results = [];
  
  for (const cat of categories) {
    const data = await fetchCategory(cat);
    results.push(data);
    await new Promise(r => setTimeout(r, 500)); // 0.5초 대기
  }

  // 저장
  const dir = path.join(process.cwd(), 'test/phase1_raw');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  results.forEach(({ categoryNo, products }) => {
    const filePath = path.join(dir, `category-${categoryNo}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ products }, null, 2));
    console.log(`💾 저장: ${filePath} (${products.length}개)`);
  });

  console.log('\n✅ 모든 카테고리 수집 완료!');
  console.log(`📊 총 ${results.reduce((sum, r) => sum + r.products.length, 0)}개 상품`);
})();
