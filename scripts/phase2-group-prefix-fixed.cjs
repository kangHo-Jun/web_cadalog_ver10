const fs = require('fs');
const path = require('path');

const categories = [325, 326, 327, 328, 329, 330, 331, 332, 333];
const rawDir = 'test/phase1_raw';
const outputDir = 'test/phase2_grouped';
const outputFile = path.join(outputDir, 'grouped-by-prefix.json');

// 출력 디렉토리 생성
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const allGroups = {};

console.log('🔄 정규화 시작...\n');

categories.forEach(catNo => {
  const filePath = path.join(rawDir, `category-${catNo}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Category ${catNo}: 파일 없음`);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const products = data.products || [];
  
  console.log(`📦 Category ${catNo}: ${products.length}개 상품`);
  
  products.forEach(product => {
    const code = product.product_code;
    if (!code) return;
    
    const prefix = code.substring(0, 8);
    
    if (!allGroups[prefix]) {
      allGroups[prefix] = {
        prefix: prefix,
        variants: []
      };
    }
    
    allGroups[prefix].variants.push(product);
  });
});

// 결과 저장
fs.writeFileSync(outputFile, JSON.stringify(allGroups, null, 2));

console.log('\n✅ 정규화 완료!');
console.log(`📁 파일: ${outputFile}`);
console.log(`📊 총 그룹 수: ${Object.keys(allGroups).length}`);
console.log(`📦 총 상품 수: ${Object.values(allGroups).reduce((sum, g) => sum + g.variants.length, 0)}`);

console.log('\n🔍 처음 5개 그룹:');
Object.entries(allGroups).slice(0, 5).forEach(([prefix, group]) => {
  console.log(`  ${prefix}: ${group.variants.length}개`);
});
