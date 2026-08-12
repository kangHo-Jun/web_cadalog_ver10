import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * Cafe24 Webhook Receiver
 * 
 * 특정 이벤트(상품 정보 변경 등)가 발생했을 때 Cafe24에서 전송하는 알림을 수신합니다.
 * 이 엔드포인트는 실시간 데이터 동기화의 핵심적인 역할을 수행합니다.
 */
export async function POST(request: Request) {
    try {
        // 1. 페이로드 수신
        const payload = await request.json();
        const eventType = request.headers.get('x-cafe24-event-type');

        console.log(`[Cafe24 Webhook] Received event: ${eventType}`);
        console.log('[Cafe24 Webhook] Payload:', JSON.stringify(payload, null, 2));

        /**
         * TODO: 보안 검증
         * Cafe24에서 제공하는 서명(HMAC)을 확인하여 요청의 신뢰성을 검증하는 로직이 향후 추가되어야 합니다.
         */

        // 2. 이벤트 유형에 따른 처리
        if (eventType === 'product.update' || eventType === 'product.create') {
            const productId = payload.resource_id || (payload.data && payload.data.product_no);
            console.log(`[Cafe24 Webhook] Product ${productId} changed. Triggering cache revalidation...`);

            // 3. 캐시 무효화 (Next.js 15 On-demand Revalidation)
            // 현재 제품 리스트 API와 카테고리 API의 캐시를 즉시 파기합니다.
            revalidatePath('/api/products');
            revalidatePath('/api/categories');
        }

        return NextResponse.json({
            success: true,
            message: 'Webhook received and processed',
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[Cafe24 Webhook] Error processing webhook:', error.message);
        return NextResponse.json(
            { success: false, error: 'Failed to process webhook' },
            { status: 500 }
        );
    }
}

// GET 요청 시 가이드 정보 제공
export async function GET() {
    return NextResponse.json({
        message: 'Cafe24 Webhook Endpoint is active.',
        guide: 'Please use POST method to receive webhooks from Cafe24.',
        endpoint: '/api/webhook/cafe24'
    });
}
