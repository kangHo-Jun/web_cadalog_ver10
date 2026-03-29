import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SPREADSHEET_ID = '1oQN0oApCGHSMHGYf_1gIpF-5dG8ETSsqrx-eAlz394k';
const SHEET_NAME = '시트1';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const items = Array.isArray(body?.items) ? body.items : null;

        if (!items) {
            return NextResponse.json(
                { result: 'error', message: 'items array is required' },
                { status: 400 }
            );
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const today = new Date().toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).replace(/\. /g, '-').replace('.', '');

        const rows = items.map((item: any) => {
            const row = new Array(28).fill('');
            row[2] = today;
            row[4] = '안양';
            row[6] = '두현숙';
            row[23] = item.product_code || '';
            row[26] = item.quantity || '';
            row[27] = item.price || '';
            return row;
        });

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:AB`,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        return NextResponse.json({ result: 'ok' });

    } catch (error: any) {
        console.error('Sheets API error:', error);
        return NextResponse.json(
            { result: 'error', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}
