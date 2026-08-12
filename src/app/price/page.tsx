'use client';

import React, { useState, useEffect } from 'react';
import PriceCatalogView from '@/components/price/PriceCatalogView';
import PriceCatalogMobileView from '@/components/price/PriceCatalogMobileView';

export default function PricePage() {
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // SSR 대응 (Hydration mismatch 방지)
    if (isMobile === null) return <div className="min-h-screen bg-gray-50" />;

    return isMobile ? <PriceCatalogMobileView /> : <PriceCatalogView />;
}
