import { NextResponse } from 'next/server';
import { saveTokens } from '@/lib/token-store';

/**
 * Redis 초기화 API
 * 환경 변수의 토큰을 Redis에 저장합니다.
 * 
 * 사용법:
 * curl -X POST https://web-cadalog-ver10.vercel.app/api/init-tokens
 */
export async function POST() {
    try {
        // 환경 변수에서 토큰 가져오기
        const tokens = {
            access_token: process.env.CAFE24_ACCESS_TOKEN || '',
            refresh_token: process.env.CAFE24_REFRESH_TOKEN || '',
            expires_at: Date.now() + 2 * 60 * 60 * 1000, // 2시간 후
        };

        // 토큰 유효성 검사
        if (!tokens.access_token || !tokens.refresh_token) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing CAFE24_ACCESS_TOKEN or CAFE24_REFRESH_TOKEN in environment variables'
                },
                { status: 400 }
            );
        }

        // Redis에 저장
        await saveTokens(tokens);

        console.log('✅ Tokens initialized in Redis successfully');

        return NextResponse.json({
            success: true,
            message: 'Tokens initialized in Redis',
            data: {
                access_token: tokens.access_token.substring(0, 10) + '...',
                refresh_token: tokens.refresh_token.substring(0, 10) + '...',
                expires_at: new Date(tokens.expires_at).toISOString(),
            }
        });
    } catch (error) {
        console.error('❌ Failed to initialize tokens:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to initialize tokens in Redis',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * GET 요청으로 현재 Redis 상태 확인
 */
export async function GET() {
    return NextResponse.json({
        message: 'Use POST method to initialize tokens',
        usage: 'curl -X POST https://web-cadalog-ver10.vercel.app/api/init-tokens'
    });
}
