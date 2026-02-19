const fs = require('fs');

const categoryFile = 'test/phase1_raw/category-325.json';
const data = JSON.parse(fs.readFileSync(categoryFile, 'utf8'));

console.log('📊 원본 데이터 분석:');
console.log('- products 배열 존재:', !!data.products);
console.log('- products 개수:', data.products?.length || 0);

if (data.products && data.products.length > 0) {
  const first = data.products[0];
  console.log('\n📦 첫 번째 상품:');
  console.log('- product_code:', first.product_code);
  console.log('- product_name:', first.product_name);
  
  console.log('\n🔑 product_code 목록 (처음 10개):');
  data.products.slice(0, 10).forEach(p => {
    const code = p.product_code;
    const prefix = code?.substring(0, 8);
    console.log(`  ${code} → prefix: ${prefix}`);
  });
  
  const groups = {};
  data.products.forEach(p => {
    const code = p.product_code;
    if (code) {
      const prefix = code.substring(0, 8);
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(p);
    }
  });
  
  console.log('\n✅ 그룹핑 결과:');
  console.log('- 총 그룹 수:', Object.keys(groups).length);
  console.log('- 첫 5개 그룹:');
  Object.entries(groups).slice(0, 5).forEach(([prefix, items]) => {
    console.log(`  ${prefix}: ${items.length}개`);
  });
}
