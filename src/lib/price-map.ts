import { redisGet, redisSet } from './redis-client';

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

function extractGvizJson(text: string): GvizResponse {
    const match = text.match(/google\.visualization\.Query\.setResponse\((\{[\s\S]*\})\);/);
    if (!match) {
        throw new Error('Invalid gviz response');
    }
    return JSON.parse(match[1]) as GvizResponse;
}

function parsePriceMap(response: GvizResponse): PriceMap {
    const cols = response.table?.cols || [];
    const rows = response.table?.rows || [];

    // The Cafe24 sheet tab starts with data on row 1, so gviz does not expose header labels.
    // Use fixed columns based on the current A~G layout:
    // D(index 3)=(1)800액자레일2 style code, F(index 5)=additional amount.
    const variantIndex = 3;
    const amountIndex = 5;

    if (cols.length <= amountIndex) {
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
        const cached = await redisGet<PriceMap>(PRICE_CACHE_KEY);
        if (cached) {
            return cached;
        }

        const fresh = await fetchPriceMapFromSheet();
        await redisSet(PRICE_CACHE_KEY, fresh, { EX: PRICE_CACHE_TTL_SECONDS });
        return fresh;
    } catch (error) {
        console.error('Redis cache error for prices, falling back to Google Sheets:', error);
        return fetchPriceMapFromSheet();
    }
}
