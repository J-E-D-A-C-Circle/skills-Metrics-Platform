'use client';
import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// The app relies on window/localStorage, so it renders on the client only.
const SkillMatrixApp = dynamic(() => import('./SkillMatrixApp'), { ssr: false });

function readLocation() {
  if (typeof window === 'undefined') return { page: 'home', tab: undefined };
  const page = window.location.pathname.replace(/^\/+|\/+$/g, '') || 'home';
  const tab = new URLSearchParams(window.location.search).get('tab') || undefined;
  return { page, tab };
}

export default function AppRouter() {
  const [loc, setLoc] = useState({ page: 'home', tab: undefined });
  useEffect(() => {
    setLoc(readLocation());
    const onPop = () => setLoc(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const onNavigate = useCallback((p, t) => {
    const url = '/' + (p === 'home' ? '' : p) + (t && t !== 'account' ? '?tab=' + t : '');
    if (url !== window.location.pathname + window.location.search) window.history.pushState({}, '', url);
    setLoc({ page: p, tab: t && t !== 'account' ? t : undefined });
  }, []);
  return <SkillMatrixApp routePage={loc.page} routeTab={loc.tab} onNavigate={onNavigate} role={process.env.NEXT_PUBLIC_DEMO_ROLE || 'admin'} />;
}
