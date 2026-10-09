'use client';
import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// The app relies on window/localStorage, so it renders on the client only.
const SkillMatrixApp = dynamic(() => import('./SkillMatrixApp'), { ssr: false });

// Each app/<route>/page.jsx passes its own page as the fallback; the URL wins when it has a path.
function readLocation(fallback = 'home', fallbackTab = undefined) {
  if (typeof window === 'undefined') return { page: fallback, tab: fallbackTab, id: undefined };
  const raw = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const sp = new URLSearchParams(window.location.search);
  return { page: raw || fallback, tab: sp.get('tab') || fallbackTab, id: sp.get('id') || undefined };
}

export default function AppRouter({ initialPage = 'home', initialTab = undefined }) {
  const [loc, setLoc] = useState(() => readLocation(initialPage, initialTab));
  useEffect(() => {
    setLoc(readLocation(initialPage, initialTab));
    const onPop = () => setLoc(readLocation(initialPage, initialTab));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [initialPage, initialTab]);
  // opts.replace swaps the current history entry (used when a hidden or aliased URL is redirected).
  const onNavigate = useCallback((p, t, opts) => {
    const o = opts || {}, tab = t && t !== 'account' ? t : undefined;
    const qs = new URLSearchParams();
    if (tab) qs.set('tab', tab);
    if (o.id) qs.set('id', o.id);
    const url = '/' + (p === 'home' ? '' : p) + (qs.toString() ? '?' + qs.toString() : '');
    if (url !== window.location.pathname + window.location.search) window.history[o.replace ? 'replaceState' : 'pushState']({}, '', url);
    setLoc({ page: p, tab, id: o.id || undefined });
  }, []);
  return <SkillMatrixApp routePage={loc.page} routeTab={loc.tab} routeId={loc.id} onNavigate={onNavigate} role={process.env.NEXT_PUBLIC_DEMO_ROLE || 'admin'} />;
}
