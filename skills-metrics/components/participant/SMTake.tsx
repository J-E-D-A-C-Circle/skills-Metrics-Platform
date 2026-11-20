'use client';
// =============================================================================
// SMTake.jsx · Take Assessment: start or resume an attempt, answer (autosaved), review, submit, see results
// Screen / URL: /take?id=<assessment id> (full screen, no sidebar). Stages: intro -> questions -> review -> submitted
// Who sees it: anyone with "Take assessments" (staff, supervisors). Administrators never (no assessments.view)
// Used by: components/SkillMatrixApp.jsx (page "take"), components/SMMyAssessments.jsx (ResultsPanel,
//   AttemptStatusBadge)   Depends on: smUI.jsx, smApi.js, lib/scoring.js; GET /api/my/assessments/:id,
//   POST /api/attempts, GET /api/attempts/:id, PUT /api/attempts/:id/responses, POST /api/attempts/:id/time,
//   POST /api/attempts/:id/submit
// Sections (search for these markers): TAKE · Labels, TAKE · Results panel, TAKE · Active page time,
//   TAKE · Answer saving, TAKE · Screen, TAKE · Loading & errors, TAKE · Top bar, TAKE · Intro, TAKE · Question,
//   TAKE · Question navigator, TAKE · Review, TAKE · Submitted, TAKE · Dialogs
// Rules: no countdown timer anywhere. Time on the page is counted only while it is visible and in front, sent to
// the server in slices, never affects scores and is shown only after submitting. Every answer saves as it is
// chosen; leaving and coming back resumes at the same place.
// =============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Btn, Badge, CompetencyBadge, GapStatusBadge, Avg, Confirm, EmptyState, DataTable, CARD, GREEN, LoadingState, Spinner } from '@/components/shared/smUI';
import { api, fmtDate, fmtDateTime, fmtDuration } from '@/components/shared/smApi';
import { formatAverage } from '@/lib/scoring';
import {
  cacheAssessmentPackage,
  getCachedAssessmentPackage,
  saveAttemptStateEncrypted,
  getAttemptStateEncrypted,
  enqueueSyncItem,
  getPendingSyncQueue,
  removeSyncItem,
  clearAttemptSync,
} from '@/lib/client/takeStorage';

// ===== TAKE · Labels =====
// Attempt statuses (Attempt.status) with a colour and a text label.
const ATTEMPT_STATUS = {
  IN_PROGRESS: ['In progress', '#fef3c7', '#92400e'], SUBMITTED: ['Submitted', '#e0f2fe', '#075985'], PENDING_MARKING: ['Pending marking', '#ede9fe', '#5b21b6'],
  COMPLETED: ['Completed', '#dcfce7', '#15803d'], ABANDONED: ['Abandoned', '#f3f4f6', '#4b5563'], EXPIRED: ['Expired', '#fee2e2', '#b91c1c'],
};
export function AttemptStatusBadge({ status }) {
  const s = ATTEMPT_STATUS[status] || [status, '#f3f4f6', '#4b5563'];
  return <Badge bg={s[1]} fg={s[2]}>{s[0]}</Badge>;
}
const MUTED = { fontSize: '13px', color: '#6b7280' };

// ===== TAKE · Results panel =====
// item = one entry from GET /api/my/assessments/:id. Final average per competency (2 decimals), Competent /
// Proficient, gap status, and each completed attempt's score. Only shown when the server says results are released.
export function ResultsPanel({ item }) {
  if (!item) return null;
  if (!item.released) return <EmptyState icon="icon-clock" title="Results are not available yet" text={item.releaseNote || 'Results will be available later.'} />;
  const r = item.results;
  if (!r || !r.competencies.length) return <EmptyState icon="icon-clipboard-list" title="No results yet" text={item.attempts && item.attempts.some(a => a.status === 'PENDING_MARKING') ? 'Your attempt is waiting to be marked. Results will appear here once marking is finished.' : 'Results appear here once you complete an attempt.'} />;
  const cols = [
    { key: 'name', label: 'Competency', render: c => <span style={{ fontWeight: 600 }}>{c.name}</span> },
    { key: 'average', label: 'Final average', align: 'center', render: c => <Avg value={c.average} /> },
    { key: 'attemptsIncluded', label: 'Attempts counted', align: 'center' },
    { key: 'competencyStatus', label: 'Competency', render: c => <CompetencyBadge status={c.competencyStatus} /> },
    { key: 'gapStatus', label: 'Gap', render: c => <GapStatusBadge gap={c.gapStatus} /> },
    ...r.attempts.map(a => ({ key: 'a' + a.id, label: 'Attempt ' + a.attemptNo, align: 'center', render: c => <span style={{ font: "500 12.5px 'JetBrains Mono',monospace", color: '#374151' }}>{a.scores[c.competencyId] == null ? '—' : formatAverage(a.scores[c.competencyId])}</span> })),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ ...MUTED, lineHeight: 1.5 }}>Each final average is the average of <b>all</b> your completed attempts ({r.attempts.length} so far) on a 0 to 5 scale. Abandoned, expired and unsubmitted attempts are not counted. A competency can be Competent and still show a Moderate Gap against the required level.</div>
      <div style={{ border: '1px solid rgba(15,35,65,.08)', borderRadius: '14px', overflow: 'hidden', background: '#fff' }}>
        <DataTable columns={cols} rows={r.competencies} minWidth={620 + r.attempts.length * 90} rowKey={c => c.competencyId} />
      </div>
      {r.overall != null ? <div style={MUTED}>Overall assessment average (plain average of the competency averages above, shown for information only): <Avg value={r.overall} /></div> : null}
    </div>
  );
}

// ===== TAKE · Active page time =====
// Counts time only while this page is visible AND in front (Page Visibility API + window focus), per question.
// Closed slices are sent every 15 s and when the page is hidden or closed; a failed send is kept and retried.
// tabId is random per tab, and the server drops any overlap with time another tab already sent. This records time
// on the page; it does not prove continuous attention.
function newTabId() { try { return crypto.randomUUID().replace(/-/g, ''); } catch (e) { return Math.random().toString(36).slice(2) + Date.now().toString(36); } }
function useActiveTime(attemptId, questionId, on) {
  const r = useRef({ tab: null, cur: null, buf: [], q: null, on: false, id: null });
  if (!r.current.tab) r.current.tab = newTabId();
  r.current.id = attemptId;
  const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus();
  const close = useCallback(() => { const s = r.current, c = s.cur; if (!c) return; s.cur = null; const end = Date.now(); if (end - c.start >= 200) s.buf.push({ questionId: c.q, start: c.start, end }); }, []);
  const open = useCallback(() => { const s = r.current; if (!s.cur && s.on && s.id && visible()) s.cur = { q: s.q, start: Date.now() }; }, []);
  const flush = useCallback(async keepalive => {
    close(); open();
    const s = r.current, slices = s.buf.splice(0, 200);
    if (!slices.length || !s.id) return;
    try {
      const res = await fetch('/api/attempts/' + s.id + '/time', { method: 'POST', credentials: 'same-origin', keepalive: !!keepalive, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tabId: s.tab, sentAt: Date.now(), slices }) });
      if (res.status >= 500) s.buf.unshift(...slices);
    } catch (e) { s.buf.unshift(...slices); if (s.buf.length > 400) s.buf.splice(0, s.buf.length - 400); }
  }, [close, open]);
  // Switch question: close the old slice, start a new one.
  useEffect(() => { close(); r.current.q = questionId ?? null; r.current.on = !!on; open(); }, [questionId, on, close, open]);
  useEffect(() => {
    if (!on || !attemptId) return undefined;
    const onVis = () => { if (document.visibilityState === 'visible') open(); else flush(true); };
    const onFocus = () => open(), onBlur = () => close(), onHide = () => flush(true);
    document.addEventListener('visibilitychange', onVis); window.addEventListener('focus', onFocus); window.addEventListener('blur', onBlur); window.addEventListener('pagehide', onHide);
    const t = setInterval(() => flush(false), 15000);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onFocus); window.removeEventListener('blur', onBlur); window.removeEventListener('pagehide', onHide); r.current.on = false; flush(true); };
  }, [on, attemptId, open, close, flush]);
  return flush;
}

// ===== TAKE · Answer saving =====
// Each answer is sent as soon as it changes (typed answers after a short pause). Saves for one question run one
// after another so the last choice always wins. In addition, answers and flags are stored in real-time in
// encrypted client IndexedDB; when offline, operations are queued in IndexedDB and automatically synchronized.
function useAnswers(attemptId, assessmentId, flagsRef, idxRef, onClosed) {
  const [answers, setAnswers] = useState({}), [saveState, setSaveState] = useState({});
  const latest = useRef({}), chains = useRef({}), failed = useRef(new Set()), timers = useRef({});

  const persistLocal = useCallback((ans) => {
    if (attemptId && assessmentId) {
      saveAttemptStateEncrypted(attemptId, {
        assessmentId,
        answers: ans,
        flags: flagsRef.current || {},
        position: idxRef.current || 0,
      });
    }
  }, [attemptId, assessmentId, flagsRef, idxRef]);

  const send = useCallback(qid => {
    chains.current[qid] = (chains.current[qid] || Promise.resolve()).then(async () => {
      const a = latest.current[qid] || {};
      setSaveState(s => ({ ...s, [qid]: 'saving' }));
      // Always persist locally in encrypted storage
      persistLocal(latest.current);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Enqueue offline sync item in IndexedDB
        await enqueueSyncItem(attemptId, 'response', { questionId: qid, optionIds: a.optionIds || [], textAnswer: a.textAnswer || null });
        failed.current.delete(qid);
        setSaveState(s => ({ ...s, [qid]: 'saved' }));
        return;
      }

      try {
        await api('PUT', '/api/attempts/' + attemptId + '/responses', { questionId: qid, optionIds: a.optionIds || [], textAnswer: a.textAnswer || null });
        failed.current.delete(qid);
        setSaveState(s => ({ ...s, [qid]: 'saved' }));
      } catch (e) {
        if (e.status === 409 || e.status === 403 || e.status === 404) {
          failed.current.delete(qid);
          onClosed(e.message);
          return;
        }
        // Save to offline sync queue on network glitch
        await enqueueSyncItem(attemptId, 'response', { questionId: qid, optionIds: a.optionIds || [], textAnswer: a.textAnswer || null });
        failed.current.add(qid);
        setSaveState(s => ({ ...s, [qid]: 'saved' }));
      }
    });
    return chains.current[qid];
  }, [attemptId, onClosed, persistLocal]);

  const change = useCallback((qid, value, delay) => {
    latest.current[qid] = value;
    setAnswers(x => {
      const n = { ...x, [qid]: value };
      persistLocal(n);
      return n;
    });
    clearTimeout(timers.current[qid]);
    if (delay) timers.current[qid] = setTimeout(() => send(qid), delay); else send(qid);
  }, [send, persistLocal]);

  const load = useCallback(saved => {
    latest.current = { ...saved };
    setAnswers(saved);
    setSaveState({});
    persistLocal(saved);
  }, [persistLocal]);

  useEffect(() => {
    const t = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        failed.current.forEach(qid => send(qid));
      }
    }, 5000);
    return () => clearInterval(t);
  }, [send]);

  // Waits for every pending save. true = all saved.
  const settle = useCallback(async () => {
    Object.entries(timers.current).forEach(([qid, t]) => { clearTimeout(t); delete timers.current[qid]; send(Number(qid)); });
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      failed.current.forEach(qid => send(qid));
    }
    await Promise.all(Object.values(chains.current));
    return failed.current.size === 0 || (typeof navigator !== 'undefined' && !navigator.onLine);
  }, [send]);

  return { answers, saveState, change, load, settle };
}
const isAnswered = a => !!a && ((a.optionIds && a.optionIds.length > 0) || !!(a.textAnswer && a.textAnswer.trim()));

// ===== TAKE · Screen =====
export default function SMTake({ go, id, vw, toast }) {
  const assessmentId = Number(id);
  const [stage, setStage] = useState('loading'), [error, setError] = useState('');
  const [item, setItem] = useState(null), [att, setAtt] = useState(null), [idx, setIdx] = useState(0);
  const [confirm, setConfirm] = useState(null), [busy, setBusy] = useState(false), [navOpen, setNavOpen] = useState(false), [done, setDone] = useState(null);
  const [flags, setFlags] = useState({});
  const flagsRef = useRef({});
  flagsRef.current = flags;
  const idxRef = useRef(0);
  idxRef.current = idx;
  const [isOnline, setIsOnline] = useState(true);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const closed = useCallback(msg => { setError(msg || 'This attempt can no longer be changed.'); setStage('closed'); }, []);
  const { answers, saveState, change, load, settle } = useAnswers(att && att.attempt.id, assessmentId, flagsRef, idxRef, closed);
  const questions = att ? att.questions : [], q = questions[idx];
  const answering = stage === 'answer' || stage === 'review';
  const flushTime = useActiveTime(att && att.attempt.id, stage === 'answer' && q ? q.id : null, answering);
  const phone = vw < 640;

  // Service Worker Registration for Offline Capability
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-take.js').catch(err => {
        console.warn('[SMTake] Service Worker registration failed:', err);
      });
    }
  }, []);

  const loadItem = useCallback(async () => {
    try {
      const d = await api('GET', '/api/my/assessments/' + assessmentId);
      setItem(d.item);
      return d.item;
    } catch (err) {
      // Fallback to locally cached package if offline
      const cached = await getCachedAssessmentPackage(assessmentId);
      if (cached && cached.item) {
        setItem(cached.item);
        return cached.item;
      }
      throw err;
    }
  }, [assessmentId]);

  useEffect(() => {
    if (!Number.isInteger(assessmentId) || assessmentId < 1) { setStage('none'); return; }
    loadItem().then(() => setStage('intro')).catch(e => { setError(e.message); setStage('error'); });
  }, [assessmentId, loadItem]);

  // Synchronize offline queue when connectivity is restored
  const syncPending = useCallback(async (currentAttId) => {
    const targetAttemptId = currentAttId || (att && att.attempt?.id);
    if (!targetAttemptId) return;
    setSyncingOffline(true);
    try {
      const pending = await getPendingSyncQueue(targetAttemptId);
      let hadSubmit = false;
      for (const queueItem of pending) {
        if (queueItem.type === 'response') {
          try {
            await api('PUT', '/api/attempts/' + targetAttemptId + '/responses', queueItem.payload);
            if (queueItem.id) await removeSyncItem(queueItem.id);
          } catch (e) {
            if (e.status !== 409 && e.status !== 403) break;
          }
        } else if (queueItem.type === 'flag') {
          if (queueItem.id) await removeSyncItem(queueItem.id);
        } else if (queueItem.type === 'submit') {
          hadSubmit = true;
          if (queueItem.id) await removeSyncItem(queueItem.id);
        }
      }
      // If a submit was queued while offline, auto-submit once synced
      if (hadSubmit) {
        toast && toast('Connection restored: auto-submitting your completed assessment…');
        await api('POST', '/api/attempts/' + targetAttemptId + '/submit');
        const [d] = await Promise.all([api('GET', '/api/attempts/' + targetAttemptId), loadItem()]);
        await clearAttemptSync(targetAttemptId);
        setDone(d.attempt);
        setStage('done');
        toast && toast('Assessment successfully submitted and synced!');
      }
    } catch (err) {
      console.warn('[take] Error syncing pending offline items:', err);
    } finally {
      setSyncingOffline(false);
    }
  }, [att, loadItem, toast]);

  // Network connection monitor
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const onOnline = () => {
      setIsOnline(true);
      toast && toast('Connection restored. Synchronizing answers…');
      syncPending();
    };
    const onOffline = () => {
      setIsOnline(false);
      toast && toast('Offline mode: Answers and flags saved locally in encrypted storage.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [syncPending, toast]);

  // Start (or resume) on the server or offline storage, then cache package locally
  const begin = async () => {
    setBusy(true);
    try {
      let s, d;
      if (navigator.onLine) {
        s = await api('POST', '/api/attempts', { assessmentId });
        d = await api('GET', '/api/attempts/' + s.attemptId);
        // Cache full assessment package in IndexedDB for offline resilience
        await cacheAssessmentPackage(assessmentId, {
          item,
          questions: d.questions,
          assessment: d.assessment,
          maxAttempts: d.maxAttempts,
        });
      } else {
        const cachedPkg = await getCachedAssessmentPackage(assessmentId);
        if (!cachedPkg) {
          throw new Error('Offline: No cached assessment package found. Please connect to the internet first.');
        }
        d = {
          attempt: { id: Date.now(), attemptNo: (item?.used || 0) + 1, status: 'IN_PROGRESS' },
          questions: cachedPkg.questions,
          assessment: cachedPkg.assessment,
          answers: {},
          position: 0,
        };
      }

      if (d.attempt.status !== 'IN_PROGRESS') { closed('This attempt has already been closed.'); return; }

      // Restore encrypted local answers and flags if present
      const localState = await getAttemptStateEncrypted(d.attempt.id);
      const initialAnswers = localState?.answers || d.answers || {};
      const initialFlags = localState?.flags || {};
      setFlags(initialFlags);
      load(initialAnswers);
      setAtt(d);
      setIdx(Math.min(localState?.position ?? d.position ?? 0, Math.max(0, d.questions.length - 1)));
      setStage('answer');
      setConfirm(null);
      if (s?.resumed || localState) toast && toast('Welcome back: your answers and flags have been restored');
    } catch (e) {
      setConfirm(null);
      setError(e.message);
      await loadItem().catch(() => {});
      setStage('intro');
    } finally {
      setBusy(false);
    }
  };

  const exit = async () => { await settle(); await flushTime(true); go('assessments'); };

  // Submit attempt: online immediately, or queue for auto-submission upon reconnection
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        // Enqueue submit action for auto-submission upon reconnection
        await enqueueSyncItem(att.attempt.id, 'submit', { submittedAt: Date.now() });
        await saveAttemptStateEncrypted(att.attempt.id, {
          assessmentId,
          answers,
          flags,
          position: idx,
          isSubmitted: true,
        });
        setConfirm(null);
        toast && toast('Offline: Your attempt is saved in encrypted storage and will auto-submit when connection is restored.');
        setDone({
          attemptNo: att.attempt.attemptNo,
          submittedAt: new Date().toISOString(),
          status: 'PENDING_MARKING',
          activeSeconds: 0,
          elapsedSeconds: 0,
        });
        setStage('done');
        return;
      }

      if (!(await settle())) {
        setError("Some answers haven't saved yet. Check your connection and try again.");
        setConfirm(null);
        return;
      }
      await flushTime(false);
      await api('POST', '/api/attempts/' + att.attempt.id + '/submit');
      const [d] = await Promise.all([api('GET', '/api/attempts/' + att.attempt.id), loadItem()]);
      await clearAttemptSync(att.attempt.id);
      setDone(d.attempt);
      setConfirm(null);
      setStage('done');
      toast && toast('Attempt submitted');
    } catch (e) {
      setConfirm(null);
      if (e.status === 409) closed(e.message);
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleFlag = (qid) => {
    setFlags(prev => {
      const next = { ...prev, [qid]: !prev[qid] };
      if (att && att.attempt) {
        saveAttemptStateEncrypted(att.attempt.id, {
          assessmentId,
          answers,
          flags: next,
          position: idx,
        });
        enqueueSyncItem(att.attempt.id, 'flag', { questionId: qid, flagged: next[qid] });
      }
      return next;
    });
  };

  const goTo = i => { setIdx(Math.max(0, Math.min(questions.length - 1, i))); setStage('answer'); setNavOpen(false); try { window.scrollTo(0, 0); } catch (e) {} };
  const answeredCount = useMemo(() => questions.filter(x => isAnswered(answers[x.id])).length, [questions, answers]);
  const flaggedCount = useMemo(() => Object.values(flags).filter(Boolean).length, [flags]);
  const unanswered = questions.length - answeredCount;
  const saving = Object.values(saveState).some(s => s === 'saving'), saveError = Object.values(saveState).some(s => s === 'error');

  const wrap = children => <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>{topBar}<main style={{ width: 'min(900px,100%)', margin: '0 auto', padding: phone ? '16px 16px 48px' : '24px 20px 56px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>{children}</main>{dialogs}</div>;

  // ===== TAKE · Top bar =====
  const title = (att && att.assessment.title) || (item && item.title) || 'Take Assessment';
  const topBar = (
    <div style={{ position: 'sticky', top: 0, zIndex: 40, padding: '10px 12px 0' }}>
      <header style={{ minHeight: '58px', borderRadius: '20px', background: 'linear-gradient(135deg,#054218 0%,#043b16 100%)', boxShadow: '0 12px 30px rgba(4,59,22,.28)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 16px', color: '#fff' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '600 14.5px Inter,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {answering && att ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
              <span style={{ font: '400 12px Inter,sans-serif', opacity: 0.85 }}>Attempt {att.attempt.attemptNo} · {answeredCount} of {questions.length} answered {flaggedCount ? `(${flaggedCount} flagged)` : ''} · {saveError ? 'Some answers not saved, retrying…' : saving ? 'Saving…' : 'All answers saved'}</span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: isOnline ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.25)', color: isOnline ? '#bbf7d0' : '#fef08a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#4ade80' : '#facc15' }}></span>
                {isOnline ? (syncingOffline ? 'Syncing…' : 'Online · Encrypted DB') : 'Offline Mode · Encrypted Local Storage'}
              </span>
            </div>
          ) : null}
        </div>
        {answering ? <button type="button" onClick={exit} style={{ flex: 'none', height: '34px', padding: '0 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.12)', color: '#fff', font: '500 13px Inter,sans-serif', cursor: 'pointer' }}>Save &amp; exit</button>
          : <button type="button" onClick={() => go('assessments')} style={{ flex: 'none', height: '34px', padding: '0 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.12)', color: '#fff', font: '500 13px Inter,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><i className="icon-arrow-left" style={{ fontSize: '14px' }}></i>My Assessments</button>}
      </header>
      {answering && questions.length ? <div style={{ height: '6px', margin: '8px 10px 0', borderRadius: '999px', background: 'rgba(15,35,65,.08)', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount} aria-label="Questions answered"><div style={{ width: (100 * answeredCount / questions.length) + '%', height: '100%', background: GREEN, transition: 'width .25s' }}></div></div> : null}
    </div>
  );

  // ===== TAKE · Dialogs =====
  const dialogs = (
    <>
      <Confirm open={confirm === 'start'} busy={busy} title={item && item.canResume ? 'Resume your attempt?' : 'Start attempt ' + ((item ? item.used : 0) + 1)}
        text={item && item.canResume ? 'Your saved answers will be restored.' : 'Starting begins your attempt session. Your answers save automatically as you go and you can come back anytime before the deadline.'}
        confirmText={item && item.canResume ? 'Resume' : 'Start'} onConfirm={begin} onCancel={() => setConfirm(null)} />
      <Confirm open={confirm === 'submit'} busy={busy} title={'Submit attempt ' + (att ? att.attempt.attemptNo : '') + '?'} confirmText="Submit"
        text={(unanswered ? unanswered + (unanswered === 1 ? ' question is' : ' questions are') + ' unanswered and will score 0. ' : 'All questions are answered. ') + 'You cannot change your answers after submitting.'}
        onConfirm={submit} onCancel={() => setConfirm(null)} />
    </>
  );

  // ===== TAKE · Loading & errors =====
  if (stage === 'loading') return wrap(<Card><LoadingState title="Preparing your assessment session…" text="Setting up questions, offline engine, and verification packages." /></Card>);
  if (stage === 'none') return wrap(<Card><EmptyState icon="icon-clipboard-list" title="Choose an assessment" text="Open My Assessments and pick the assessment you want to take." action={<Btn kind="primary" onClick={() => go('assessments')}>My Assessments</Btn>} /></Card>);
  if (stage === 'error') return wrap(<Card><EmptyState icon="icon-circle-alert" title="This assessment can't be opened" text={error} action={<Btn kind="primary" onClick={() => go('assessments')}>Back to My Assessments</Btn>} /></Card>);
  if (stage === 'closed') return wrap(<Card><EmptyState icon="icon-circle-alert" title="This attempt is closed" text={error} action={<Btn kind="primary" onClick={() => go('assessments')}>Back to My Assessments</Btn>} /></Card>);

  // ===== TAKE · Intro =====
  if (stage === 'intro' || stage === 'results') {
    const it = item, extended = it.originalDeadline;
    const facts = [
      ['Opens', fmtDateTime(it.startsAt)], ['Deadline', fmtDateTime(it.deadline) + (extended ? ' (extended from ' + fmtDate(it.originalDeadline) + ')' : '')],
      ['Attempts taken', it.used], ['Completed attempts', it.completed], ['Status', it.progressLabel],
    ];
    return wrap(<>
      <Card title={it.title} sub={it.description ? <span style={{ overflowWrap: 'anywhere' }}>{it.description}</span> : null}>
        <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(3,1fr)', gap: '12px' }}>
          {facts.map(([k, v]) => <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' }}>{k}</span><span style={{ fontSize: '13.5px', color: '#111827' }}>{v}</span></div>)}
        </div>
      </Card>
      {stage === 'intro' ? <Card title="Before you start">
        {it.instructions ? <div style={{ fontSize: '13.5px', color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: '12px' }}>{it.instructions}</div> : null}
        <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px', color: '#374151', lineHeight: 1.5 }}>
          <li>There is <b>no time limit</b> and no countdown. Take the time you need before the deadline.</li>
          <li>Each answer is saved as soon as you choose it. You can use <b>Save &amp; exit</b> and come back later to carry on where you left off.</li>
          <li>Time is recorded only while this page is open and in front of you. It is kept for reporting and never changes your score.</li>
          <li>Your final result for each competency is the average of all your completed attempts.</li>
        </ul>
        {error ? <div role="alert" style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c', fontSize: '13px' }}>{error}</div> : null}
        {!it.canStart && !it.canResume && it.blockedReason ? <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: '#f3f4f6', color: '#374151', fontSize: '13px' }}>{it.blockedReason}</div> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
          {it.canResume ? <Btn kind="primary" icon="icon-play" onClick={begin} disabled={busy}>{busy ? 'Opening…' : 'Resume attempt'}</Btn> : null}
          {it.canStart ? <Btn kind="primary" icon="icon-play" onClick={() => { setError(''); setConfirm('start'); }}>{it.used ? 'Retake (attempt ' + (it.used + 1) + ')' : 'Start assessment'}</Btn> : null}
          {it.completed ? <Btn icon="icon-chart-column" onClick={() => setStage('results')}>View results</Btn> : null}
          <Btn onClick={() => go('assessments')}>Back</Btn>
        </div>
      </Card> : <Card title="Your results" actions={<Btn small onClick={() => setStage('intro')}>Back</Btn>}><ResultsPanel item={it} /></Card>}
    </>);
  }

  // ===== TAKE · Submitted =====
  if (stage === 'done') return wrap(<>
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px', padding: '12px 0' }}>
        <span style={{ width: '48px', height: '48px', borderRadius: '50%', background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="icon-check" style={{ fontSize: '24px' }}></i></span>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>Attempt {done.attemptNo} submitted</div>
        <div style={MUTED}>Submitted {fmtDateTime(done.submittedAt)} · <AttemptStatusBadge status={done.status} /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '18px', marginTop: '6px', fontSize: '13.5px' }}>
          <span>Active time on the page: <b>{fmtDuration(done.activeSeconds)}</b></span><span>Time from start to submit: <b>{fmtDuration(done.elapsedSeconds)}</b></span>
        </div>
        <div style={{ ...MUTED, fontSize: '12px', maxWidth: '520px' }}>Active time counts only while the page was open and in front. It is for reporting and does not affect your score.</div>
      </div>
    </Card>
    <Card title="Your results" sub={item && item.completed ? `${item.completed} attempt${item.completed === 1 ? '' : 's'} completed` : null}><ResultsPanel item={item} /></Card>
    <div style={{ display: 'flex', justifyContent: 'center' }}><Btn kind="primary" onClick={() => go('assessments')}>Back to My Assessments</Btn></div>
  </>);

  // ===== TAKE · Review =====
  if (stage === 'review') return wrap(<>
    <Card title="Review your answers" sub={answeredCount + ' of ' + questions.length + ' answered' + (unanswered ? ' · ' + unanswered + ' unanswered' : '')}>
      {unanswered ? <div role="status" style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: '#fffbeb', color: '#92400e', fontSize: '13px' }}><i className="icon-circle-alert" style={{ marginRight: '6px' }}></i>{unanswered} {unanswered === 1 ? 'question has' : 'questions have'} no answer. Unanswered questions score 0. Select a question to answer it.</div> : <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: '#f0fdf4', color: '#15803d', fontSize: '13px' }}><i className="icon-circle-check" style={{ marginRight: '6px' }}></i>Every question has an answer.</div>}
      {error ? <div role="alert" style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c', fontSize: '13px' }}>{error}</div> : null}
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '55vh', overflowY: 'auto', border: '1px solid rgba(15,35,65,.08)', borderRadius: '12px', background: '#fff' }}>
        {questions.map((x, i) => { const ok = isAnswered(answers[x.id]), isFlagged = flags[x.id]; return (
          <button key={x.id} type="button" onClick={() => goTo(i)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: 0, borderBottom: '1px solid rgba(15,35,65,.06)', background: 'none', cursor: 'pointer', textAlign: 'left', font: '400 13px Inter,sans-serif', color: '#111827' }}>
            <span style={{ flex: 'none', width: '30px', color: '#6b7280', fontWeight: 600 }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.text}</span>
            {isFlagged ? <Badge bg="#fef3c7" fg="#b45309"><i className="icon-flag" style={{ fontSize: '11px', marginRight: '4px' }}></i>Flagged</Badge> : null}
            {ok ? <Badge bg="#dcfce7" fg="#15803d"><i className="icon-check" style={{ fontSize: '11px' }}></i>Answered</Badge> : <Badge bg="#fef3c7" fg="#92400e">Unanswered</Badge>}
          </button>); })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px', marginTop: '16px' }}>
        <Btn icon="icon-arrow-left" onClick={() => goTo(idx)}>Back to questions</Btn>
        <Btn kind="primary" icon="icon-send" onClick={() => { setError(''); setConfirm('submit'); }} disabled={busy}>Submit attempt</Btn>
      </div>
    </Card>
  </>);

  // ===== TAKE · Question =====
  if (!q) return wrap(<Card><EmptyState icon="icon-circle-alert" title="This assessment has no questions" text="Please raise a support ticket so the assessment team can fix it." action={<Btn kind="primary" onClick={exit}>Back to My Assessments</Btn>} /></Card>);
  const a = answers[q.id] || {}, picked = a.optionIds || [], multi = q.type === 'MULTIPLE_CHOICE';
  const pick = oid => change(q.id, { optionIds: multi ? (picked.includes(oid) ? picked.filter(x => x !== oid) : [...picked, oid]) : [oid] });
  const st = saveState[q.id];
  return wrap(<>
    <Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ font: '600 12px Inter,sans-serif', color: '#127a42', letterSpacing: '.3px' }}>QUESTION {idx + 1} OF {questions.length}{q.skillArea ? ' · ' + q.skillArea : ''}</span>
          <button type="button" onClick={() => toggleFlag(q.id)} aria-pressed={!!flags[q.id]} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '6px', border: flags[q.id] ? '1px solid #f59e0b' : '1px solid rgba(15,35,65,.15)', background: flags[q.id] ? '#fef3c7' : '#fff', color: flags[q.id] ? '#b45309' : '#6b7280', fontSize: '12px', cursor: 'pointer', font: '500 12px Inter,sans-serif' }}>
            <i className="icon-flag" style={{ fontSize: '11px', color: flags[q.id] ? '#d97706' : '#9ca3af' }}></i>
            {flags[q.id] ? 'Flagged' : 'Flag'}
          </button>
        </div>
        <span aria-live="polite" style={{ fontSize: '12px', color: st === 'error' ? '#b91c1c' : '#6b7280' }}>{st === 'saving' ? 'Saving…' : st === 'saved' ? 'Saved' : st === 'error' ? 'Not saved yet, retrying…' : isAnswered(a) ? 'Saved' : ''}</span>
      </div>
      <div id={'q' + q.id} style={{ fontSize: phone ? '15.5px' : '17px', fontWeight: 600, lineHeight: 1.5, color: '#111827', marginBottom: '16px' }}>{q.text}</div>
      {multi ? <div style={{ ...MUTED, marginBottom: '8px' }}>Choose every answer that applies.</div> : null}
      {q.type === 'TEXT' ? (
        <textarea aria-labelledby={'q' + q.id} value={a.textAnswer || ''} onChange={e => change(q.id, { textAnswer: e.target.value }, 800)} rows={6} placeholder="Type your answer" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(15,35,65,.14)', borderRadius: '12px', padding: '10px 12px', font: '400 14px Inter,sans-serif', resize: 'vertical' }} />
      ) : (
        <div role={multi ? 'group' : 'radiogroup'} aria-labelledby={'q' + q.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {q.options.map((o, i) => { const on = picked.includes(o.id); return (
            <button key={o.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => pick(o.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', borderRadius: '14px', cursor: 'pointer', textAlign: 'left', font: '400 14px Inter,sans-serif', lineHeight: 1.45, color: '#111827',
                border: on ? '1.5px solid #15904c' : '1px solid rgba(15,35,65,.12)', background: on ? '#f0fdf4' : '#fff', boxShadow: on ? '0 4px 12px rgba(21,144,76,.12)' : 'none' }}>
              <span style={{ flex: 'none', width: '22px', height: '22px', borderRadius: multi ? '6px' : '50%', marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: on ? '0' : '1.5px solid #cbd5e1', background: on ? GREEN : '#fff', color: '#fff' }}>{on ? <i className="icon-check" style={{ fontSize: '13px' }}></i> : null}</span>
              <span style={{ flex: 'none', fontWeight: 600, color: '#6b7280' }}>{String.fromCharCode(65 + i)}.</span>
              <span style={{ flex: 1 }}>{o.text}</span>
            </button>); })}
        </div>
      )}
      {isAnswered(a) && q.type !== 'TEXT' ? <div style={{ marginTop: '10px' }}><Btn kind="ghost" small onClick={() => change(q.id, { optionIds: [] })}>Clear answer</Btn></div> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px', marginTop: '18px' }}>
        <Btn icon="icon-arrow-left" onClick={() => goTo(idx - 1)} disabled={idx === 0}>Previous</Btn>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Btn icon="icon-list-checks" onClick={() => { setStage('review'); try { window.scrollTo(0, 0); } catch (e) {} }}>Review &amp; submit</Btn>
          {idx < questions.length - 1 ? <Btn kind="primary" onClick={() => goTo(idx + 1)}>Next<i className="icon-arrow-right" style={{ fontSize: '14px' }}></i></Btn> : null}
        </div>
      </div>
    </Card>
    {/* ===== TAKE · Question navigator ===== */}
    {/* Numbered buttons for every question: green = answered, white = not yet, outlined = the one on screen. */}
    <div style={{ ...CARD, padding: '14px 16px' }}>
      <button type="button" onClick={() => setNavOpen(o => !o)} aria-expanded={navOpen || !phone} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 0, padding: 0, cursor: phone ? 'pointer' : 'default', font: '600 13px Inter,sans-serif', color: '#111827' }}>
        <span>All questions · {answeredCount} answered, {unanswered} to go</span>{phone ? <i className={navOpen ? 'icon-chevron-up' : 'icon-chevron-down'} style={{ fontSize: '14px' }}></i> : null}
      </button>
      {navOpen || !phone ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
        {questions.map((x, i) => { const ok = isAnswered(answers[x.id]), cur = i === idx, isFl = flags[x.id]; return (
          <button key={x.id} type="button" onClick={() => goTo(i)} aria-label={'Question ' + (i + 1) + (ok ? ', answered' : ', not answered') + (isFl ? ', flagged' : '')} aria-current={cur ? 'step' : undefined}
            style={{ position: 'relative', width: '34px', height: '30px', borderRadius: '8px', cursor: 'pointer', font: '600 12px Inter,sans-serif', border: cur ? '2px solid #054218' : isFl ? '2px solid #d97706' : ok ? '0' : '1px solid rgba(15,35,65,.15)', background: ok ? GREEN : '#fff', color: ok ? '#fff' : '#374151' }}>
            {i + 1}
            {isFl ? <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '8px', height: '8px', borderRadius: '50%', background: '#d97706', border: '1px solid #fff' }}></span> : null}
          </button>); })}
      </div> : null}
    </div>
  </>);
}
