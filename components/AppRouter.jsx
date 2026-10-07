'use client';
import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// The app relies on window/localStorage, so it renders on the client only.
const SkillMatrixApp = dynamic(() => import('./SkillMatrixApp'), { ssr: false });

function readLocation(fallback = 'home', fallbackTab = undefined) {
  if (typeof window === 'undefined') return { page: fallback, tab: fallbackTab };
  const raw = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const page = raw || fallback;
  const tab = new URLSearchParams(window.location.search).get('tab') || fallbackTab;
  return { page, tab };
}

export default function AppRouter({ initialPage = 'home', initialTab = undefined }) {
  const [loc, setLoc] = useState(() => readLocation(initialPage, initialTab));
  useEffect(() => {
    setLoc(readLocation(initialPage, initialTab));
    const onPop = () => setLoc(readLocation(initialPage, initialTab));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [initialPage, initialTab]);
  const onNavigate = useCallback((p, t) => {
    const url = '/' + (p === 'home' ? '' : p) + (t && t !== 'account' ? '?tab=' + t : '');
    if (url !== window.location.pathname + window.location.search) window.history.pushState({}, '', url);
    setLoc({ page: p, tab: t && t !== 'account' ? t : undefined });
  }, []);
  return <SkillMatrixApp routePage={loc.page} routeTab={loc.tab} onNavigate={onNavigate} role={process.env.NEXT_PUBLIC_DEMO_ROLE || 'admin'} />;
}
