import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const items = Array.isArray(body?.items) ? body.items : null;

        if (!items) {
            return NextResponse.json({ result: 'error', message: 'items array is required' }, { status: 400 });
        }

        const webhookUrl = process.env.GAS_QUOTE_WEBHOOK_URL;

        if (!webhookUrl) {
            return NextResponse.json({ result: 'error', message: 'GAS_QUOTE_WEBHOOK_URL is not configured' }, { status: 500 });
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'items=' + encodeURIComponent(JSON.stringify(items)),
            redirect: 'follow',
            cache: 'no-store',
        });

        const text = await response.text();
        let data: any;

        try {
            data = JSON.parse(text);
        } catch {
            data = { result: 'error', message: text || 'Invalid GAS response' };
        }

        return NextResponse.json(data, { status: response.ok ? 200 : response.status });
    } catch (error: any) {
        return NextResponse.json(
            { result: 'error', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}
