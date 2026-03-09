// 전역 변수
let allProducts = [];
let filteredProducts = [];
let quoteItems = new Map();

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    // await loadDisplayConfig(); // CSV 설정은 사용하지 않음
    await loadProducts();
    initializeEventListeners();

    // 초기 렌더링
    // 주요 품목(테이블)만 렌더링
    renderFeaturedTable(allProducts.filter(p => p.is_table_view));

    // 전체 카탈로그(그리드)는 숨김 상태로 시작
    document.getElementById('catalogSection').style.display = 'none';
    updateQuoteCount();
});

// 상품 데이터 로드
async function loadProducts() {
    try {
        const response = await fetch('../../data/refined_catalog.json');
        const products = await response.json();

        // 데이터 가공
        allProducts = products.map((p, index) => ({
            ...p,
            display_order: index + 1,
            category: p.category || '미분류'
        }));

        filteredProducts = [...allProducts];
        populateCategoryFilter();

        console.log(`✅ ${allProducts.length}개 상품 로드 완료`);
    } catch (error) {
        console.error('❌ 상품 데이터 로드 실패:', error);
        alert('상품 데이터를 불러오는데 실패했습니다.');
    }
}

// 카테고리 필터 옵션 생성
function populateCategoryFilter() {
    const categories = [...new Set(allProducts.map(p => p.category))].filter(c => c);
    const select = document.getElementById('categoryFilter');

    // 기존 옵션 초기화 (첫 번째 제외)
    while (select.options.length > 1) {
        select.remove(1);
    }

    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

// 이벤트 리스너 초기화
function initializeEventListeners() {
    document.getElementById('searchBtn').addEventListener('click', applyFilters);
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') applyFilters();
    });

    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('resetBtn').addEventListener('click', resetFilters);

    document.getElementById('openQuote').addEventListener('click', openQuotePanel);
    document.getElementById('closeQuote').addEventListener('click', closeQuotePanel);
    document.getElementById('downloadQuote').addEventListener('click', downloadQuote);
    document.getElementById('emailQuote').addEventListener('click', emailQuote);
}

// 필터 적용 (검색/카테고리 변경 시)
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const category = document.getElementById('categoryFilter').value;

    // 검색어나 카테고리 필터가 없으면 초기 상태(주요 품목 20선)로 복귀
    if (!searchTerm && !category) {
        resetFilters();
        return;
    }

    // 필터링 적용
    filteredProducts = allProducts.filter(product => {
        const matchesSearch = !searchTerm ||
            product.name.toLowerCase().includes(searchTerm) ||
            product.code.toLowerCase().includes(searchTerm);

        const matchesCategory = !category || product.category === category;

        return matchesSearch && matchesCategory;
    });

    // 화면 전환: 주요 품목 숨김, 검색 결과 테이블 표시
    document.getElementById('featuredSection').style.display = 'none';
    document.getElementById('catalogSection').style.display = 'block';

    // 검색 결과 타이틀 업데이트
    const resultTitle = document.querySelector('#catalogSection h2');
    resultTitle.textContent = `🔍 검색 결과 (${filteredProducts.length}개)`;

    renderSearchResultTable(filteredProducts);
}

// 필터 초기화
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';

    filteredProducts = [...allProducts];

    // 화면 전환: 주요 품목 표시, 검색 결과 테이블 숨김
    document.getElementById('featuredSection').style.display = 'block';
    document.getElementById('catalogSection').style.display = 'none';
}

// 검색 결과 렌더링 (테이블)
function renderSearchResultTable(products) {
    const tbody = document.getElementById('searchResultTableBody');
    const noResults = document.getElementById('noResults');
    const totalCount = document.getElementById('totalCount');

    tbody.innerHTML = '';
    totalCount.textContent = products.length;

    if (products.length === 0) {
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';

    products.forEach((product, index) => {
        const row = createProductRow(product, index + 1);
        tbody.appendChild(row);
    });
}

// 주요 품목 렌더링 (테이블)
function renderFeaturedTable(products) {
    const tbody = document.getElementById('featuredTableBody');
    tbody.innerHTML = '';

    products.forEach((product, index) => {
        const row = createProductRow(product, index + 1);
        tbody.appendChild(row);
    });
}

// 전체 품목 렌더링 (그리드)
function renderCatalogGrid(products) {
    const grid = document.getElementById('productGrid');
    const noResults = document.getElementById('noResults');
    const totalCount = document.getElementById('totalCount');

    grid.innerHTML = '';
    totalCount.textContent = products.length;

    if (products.length === 0) {
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';

    products.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });
}

// HTML 헬퍼: 테이블 행 생성
function createProductRow(product, displayOrder) {
    const row = document.createElement('tr');
    const isInQuote = quoteItems.has(product.product_no);
    const priceClass = product.price > 0 ? 'product-price' : 'product-price inquiry';
    const priceText = formatPrice(product.price);

    row.innerHTML = `
        <td>${displayOrder}</td>
        <td class="product-code">${product.code}</td>
        <td class="product-name">${product.name}</td>
        <td><span class="product-category">${product.category}</span></td>
        <td class="${priceClass}">${priceText}</td>
        <td>
            <button class="btn-add-quote ${isInQuote ? 'added' : ''}" 
                    onclick="addToQuote(${product.product_no})">
                ${isInQuote ? '✓' : '+'}
            </button>
        </td>
    `;
    return row;
}

// HTML 헬퍼: 카드 생성
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const isInQuote = quoteItems.has(product.product_no);
    const priceClass = product.price > 0 ? 'card-price' : 'card-price inquiry';
    const priceText = formatPrice(product.price);

    // 이미지가 없으면 텍스트 아이콘 표시
    let imageContent = `<div class="card-no-image">📦</div>`;
    if (product.image_url) {
        imageContent = `<img src="${product.image_url}" alt="${product.name}" class="card-image" onerror="this.parentElement.innerHTML='<div class=\\'card-no-image\\'>📦</div>'">`;
    }

    card.innerHTML = `
        <div class="card-image-wrapper">
            ${imageContent}
        </div>
        <div class="card-body">
            <div class="card-header">
                <span class="card-category">${product.category}</span>
                <span class="card-code">${product.code}</span>
            </div>
            <h3 class="card-title" title="${product.name}">${product.name}</h3>
            <div class="card-footer">
                <div class="${priceClass}">${priceText}</div>
                <button class="btn-add-quote ${isInQuote ? 'added' : ''}" 
                        onclick="addToQuote(${product.product_no})">
                    ${isInQuote ? '담기' : '견적 +'}
                </button>
            </div>
        </div>
    `;
    return card;
}

// 견적에 추가
function addToQuote(productNo) {
    const product = allProducts.find(p => p.product_no === productNo);
    if (!product) return;

    if (quoteItems.has(productNo)) {
        quoteItems.delete(productNo);
    } else {
        quoteItems.set(productNo, {
            product: product,
            quantity: 1
        });
    }

    updateQuotePanel();
    updateQuoteCount();

    // UI 업데이트 (테이블과 그리드 모두)
    updateAllAddButtons(productNo);
}

// 버튼 상태 일괄 업데이트
function updateAllAddButtons(productNo) {
    const isInQuote = quoteItems.has(productNo);

    // 테이블 내 버튼 찾기
    const tableButtons = document.querySelectorAll(`#featuredTableBody button[onclick="addToQuote(${productNo})"]`);
    tableButtons.forEach(btn => {
        btn.className = `btn-add-quote ${isInQuote ? 'added' : ''}`;
        btn.textContent = isInQuote ? '✓' : '+';
    });

    // 그리드 내 버튼 찾기
    const gridButtons = document.querySelectorAll(`#productGrid button[onclick="addToQuote(${productNo})"]`);
    gridButtons.forEach(btn => {
        btn.className = `btn-add-quote ${isInQuote ? 'added' : ''}`;
        btn.textContent = isInQuote ? '담기' : '견적 +';
    });
}

// 견적 패널 업데이트
function updateQuotePanel() {
    const container = document.getElementById('quoteItems');
    container.innerHTML = '';

    if (quoteItems.size === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">견적에 추가된 상품이 없습니다.</p>';
        updateQuoteSummary();
        return;
    }

    quoteItems.forEach((item, productNo) => {
        const div = document.createElement('div');
        div.className = 'quote-item';
        div.innerHTML = `
            <div class="quote-item-name">${item.product.name}</div>
            <div class="quote-item-controls">
                <label>수량:</label>
                <input type="number" class="qty-input" value="${item.quantity}" min="1" 
                       onchange="updateQuantity(${productNo}, this.value)">
                <span>${formatPrice(item.product.price * item.quantity)}</span>
                <button class="remove-item" onclick="removeFromQuote(${productNo})">삭제</button>
            </div>
        `;
        container.appendChild(div);
    });

    updateQuoteSummary();
}

function updateQuantity(productNo, quantity) {
    const qty = parseInt(quantity) || 1;
    if (quoteItems.has(productNo)) {
        quoteItems.get(productNo).quantity = qty;
        updateQuoteSummary();
    }
}

function removeFromQuote(productNo) {
    quoteItems.delete(productNo);
    updateQuotePanel();
    updateQuoteCount();
    updateAllAddButtons(productNo);
}

function updateQuoteSummary() {
    const itemCount = document.getElementById('quoteItemCount');
    const totalPrice = document.getElementById('quoteTotalPrice');

    let total = 0;
    quoteItems.forEach(item => {
        total += item.product.price * item.quantity;
    });

    itemCount.textContent = quoteItems.size;
    totalPrice.textContent = formatPrice(total);
}

function updateQuoteCount() {
    document.getElementById('quoteCount').textContent = quoteItems.size;
}

function openQuotePanel() {
    document.getElementById('quotePanel').classList.add('open');
    updateQuotePanel();
}

function closeQuotePanel() {
    document.getElementById('quotePanel').classList.remove('open');
}

function downloadQuote() {
    if (quoteItems.size === 0) {
        alert('견적에 추가된 상품이 없습니다.');
        return;
    }

    let text = '='.repeat(60) + '\n';
    text += '대산우드랜드 견적서\n';
    text += '='.repeat(60) + '\n\n';

    let total = 0;
    let index = 1;

    quoteItems.forEach(item => {
        const subtotal = item.product.price * item.quantity;
        total += subtotal;

        text += `[${index}] ${item.product.name}\n`;
        text += `    상품코드: ${item.product.code}\n`;
        text += `    카테고리: ${item.product.category}\n`;
        text += `    단가: ${formatPrice(item.product.price)}\n`;
        text += `    수량: ${item.quantity}개\n`;
        text += `    소계: ${formatPrice(subtotal)}\n`;
        text += '-'.repeat(60) + '\n';
        index++;
    });

    text += '\n' + '='.repeat(60) + '\n';
    text += `총 금액: ${formatPrice(total)}\n`;
    text += '='.repeat(60) + '\n';

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `견적서_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    alert('견적서가 다운로드되었습니다.');
}

function emailQuote() {
    if (quoteItems.size === 0) {
        alert('견적에 추가된 상품이 없습니다.');
        return;
    }

    const email = prompt('견적서를 받을 이메일 주소를 입력하세요:');
    if (email) {
        alert(`${email}로 견적서가 전송되었습니다. (시뮬레이션)`);
    }
}

function formatPrice(price) {
    if (!price || price === 0) return '가격문의';
    return price.toLocaleString('ko-KR') + '원';
}
