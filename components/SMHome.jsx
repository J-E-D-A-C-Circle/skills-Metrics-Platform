'use client';
import React from 'react';
import __css from './SMHome.module.css';


class SMHome extends React.Component {
  state = { heatOpen: true, alert: true, ym: null, avatar: null };

  componentDidMount() {
    try {
      const av = localStorage.getItem('skm-user-avatar');
      if (av) this.setState({ avatar: av });
    } catch (e) {}
    this.onAvatarStorage = () => {
      try {
        const av = localStorage.getItem('skm-user-avatar');
        this.setState({ avatar: av || null });
      } catch (e) {}
    };
    window.addEventListener('skm-avatar-changed', this.onAvatarStorage);
    window.addEventListener('storage', this.onAvatarStorage);
  }

  componentWillUnmount() {
    window.removeEventListener('skm-avatar-changed', this.onAvatarStorage);
    window.removeEventListener('storage', this.onAvatarStorage);
  }

  renderVals() {
    const d = this.props.data, go = this.props.go || (() => {}), vw = this.props.vw || 1440, s = this.state;
    if (!d) return {};
    const st = this.props.status || 'not_started', role = this.props.role || 'staff', C = d.cycle;
    const comps = d.comps.map(c => ({ ...c, gapLabel: d.GAP[c.gap].label, gapBg: d.GAP[c.gap].bg, gapFg: d.GAP[c.gap].fg,
      impLabel: c.importance + ' · ' + d.IMP[c.importance].short, impBg: d.IMP[c.importance].bg }));
    const total = comps.length, avg = comps.reduce((a, c) => a + c.actual, 0) / total, maxGap = Math.max(...comps.map(c => c.gap));
    const B = {
      not_started: { chip: 'TODAY', icon: 'icon-timer', title: 'Your ' + C.name + ' is open today.', text: 'Complete it in one sitting between ' + C.window + '. Once you start you have ' + C.durationMin + ' minutes and the timer cannot be paused.', cta: 'Start Assessment', bg: 'linear-gradient(90deg,#0d3b2a 0%,#145a3c 55%,#9a7a45 100%)', kicker: C.short + ' · ' + C.window, sub: C.questions + ' questions · ' + C.durationMin + ' minutes · 1 attempt', act: () => go('take') },
      in_progress: { chip: 'LIVE', icon: 'icon-alarm-clock', title: 'Your assessment timer is still running.', text: 'Go back now. Your answers have been saved and any unanswered questions will be submitted automatically when the time runs out.', cta: 'Resume Assessment', bg: 'linear-gradient(90deg,#7f1d1d 0%,#9f2d20 60%,#c2410c 100%)', kicker: 'IN PROGRESS · TIMER RUNNING', sub: 'Return before time runs out', act: () => go('take') },
      submitted: { chip: 'DONE', icon: 'icon-circle-check', title: 'Assessment submitted. Thank you.', text: 'Your line manager will complete their evaluation by ' + C.mgrCloseLabel + '. Results are released on ' + C.resultsLabel + '.', cta: 'View Receipt', bg: 'linear-gradient(110deg,#0b4a2e 0%,#15904c 42%,#b8901f 82%,#f2c14e 100%)', kicker: C.short + ' · SUBMITTED', sub: 'Results on ' + C.resultsLabel, act: () => go('take') },
    }[st];
    const now = new Date(), ym = s.ym || [now.getFullYear(), now.getMonth()];
    const first = new Date(ym[0], ym[1], 1).getDay(), dim = new Date(ym[0], ym[1] + 1, 0).getDate(), days = [];
    const same = (a, y, m, dd) => a.getFullYear() === y && a.getMonth() === m && a.getDate() === dd;
    for (let i = 0; i < first; i++) days.push({ label: '', bg: 'transparent', fg: '#374151', weight: 400, dot: 'transparent', title: '' });
    for (let dd = 1; dd <= dim; dd++) {
      const isA = same(C.day, ym[0], ym[1], dd), isR = same(C.results, ym[0], ym[1], dd), isM = same(C.mgrClose, ym[0], ym[1], dd), isP = same(C.plans, ym[0], ym[1], dd);
      days.push({ label: String(dd).padStart(2, '0'), bg: isA ? '#0d3b2a' : 'transparent', fg: isA ? '#fff' : '#374151', weight: isA ? 700 : 400,
        dot: isA ? '#ea7a12' : (isR || isM || isP) ? '#111827' : 'transparent', title: isA ? 'Assessment day' : isR ? 'Results released' : isM ? 'Manager evaluations close' : isP ? 'Development plans due' : '' });
    }
    const shift = k => () => { let m = ym[1] + k, y = ym[0]; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } this.setState({ ym: [y, m] }); };
    return {
      goProfile: () => go('profile'), goSkills: () => go('profile', 'skills'), goHistory: () => go('profile', 'history'), goHeatmap: () => go('heatmap'), goAssessments: () => go('assessments'),
      showPhoto: vw >= 760, dayLabel: C.dayLabel, windowText: C.window, duration: C.durationMin,
      bannerBg: B.bg, bannerIcon: B.icon, bannerChip: B.chip, bannerTitle: B.title, bannerText: B.text, bannerCta: B.cta, bannerAction: B.act, qaKicker: B.kicker, qaSub: B.sub,
      total, avgText: d.fmt(avg) + ' / 5', avgLabel: d.LEVEL[Math.round(avg)], openGaps: comps.filter(c => c.gap > 0).length, maxGapText: maxGap + ' · ' + d.GAP[maxGap].label,
      gapSpan: vw >= 1280 ? 2 : 1,
      gapDist: d.GAP.map((g, i) => ({ count: comps.filter(c => c.gap === i).length, bg: g.bg, title: i + ' · ' + g.label })).filter(g => g.count),
      showAlert: s.alert, hideAlert: () => this.setState({ alert: false }),
      topGaps: [...comps].sort((a, b) => b.gap * b.importance - a.gap * a.importance).slice(0, 5),
      quick: [{ icon: 'icon-upload', title: 'Upload Evidence', sub: 'Attach certificates to back up your ratings', onClick: () => go('evidence') }, { icon: 'icon-target', title: 'Development Plan', sub: '1 action is waiting for manager approval', onClick: () => go('plan') }],
      majors: d.majors.map(m => ({ ...m, targetPct: (m.t / 5 * 100) + '%', actualPct: (m.a / 5 * 100) + '%' })),
      showTeam: role === 'manager' || role === 'admin', heatOpen: s.heatOpen, heatChev: s.heatOpen ? 'icon-chevron-up' : 'icon-chevron-down', toggleHeat: () => this.setState({ heatOpen: !s.heatOpen }),
      heat: d.team.map(t => ({ name: t.name, role: t.role, cells: t.gaps.map((g, i) => ({ label: g === 0 ? '✓' : g, bg: d.GAP[g].bg, fg: d.GAP[g].fg, title: d.majors[i].name + ': ' + d.GAP[g].label })) })),
      gapScale: d.GAP,
      asideMax: vw >= 1280 ? '380px' : 'none',
      monthName: new Date(ym[0], ym[1], 1).toLocaleString('en', { month: 'long', year: 'numeric' }), days, prevMonth: shift(-1), nextMonth: shift(1),
      avatar: s.avatar,
      timeline: [
        { name: 'ASSESSMENT DAY (TIMED)', when: C.dayLabel, ring: '#ea7a12', fill: st === 'submitted' ? '#ea7a12' : '#fff' },
        { name: 'MANAGER EVALUATIONS CLOSE', when: C.mgrCloseLabel, ring: '#111827', fill: '#fff' },
        { name: 'RESULTS RELEASED', when: C.resultsLabel, ring: '#111827', fill: '#fff' },
        { name: 'DEVELOPMENT PLANS DUE', when: C.plansLabel, ring: '#2fb36b', fill: '#fff' }],
    };
  }
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "22px", padding: "clamp(16px,2.6vw,36px) clamp(14px,2vw,28px) 40px", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 620px", minWidth: "0", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", overflow: "hidden", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ position: "relative", minHeight: "180px", background: "#0d3b2a", display: "flex" }}>
              <div style={{ position: "relative", zIndex: "1", flex: "1", padding: "18px clamp(16px,2.4vw,28px) 22px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "4px 0 0 clamp(0px,2.5vw,32px)" }}>
                  <div
                    onClick={__v.goProfile}
                    title={"View profile / change photo"}
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "50%",
                      border: "3px solid #fff",
                      flex: "none",
                      background: __v.avatar ? "transparent" : "linear-gradient(135deg,#0d3b2a 0%,#15904c 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      font: "700 22px Inter,sans-serif",
                      color: "#fff",
                      overflow: "hidden",
                      boxShadow: "0 4px 14px rgba(0,0,0,.25)",
                      cursor: "pointer"
                    }}
                  >
                    {__v.avatar ? (
                      <img src={__v.avatar} alt={"Profile"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      "AD"
                    )}
                  </div>
                  <div style={{ color: "#fff", minWidth: "0", flex: "1 1 auto" }}>
                    <div style={{ fontSize: "14.5px", fontWeight: "500" }}>Welcome back,</div>
                    <div style={{ fontSize: "clamp(18px,2vw,22px)", fontWeight: "700", letterSpacing: "-0.2px", marginTop: "2px" }}>ADJEI DENZIL ASIAM</div>
                    <div style={{ fontSize: "13px", color: "#d6e9de", marginTop: "3px", overflowWrap: "break-word" }}>denzilasiam.adjei@dvla.gov.gh</div>
                    <button onClick={__v.goProfile} style={{ marginTop: "6px", background: "none", border: "0", padding: "0", color: "#fff", font: "600 10px Inter,sans-serif", textDecoration: "underline", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}>View Skill Profile<i className={"icon-chevron-right"} style={{ fontSize: "11px" }}></i></button>
                  </div>
                </div>
              </div>
              {(__v.showPhoto) ? (
                <div style={{
                  position: "absolute",
                  right: "0",
                  top: "0",
                  bottom: "0",
                  width: "58%",
                  backgroundImage: "url('/assets/dvla-head-office.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center 38%",
                  backgroundRepeat: "no-repeat",
                  WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.2) 15%, rgba(0,0,0,0.85) 42%, #000 75%)",
                  maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.2) 15%, rgba(0,0,0,0.85) 42%, #000 75%)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "flex-end",
                  padding: "0 20px 14px 0",
                  pointerEvents: "none"
                }}>
                  <div style={{
                    position: "absolute",
                    inset: "0",
                    background: "linear-gradient(135deg, rgba(13,59,42,0.4) 0%, rgba(13,59,42,0.1) 40%, rgba(13,59,42,0.3) 100%)",
                    pointerEvents: "none"
                  }} />
                  <div style={{
                    position: "relative",
                    zIndex: 2,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(13, 59, 42, 0.85)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "6px",
                    padding: "3px 9px",
                    fontSize: "10.5px",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: "600",
                    color: "#e1f0e7",
                    letterSpacing: "0.4px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                  }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2fb36b", display: "inline-block" }}></span>
                    HEAD OFFICE · ACCRA
                  </div>
                </div>
              ) : null}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "18px", padding: "22px 22px 24px" }}>
              <div>
                <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280" }}>STAFF ID</div>
                <div style={{ font: "600 17px 'JetBrains Mono',monospace", marginTop: "9px", color: "#111827" }}>123456789</div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "6px" }}>HEAD OFFICE</div>
              </div>
              <div>
                <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280" }}>DEPARTMENT</div>
                <div style={{ fontSize: "18px", fontWeight: "600", marginTop: "6px" }}>IT DEPARTMENT</div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "6px" }}>HOD: Joseph Ahor Abandoh-Sam</div>
              </div>
              <div>
                <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280" }}>DESIGNATION</div>
                <div style={{ fontSize: "18px", fontWeight: "600", marginTop: "6px" }}>IT OFFICER</div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "6px" }}>Target: IT Officer · Grade 10</div>
              </div>
              <div>
                <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280" }}>ASSESSMENT DAY</div>
                <div style={{ fontSize: "18px", fontWeight: "600", marginTop: "6px" }}>{__v.dayLabel}</div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "6px" }}>{__v.windowText} · {__v.duration} min, one attempt</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", padding: "14px 20px 14px 18px", borderRadius: "12px", background: __v.bannerBg, color: "#fff" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "9px", background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <i className={__v.bannerIcon} style={{ fontSize: "20px" }}></i>
            </div>
            <div style={{ flex: "1 1 320px", minWidth: "0" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                <span style={{ font: "700 10px Inter,sans-serif", background: "rgba(255,255,255,.92)", color: "#0d3b2a", borderRadius: "999px", padding: "2px 8px" }}>{__v.bannerChip}</span>
                <span style={{ fontSize: "15px", fontWeight: "600" }}>{__v.bannerTitle}</span>
              </div>
              <div style={{ fontSize: "13px", color: "#e1f0e7", marginTop: "4px", textWrap: "pretty" }}>{__v.bannerText}</div>
            </div>
            <button onClick={__v.bannerAction} style={{ display: "flex", alignItems: "center", gap: "8px", height: "34px", padding: "0 16px", border: "0", borderRadius: "999px", background: "#fff", color: "#0d3b2a", font: "600 13.5px Inter,sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>{__v.bannerCta}<i className={"icon-arrow-right"} style={{ fontSize: "15px" }}></i></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "12px" }}>
            <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "20px 18px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "13.5px", color: "#374151" }}>Competencies Assessed</div>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{__v.total} of {__v.total}</div>
              <button onClick={__v.goSkills} style={{ alignSelf: "flex-start", marginTop: "auto", height: "28px", padding: "0 14px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 12px Inter,sans-serif", cursor: "pointer" }}>View</button>
            </div>
            <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "20px 18px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "13.5px", color: "#374151" }}>Average Proficiency</div>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{__v.avgText} <span style={{ fontWeight: "500", color: "#6b7280", fontSize: "13px" }}>· {__v.avgLabel}</span></div>
              <button onClick={__v.goSkills} style={{ alignSelf: "flex-start", marginTop: "auto", height: "28px", padding: "0 14px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 12px Inter,sans-serif", cursor: "pointer" }}>View</button>
            </div>
            <div style={{ gridColumn: `span ${__v.gapSpan ?? ""}`, background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "20px 18px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "13.5px", color: "#374151" }}>Skill Gaps <span style={{ color: "#9ca3af" }}>(Target − Actual)</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div style={{ font: "600 9.5px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280" }}>OPEN GAPS</div>
                  <div style={{ fontSize: "19px", fontWeight: "700", marginTop: "4px" }}>{__v.openGaps} of {__v.total}</div>
                </div>
                <div>
                  <div style={{ font: "600 9.5px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280" }}>LARGEST GAP</div>
                  <div style={{ fontSize: "19px", fontWeight: "700", marginTop: "4px" }}>{__v.maxGapText}</div>
                </div>
              </div>
              <div style={{ display: "flex", height: "8px", borderRadius: "999px", overflow: "hidden", marginTop: "6px", gap: "2px" }}>
                {(__v.gapDist || []).map((g, $index) => (<React.Fragment key={$index}>
                  <div title={g?.title} style={{ flex: g?.count, background: g?.bg }}></div>
                </React.Fragment>))}
              </div>
              <button onClick={__v.goSkills} style={{ alignSelf: "flex-start", marginTop: "8px", height: "28px", padding: "0 14px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 12px Inter,sans-serif", cursor: "pointer" }}>View</button>
            </div>
          </div>
          {(__v.showAlert) ? (<>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", padding: "20px 20px 20px 18px", border: "1px solid #a7e3c0", borderRadius: "12px", background: "#ecfbf2" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#d3f4e0", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", color: "#16a34a" }}>
                <i className={"icon-check"} style={{ fontSize: "20px" }}></i>
              </div>
              <div style={{ flex: "1", minWidth: "0" }}>
                <div style={{ fontSize: "clamp(16px,1.6vw,18.5px)", fontWeight: "600" }}>Manager Evaluation Received</div>
                <div style={{ fontSize: "clamp(14px,1.4vw,16px)", color: "#374151", marginTop: "6px", textWrap: "pretty" }}>Joseph Ahor Abandoh-Sam has submitted your Q3 manager evaluation. Compare it with your self-assessment. <button onClick={__v.goHistory} style={{ background: "none", border: "0", padding: "0", cursor: "pointer", color: "#127a42", font: "500 12px Inter,sans-serif" }}>View Feedback</button></div>
              </div>
              <button onClick={__v.hideAlert} style={{ background: "none", border: "0", cursor: "pointer", color: "#6b7280", display: "flex", padding: "2px" }}>
                <i className={"icon-x"} style={{ fontSize: "16px" }}></i>
              </button>
            </div>
          </>) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-start" }}>
            <div style={{ flex: "1.6 1 420px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", padding: "18px 18px 12px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div>
                  <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Priority Skill Gaps</div>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "5px" }}>Ranked by gap size × how important the skill is to your role</div>
                </div>
                <button onClick={__v.goSkills} style={{ background: "none", border: "0", cursor: "pointer", font: "500 13.5px Inter,sans-serif", color: "#127a42", marginTop: "4px", whiteSpace: "nowrap" }}>See all</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: "540px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 128px 92px 112px", gap: "12px", padding: "10px 18px", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                    <span>COMPETENCY</span>
                    <span>IMPORTANCE</span>
                    <span>TARGET → ACTUAL</span>
                    <span>GAP</span>
                  </div>
                  {(__v.topGaps || []).map((c, $index) => (<React.Fragment key={$index}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 128px 92px 112px", gap: "12px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                      <div style={{ minWidth: "0" }}>
                        <div style={{ fontSize: "14px", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c?.name}</div>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{c?.major}</div>
                      </div>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#374151" }}><span style={{ width: "8px", height: "8px", borderRadius: "2px", background: c?.impBg }}></span>{c?.impLabel}</span>
                      <span style={{ font: "600 13px 'JetBrains Mono',monospace", color: "#111827" }}>{c?.target} → {c?.actual}</span>
                      <span style={{ justifySelf: "start", font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: c?.gapBg, color: c?.gapFg, whiteSpace: "nowrap" }}>{c?.gap} · {c?.gapLabel}</span>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
            </div>
            <div style={{ flex: "1 1 280px", minWidth: "0" }}>
              <div style={{ fontSize: "16.5px", fontWeight: "600", margin: "0 0 12px" }}>Quick Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button className={__css.h0} onClick={__v.bannerAction} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 20px", borderRadius: "12px", border: "0", background: "linear-gradient(120deg,#0d3b2a,#17603f)", color: "#fff", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <i className={"icon-timer"} style={{ fontSize: "19px" }}></i>
                  </span>
                  <span style={{ flex: "1", display: "flex", flexDirection: "column" }}>
                    <span style={{ font: "700 9px Inter,sans-serif", letterSpacing: ".6px", color: "#b9d8c6" }}>{__v.qaKicker}</span>
                    <span style={{ font: "600 14px Inter,sans-serif", marginTop: "2px" }}>{__v.bannerCta}</span>
                    <span style={{ font: "400 11.5px Inter,sans-serif", color: "#cfe6d8", marginTop: "3px" }}>{__v.qaSub}</span>
                  </span>
                  <i className={"icon-arrow-right"} style={{ fontSize: "17px" }}></i>
                </button>
                {(__v.quick || []).map((q, $index) => (<React.Fragment key={$index}>
                  <button className={__css.h1} onClick={q?.onClick} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", borderRadius: "18px", background: "rgba(255,255,255,.62)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ width: "38px", height: "38px", borderRadius: "9px", background: "#e6f2ea", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", color: "#0d3b2a" }}>
                      <i className={q?.icon} style={{ fontSize: "17px" }}></i>
                    </span>
                    <span style={{ flex: "1", display: "flex", flexDirection: "column" }}>
                      <span style={{ font: "600 14px Inter,sans-serif", color: "#111827" }}>{q?.title}</span>
                      <span style={{ font: "400 11.5px Inter,sans-serif", color: "#6b7280", marginTop: "3px" }}>{q?.sub}</span>
                    </span>
                    <i className={"icon-chevron-right"} style={{ fontSize: "16px", color: "#9ca3af" }}></i>
                  </button>
                </React.Fragment>))}
              </div>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", padding: "18px 18px 14px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Skill Snapshot</div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "5px" }}>Average target compared with your current level for each major skill</div>
              </div>
              <div style={{ display: "flex", gap: "16px", fontSize: "11.5px", color: "#4b5563", marginTop: "4px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "14px", height: "6px", borderRadius: "3px", background: "#0d3b2a" }}></span>Actual</span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "14px", height: "6px", borderRadius: "3px", background: "#f2c46b" }}></span>Target</span>
              </div>
            </div>
            <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {(__v.majors || []).map((m, $index) => (<React.Fragment key={$index}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,220px) minmax(0,1fr) 72px", gap: "14px", alignItems: "center" }}>
                  <div style={{ minWidth: "0" }}>
                    <div style={{ fontSize: "14px", fontWeight: "500" }}>{m?.name}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{m?.count} competencies</div>
                  </div>
                  <div style={{ position: "relative", height: "22px" }}>
                    <div style={{ position: "absolute", inset: "0", background: "repeating-linear-gradient(90deg,#f1f2f4 0 calc(20% - 1px),#fff calc(20% - 1px) 20%)", borderRadius: "4px" }}></div>
                    <div style={{ position: "absolute", left: "0", top: "2px", height: "8px", borderRadius: "4px", background: "#f2c46b", width: m?.targetPct }}></div>
                    <div style={{ position: "absolute", left: "0", top: "12px", height: "8px", borderRadius: "4px", background: "#0d3b2a", width: m?.actualPct }}></div>
                  </div>
                  <span style={{ font: "600 12.5px 'JetBrains Mono',monospace", color: "#374151", textAlign: "right" }}>{m?.actual}/{m?.target}</span>
                </div>
              </React.Fragment>))}
            </div>
          </div>
          {(__v.showTeam) ? (<>
            <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "20px 22px" }}>
                <button onClick={__v.toggleHeat} style={{ flex: "1", display: "flex", alignItems: "center", gap: "10px", background: "none", border: "0", cursor: "pointer", font: "600 clamp(18px,2vw,22px) Inter,sans-serif", color: "#111827", textAlign: "left", padding: "0" }}>Team Skill Heatmap<i className={__v.heatChev} style={{ fontSize: "20px", color: "#6b7280" }}></i></button>
                <button onClick={__v.goHeatmap} style={{ background: "none", border: "0", cursor: "pointer", font: "500 13.5px Inter,sans-serif", color: "#127a42", whiteSpace: "nowrap" }}>Open full heatmap</button>
              </div>
              {(__v.heatOpen) ? (<>
                <div style={{ padding: "0 22px 24px", overflowX: "auto" }}>
                  <div style={{ minWidth: "620px", display: "grid", gridTemplateColumns: "200px repeat(4,minmax(0,1fr))", gap: "4px" }}>
                    <span></span>
                    {(__v.majors || []).map((m, $index) => (<React.Fragment key={$index}>
                      <span style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280", padding: "0 4px 6px", textTransform: "uppercase" }}>{m?.name}</span>
                    </React.Fragment>))}
                    {(__v.heat || []).map((r, $index) => (<React.Fragment key={$index}>
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: "10px" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: "500" }}>{r?.name}</span>
                        <span style={{ fontSize: "11.5px", color: "#6b7280" }}>{r?.role}</span>
                      </div>
                      {(r?.cells || []).map((cell, $index) => (<React.Fragment key={$index}>
                        <div title={cell?.title} style={{ height: "44px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", font: "600 12px Inter,sans-serif", background: cell?.bg, color: cell?.fg }}>{cell?.label}</div>
                      </React.Fragment>))}
                    </React.Fragment>))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "16px", fontSize: "11.5px", color: "#4b5563" }}>
                    {(__v.gapScale || []).map((g, $index) => (<React.Fragment key={$index}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "12px", height: "12px", borderRadius: "3px", background: g?.bg }}></span>{g?.n} · {g?.label}</span>
                    </React.Fragment>))}
                  </div>
                </div>
              </>) : null}
            </div>
          </>) : null}
        </div>
        <aside className={__css.stickyAside} style={{ position: "sticky", top: "80px", alignSelf: "flex-start", flex: "1 1 320px", maxWidth: __v.asideMax, maxHeight: "calc(100vh - 96px)", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "28px 18px 24px" }}>
          <button onClick={__v.goAssessments} style={{ background: "none", border: "0", padding: "0", cursor: "pointer", font: "500 13px Inter,sans-serif", color: "#127a42" }}>Full Assessment Calendar</button>
          <div style={{ display: "flex", gap: "16px", marginTop: "14px", fontSize: "11.5px", color: "#4b5563" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ea7a12" }}></span>Assessment</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#111827" }}></span>Other</span>
          </div>
          <div style={{ marginTop: "20px", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px 16px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "17px", color: "#1f2937" }}>{__v.monthName}</span>
              <div style={{ display: "flex", alignItems: "center", background: "#f3f4f6", borderRadius: "999px" }}>
                <button onClick={__v.prevMonth} style={{ background: "none", border: "0", cursor: "pointer", padding: "3px 5px", display: "flex", color: "#374151" }}>
                  <i className={"icon-chevron-left"} style={{ fontSize: "16px" }}></i>
                </button>
                <span style={{ width: "1px", height: "12px", background: "#d1d5db" }}></span>
                <button onClick={__v.nextMonth} style={{ background: "none", border: "0", cursor: "pointer", padding: "3px 5px", display: "flex", color: "#374151" }}>
                  <i className={"icon-chevron-right"} style={{ fontSize: "16px" }}></i>
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginTop: "18px", textAlign: "center", fontSize: "10px", fontWeight: "600", color: "#6b7280" }}>
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", rowGap: "22px", marginTop: "20px" }}>
              {(__v.days || []).map((d, $index) => (<React.Fragment key={$index}>
                <div title={d?.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                  <span style={{ width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: d?.fg, fontWeight: d?.weight, background: d?.bg }}>{d?.label}</span>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: d?.dot }}></span>
                </div>
              </React.Fragment>))}
            </div>
          </div>
          <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "12px", fontSize: "14.5px", color: "#1f2937", paddingLeft: "4px" }}><i className={"icon-calendar-days"} style={{ fontSize: "18px", color: "#15904c" }}></i>Today</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "14px", paddingLeft: "4px", fontSize: "12px", color: "#1f2937" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "9px", height: "9px", border: "1.5px solid #ea7a12", borderRadius: "50%" }}></span>Q4 SKILLS ASSESSMENT ({__v.duration} MIN)</span>
            <span style={{ fontSize: "11px", color: "#4b5563", whiteSpace: "nowrap" }}>{__v.windowText}</span>
          </div>
          <div style={{ marginTop: "28px", display: "flex", alignItems: "center", gap: "12px", fontSize: "14.5px", color: "#1f2937", paddingLeft: "4px" }}><i className={"icon-calendar-clock"} style={{ fontSize: "18px", color: "#15904c" }}></i>Cycle Timeline</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "16px", paddingLeft: "4px" }}>
            {(__v.timeline || []).map((a, $index) => (<React.Fragment key={$index}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", fontSize: "12px", color: "#1f2937" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}><span style={{ width: "9px", height: "9px", borderRadius: "50%", flex: "none", border: `1.5px solid ${a?.ring ?? ""}`, background: a?.fill }}></span>{a?.name}</span>
                <span style={{ fontSize: "11px", color: "#4b5563", flex: "none" }}>{a?.when}</span>
              </div>
            </React.Fragment>))}
          </div>
        </aside>
      </div>
    </>
    );
  }
}


export default SMHome;
