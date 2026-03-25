'use client';

import { useState, useEffect } from 'react';
import Phase1CatalogView from '@/components/phase1/Phase1CatalogView';
import Phase1MobileView from '@/components/phase1/Phase1MobileView';

export default function Page() {
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    if (isMobile === null) return null;

    return isMobile ? <Phase1MobileView /> : <Phase1CatalogView />;
}
