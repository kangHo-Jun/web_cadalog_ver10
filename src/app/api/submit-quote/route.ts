import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SPREADSHEET_ID = '1oQN0oApCGHSMHGYf_1gIpF-5dG8ETSsqrx-eAlz394k';
const SHEET_NAME = '시트1';
const CAFE24_SHEET_ID = '1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek';
const GMAIL_SENDER = 'zartkang@gmail.com';
const GMAIL_RECIPIENT = 'rlawkdgh9@gmail.com';

export async function POST(req: Request) {
    try {
        const contentType = req.headers.get('content-type') || '';
        let items: any[] | null = null;
        let customer: Record<string, string> = {};
        let uploadedFiles: File[] = [];

        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const rawItems = formData.get('items');
            const parsedItems =
                typeof rawItems === 'string'
                    ? JSON.parse(rawItems)
                    : null;

            items = Array.isArray(parsedItems) ? parsedItems : null;
            customer = {
                name: typeof formData.get('name') === 'string' ? String(formData.get('name')) : '',
                email: typeof formData.get('email') === 'string' ? String(formData.get('email')) : '',
                phone: typeof formData.get('phone') === 'string' ? String(formData.get('phone')) : '',
                message: typeof formData.get('message') === 'string' ? String(formData.get('message')) : '',
            };
            uploadedFiles = formData
                .getAll('files')
                .filter((entry): entry is File => entry instanceof File && entry.size > 0);
        } else {
            const body = await req.json();
            items = Array.isArray(body?.items) ? body.items : null;
            customer = body?.customer || {};
        }

        if (!items) {
            return NextResponse.json(
                { result: 'error', message: 'items array is required' },
                { status: 400 }
            );
        }

        const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
            ?.replace(/\\n/g, '\n')
            ?.replace(/"/g, '');

        const credentials = {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: privateKey,
        };

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const today = new Date().toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).replace(/\. /g, '-').replace('.', '');

        const cafe24Data = await sheets.spreadsheets.values.get({
            spreadsheetId: CAFE24_SHEET_ID,
            range: '카페24상품!A:G',
        });

        const cafe24Rows = cafe24Data.data.values || [];
        const productNameMap: Record<string, string> = {};
        cafe24Rows.forEach((r) => {
            const variantCode = r[4];       // E열: variant_code
            const customVariantCode = r[3]; // D열: custom_variant_code
            if (variantCode && customVariantCode) {
                productNameMap[variantCode] = customVariantCode;
            }
        });

        const rows = items.map((item: any, index: number) => {
            const quantity = Number(item.quantity || 0);
            const unitPrice = Math.round(Number(item.price || 0) / 1.1);

            const row = new Array(25).fill('');
            row[0] = index === 0 ? customer.name || '' : '';
            row[1] = index === 0 ? customer.phone || '' : '';
            row[2] = index === 0 ? customer.message || '' : '';
            row[3] = '';
            row[4] = '3883833';
            row[5] = '';
            row[6] = today;
            row[7] = '100';
            row[17] = productNameMap[item.product_code] || item.product_code || '';
            row[18] = '';
            row[19] = quantity;
            row[20] = unitPrice;
            row[21] = row[19] * row[20];
            row[22] = Math.round(row[21] * 0.1);
            row[23] = row[21] + row[22];
            row[24] = '';
            return row;
        });

        const colA = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:A`,
        });

        const nextRow = (colA.data.values ?? []).reduce((lastRow, value, index) => {
            return value?.[0] ? index + 1 : lastRow;
        }, 0) + 1;

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: 'RAW',
                data: rows.flatMap((row: (string | number)[], index: number) => {
                    const rowNumber = nextRow + index;
                    return [
                        {
                            range: `${SHEET_NAME}!A${rowNumber}:I${rowNumber}`,
                            values: [row.slice(0, 9)],
                        },
                        {
                            range: `${SHEET_NAME}!K${rowNumber}:Y${rowNumber}`,
                            values: [row.slice(10, 25)],
                        },
                    ];
                }),
            },
        });

        const firstItem = items[0] || {};
        const firstUnitPrice = Math.round(Number(firstItem.price || 0) / 1.1);
        const mailText = `[새 견적 요청]

고객명: ${customer.name || ''}
연락처: ${customer.phone || ''}
요청사항: ${customer.message || ''}
단가: ${firstUnitPrice}
요청일: ${today}`;

        const attachments = await Promise.all(uploadedFiles.map(async (file) => ({
            filename: file.name,
            content: Buffer.from(await file.arrayBuffer()),
            contentType: file.type || 'application/octet-stream',
        })));

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const mailInfo = await transporter.sendMail({
            from: GMAIL_SENDER,
            to: GMAIL_RECIPIENT,
            subject: `[새 견적 요청] ${customer.name || ''}`,
            text: mailText,
            attachments,
        });

        return NextResponse.json({ result: 'ok', messageId: mailInfo.messageId });

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
