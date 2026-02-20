/**
 * Logic Verification Script (ver0219)
 */

// 1. Copy of normalizeProductName from product-utils.ts
function normalizeProductName(name) {
    if (!name) return '';
    return name
        .replace(/<[^>]*>/g, ' ')   // HTML Tag -> Space
        .replace(/&nbsp;/g, ' ')    // &nbsp; -> Space
        .replace(/&amp;/g, '&')     // &amp; -> &
        .replace(/&lt;/g, '<')      // &lt; -> <
        .replace(/&gt;/g, '>')      // &gt; -> >
        .replace(/\s+/g, ' ')       // Multi-space -> Single space
        .trim();
}

// 2. Logic Simulation
function simulateGrouping(product) {
    const parentName = normalizeProductName(product.product_name);
    let children = [];

    if (product.has_option === 'T') {
        const optionValues = product.options?.options?.[0]?.option_value || [];
        children = optionValues.map(ov => {
            const name = ov.value || ov.option_text || '';
            const matchedVariant = product.variants?.find(v =>
                v.options?.some(o => o.value === name)
            );
            const price = Number(product.price) + Number(matchedVariant?.additional_amount || 0);
            return { name, price, variantCode: matchedVariant?.variant_code || '' };
        });
    } else {
        children = [{
            name: parentName,
            price: Number(product.price),
            isSingle: true
        }];
    }

    return {
        id: product.product_code,
        parentName,
        children
    };
}

// 3. Test Cases
const testCases = [
    {
        name: "Case 1: Parent Name with HTML and 'x' (No Cutting)",
        product: {
            product_name: "단열재 GCS보드<br>31T x 900 x 2400mm",
            has_option: "F",
            product_code: "P0001",
            price: "50000"
        }
    },
    {
        name: "Case 2: Option Product (Grouping by option_value)",
        product: {
            product_name: "프리미엄 PF보드",
            has_option: "T",
            product_code: "P0002",
            price: "40000",
            options: {
                options: [{
                    option_value: [
                        { value: "30T x 1000 x 1800" },
                        { value: "50T x 1000 x 1800" }
                    ]
                }]
            },
            variants: [
                { variant_code: "V001", additional_amount: "5000", options: [{ value: "30T x 1000 x 1800" }] },
                { variant_code: "V002", additional_amount: "15000", options: [{ value: "50T x 1000 x 1800" }] }
            ]
        }
    }
];

console.log("=== Logic Verification Start (ver0219) ===\n");

testCases.forEach(tc => {
    console.log(`[Test] ${tc.name}`);
    const result = simulateGrouping(tc.product);
    console.log("Result:", JSON.stringify(result, null, 2));
    console.log("-------------------------------------------\n");
});

console.log("=== Verification Complete ===");
