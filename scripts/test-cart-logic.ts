import { useCartStore } from '../src/store/useCartStore';

async function testCart() {
    console.log('--- Testing Cart Logic ---');
    const store = useCartStore.getState();
    const testProduct = {
        product_no: 123,
        parent_name: 'Test Parent Product',
        product_name: 'Test Product',
        price: '1000',
        product_code: 'TP001'
    };

    // 1. Initial State
    console.log('1. Initial items:', store.items.length);

    // 2. Add Item
    useCartStore.getState().addToCart(testProduct, 1);
    let state = useCartStore.getState();
    console.log('2. After add:', state.items[0]?.quantity === 1 ? 'SUCCESS' : 'FAIL');
    console.log('   Last added:', state.lastAddedProductNo === 123 ? 'SUCCESS' : 'FAIL');

    // 3. Add Again (Aggregation)
    useCartStore.getState().addToCart(testProduct, 1);
    state = useCartStore.getState();
    console.log('3. After 2nd add (Aggregation):', state.items[0]?.quantity === 2 ? 'SUCCESS' : 'FAIL');

    // 4. Undo Last Add
    useCartStore.getState().undoLastAdd();
    state = useCartStore.getState();
    console.log('4. After Undo:', state.items[0]?.quantity === 1 ? 'SUCCESS' : 'FAIL');
    console.log('   Last added cleared:', state.lastAddedProductNo === null ? 'SUCCESS' : 'FAIL');

    // 5. Undo Again (Should be null-op or clear last item if 1)
    useCartStore.getState().addToCart(testProduct, 1); // Set last added
    useCartStore.getState().undoLastAdd();
    useCartStore.getState().undoLastAdd(); // Serial undo check
    state = useCartStore.getState();
    console.log('5. Multiple Undo check:', state.lastAddedProductNo === null ? 'SUCCESS' : 'FAIL');

    // 6. Rapid Add (10 times)
    for (let i = 0; i < 10; i++) {
        useCartStore.getState().addToCart(testProduct, 1);
    }
    state = useCartStore.getState();
    console.log('6. Rapid 10 adds:', state.items.find(i => i.product.product_no === 123)?.quantity === 11 ? 'SUCCESS' : 'FAIL');
}

testCart().catch(console.error);
