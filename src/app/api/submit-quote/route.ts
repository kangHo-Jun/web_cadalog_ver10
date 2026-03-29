import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SPREADSHEET_ID = '1oQN0oApCGHSMHGYf_1gIpF-5dG8ETSsqrx-eAlz394k';
const SHEET_NAME = '시트1';
const CAFE24_SHEET_ID = '1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const items = Array.isArray(body?.items) ? body.items : null;
        const customer = body?.customer || {};

        if (!items) {
            return NextResponse.json(
                { result: 'error', message: 'items array is required' },
                { status: 400 }
            );
        }

        const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
            ?.replace(/\\n/g, '\n')
            ?.replace(/"/g, '');

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: privateKey,
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

        // G열 PROD_DES 조회로 변경
        const cafe24Data = await sheets.spreadsheets.values.get({
            spreadsheetId: CAFE24_SHEET_ID,
            range: '카페24상품!A:G',
        });

        const cafe24Rows = cafe24Data.data.values || [];
        const productNameMap: Record<string, string> = {};
        cafe24Rows.forEach((r) => {
            const variantCode = r[4]; // E열: variant_code
            const prodDes = r[6];     // G열: PROD_DES
            if (variantCode && prodDes) {
                productNameMap[variantCode] = prodDes;
            }
        });

        const rows = items.map((item: any) => {
            const row = new Array(31).fill('');
            row[0] = customer.name || '';      // A열
            row[1] = customer.phone || '';     // B열
            row[2] = customer.message || '';   // C열
            row[5] = today;                    // F열
            row[7] = '안양';                   // H열
            row[9] = '두현숙';                 // J열
            row[26] = productNameMap[item.product_code] || item.product_name || ''; // AA열
            row[29] = item.quantity || '';     // AD열
            row[30] = item.price || '';        // AE열
            return row;
        });

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:AE`,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows,
            },
        });

        return NextResponse.json({ result: 'ok' });

    } catch (error: any) {
        console.error('Sheets API error full:', JSON.stringify({
            message: error?.message,
            code: error?.code,
            status: error?.status,
            errors: error?.errors,
        }));
        return NextResponse.json(
            { result: 'error', message: error?.message || 'Unknown error' },
            { status: 500 }
        );
    }
}
