'use client';
import React from 'react';
import StaffEvaluations from './SMStaffEvals';


// 360° Feedback and Plan Approvals (hidden by FEATURES). Kept so they can be switched back on.
class TeamLegacy extends React.Component {
  state = { evals: {}, modal: null, ratings: {}, comment: '', toast: '', done360: {}, apTab: 'Pending',
    approvals: [
      { id: 1, member: 'Adjei Denzil Asiam', action: 'Run a DR drill alongside the infrastructure team', comp: 'Backup & Disaster Recovery', gap: 3, due: 'Nov 2026', state: 'Pending' },
      { id: 2, member: 'Yaw Darko', action: 'Security+ bootcamp (5 days)', comp: 'Incident Response', gap: 4, due: 'Dec 2026', state: 'Pending' },
      { id: 3, member: 'Kofi Boateng', action: 'Advanced PostgreSQL administration course', comp: 'Database Administration', gap: 2, due: 'Jan 2027', state: 'Approved' }] };
  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2400); }
  renderVals() {
    const d = this.props.data, s = this.state;
    if (!d) return {};
    const view = this.props.view || 'team-evals';
    const ini = n => n.split(' ').map(x => x[0]).slice(0, 2).join('');
    const CH = { Submitted: ['#dcfce7', '#15803d'], 'In progress': ['#fef3c7', '#92400e'], 'Not started': ['#f3f4f6', '#4b5563'], Pending: ['#ffedd5', '#9a3412'], Evaluated: ['#dcfce7', '#15803d'], Locked: ['#f3f4f6', '#6b7280'] };
    const team = d.team.map(t => ({ ...t, eval: s.evals[t.id] || t.eval }));
    const members = team.map(t => {
      const can = t.eval === 'Pending', done = t.eval === 'Evaluated';
      return { name: t.name, role: t.role, initials: ini(t.name), self: t.self, eval: t.eval, selfBg: CH[t.self][0], selfFg: CH[t.self][1], evalBg: CH[t.eval][0], evalFg: CH[t.eval][1],
        btn: can ? 'Evaluate' : done ? 'Evaluated' : 'Awaiting self-assessment', cursor: can ? 'pointer' : 'default',
        btnBg: can ? '#0d3b2a' : '#fff', btnFg: can ? '#fff' : '#9ca3af', btnBorder: can ? '0' : '1px solid #e5e7eb',
        action: () => can && this.setState({ modal: { kind: 'eval', id: t.id, name: t.name, role: t.role }, ratings: {}, comment: '' }) };
    });
    const reqs = [{ id: 'r1', name: 'Ama Owusu', role: 'Network Engineer', relation: 'Peer' }, { id: 'r2', name: 'Esi Mensah', role: 'HR Officer', relation: 'Cross-department' }, { id: 'r3', name: 'Joseph Ahor Abandoh-Sam', role: 'HOD', relation: 'Upward feedback' }];
    const m = s.modal;
    let rateRows = [], total = 0;
    if (m) {
      const items = m.kind === 'eval' ? d.comps.map(c => ({ key: 'c' + c.id, name: c.name, meta: c.major + ' · target ' + c.target, selfText: 'Self-rated ' + Math.max(1, c.actual + (c.id % 3 === 0 ? 1 : 0)) }))
        : d.majors.map((x, i) => ({ key: 'm' + i, name: x.name, meta: 'Overall proficiency in this area', selfText: '' }));
      total = items.length;
      rateRows = items.map(it => ({ ...it, opts: [1, 2, 3, 4, 5].map(n => { const on = s.ratings[it.key] === n; return { label: n + ' ' + d.PROF[n].label.slice(0, 4) + '.', title: d.PROF[n].desc, pick: () => this.setState({ ratings: { ...this.state.ratings, [it.key]: n } }),
        bg: on ? '#0d3b2a' : '#fff', fg: on ? '#fff' : '#374151', border: on ? '#0d3b2a' : '#e5e7eb' }; }) }));
    }
    const rated = Object.keys(s.ratings).length, ready = m && rated === total;
    const apList = s.approvals.filter(a => a.state === s.apTab);
    return {
      title: { 'team-evals': 'Staff Evaluations', feedback: '360° Feedback', approvals: 'Plan Approvals' }[view],
      subtitle: { 'team-evals': 'Rate each direct report after they submit their timed self-assessment', feedback: 'Give and track multi-source feedback for this cycle', approvals: 'Review development actions proposed by your team' }[view],
      isEvals: view === 'team-evals', isFeedback: view === 'feedback', isApprovals: view === 'approvals',
      kpis: [{ label: 'Direct reports', value: team.length, sub: 'IT Department' }, { label: 'Self-assessments submitted', value: team.filter(t => t.self === 'Submitted').length + ' / ' + team.length, sub: 'Timed · ' + d.cycle.dayLabel },
        { label: 'Evaluations completed', value: team.filter(t => t.eval === 'Evaluated').length + ' / ' + team.length, sub: 'Close ' + d.cycle.mgrCloseLabel }, { label: 'Avg team gap', value: '1.3', sub: 'Minimal → Moderate' }],
      members, mgrClose: d.cycle.mgrCloseLabel,
      requests: reqs.map(r => ({ ...r, initials: ini(r.name), done: !!s.done360[r.id], pending: !s.done360[r.id], open: () => this.setState({ modal: { kind: '360', id: r.id, name: r.name, role: r.role }, ratings: {}, comment: '' }) })),
      assessors: [['Line manager', 'Received'], ['Peer · Ama Owusu', 'Received'], ['Peer · Kofi Boateng', 'Received'], ['Direct report', 'Waiting'], ['Cross-department', 'Waiting']].map(([rel, st]) => ({ rel, status: st, bg: st === 'Received' ? '#dcfce7' : '#f3f4f6', fg: st === 'Received' ? '#15803d' : '#4b5563' })),
      remind: () => this.flash('Reminder sent to 2 assessors'),
      apTabs: ['Pending', 'Approved', 'Returned'].map(t => ({ label: t + ' (' + s.approvals.filter(a => a.state === t).length + ')', onClick: () => this.setState({ apTab: t }), bg: s.apTab === t ? '#fff' : 'transparent', fg: s.apTab === t ? '#111827' : '#4b5563' })),
      noApprovals: apList.length === 0,
      approvals: apList.map(a => ({ ...a, gapBg: d.GAP[a.gap].bg, gapFg: d.GAP[a.gap].fg, isPending: a.state === 'Pending', notPending: a.state !== 'Pending',
        sBg: a.state === 'Approved' ? '#dcfce7' : '#fee2e2', sFg: a.state === 'Approved' ? '#15803d' : '#b91c1c',
        approve: () => { this.setState({ approvals: s.approvals.map(x => x.id === a.id ? { ...x, state: 'Approved' } : x) }); this.flash('Approved. ' + a.member.split(' ')[0] + ' has been notified'); },
        ret: () => { this.setState({ approvals: s.approvals.map(x => x.id === a.id ? { ...x, state: 'Returned' } : x) }); this.flash('Returned for changes'); } })),
      modalOpen: !!m, closeModal: () => this.setState({ modal: null }), stop: e => e.stopPropagation(),
      modalTitle: m ? (m.kind === 'eval' ? 'Evaluate ' + m.name : 'Feedback for ' + m.name) : '', modalSub: m ? m.role + (m.kind === 'eval' ? ' · ' + d.cycle.name : ' · 360° feedback') : '',
      rateRows, ratedText: rated + ' of ' + total + ' rated', comment: s.comment, onComment: e => this.setState({ comment: e.target.value }),
      submitBg: ready ? '#15904c' : '#a3acb9', submitCursor: ready ? 'pointer' : 'not-allowed',
      submitModal: () => { if (!ready) return;
        if (m.kind === 'eval') this.setState({ evals: { ...s.evals, [m.id]: 'Evaluated' }, modal: null }); else this.setState({ done360: { ...s.done360, [m.id]: true }, modal: null });
        this.flash(m.kind === 'eval' ? 'Evaluation submitted for ' + m.name : 'Feedback submitted'); },
      toast: s.toast,
    };
  }
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      <div style={{ padding: "clamp(16px,2.6vw,30px) clamp(14px,2.4vw,32px) 48px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <h1 style={{ margin: "0", fontSize: "clamp(24px,3vw,30px)", fontWeight: "700", letterSpacing: "-0.5px" }}>{__v.title}</h1>
          <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "6px" }}>{__v.subtitle}</div>
        </div>
        {(__v.isEvals) ? (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "12px" }}>
            {(__v.kpis || []).map((k, $index) => (<React.Fragment key={$index}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "18px" }}>
                <div style={{ fontSize: "13px", color: "#374151" }}>{k?.label}</div>
                <div style={{ fontSize: "22px", fontWeight: "700", marginTop: "8px" }}>{k?.value}</div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{k?.sub}</div>
              </div>
            </React.Fragment>))}
          </div>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ padding: "18px clamp(16px,2.4vw,22px)", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Direct reports</div>
            {(__v.members || []).map((m, $index) => (<React.Fragment key={$index}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", padding: "14px clamp(16px,2.4vw,22px)", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <span style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#e6f2ea", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center", font: "600 13px Inter,sans-serif", flex: "none" }}>{m?.initials}</span>
                <div style={{ flex: "1 1 180px", minWidth: "0" }}>
                  <div style={{ fontSize: "14.5px", fontWeight: "500" }}>{m?.name}</div>
                  <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "2px" }}>{m?.role}</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", flex: "1 1 260px" }}>
                  <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: m?.selfBg, color: m?.selfFg, whiteSpace: "nowrap" }}>Self: {m?.self}</span>
                  <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: m?.evalBg, color: m?.evalFg, whiteSpace: "nowrap" }}>Evaluation: {m?.eval}</span>
                </div>
                <button onClick={m?.action} style={{ height: "34px", padding: "0 16px", borderRadius: "999px", font: "600 13px Inter,sans-serif", cursor: m?.cursor, background: m?.btnBg, color: m?.btnFg, border: m?.btnBorder, whiteSpace: "nowrap" }}>{m?.btn}</button>
              </div>
            </React.Fragment>))}
          </div>
        </>) : null}
        {(__v.isFeedback) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            <div style={{ flex: "2 1 480px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Feedback requested from you</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>Anonymous to the person, visible to HR. Closes {__v.mgrClose}.</div>
              </div>
              {(__v.requests || []).map((r, $index) => (<React.Fragment key={$index}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", padding: "14px 22px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#e6f2ea", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center", font: "600 13px Inter,sans-serif", flex: "none" }}>{r?.initials}</span>
                  <div style={{ flex: "1 1 200px", minWidth: "0" }}>
                    <div style={{ fontSize: "14.5px", fontWeight: "500" }}>{r?.name}</div>
                    <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "2px" }}>{r?.role} · {r?.relation}</div>
                  </div>
                  {(r?.done) ? (<>
                    <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: "#dcfce7", color: "#15803d" }}>Submitted</span>
                  </>) : null}
                  {(r?.pending) ? (<>
                    <button onClick={r?.open} style={{ height: "34px", padding: "0 16px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>Give feedback</button>
                  </>) : null}
                </div>
              </React.Fragment>))}
            </div>
            <div style={{ flex: "1 1 300px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Your 360° assessors</div>
              <div style={{ padding: "16px 22px 6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "#374151" }}>
                  <span>Responses</span>
                  <span style={{ fontWeight: "600" }}>3 of 5</span>
                </div>
                <div style={{ height: "6px", borderRadius: "999px", background: "#eef0f3", marginTop: "8px", overflow: "hidden" }}>
                  <div style={{ width: "60%", height: "100%", background: "#0d3b2a" }}></div>
                </div>
              </div>
              {(__v.assessors || []).map((a, $index) => (<React.Fragment key={$index}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "10px 22px", fontSize: "13.5px" }}>
                  <span>{a?.rel}</span>
                  <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: a?.bg, color: a?.fg }}>{a?.status}</span>
                </div>
              </React.Fragment>))}
              <div style={{ padding: "10px 22px 18px" }}>
                <button onClick={__v.remind} style={{ height: "34px", padding: "0 14px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#374151", font: "500 13px Inter,sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><i className={"icon-send"} style={{ fontSize: "13px" }}></i>Send reminder</button>
              </div>
            </div>
          </div>
        </>) : null}
        {(__v.isApprovals) ? (<>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "16px 22px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Development plan actions</div>
              <div style={{ display: "flex", background: "rgba(118,118,128,.12)", borderRadius: "10px", padding: "3px", gap: "3px" }}>
                {(__v.apTabs || []).map((t, $index) => (<React.Fragment key={$index}>
                  <button onClick={t?.onClick} style={{ height: "28px", padding: "0 12px", border: "0", borderRadius: "6px", cursor: "pointer", font: "500 12.5px Inter,sans-serif", background: t?.bg, color: t?.fg }}>{t?.label}</button>
                </React.Fragment>))}
              </div>
            </div>
            {(__v.noApprovals) ? (<>
              <div style={{ padding: "40px", textAlign: "center", fontSize: "13.5px", color: "#6b7280" }}>Nothing here.</div>
            </>) : null}
            {(__v.approvals || []).map((p, $index) => (<React.Fragment key={$index}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", padding: "16px 22px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <span style={{ flex: "none", font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: p?.gapBg, color: p?.gapFg }}>Gap {p?.gap}</span>
                <div style={{ flex: "2 1 260px", minWidth: "0" }}>
                  <div style={{ fontSize: "14.5px", fontWeight: "500" }}>{p?.action}</div>
                  <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "3px" }}>{p?.member} · {p?.comp} · Due {p?.due}</div>
                </div>
                {(p?.isPending) ? (<>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={p?.ret} style={{ height: "34px", padding: "0 14px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "999px", background: "#fff", color: "#374151", font: "500 13px Inter,sans-serif", cursor: "pointer" }}>Return</button>
                    <button onClick={p?.approve} style={{ height: "34px", padding: "0 16px", border: "0", borderRadius: "999px", background: "#16a34a", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>Approve</button>
                  </div>
                </>) : null}
                {(p?.notPending) ? (<>
                  <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: p?.sBg, color: p?.sFg }}>{p?.state}</span>
                </>) : null}
              </div>
            </React.Fragment>))}
          </div>
        </>) : null}
        {(__v.modalOpen) ? (<>
          <div onClick={__v.closeModal} style={{ position: "fixed", inset: "0", zIndex: "70", background: "rgba(8,12,24,.5)", display: "flex", justifyContent: "flex-end" }}>
            <div onClick={__v.stop} style={{ width: "min(640px,100%)", height: "100%", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-20px 0 60px rgba(0,0,0,.2)" }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(15,35,65,.07)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: "700" }}>{__v.modalTitle}</div>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>{__v.modalSub}</div>
                </div>
                <button onClick={__v.closeModal} style={{ background: "none", border: "0", cursor: "pointer", color: "#6b7280", display: "flex", padding: "4px" }}>
                  <i className={"icon-x"} style={{ fontSize: "18px" }}></i>
                </button>
              </div>
              <div style={{ flex: "1", overflowY: "auto", padding: "8px 22px 20px" }}>
                {(__v.rateRows || []).map((r, $index) => (<React.Fragment key={$index}>
                  <div style={{ padding: "14px 0", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px" }}>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "500" }}>{r?.name}</div>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{r?.meta}</div>
                      </div>
                      {(r?.selfText) ? (<>
                        <span style={{ fontSize: "12px", color: "#4b5563", background: "#f3f4f6", borderRadius: "999px", padding: "3px 9px", alignSelf: "flex-start" }}>{r?.selfText}</span>
                      </>) : null}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "6px", marginTop: "10px" }}>
                      {(r?.opts || []).map((o, $index) => (<React.Fragment key={$index}>
                        <button onClick={o?.pick} title={o?.title} style={{ height: "36px", borderRadius: "10px", cursor: "pointer", font: "600 12px Inter,sans-serif", background: o?.bg, color: o?.fg, border: `1.5px solid ${o?.border ?? ""}` }}>{o?.label}</button>
                      </React.Fragment>))}
                    </div>
                  </div>
                </React.Fragment>))}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "16px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>COMMENTS<textarea value={__v.comment} onChange={__v.onComment} placeholder={"Strengths, areas to improve, suggested training…"} style={{ minHeight: "110px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "10px", font: "400 13.5px/1.5 Inter,sans-serif", color: "#111827", resize: "vertical" }}></textarea></label>
              </div>
              <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(15,35,65,.07)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{__v.ratedText}</span>
                <button onClick={__v.submitModal} style={{ height: "38px", padding: "0 20px", border: "0", borderRadius: "999px", background: __v.submitBg, color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: __v.submitCursor }}>Submit</button>
              </div>
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


export default function SMTeam(props) {
  return props.view === 'staff-evals' ? <StaffEvaluations {...props} /> : <TeamLegacy {...props} />;
}
