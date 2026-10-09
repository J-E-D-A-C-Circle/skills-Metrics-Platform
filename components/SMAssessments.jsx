'use client';
import React from 'react';
import __css from './SMAssessments.module.css';
import { PageHeader } from './smUI';
import { Select } from './ui/select';


class SMAssessments extends React.Component {
  state = { filter: 'All', comp: '1', kind: 'Certificate', toast: '', evidence: [
    { id: 1, name: 'CCNA_Certificate_2025.pdf', kind: 'Certificate', comp: 1, date: '12 Mar 2026', status: 'Verified' },
    { id: 2, name: 'ITIL4_Foundation.pdf', kind: 'Certificate', comp: 10, date: '04 Jan 2026', status: 'Verified' },
    { id: 3, name: 'DR_runbook_contribution.pdf', kind: 'Work sample', comp: 3, date: '22 Sep 2026', status: 'Pending review' },
    { id: 4, name: 'Azure_course_enrolment.png', kind: 'Training record', comp: 9, date: '28 Sep 2026', status: 'Pending review' }] };
  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2400); }
  renderVals() {
    const d = this.props.data, go = this.props.go || (() => {}), s = this.state;
    if (!d) return {};
    const rawView = this.props.view;
    const view = (rawView === 'assess' ? 'assessments' : rawView) || 'assessments', st = this.props.status || 'not_started', C = d.cycle, ft = this.props.features || {};
    const S = { not_started: ['OPEN TODAY', '#ffedd5', '#9a3412', 'Start Assessment', 'icon-play'], in_progress: ['IN PROGRESS', '#fee2e2', '#b91c1c', 'Resume Assessment', 'icon-timer'], submitted: ['SUBMITTED', '#dcfce7', '#15803d', 'View Receipt', 'icon-receipt'] }[st];
    const chip = (t, bg, fg) => ({ status: t, sBg: bg, sFg: fg });
    const done = st === 'submitted';
    const H = [
      ['Q3 2026', 'Manager Evaluation', 'Joseph Ahor Abandoh-Sam', '12 Sep 2026', '3.1'], ['Q3 2026', 'Self-Assessment', 'Self (timed)', '28 Aug 2026', '3.4'],
      ['Q2 2026', '360° Feedback', '5 assessors', '30 Jun 2026', '3.0'], ['Q2 2026', 'Manager Evaluation', 'Joseph Ahor Abandoh-Sam', '14 Jun 2026', '2.9'], ['Q2 2026', 'Self-Assessment', 'Self (timed)', '02 Jun 2026', '3.2']];
    const F = ['All', 'Self-Assessment', 'Manager Evaluation', ...(ft.feedback360 ? ['360° Feedback'] : [])];
    const STS = { 'Verified': ['#dcfce7', '#15803d'], 'Pending review': ['#fef3c7', '#92400e'] };
    return {
      title: view === 'evidence' ? 'Evidence & Certifications' : 'My Assessments',
      subtitle: view === 'evidence' ? 'Upload proof that backs up your skill ratings' : 'Your timed one-day assessments, evaluations and results. Start the current one here.',
      isList: view === 'assessments', isEvidence: view === 'evidence',
      chipText: S[0], chipBg: S[1], chipFg: S[2], ctaText: S[3], ctaIcon: S[4], cta: () => go('take'),
      cycleName: C.name, cycleText: C.dayLong + ' · ' + C.window,
      facts: [{ label: 'TIME LIMIT', value: C.durationMin + ' minutes' }, { label: 'ATTEMPTS', value: '1' }, { label: 'QUESTIONS', value: '18' }, { label: 'RESULTS', value: C.resultsLabel }],
      steps: [
        { icon: 'icon-timer', name: 'Self-assessment (timed)', desc: C.dayLabel + ' · ' + C.window + ' · ' + C.durationMin + ' min once started', ...(done ? chip('Submitted', '#dcfce7', '#15803d') : st === 'in_progress' ? chip('In progress', '#fee2e2', '#b91c1c') : chip('Open today', '#ffedd5', '#9a3412')), dotBg: done ? '#0d3b2a' : '#fff', dotFg: done ? '#fff' : '#0d3b2a', dotBorder: '#0d3b2a' },
        { icon: 'icon-user-round-check', name: 'Manager evaluation', desc: 'Joseph Ahor Abandoh-Sam rates each competency · closes ' + C.mgrCloseLabel, ...(done ? chip('With manager', '#e0e7ff', '#3730a3') : chip('Opens after you submit', '#f3f4f6', '#4b5563')), dotBg: '#fff', dotFg: '#6b7280', dotBorder: '#d1d5db' },
        ft.feedback360 ? { icon: 'icon-refresh-cw', name: '360° peer feedback', desc: '5 assessors invited · 3 responded', ...chip('3 of 5', '#f3f4f6', '#4b5563'), dotBg: '#fff', dotFg: '#6b7280', dotBorder: '#d1d5db' } : null,
        { icon: 'icon-chart-column', name: 'Results & gap report', desc: 'Target − actual gaps are calculated automatically', ...chip(C.resultsLabel, '#f3f4f6', '#4b5563'), dotBg: '#fff', dotFg: '#6b7280', dotBorder: '#d1d5db' }].filter(Boolean),
      filters: F.map(f => ({ label: f, onClick: () => this.setState({ filter: f }), bg: s.filter === f ? '#fff' : 'transparent', fg: s.filter === f ? '#111827' : '#4b5563' })),
      rows: H.filter(h => (ft.feedback360 || h[1] !== '360° Feedback') && (s.filter === 'All' || h[1] === s.filter)).map(([cycle, type, assessor, date, score]) => ({ cycle, type, assessor, date, score, onReport: () => this.flash('Downloading ' + cycle + ' ' + type + ' (PDF)…') })),
      comp: s.comp, kind: s.kind, onComp: e => this.setState({ comp: e.target.value }), onKind: e => this.setState({ kind: e.target.value }),
      compOptions: d.comps.map(c => ({ id: String(c.id), label: c.name })),
      onFile: e => { const f = e.target.files && e.target.files[0]; if (!f) return;
        if (f.size > 10 * 1024 * 1024) { this.flash('File too large (max 10 MB)'); return; }
        this.setState({ evidence: [{ id: Date.now(), name: f.name, kind: s.kind, comp: +s.comp, date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), status: 'Pending review' }, ...s.evidence] });
        e.target.value = ''; this.flash('Uploaded. HR will review it shortly'); },
      evCount: s.evidence.length,
      evidence: s.evidence.map(x => ({ name: x.name, kind: x.kind, date: x.date, status: x.status, comp: (d.comps.find(c => c.id === x.comp) || {}).name,
        icon: /\.(png|jpe?g)$/i.test(x.name) ? 'icon-image' : 'icon-file-text', sBg: STS[x.status][0], sFg: STS[x.status][1], removable: x.status !== 'Verified',
        remove: () => this.setState({ evidence: this.state.evidence.filter(y => y.id !== x.id) }) })),
      toast: s.toast,
    };
  }
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      <div style={{ padding: "clamp(16px,2.6vw,30px) clamp(14px,2.4vw,32px) 48px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <PageHeader title={__v.title} description={__v.subtitle} actions={__v.isList ? <button onClick={__v.cta} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 16px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}><i className={__v.ctaIcon} style={{ fontSize: "14px" }}></i>{__v.ctaText}</button> : null} />
        {(__v.isList) ? (<>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", overflow: "hidden" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px", padding: "22px clamp(18px,2.4vw,24px)", background: "linear-gradient(120deg,#0d3b2a,#17603f)", color: "#fff" }}>
              <div style={{ minWidth: "0" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                  <span style={{ font: "700 10px Inter,sans-serif", letterSpacing: ".5px", background: __v.chipBg, color: __v.chipFg, borderRadius: "999px", padding: "3px 9px" }}>{__v.chipText}</span>
                  <span style={{ fontSize: "12px", color: "#b9d8c6" }}>CURRENT CYCLE</span>
                </div>
                <div style={{ fontSize: "clamp(18px,2vw,22px)", fontWeight: "700", marginTop: "8px" }}>{__v.cycleName}</div>
                <div style={{ fontSize: "13px", color: "#cfe6d8", marginTop: "4px" }}>{__v.cycleText}</div>
              </div>
              <button onClick={__v.cta} style={{ display: "flex", alignItems: "center", gap: "8px", height: "40px", padding: "0 20px", border: "0", borderRadius: "999px", background: "#fff", color: "#0d3b2a", font: "600 14px Inter,sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}><i className={__v.ctaIcon} style={{ fontSize: "15px" }}></i>{__v.ctaText}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
              {(__v.facts || []).map((f, $index) => (<React.Fragment key={$index}>
                <div style={{ padding: "16px clamp(16px,2.4vw,24px)", borderRight: "1px solid rgba(15,35,65,.07)", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280" }}>{f?.label}</div>
                  <div style={{ fontSize: "16px", fontWeight: "600", marginTop: "5px" }}>{f?.value}</div>
                </div>
              </React.Fragment>))}
            </div>
            <div style={{ padding: "18px clamp(18px,2.4vw,24px) 22px" }}>
              <div style={{ fontSize: "14.5px", fontWeight: "600", marginBottom: "14px" }}>What happens in this cycle</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {(__v.steps || []).map((st, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "flex", gap: "14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", background: st?.dotBg, color: st?.dotFg, border: `1.5px solid ${st?.dotBorder ?? ""}` }}>
                        <i className={st?.icon} style={{ fontSize: "13px" }}></i>
                      </span>
                      <span style={{ flex: "1", width: "2px", background: "#e5e7eb", minHeight: "14px" }}></span>
                    </div>
                    <div style={{ flex: "1", paddingBottom: "16px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px" }}>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "600" }}>{st?.name}</div>
                        <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "3px" }}>{st?.desc}</div>
                      </div>
                      <span style={{ alignSelf: "flex-start", font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: st?.sBg, color: st?.sFg, whiteSpace: "nowrap" }}>{st?.status}</span>
                    </div>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "18px clamp(18px,2.4vw,24px)", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Past Assessments</div>
              <div style={{ display: "flex", background: "rgba(118,118,128,.12)", borderRadius: "10px", padding: "3px", gap: "3px", flexWrap: "wrap" }}>
                {(__v.filters || []).map((f, $index) => (<React.Fragment key={$index}>
                  <button onClick={f?.onClick} style={{ height: "28px", padding: "0 12px", border: "0", borderRadius: "6px", cursor: "pointer", font: "500 12.5px Inter,sans-serif", background: f?.bg, color: f?.fg }}>{f?.label}</button>
                </React.Fragment>))}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "720px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "100px 180px minmax(0,1fr) 120px 80px 90px", gap: "14px", padding: "10px clamp(18px,2.4vw,24px)", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span>CYCLE</span>
                  <span>TYPE</span>
                  <span>ASSESSOR</span>
                  <span>DATE</span>
                  <span>SCORE</span>
                  <span>REPORT</span>
                </div>
                {(__v.rows || []).map((h, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 180px minmax(0,1fr) 120px 80px 90px", gap: "14px", alignItems: "center", padding: "14px clamp(18px,2.4vw,24px)", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "14px" }}>
                    <span style={{ fontWeight: "600" }}>{h?.cycle}</span>
                    <span style={{ color: "#374151" }}>{h?.type}</span>
                    <span style={{ color: "#374151" }}>{h?.assessor}</span>
                    <span style={{ color: "#6b7280", fontSize: "13px" }}>{h?.date}</span>
                    <span style={{ font: "600 13px 'JetBrains Mono',monospace" }}>{h?.score}</span>
                    <button onClick={h?.onReport} style={{ justifySelf: "start", background: "none", border: "0", cursor: "pointer", color: "#127a42", font: "500 12.5px Inter,sans-serif", display: "flex", alignItems: "center", gap: "4px" }}><i className={"icon-file-down"} style={{ fontSize: "14px" }}></i>PDF</button>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
          </div>
        </>) : null}
        {(__v.isEvidence) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 320px", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Upload evidence</div>
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>COMPETENCY<Select value={__v.comp} onChange={__v.onComp} style={{ height: "38px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13.5px Inter,sans-serif", background: "#fff", color: "#111827" }}>
                  {(__v.compOptions || []).map((o, $index) => (<React.Fragment key={$index}>
                    <option value={o?.id}>{o?.label}</option>
                  </React.Fragment>))}
                </Select></label>
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>EVIDENCE TYPE<Select value={__v.kind} onChange={__v.onKind} style={{ height: "38px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13.5px Inter,sans-serif", background: "#fff", color: "#111827" }}>
                  <option value={"Certificate"}>Certificate</option>
                  <option value={"Training record"}>Training record</option>
                  <option value={"Work sample"}>Work sample</option>
                  <option value={"Reference letter"}>Reference letter</option>
                </Select></label>
              <label className={__css.h0} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "150px", border: "1.5px dashed #c7ccd4", borderRadius: "12px", background: "rgba(255,255,255,.4)", cursor: "pointer", textAlign: "center", padding: "18px" }}>
                <i className={"icon-cloud-upload"} style={{ fontSize: "28px", color: "#0d3b2a" }}></i>
                <span style={{ font: "600 14px Inter,sans-serif", color: "#111827" }}>Click to choose a file</span>
                <span style={{ font: "400 12px Inter,sans-serif", color: "#6b7280" }}>PDF, JPG or PNG · up to 10 MB</span>
                <input type={"file"} accept={".pdf,.jpg,.jpeg,.png"} onChange={__v.onFile} style={{ display: "none" }} />
              </label>
              <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: "1.5" }}>HR reviews each upload. Once verified, it appears next to the competency on your skill profile.</div>
            </div>
            <div style={{ flex: "2 1 520px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16.5px", fontWeight: "600" }}>My evidence</span>
                <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{__v.evCount} files</span>
              </div>
              {(__v.evidence || []).map((e, $index) => (<React.Fragment key={$index}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", padding: "14px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span style={{ width: "38px", height: "38px", borderRadius: "9px", background: "#e6f2ea", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <i className={e?.icon} style={{ fontSize: "17px" }}></i>
                  </span>
                  <div style={{ flex: "1 1 200px", minWidth: "0" }}>
                    <div style={{ fontSize: "14px", fontWeight: "500", overflowWrap: "anywhere" }}>{e?.name}</div>
                    <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "2px" }}>{e?.kind} · {e?.comp} · {e?.date}</div>
                  </div>
                  <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: e?.sBg, color: e?.sFg, whiteSpace: "nowrap" }}>{e?.status}</span>
                  {(e?.removable) ? (<>
                    <button onClick={e?.remove} title={"Remove"} style={{ background: "none", border: "0", cursor: "pointer", color: "#9ca3af", display: "flex", padding: "4px" }}>
                      <i className={"icon-trash-2"} style={{ fontSize: "15px" }}></i>
                    </button>
                  </>) : null}
                </div>
              </React.Fragment>))}
            </div>
          </div>
        </>) : null}
        {(__v.toast) ? (<>
          <div style={{ position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: "80", background: "#111827", color: "#fff", font: "500 13px Inter,sans-serif", padding: "10px 16px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,.25)", display: "flex", alignItems: "center", gap: "8px" }}><i className={"icon-circle-check"} style={{ fontSize: "15px", color: "#4ade80" }}></i>{__v.toast}</div>
        </>) : null}
      </div>
    </>
    );
  }
}


export default SMAssessments;
