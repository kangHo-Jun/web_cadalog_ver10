import { getRedisClient } from './redis-client';

const SHEET_ID = '1_T_pl2ItqfmdAsDmrjkg1BBZyQMAVXkUrPMEwhGI6ek';
const SHEET_GID = '1267943882';
const PRICE_CACHE_KEY = 'prices:variant_code:v1';
const PRICE_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;

type PriceMap = Record<string, number>;

// ... (Gviz types and normalization functions)
type GvizColumn = {
    id?: string;
    label?: string;
    type?: string;
};

type GvizCell = {
    v?: any;
    f?: string;
};

type GvizRow = {
    c?: GvizCell[];
};

type GvizResponse = {
    table?: {
        cols?: GvizColumn[];
        rows?: GvizRow[];
    };
};

function normalizeHeader(value: string | undefined | null): string {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9_]/g, '');
}

function extractGvizJson(text: string): GvizResponse {
    const match = text.match(/google\.visualization\.Query\.setResponse\((\{[\s\S]*\})\);/);
    if (!match) {
        throw new Error('Invalid gviz response');
    }
    return JSON.parse(match[1]) as GvizResponse;
}

function findColumnIndex(cols: GvizColumn[], predicate: (label: string, id: string) => boolean): number {
    for (let i = 0; i < cols.length; i += 1) {
        const label = normalizeHeader(cols[i]?.label);
        const id = normalizeHeader(cols[i]?.id);
        if (predicate(label, id)) return i;
    }
    return -1;
}

function parsePriceMap(response: GvizResponse): PriceMap {
    const cols = response.table?.cols || [];
    const rows = response.table?.rows || [];

    const variantIndex = findColumnIndex(cols, (label, id) =>
        label === 'variant_code' ||
        label === 'variantcode' ||
        id === 'variant_code' ||
        id === 'variantcode' ||
        (label.includes('variant') && label.includes('code'))
    );

    const amountIndex = findColumnIndex(cols, (label, id) =>
        label === 'additional_amount' ||
        label === 'additionalamount' ||
        id === 'additional_amount' ||
        id === 'additionalamount' ||
        (label.includes('additional') && label.includes('amount'))
    );

    if (variantIndex < 0 || amountIndex < 0) {
        throw new Error('Required columns not found in gviz response');
    }

    const map: PriceMap = {};

    for (const row of rows) {
        const cells = row.c || [];
        const variantRaw = cells[variantIndex]?.v;
        const amountRaw = cells[amountIndex]?.v;
        if (variantRaw === null || variantRaw === undefined) continue;

        const variantCode = String(variantRaw).trim();
        if (!variantCode) continue;

        const amountNumber = typeof amountRaw === 'number'
            ? amountRaw
            : Number(String(amountRaw || '').replace(/,/g, ''));

        if (!Number.isFinite(amountNumber)) continue;

        map[variantCode] = amountNumber;
    }

    return map;
}

async function fetchPriceMapFromSheet(): Promise<PriceMap> {
    const res = await fetch(GVIZ_URL, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to fetch gviz data (${res.status})`);
    }
    const text = await res.text();
    const json = extractGvizJson(text);
    return parsePriceMap(json);
}

export async function getPriceMap(): Promise<PriceMap> {
    try {
        const client = getRedisClient();
        
        const cached = await client.get<PriceMap>(PRICE_CACHE_KEY);
        if (cached) {
            return cached;
        }

        const fresh = await fetchPriceMapFromSheet();
        await client.set(PRICE_CACHE_KEY, JSON.stringify(fresh), { ex: PRICE_CACHE_TTL_SECONDS });
        return fresh;
    } catch (error) {
        console.error('Redis cache error for prices, falling back to Google Sheets:', error);
        return fetchPriceMapFromSheet();
    }
}
