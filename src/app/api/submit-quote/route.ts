import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SPREADSHEET_ID = '1oQN0oApCGHSMHGYf_1gIpF-5dG8ETSsqrx-eAlz394k';
const SHEET_NAME = '시트1';
const CAFE24_SHEET_ID = '1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek';
const GMAIL_SENDER = 'zartkang@gmail.com';
const GMAIL_RECIPIENT = 'zartkang@gmail.com';

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

        // G열 PROD_DES 조회로 변경
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

        const rows = items.map((item: any) => {
            const quantity = Number(item.quantity || 0);
            const price = Number(item.price || 0);
            const supplyAmount = quantity * price;
            const vatAmount = Math.round(supplyAmount * 0.1);
            const totalAmount = supplyAmount + vatAmount;

            const row = new Array(39).fill('');
            row[0] = customer.name || '';      // A열
            row[1] = customer.phone || '';     // B열
            row[2] = customer.message || '';   // C열
            row[3] = '3883833';                // D열
            row[5] = today;                    // F열
            row[7] = '100';                    // H열: 출하창고
            row[9] = '';                       // J열: 거래처 담당자 빈칸
            row[26] = productNameMap[item.product_code] || item.product_code || ''; // AA열
            row[29] = item.quantity || '';     // AD열
            row[30] = Math.round(Number(item.price || 0) / 1.1);  // AE열 (VAT 제외 공급가)
            row[32] = supplyAmount;            // AG열
            row[33] = vatAmount;               // AH열
            row[38] = totalAmount;             // AM열
            return row;
        });

        const colA = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:A`,
        });

        const nextRow = (colA.data.values?.length ?? 0) + 1;

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: 'RAW',
                data: rows.flatMap((row: string[], index: number) => {
                    const rowNumber = nextRow + index;
                    return [
                        {
                            range: `${SHEET_NAME}!A${rowNumber}:H${rowNumber}`,
                            values: [row.slice(0, 8)],
                        },
                        {
                            range: `${SHEET_NAME}!K${rowNumber}:AM${rowNumber}`,
                            values: [row.slice(10)],
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
