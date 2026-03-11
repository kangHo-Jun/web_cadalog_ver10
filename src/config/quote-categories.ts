/**
 * 견적서 전용 카테고리 설정
 * Cafe24에서 "표시안함"으로 설정된 카테고리는 API로 조회되지 않아
 * 수동으로 카테고리 번호를 등록해야 합니다.
 *
 * 소스: src/config/quote-categories.csv
 */

export interface QuoteCategory {
  category_no: number;
  category_name: string;      // Cafe24에서 사용하는 전체 이름
  display_name: string;       // 화면에 표시할 이름 (견적서) 제거된 버전
  category_depth: number;     // 카테고리 깊이 (대분류 = 1)
  parent_category_no?: number | null; // 부모 카테고리 번호
}

import fs from 'fs';
import path from 'path';

function parseCsvLine(line: string): string[] {
  // Simple CSV parser (no quoted commas in this file)
  return line.split(',').map((part) => part.trim());
}

function loadQuoteCategories(): QuoteCategory[] {
  try {
    const csvPath = path.join(process.cwd(), 'src', 'config', 'quote-categories.csv');
    const raw = fs.readFileSync(csvPath, 'utf8');
    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 1) return [];

    const rows = lines.slice(1); // skip header
    const categories: QuoteCategory[] = [];

    for (const row of rows) {
      const [category_no, category_name, display_name, category_depth, parent_category_no] = parseCsvLine(row);
      if (!category_no) continue;
      categories.push({
        category_no: Number(category_no),
        category_name,
        display_name,
        category_depth: Number(category_depth || 0),
        parent_category_no: parent_category_no ? Number(parent_category_no) : null,
      });
    }

    return categories;
  } catch (error) {
    console.error('Failed to load quote-categories.csv:', error);
    return [];
  }
}

export const QUOTE_CATEGORIES: QuoteCategory[] = loadQuoteCategories();

// 카테고리 번호 배열 (API 호출용)
export const QUOTE_CATEGORY_NOS = QUOTE_CATEGORIES.map(c => c.category_no);
