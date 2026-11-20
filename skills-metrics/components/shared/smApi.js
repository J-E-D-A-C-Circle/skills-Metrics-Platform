'use client';
// =============================================================================
// smApi.js · Browser helpers for calling the server (app/api/**) from the screens
// Screen / URL: every server-backed screen
// Used by: SM*.jsx pages that read or change data   Depends on: react
// Sections (search for these markers): API · Call, API · Load hook, API · Formatting
// =============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';

// ===== API · Call =====
// api('GET', '/api/x') / api('POST', '/api/x', body). Returns the JSON reply; throws an Error carrying the
// server's message (e.message) and the field errors (e.fields) when the request fails.
export async function api(method, path, body) {
  const r = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error(d.error || 'Something went wrong. Please try again.'); err.fields = d.fields; err.status = r.status; throw err; }
  return d;
}
// Builds "?a=1&b=2" from an object, leaving out empty values.
export const qs = o => { const p = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '' && v !== 'All') p.set(k, v); }); const s = p.toString(); return s ? '?' + s : ''; };

// ===== API · Load hook =====
// const { data, error, loading, reload } = useLoad('/api/x' + qs(filters)). Reloads when the path changes.
export function useLoad(path) {
  const [state, set] = useState({ data: null, error: '', loading: true });
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (!path) { set({ data: null, error: '', loading: false }); return; }
    const n = ++seq.current;
    set(s => ({ ...s, loading: true }));
    try { const d = await api('GET', path); if (n === seq.current) set({ data: d, error: '', loading: false }); }
    catch (e) { if (n === seq.current) set({ data: null, error: e.message, loading: false }); }
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

// ===== API · Formatting =====
export const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = d => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtDuration = s => { if (s == null) return '—'; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? h + 'h ' + m + 'm' : m ? m + 'm ' + x + 's' : x + 's'; };
