'use client';

import { useState } from 'react';

type SyncResult = {
  success: boolean;
  products?: number;
  error?: string;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/sync-products', { method: 'POST' });
      const data: SyncResult = await res.json();
      setResult(data);
      if (data.success) {
        setLastSynced(new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
      }
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">웹카탈로그 관리</h1>
          <p className="text-xs text-gray-400 mt-1">
            카페24 최신 가격을 즉시 반영합니다
          </p>
        </div>

        <div className="space-y-2 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>자동 동기화</span>
            <span className="font-medium text-gray-700">매일 12:00 (KST)</span>
          </div>
          {lastSynced && (
            <div className="flex justify-between">
              <span>마지막 수동 동기화</span>
              <span className="font-medium text-gray-700">{lastSynced}</span>
            </div>
          )}
        </div>

        <button
          onClick={handleSync}
          disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-medium transition-colors
            bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {loading ? '동기화 중...' : '가격 즉시 동기화'}
        </button>

        {result && (
          <div className={`rounded-xl px-4 py-3 text-xs ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {result.success
              ? `완료 — 상품 ${result.products}건 업데이트됨`
              : `오류: ${result.error}`}
          </div>
        )}
      </div>
    </div>
  );
}
