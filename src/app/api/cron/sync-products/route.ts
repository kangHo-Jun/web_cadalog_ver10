import { NextResponse } from 'next/server';
import { createClient } from 'redis';
import apiClient from '@/lib/api-client';

const CATEGORY_NOS = [325, 326, 327, 328, 329, 330, 331, 332, 333];
const SNAPSHOT_KEY = 'catalog:snapshot:v1';

export async function GET() {
  try {
    const allProducts: any[] = [];
    
    for (const catNo of CATEGORY_NOS) {
      const response = await apiClient.get('/products', {
        params: {
          category: catNo,
          embed: 'variants',
          limit: 100
        }
      });
      
      if (response.data.products) {
        allProducts.push(...response.data.products);
      }
    }
    
    const grouped: Record<string, any> = {};
    
    for (const product of allProducts) {
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          const variantCode = variant.variant_code;
          if (variantCode && variantCode.length >= 8) {
            const parentCode = variantCode.substring(0, 8);
            
            if (!grouped[parentCode]) {
              grouped[parentCode] = {
                parentName: product.product_name,
                children: []
              };
            }
            
            grouped[parentCode].children.push({
              variantCode: variantCode,
              variantName: variant.variant_name || '',
              price: variant.additional_amount || '0'
            });
          }
        }
      }
    }
    
    const client = createClient({ url: process.env.KV_REDIS_URL });
    await client.connect();
    await client.set(SNAPSHOT_KEY, JSON.stringify(grouped));
    await client.quit();
    
    return NextResponse.json({ 
      success: true, 
      products: Object.keys(grouped).length 
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
