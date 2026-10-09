'use client';
import React from 'react';
import __css from './SMAssessmentSession.module.css';


const KEY = 'skm-session';
// The assessment for the signed-in officer: a self-rating of their department's technical skills and the
// DVLA general skills, plus one open-text answer that a reviewer scores. Departments with a DVLA question
// bank (HR, RBDI) sit that bank's questions instead; see the Form Builder.
const pad = n => String(n).padStart(2, '0');
class SMAssessmentSession extends React.Component {
  state = { sess: null, idx: 0, now: Date.now(), agreed: false, review: false, warn: false, savedAt: null };
  componentDidMount() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) this.setState({ sess: s }, () => { if (!s.submittedAt) this.arm(); }); } catch (e) {}
  }
  componentWillUnmount() { this.disarm(); }
  questions() {
    const d = this.props.data;
    const hint = 'Choose the description that best matches what you can do today.';
    const lik = d.comps.map(c => ({ id: 'c' + c.id, type: 'likert', section: c.major, text: 'How would you rate your current proficiency in ' + c.name + '?', hint }));
    const gen = d.framework.filter(c => c.category === 'General').map(c => ({ id: 'g' + c.id, type: 'likert', section: 'General skills', text: 'How would you rate your current proficiency in ' + c.name + '?', hint }));
    const text = { id: 'o1', type: 'text', section: 'General skills', text: 'Describe a recent piece of work that shows your Leadership & Management skills. What did you do, and what would you do differently?', min: 40 };
    return [...lik, ...gen, text];
  }
  save(sess) { try { localStorage.setItem(KEY, JSON.stringify(sess)); } catch (e) {} this.setState({ sess, savedAt: Date.now() }); }
  arm() {
    this.disarm();
    this._tick = setInterval(() => { this.setState({ now: Date.now() }); const s = this.state.sess; if (s && !s.submittedAt && this.remaining() <= 0) this.submit('time'); }, 1000);
    this._vis = () => { if (document.hidden) this.strike(); };
    this._blur = () => this.strike();
    document.addEventListener('visibilitychange', this._vis); window.addEventListener('blur', this._blur);
  }
  disarm() { clearInterval(this._tick); if (this._vis) document.removeEventListener('visibilitychange', this._vis); if (this._blur) window.removeEventListener('blur', this._blur); }
  strike() {
    const s = this.state.sess; if (!s || s.submittedAt) return;
    if (this._last && Date.now() - this._last < 1500) return; this._last = Date.now();
    const limit = this.props.data.cycle.tabLimit, strikes = (s.strikes || 0) + 1;
    const next = { ...s, strikes, events: [...(s.events || []), { t: Date.now(), type: 'left-window' }] };
    this.save(next);
    if (strikes >= limit) this.submit('integrity', next); else this.setState({ warn: true });
  }
  remaining() { const s = this.state.sess; if (!s) return 0; return s.startAt + this.props.data.cycle.durationMin * 60000 - Date.now(); }
  submit(reason, base) {
    const s = base || this.state.sess; if (!s || s.submittedAt) return;
    const next = { ...s, submittedAt: Date.now(), reason, ref: 'SMA-Q4-' + Math.random().toString(36).slice(2, 7).toUpperCase() };
    this.save(next); this.disarm(); this.setState({ review: false, warn: false });
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    this.props.onStatus && this.props.onStatus('submitted');
  }
  answer(id, v) { const s = this.state.sess; this.save({ ...s, answers: { ...s.answers, [id]: v } }); }
  isAnswered(q, a) {
    const v = a[q.id];
    if (q.type === 'multi') return Array.isArray(v) && v.length > 0;
    if (q.type === 'text') return typeof v === 'string' && v.trim().length >= q.min;
    if (q.type === 'numeric') return v !== undefined && v !== '' && !isNaN(+v) && +v >= 0 && +v <= 1000;
    return v !== undefined && v !== null && v !== '';
  }
  renderVals() {
    const d = this.props.data, go = this.props.go || (() => {}), vw = this.props.vw || 1440, s = this.state;
    if (!d) return {};
    const C = d.cycle, sess = s.sess, all = this.questions();
    const stage = !sess ? 'brief' : sess.submittedAt ? 'done' : 'live';
    const base = { cycleName: C.name, isBrief: stage === 'brief', isLive: stage === 'live', notLive: stage !== 'live', isDone: stage === 'done', goHome: () => go('home'),
      block: e => { if (stage === 'live') e.preventDefault(); }, userSelect: stage === 'live' ? 'none' : 'auto', duration: C.durationMin, tabLimit: C.tabLimit };
    if (stage === 'brief') return { ...base,
      facts: [{ icon: 'icon-calendar', label: 'DATE', value: C.dayLabel }, { icon: 'icon-clock', label: 'WINDOW', value: C.window }, { icon: 'icon-timer', label: 'TIME LIMIT', value: C.durationMin + ' minutes' }, { icon: 'icon-list-checks', label: 'QUESTIONS', value: all.length + ' questions' }],
      rules: [
        { icon: 'icon-timer', text: 'You have ' + C.durationMin + ' minutes from the moment you press Start. The timer keeps running if you close the page or lose your connection.' },
        { icon: 'icon-calendar-clock', text: 'The window is only open today, ' + C.window + '. Any attempt still open when it closes is submitted automatically.' },
        { icon: 'icon-repeat-1', text: "You get one attempt. Once you've submitted, you can't reopen the assessment." },
        { icon: 'icon-app-window', text: 'Leaving this window or switching tabs is recorded. After ' + C.tabLimit + ' times, your assessment is submitted automatically.' },
        { icon: 'icon-shuffle', text: 'Every candidate gets the questions in a different order. Copy, paste and right-click are turned off.' },
        { icon: 'icon-cloud-check', text: 'Your answers save as you go, and still save if your connection drops for a moment.' }],
      agreed: s.agreed, toggleAgree: () => this.setState({ agreed: !s.agreed }),
      startBg: s.agreed ? '#15904c' : '#a3acb9', startCursor: s.agreed ? 'pointer' : 'not-allowed',
      start: () => { if (!s.agreed) return;
        const order = all.map(q => q.id).sort(() => Math.random() - 0.5);
        const ns = { startAt: Date.now(), order, answers: {}, flags: [], strikes: 0, events: [] };
        this.save(ns); this.setState({ idx: 0 }, () => this.arm());
        try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
        this.props.onStatus && this.props.onStatus('in_progress'); } };
    const byId = Object.fromEntries(all.map(q => [q.id, q]));
    const qs = sess.order.map(id => byId[id]).filter(Boolean), a = sess.answers || {};
    const answered = qs.filter(q => this.isAnswered(q, a)).length;
    if (stage === 'done') {
      const used = Math.min(sess.submittedAt - sess.startAt, C.durationMin * 60000), mm = Math.floor(used / 60000), ss = Math.floor(used % 60000 / 1000);
      return { ...base,
        doneReason: { manual: 'Thanks. Your answers have been locked and sent to your line manager for evaluation. Results are released on ' + C.resultsLabel + '.', time: 'Time ran out, so your answers were submitted automatically. Results are released on ' + C.resultsLabel + '.', integrity: 'Your assessment was submitted automatically because you left the window ' + C.tabLimit + ' times. HR has been notified for review.' }[sess.reason] || '',
        receipt: [
          { label: 'REFERENCE', value: sess.ref, font: "'JetBrains Mono',monospace" }, { label: 'SUBMITTED', value: new Date(sess.submittedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }), font: 'Inter,sans-serif' },
          { label: 'TIME USED', value: mm + 'm ' + pad(ss) + 's of ' + C.durationMin + 'm', font: 'Inter,sans-serif' }, { label: 'ANSWERED', value: answered + ' of ' + qs.length, font: 'Inter,sans-serif' },
          { label: 'INTEGRITY EVENTS', value: String(sess.strikes || 0), font: 'Inter,sans-serif' }, { label: 'RESULTS RELEASED', value: C.resultsLabel, font: 'Inter,sans-serif' }],
        reset: () => { try { localStorage.removeItem(KEY); } catch (e) {} this.setState({ sess: null, agreed: false, idx: 0 }); this.props.onStatus && this.props.onStatus('not_started'); } };
    }
    const rem = Math.max(0, this.remaining()), mins = Math.floor(rem / 60000), secs = Math.floor(rem % 60000 / 1000);
    const idx = Math.min(s.idx, qs.length - 1), q = qs[idx], v = a[q.id], flags = sess.flags || [];
    const setIdx = i => this.setState({ idx: Math.max(0, Math.min(qs.length - 1, i)) });
    let qv = { section: q.section.toUpperCase(), text: q.text, hint: q.hint || (q.type === 'single' ? 'Choose one answer.' : q.type === 'numeric' ? 'Enter a whole number between 0 and 1000.' : q.type === 'text' ? 'Write at least ' + q.min + ' characters.' : ''),
      reqText: 'REQUIRED', reqFg: '#991b1b', reqBg: '#fef2f2', isChoice: false, isNumeric: false, isText: false };
    if (this.isAnswered(q, a)) { qv.reqText = 'ANSWERED'; qv.reqFg = '#15803d'; qv.reqBg = '#dcfce7'; }
    if (q.type === 'likert') qv = { ...qv, isChoice: true, options: [1, 2, 3, 4, 5].map(n => { const on = v === n; return { badge: n, label: d.PROF[n].label, desc: d.PROF[n].desc, radius: '8px', pick: () => this.answer(q.id, n),
      bg: on ? '#eef7f1' : '#fff', border: on ? '#0d3b2a' : '#e5e7eb', badgeBg: on ? '#0d3b2a' : '#fff', badgeFg: on ? '#fff' : '#374151', badgeBorder: on ? '#0d3b2a' : 'rgba(15,35,65,.14)' }; }) };
    if (q.type === 'single' || q.type === 'multi') qv = { ...qv, isChoice: true, options: q.options.map((label, i) => {
      const on = q.type === 'multi' ? (v || []).includes(i) : v === i;
      return { badge: q.type === 'multi' ? (on ? '✓' : '') : String.fromCharCode(65 + i), label, desc: '', radius: q.type === 'multi' ? '6px' : '50%',
        pick: () => q.type === 'multi' ? this.answer(q.id, on ? (v || []).filter(x => x !== i) : [...(v || []), i]) : this.answer(q.id, i),
        bg: on ? '#eef7f1' : '#fff', border: on ? '#0d3b2a' : '#e5e7eb', badgeBg: on ? '#0d3b2a' : '#fff', badgeFg: on ? '#fff' : '#374151', badgeBorder: on ? '#0d3b2a' : 'rgba(15,35,65,.14)' }; }) };
    if (q.type === 'numeric') qv = { ...qv, isNumeric: true, value: v ?? '', unit: q.unit, onInput: e => this.answer(q.id, e.target.value),
      error: v !== undefined && v !== '' && (isNaN(+v) || +v < 0 || +v > 1000) ? 'Enter a number between 0 and 1000.' : '' };
    if (q.type === 'text') { const len = (v || '').trim().length; qv = { ...qv, isText: true, value: v || '', onInput: e => this.answer(q.id, e.target.value), count: len,
      countHint: len >= q.min ? 'Minimum length met' : (q.min - len) + ' more characters needed', countColor: len >= q.min ? '#15803d' : '#6b7280' }; }
    const unanswered = qs.filter(x => !this.isAnswered(x, a));
    const flagged = flags.includes(q.id);
    return { ...base,
      timeLeft: pad(mins) + ':' + pad(secs), timerBg: rem < 60000 ? '#dc2626' : rem < 300000 ? '#f2a516' : 'rgba(255,255,255,.12)', timerFg: rem < 300000 && rem >= 60000 ? '#1f2937' : '#fff',
      savedText: s.savedAt ? 'Saved ' + new Date(s.savedAt).toLocaleTimeString('en-GB') : 'Autosave on',
      progressPct: (answered / qs.length * 100) + '%', answeredCount: answered, qCount: qs.length, unansweredCount: unanswered.length, flaggedCount: flags.length,
      strikes: sess.strikes || 0, strikeColor: (sess.strikes || 0) ? '#b91c1c' : '#15803d',
      navMax: vw >= 900 ? '280px' : 'none', navPos: vw >= 900 ? 'sticky' : 'static',
      navItems: qs.map((x, i) => { const ans = this.isAnswered(x, a), cur = i === idx;
        return { num: i + 1, go: () => setIdx(i), flag: flags.includes(x.id), bg: ans ? '#0d3b2a' : '#fff', fg: ans ? '#fff' : '#374151', border: cur ? '2px solid #f2a516' : ans ? '1.5px solid #0d3b2a' : '1.5px solid #cbd2da' }; }),
      qNum: idx + 1, q: qv,
      prev: () => setIdx(idx - 1), prevColor: idx === 0 ? '#9ca3af' : '#374151',
      next: () => idx === qs.length - 1 ? this.setState({ review: true }) : setIdx(idx + 1), nextText: idx === qs.length - 1 ? 'Review & submit' : 'Next',
      toggleFlag: () => this.save({ ...sess, flags: flagged ? flags.filter(f => f !== q.id) : [...flags, q.id] }),
      flagText: flagged ? 'Flagged' : 'Flag for review', flagBg: flagged ? '#fff7e6' : '#fff', flagBorder: flagged ? '#f2a516' : 'rgba(15,35,65,.14)',
      showReview: s.review, openReview: () => this.setState({ review: true }), closeReview: () => this.setState({ review: false }),
      hasUnanswered: unanswered.length > 0, canSubmit: unanswered.length === 0, unansBg: unanswered.length ? '#fef2f2' : '#f5f6f8',
      goFirstUnanswered: () => { this.setState({ review: false }); setIdx(qs.indexOf(unanswered[0])); },
      submitNow: () => this.submit('manual'),
      showWarn: s.warn, dismissWarn: () => this.setState({ warn: false }) };
  }
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      <div onCopy={__v.block} onCut={__v.block} onPaste={__v.block} onContextMenu={__v.block} style={{ minHeight: "100vh", background: "transparent", display: "flex", flexDirection: "column", fontFamily: "Inter,system-ui,sans-serif", color: "#111827", userSelect: __v.userSelect }}>
        <header style={{ position: "sticky", top: "0", zIndex: "20", background: "#0d3b2a", color: "#fff", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px clamp(12px,2.4vw,28px)", minHeight: "63px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "0" }}>
            <div style={{ minWidth: "0" }}>
              <div style={{ fontSize: "clamp(15px,1.6vw,18px)", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{__v.cycleName}</div>
              <div style={{ fontSize: "12px", color: "#b9d8c6", marginTop: "2px" }}>ADJEI DENZIL ASIAM · 123456789</div>
            </div>
          </div>
          {(__v.isLive) ? (<>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "12px", color: "#b9d8c6", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}><i className={"icon-cloud-check"} style={{ fontSize: "14px" }}></i>{__v.savedText}</span>
              <div title={"Time remaining"} style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 14px", borderRadius: "12px", background: __v.timerBg, color: __v.timerFg }}>
                <i className={"icon-timer"} style={{ fontSize: "16px" }}></i>
                <span style={{ font: "600 18px 'JetBrains Mono',monospace", letterSpacing: ".5px" }}>{__v.timeLeft}</span>
              </div>
              <button onClick={__v.openReview} style={{ height: "38px", padding: "0 18px", border: "0", borderRadius: "999px", background: "#fff", color: "#0d3b2a", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>Submit</button>
            </div>
          </>) : null}
          {(__v.notLive) ? (<>
            <button onClick={__v.goHome} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 14px", border: "1px solid rgba(255,255,255,.25)", borderRadius: "999px", background: "transparent", color: "#fff", font: "500 13px Inter,sans-serif", cursor: "pointer" }}><i className={"icon-arrow-left"} style={{ fontSize: "14px" }}></i>Back to portal</button>
          </>) : null}
        </header>
        {(__v.isLive) ? (<>
          <div style={{ height: "4px", background: "#dde3ea" }}>
            <div style={{ height: "100%", background: "#f2a516", width: __v.progressPct, transition: "width .3s" }}></div>
          </div>
        </>) : null}
        {(__v.isBrief) ? (<>
          <div style={{ flex: "1", display: "flex", justifyContent: "center", padding: "clamp(16px,4vw,48px) clamp(12px,3vw,24px)" }}>
            <div style={{ width: "100%", maxWidth: "820px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", overflow: "hidden" }}>
                <div style={{ padding: "clamp(20px,3vw,32px)", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span style={{ font: "700 10px Inter,sans-serif", letterSpacing: ".6px", color: "#9a3412", background: "#ffedd5", borderRadius: "999px", padding: "3px 9px" }}>OPEN TODAY · ONE ATTEMPT</span>
                  <h1 style={{ margin: "14px 0 6px", fontSize: "clamp(22px,3vw,30px)", fontWeight: "700", letterSpacing: "-0.4px" }}>{__v.cycleName}</h1>
                  <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "#4b5563", maxWidth: "620px", textWrap: "pretty" }}>This is a timed, one-day assessment of your skills. It has to be done in one sitting: once you start, the timer runs until you submit or the time runs out.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  {(__v.facts || []).map((f, $index) => (<React.Fragment key={$index}>
                    <div style={{ padding: "18px clamp(16px,2.4vw,24px)", borderRight: "1px solid rgba(15,35,65,.07)" }}>
                      <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280", display: "flex", alignItems: "center", gap: "6px" }}><i className={f?.icon} style={{ fontSize: "13px" }}></i>{f?.label}</div>
                      <div style={{ fontSize: "17px", fontWeight: "600", marginTop: "6px" }}>{f?.value}</div>
                    </div>
                  </React.Fragment>))}
                </div>
                <div style={{ padding: "clamp(20px,3vw,28px) clamp(20px,3vw,32px)" }}>
                  <div style={{ fontSize: "15px", fontWeight: "600", marginBottom: "14px" }}>Rules for this session</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {(__v.rules || []).map((r, $index) => (<React.Fragment key={$index}>
                      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <span style={{ width: "30px", height: "30px", borderRadius: "10px", background: "#e6f2ea", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                          <i className={r?.icon} style={{ fontSize: "15px" }}></i>
                        </span>
                        <span style={{ fontSize: "14px", lineHeight: "1.5", color: "#374151", paddingTop: "5px" }}>{r?.text}</span>
                      </div>
                    </React.Fragment>))}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "18px clamp(20px,3vw,32px)", background: "rgba(255,255,255,.4)", borderTop: "1px solid rgba(15,35,65,.07)" }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13.5px", color: "#374151", cursor: "pointer", maxWidth: "480px" }}><input type={"checkbox"} checked={__v.agreed} onChange={__v.toggleAgree} style={{ width: "17px", height: "17px", marginTop: "1px", accentColor: "#0d3b2a", flex: "none" }} />I'll complete this assessment on my own, without help or outside resources, and I understand I only get one attempt.</label>
                  <button onClick={__v.start} style={{ display: "flex", alignItems: "center", gap: "8px", height: "42px", padding: "0 22px", border: "0", borderRadius: "999px", background: __v.startBg, color: "#fff", font: "600 14px Inter,sans-serif", cursor: __v.startCursor }}><i className={"icon-play"} style={{ fontSize: "15px" }}></i>Start {__v.duration}-minute timer</button>
                </div>
              </div>
            </div>
          </div>
        </>) : null}
        {(__v.isLive) ? (<>
          <div style={{ flex: "1", display: "flex", flexWrap: "wrap", gap: "20px", padding: "clamp(12px,2.4vw,28px)", alignItems: "flex-start", maxWidth: "1320px", width: "100%", margin: "0 auto" }}>
            <aside style={{ flex: "1 1 240px", maxWidth: __v.navMax, background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "18px", position: __v.navPos, top: "90px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "14px", fontWeight: "600" }}>Questions</span>
                <span style={{ fontSize: "12px", color: "#6b7280" }}>{__v.answeredCount}/{__v.qCount} answered</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(36px,1fr))", gap: "6px", marginTop: "14px" }}>
                {(__v.navItems || []).map((n, $index) => (<React.Fragment key={$index}>
                  <button onClick={n?.go} style={{ position: "relative", height: "36px", borderRadius: "10px", cursor: "pointer", font: "600 12.5px Inter,sans-serif", background: n?.bg, color: n?.fg, border: n?.border }}>{n?.num}{(n?.flag) ? (<>
                      <span style={{ position: "absolute", top: "-3px", right: "-3px", width: "9px", height: "9px", borderRadius: "50%", background: "#f2a516", border: "2px solid #fff" }}></span>
                    </>) : null}</button>
                </React.Fragment>))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "14px", fontSize: "11px", color: "#6b7280" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#0d3b2a" }}></span>Answered</span>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", border: "1.5px solid #cbd2da" }}></span>Not answered</span>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#f2a516" }}></span>Flagged</span>
              </div>
              <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid rgba(15,35,65,.07)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280" }}>INTEGRITY CHECKS</span>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "#374151" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "7px" }}><i className={"icon-app-window"} style={{ fontSize: "14px", color: "#6b7280" }}></i>Times you left this window</span>
                  <span style={{ fontWeight: "600", color: __v.strikeColor }}>{__v.strikes} / {__v.tabLimit}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "#374151" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "7px" }}><i className={"icon-clipboard-x"} style={{ fontSize: "14px", color: "#6b7280" }}></i>Copy &amp; paste</span>
                  <span style={{ fontWeight: "600", color: "#15803d" }}>Blocked</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "#374151" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "7px" }}><i className={"icon-shuffle"} style={{ fontSize: "14px", color: "#6b7280" }}></i>Question order</span>
                  <span style={{ fontWeight: "600", color: "#15803d" }}>Randomised</span>
                </div>
              </div>
            </aside>
            <section style={{ flex: "3 1 520px", minWidth: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "clamp(18px,3vw,32px)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", font: "600 11px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280" }}>
                  <span>QUESTION {__v.qNum} OF {__v.qCount}</span>
                  <span style={{ color: "#d1d5db" }}>•</span>
                  <span>{__v.q?.section}</span>
                  <span style={{ marginLeft: "auto", font: "600 10.5px Inter,sans-serif", color: __v.q?.reqFg, background: __v.q?.reqBg, borderRadius: "999px", padding: "2px 8px" }}>{__v.q?.reqText}</span>
                </div>
                <h2 style={{ margin: "12px 0 6px", fontSize: "clamp(18px,2vw,22px)", fontWeight: "600", lineHeight: "1.4", textWrap: "pretty" }}>{__v.q?.text}</h2>
                <p style={{ margin: "0 0 20px", fontSize: "13.5px", color: "#6b7280" }}>{__v.q?.hint}</p>
                {(__v.q?.isChoice) ? (<>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {(__v.q?.options || []).map((o, $index) => (<React.Fragment key={$index}>
                      <button className={__css.h0} onClick={o?.pick} style={{ display: "flex", alignItems: "flex-start", gap: "14px", padding: "14px 16px", borderRadius: "12px", cursor: "pointer", textAlign: "left", background: o?.bg, border: `1.5px solid ${o?.border ?? ""}` }}>
                        <span style={{ flex: "none", width: "28px", height: "28px", borderRadius: o?.radius, display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px Inter,sans-serif", background: o?.badgeBg, color: o?.badgeFg, border: `1.5px solid ${o?.badgeBorder ?? ""}` }}>{o?.badge}</span>
                        <span style={{ display: "flex", flexDirection: "column", gap: "3px", paddingTop: "4px" }}>
                          <span style={{ font: "600 14.5px Inter,sans-serif", color: "#111827" }}>{o?.label}</span>
                          {(o?.desc) ? (<>
                            <span style={{ font: "400 13px/1.5 Inter,sans-serif", color: "#4b5563" }}>{o?.desc}</span>
                          </>) : null}
                        </span>
                      </button>
                    </React.Fragment>))}
                  </div>
                </>) : null}
                {(__v.q?.isNumeric) ? (<>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", maxWidth: "320px" }}>
                    <input type={"number"} min={"0"} max={"1000"} value={__v.q?.value} onChange={__v.q?.onInput} placeholder={"Enter a number"} style={{ flex: "1", height: "46px", border: "1.5px solid rgba(15,35,65,.14)", borderRadius: "12px", padding: "0 14px", font: "600 17px 'JetBrains Mono',monospace", color: "#111827", minWidth: "0" }} />
                    <span style={{ fontSize: "14px", color: "#4b5563" }}>{__v.q?.unit}</span>
                  </div>
                  {(__v.q?.error) ? (<>
                    <div style={{ marginTop: "8px", fontSize: "12.5px", color: "#b91c1c" }}>{__v.q?.error}</div>
                  </>) : null}
                </>) : null}
                {(__v.q?.isText) ? (<>
                  <textarea value={__v.q?.value} onChange={__v.q?.onInput} placeholder={"Type your answer here…"} style={{ width: "100%", minHeight: "200px", border: "1.5px solid rgba(15,35,65,.14)", borderRadius: "12px", padding: "14px", font: "400 15px/1.6 Inter,sans-serif", color: "#111827", resize: "vertical" }}></textarea>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "12.5px", color: __v.q?.countColor }}>
                    <span>{__v.q?.countHint}</span>
                    <span>{__v.q?.count} characters</span>
                  </div>
                </>) : null}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                <button onClick={__v.prev} style={{ display: "flex", alignItems: "center", gap: "6px", height: "40px", padding: "0 16px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "999px", background: "#fff", color: __v.prevColor, font: "500 13.5px Inter,sans-serif", cursor: "pointer" }}><i className={"icon-arrow-left"} style={{ fontSize: "15px" }}></i>Previous</button>
                <button onClick={__v.toggleFlag} style={{ display: "flex", alignItems: "center", gap: "6px", height: "40px", padding: "0 16px", border: `1px solid ${__v.flagBorder ?? ""}`, borderRadius: "999px", background: __v.flagBg, color: "#92400e", font: "500 13.5px Inter,sans-serif", cursor: "pointer" }}><i className={"icon-flag"} style={{ fontSize: "14px" }}></i>{__v.flagText}</button>
                <button onClick={__v.next} style={{ display: "flex", alignItems: "center", gap: "6px", height: "40px", padding: "0 20px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>{__v.nextText}<i className={"icon-arrow-right"} style={{ fontSize: "15px" }}></i></button>
              </div>
            </section>
          </div>
        </>) : null}
        {(__v.isDone) ? (<>
          <div style={{ flex: "1", display: "flex", justifyContent: "center", padding: "clamp(16px,4vw,48px) clamp(12px,3vw,24px)" }}>
            <div style={{ width: "100%", maxWidth: "640px", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", overflow: "hidden" }}>
              <div style={{ padding: "clamp(28px,4vw,44px)", textAlign: "center", background: "linear-gradient(110deg,#0b4a2e 0%,#15904c 42%,#b8901f 82%,#f2c14e 100%)", color: "#fff" }}>
                <div style={{ width: "68px", height: "68px", borderRadius: "50%", background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.4)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,0,0,.18)" }}>
                  <i className={"icon-circle-check"} style={{ fontSize: "34px" }}></i>
                </div>
                <h1 style={{ margin: "16px 0 6px", fontSize: "clamp(24px,3vw,30px)", fontWeight: "700", letterSpacing: "-0.3px" }}>Assessment submitted</h1>
                <p style={{ margin: "0 auto", fontSize: "14.5px", lineHeight: "1.6", color: "#f1f8f3", maxWidth: "460px", textWrap: "pretty" }}>{__v.doneReason}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
                {(__v.receipt || []).map((r, $index) => (<React.Fragment key={$index}>
                  <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(15,35,65,.07)", borderRight: "1px solid rgba(15,35,65,.07)" }}>
                    <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280" }}>{r?.label}</div>
                    <div style={{ fontSize: "15px", fontWeight: "600", marginTop: "5px", fontFamily: r?.font }}>{r?.value}</div>
                  </div>
                </React.Fragment>))}
              </div>
              <div style={{ padding: "20px 22px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <button onClick={__v.reset} style={{ background: "none", border: "0", cursor: "pointer", color: "#6b7280", font: "500 12px Inter,sans-serif", textDecoration: "underline" }}>Reset demo attempt</button>
                <button onClick={__v.goHome} style={{ display: "flex", alignItems: "center", gap: "8px", height: "40px", padding: "0 20px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>Return to Home<i className={"icon-arrow-right"} style={{ fontSize: "15px" }}></i></button>
              </div>
            </div>
          </div>
        </>) : null}
        {(__v.showReview) ? (<>
          <div style={{ position: "fixed", inset: "0", zIndex: "50", background: "rgba(8,12,24,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <div style={{ width: "min(520px,100%)", background: "#fff", borderRadius: "14px", boxShadow: "0 30px 80px rgba(0,0,0,.35)", overflow: "hidden" }}>
              <div style={{ padding: "22px 24px 8px" }}>
                <div style={{ fontSize: "19px", fontWeight: "700" }}>Submit your assessment?</div>
                <div style={{ fontSize: "13.5px", color: "#4b5563", marginTop: "6px", lineHeight: "1.5" }}>Once you submit, you can't change your answers. You have <b>{__v.timeLeft}</b> left.</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", padding: "16px 24px" }}>
                <div style={{ background: "#f5f6f8", borderRadius: "12px", padding: "12px" }}>
                  <div style={{ fontSize: "22px", fontWeight: "700" }}>{__v.answeredCount}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Answered</div>
                </div>
                <div style={{ background: __v.unansBg, borderRadius: "12px", padding: "12px" }}>
                  <div style={{ fontSize: "22px", fontWeight: "700" }}>{__v.unansweredCount}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Unanswered</div>
                </div>
                <div style={{ background: "#fff7e6", borderRadius: "12px", padding: "12px" }}>
                  <div style={{ fontSize: "22px", fontWeight: "700" }}>{__v.flaggedCount}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Flagged</div>
                </div>
              </div>
              {(__v.hasUnanswered) ? (<>
                <div style={{ margin: "0 24px", padding: "10px 12px", borderRadius: "10px", background: "#fef2f2", color: "#991b1b", fontSize: "12.5px", lineHeight: "1.5" }}>Every question must be answered before you submit. If the timer runs out, your answers are submitted as they are.</div>
              </>) : null}
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "10px", padding: "18px 24px 22px" }}>
                <button onClick={__v.closeReview} style={{ height: "38px", padding: "0 16px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "999px", background: "#fff", color: "#374151", font: "500 13.5px Inter,sans-serif", cursor: "pointer" }}>Keep working</button>
                {(__v.hasUnanswered) ? (<>
                  <button onClick={__v.goFirstUnanswered} style={{ height: "38px", padding: "0 16px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>Go to first unanswered</button>
                </>) : null}
                {(__v.canSubmit) ? (<>
                  <button onClick={__v.submitNow} style={{ height: "38px", padding: "0 18px", border: "0", borderRadius: "999px", background: "#16a34a", color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>Submit now</button>
                </>) : null}
              </div>
            </div>
          </div>
        </>) : null}
        {(__v.showWarn) ? (<>
          <div style={{ position: "fixed", inset: "0", zIndex: "60", background: "rgba(127,29,29,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <div style={{ width: "min(460px,100%)", background: "#fff", borderRadius: "14px", boxShadow: "0 30px 80px rgba(0,0,0,.35)", padding: "24px", textAlign: "center" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#fee2e2", color: "#b91c1c", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <i className={"icon-triangle-alert"} style={{ fontSize: "26px" }}></i>
              </div>
              <div style={{ fontSize: "18px", fontWeight: "700", marginTop: "12px" }}>You left the assessment window</div>
              <div style={{ fontSize: "13.5px", color: "#4b5563", marginTop: "8px", lineHeight: "1.55" }}>This has been recorded ({__v.strikes} of {__v.tabLimit}). If you leave {__v.tabLimit} times, your assessment is submitted automatically. The timer kept running while you were away.</div>
              <button onClick={__v.dismissWarn} style={{ marginTop: "18px", height: "40px", padding: "0 22px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>Return to assessment</button>
            </div>
          </div>
        </>) : null}
      </div>
    </>
    );
  }
}


export default SMAssessmentSession;
