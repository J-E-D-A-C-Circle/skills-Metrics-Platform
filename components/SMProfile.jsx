'use client';
import React from 'react';


function processAvatarFile(file, callback) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 400;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      callback(dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

class SMProfile extends React.Component {
  state = {
    avatar: null,
    avatarHover: false,
    closed: {},
    devicesOpen: false,
    devices: [
      { id: 1, name: 'Chrome on Windows', meta: 'Accra · Active now', current: true },
      { id: 2, name: 'Safari on iPhone', meta: 'Accra · 2 hours ago' },
      { id: 3, name: 'Edge on Windows', meta: 'Kumasi · 3 days ago' }
    ],
    adding: false,
    newAction: '',
    newComp: '',
    newDue: '',
    toast: '',
    plan: [
      { id: 1, action: 'CompTIA CySA+ certification course', comp: 8, due: 'Dec 2026', pct: 40, ok: true },
      { id: 2, action: 'Run a DR drill alongside the infrastructure team', comp: 3, due: 'Nov 2026', pct: 0, ok: false },
      { id: 3, action: 'Azure Fundamentals (AZ-900)', comp: 9, due: 'Jan 2027', pct: 15, ok: true }
    ]
  };

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

  handleAvatarUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.flash('Please select an image file (PNG, JPG, WebP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.flash('Image size must be less than 10MB');
      return;
    }
    processAvatarFile(file, dataUrl => {
      try {
        localStorage.setItem('skm-user-avatar', dataUrl);
        window.dispatchEvent(new Event('skm-avatar-changed'));
        this.setState({ avatar: dataUrl });
        this.flash('Profile picture updated successfully!');
      } catch (err) {
        this.flash('Could not save photo to storage');
      }
    });
    if (e.target) e.target.value = '';
  };

  handleAvatarRemove = () => {
    try {
      localStorage.removeItem('skm-user-avatar');
      window.dispatchEvent(new Event('skm-avatar-changed'));
      this.setState({ avatar: null });
      this.flash('Profile picture removed');
    } catch (err) {}
  };

  triggerFileInput = () => {
    if (this.fileInput) this.fileInput.click();
  };

  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2400); }
  renderVals() {
    const d = this.props.data, go = this.props.go || (() => {}), vw = this.props.vw || 1440, s = this.state;
    if (!d) return {};
    const tab = this.props.tab || 'account', setTab = this.props.onTab || (() => {});
    const comps = d.comps.map(c => ({ ...c, gapLabel: d.GAP[c.gap].label, gapBg: d.GAP[c.gap].bg, gapFg: d.GAP[c.gap].fg,
      impShort: d.IMP[c.importance].short, impBg: d.IMP[c.importance].bg, impFg: d.IMP[c.importance].fg,
      levelLabel: d.LEVEL[c.actual] + ' → ' + d.LEVEL[c.target],
      segs: [0, 1, 2, 3, 4].map(i => ({ bg: i < c.actual ? '#0d3b2a' : i < c.target ? '#f2c46b' : '#eef0f3' })) }));
    const avg = comps.reduce((a, c) => a + c.actual, 0) / comps.length;
    const N = comps.length, cx = 180, cy = 170, R = 120;
    const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + Math.cos(a) * R * v / 5, cy + Math.sin(a) * R * v / 5]; };
    const poly = f => comps.map((c, i) => pt(i, f(c)).map(n => n.toFixed(1)).join(',')).join(' ');
    const T = [['account', 'Account Profile', 'icon-user'], ['skills', 'Skill Profile', 'icon-radar', N], ['history', 'Assessment History', 'icon-history', 5], ['plan', 'Development Plan', 'icon-target', s.plan.length]];
    const ST = { done: ['Completed', '#dcfce7', '#15803d'], draft: ['Draft · auto-saved', '#fef3c7', '#92400e'] };
    const history = [
      ['Q3 2026', 'Manager Evaluation', 'icon-user-round-check', 'Joseph Ahor Abandoh-Sam, HOD', '12 Sep 2026', '3.1'],
      ['Q3 2026', 'Self-Assessment', 'icon-user-check', 'Self (timed, 45 min)', '28 Aug 2026', '3.4'],
      ['Q2 2026', '360° Feedback', 'icon-refresh-cw', '5 assessors', '30 Jun 2026', '3.0'],
      ['Q2 2026', 'Manager Evaluation', 'icon-user-round-check', 'Joseph Ahor Abandoh-Sam, HOD', '14 Jun 2026', '2.9'],
      ['Q2 2026', 'Self-Assessment', 'icon-user-check', 'Self (timed, 45 min)', '02 Jun 2026', '3.2'],
    ].map(([cycle, type, icon, assessor, date, score]) => ({ cycle, type, icon, assessor, date, score, report: 'PDF', status: 'Completed', sBg: '#dcfce7', sFg: '#15803d', onReport: () => this.flash('Downloading ' + cycle + ' ' + type + ' report (PDF)…') }));
    const gapComps = comps.filter(c => c.gap > 0).map(c => ({ id: String(c.id), label: c.name + ' (gap ' + c.gap + ')' }));
    const newComp = s.newComp || (gapComps[0] && gapComps[0].id);
    const canSave = s.newAction.trim().length > 3;
    return {
      avatar: s.avatar,
      avatarHover: s.avatarHover,
      onAvatarHover: val => this.setState({ avatarHover: val }),
      triggerFileInput: this.triggerFileInput,
      onAvatarUpload: this.handleAvatarUpload,
      onAvatarRemove: this.handleAvatarRemove,
      fileRef: el => { this.fileInput = el; },
      roleLabel: { staff: 'Participant', manager: 'Manager / Supervisor', admin: 'Administrator' }[this.props.role || 'staff'],
      avgText: d.fmt(avg) + ' / 5', avgLabel: d.LEVEL[Math.round(avg)], openGaps: comps.filter(c => c.gap > 0).length,
      tabs: T.map(([k, label, icon, count]) => ({ label, icon, count: count || '', onClick: () => setTab(k),
        bg: tab === k ? '#fff' : 'transparent', color: tab === k ? '#111827' : '#4b5563', shadow: tab === k ? '0 1px 2px rgba(0,0,0,.08)' : 'none' })),
      tabAccount: tab === 'account', tabSkills: tab === 'skills', tabHistory: tab === 'history', tabPlan: tab === 'plan',
      personal: [
        { label: 'FIRST NAME', value: d.user.first, icon: 'icon-circle-small' }, { label: 'LAST NAME', value: d.user.last, icon: 'icon-circle-small' },
        { label: 'OTHER NAME', value: d.user.other, icon: 'icon-circle-small' }, { label: 'EMAIL', value: d.user.email, icon: 'icon-mail-open' },
        { label: 'MOBILE NUMBER', value: d.user.mobile, icon: 'icon-phone' }, { label: 'STAFF ID', value: d.user.id, icon: 'icon-id-card' },
        { label: 'DATE OF BIRTH', value: d.user.dob, icon: 'icon-calendar' }, { label: 'GENDER', value: d.user.gender, icon: 'icon-user' }],
      employment: [{ label: 'DEPARTMENT', value: d.user.dept }, { label: 'DESIGNATION', value: d.user.designation }, { label: 'LOCATION', value: d.user.location }, { label: 'HOD', value: d.user.manager }, { label: 'TARGET PROFILE', value: d.user.target }],
      devicesOpen: s.devicesOpen, devicesCta: s.devicesOpen ? 'Hide' : 'View (' + s.devices.length + ')', toggleDevices: () => this.setState({ devicesOpen: !s.devicesOpen }),
      devices: s.devices.map(x => ({ ...x, revocable: !x.current, revoke: () => { this.setState({ devices: s.devices.filter(y => y.id !== x.id) }); this.flash('Signed out of ' + x.name); } })),
      radarMax: vw >= 1100 ? '440px' : 'none',
      radar: { rings: [1, 2, 3, 4, 5].map(v => poly(() => v)), target: poly(c => c.target), actual: poly(c => c.actual),
        axes: comps.map((c, i) => { const [x, y] = pt(i, 5); return { x, y }; }),
        labels: comps.map((c, i) => { const [x, y] = pt(i, 5.9); return { x, y, text: c.short, anchor: Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end' }; }) },
      gapScale: d.GAP,
      matrix: d.majors.map(m => { const open = !s.closed[m.name]; return { ...m, open, chev: open ? 'icon-chevron-down' : 'icon-chevron-right', items: comps.filter(c => c.major === m.name), toggle: () => this.setState({ closed: { ...s.closed, [m.name]: open } }) }; }),
      exportCsv: () => this.flash('CSV export started'), goEvidence: () => go('evidence'),
      history,
      adding: s.adding, toggleAdd: () => this.setState({ adding: !s.adding }), newAction: s.newAction, newComp, newDue: s.newDue, gapComps,
      onNewAction: e => this.setState({ newAction: e.target.value }), onNewComp: e => this.setState({ newComp: e.target.value }), onNewDue: e => this.setState({ newDue: e.target.value }),
      saveBg: canSave ? '#15904c' : '#a3acb9',
      saveAction: () => { if (!canSave) return; const due = s.newDue ? new Date(s.newDue + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'TBC';
        this.setState({ plan: [...s.plan, { id: Date.now(), action: s.newAction.trim(), comp: +newComp, due, pct: 0, ok: false }], adding: false, newAction: '', newDue: '' }); this.flash('Sent to Joseph Ahor Abandoh-Sam for approval'); },
      plan: s.plan.map(p => { const c = d.comps.find(x => x.id === p.comp) || d.comps[0];
        return { action: p.action, competency: c.name + ' · ' + c.major, gap: c.gap, gapBg: d.GAP[c.gap].bg, gapFg: d.GAP[c.gap].fg, due: p.due, pct: p.pct, pctText: p.pct + '%',
          onPct: e => this.setState({ plan: this.state.plan.map(x => x.id === p.id ? { ...x, pct: +e.target.value } : x) }),
          approval: p.ok ? 'Approved by J. Ahor Abandoh-Sam' : 'Pending approval', aBg: p.ok ? '#dcfce7' : '#fef3c7', aFg: p.ok ? '#15803d' : '#92400e', aIcon: p.ok ? 'icon-badge-check' : 'icon-clock' }; }),
      toast: s.toast,
    };
  }
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      <div style={{ padding: "clamp(16px,2.6vw,30px) clamp(14px,2.4vw,32px) 48px clamp(14px,3.4vw,52px)" }}>
        <h1 style={{ margin: "0 0 clamp(18px,2.4vw,32px)", fontSize: "clamp(26px,3vw,32px)", fontWeight: "700", letterSpacing: "-0.5px" }}>Profile</h1>
        <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", minHeight: "190px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "20px", padding: "24px clamp(18px,2.6vw,34px)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", flex: "none" }}>
            <div
              style={{ position: "relative", width: "128px", height: "128px" }}
              onMouseEnter={() => __v.onAvatarHover(true)}
              onMouseLeave={() => __v.onAvatarHover(false)}
            >
              <div
                onClick={__v.triggerFileInput}
                title={"Click to change profile picture"}
                style={{
                  width: "128px",
                  height: "128px",
                  borderRadius: "50%",
                  border: "4px solid #fff",
                  boxShadow: "0 4px 18px rgba(15,35,65,.18), 0 0 0 1px rgba(21,144,76,.2)",
                  background: __v.avatar ? "transparent" : "linear-gradient(135deg, #0d3b2a 0%, #17603f 50%, #2fb36b 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  overflow: "hidden",
                  position: "relative"
                }}
              >
                {__v.avatar ? (
                  <img
                    src={__v.avatar}
                    alt={"Profile photo"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <span style={{ font: "700 38px Inter, sans-serif", color: "#fff", letterSpacing: "1px" }}>
                    AD
                  </span>
                )}
                <div
                  style={{
                    position: "absolute",
                    inset: "0",
                    background: "rgba(10,52,36,0.6)",
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    opacity: __v.avatarHover ? 1 : 0,
                    transition: "opacity .2s ease",
                    pointerEvents: "none"
                  }}
                >
                  <i className={"icon-camera"} style={{ fontSize: "24px" }}></i>
                  <span style={{ fontSize: "11px", fontWeight: "600", marginTop: "3px" }}>Change</span>
                </div>
              </div>
              <button
                onClick={__v.triggerFileInput}
                title={"Upload new profile photo"}
                style={{
                  position: "absolute",
                  bottom: "2px",
                  right: "2px",
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: "linear-gradient(180deg,#2fb36b,#15904c)",
                  color: "#fff",
                  border: "3px solid #fff",
                  boxShadow: "0 4px 12px rgba(21,144,76,.4)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0"
                }}
              >
                <i className={"icon-camera"} style={{ fontSize: "16px" }}></i>
              </button>
              <input
                ref={__v.fileRef}
                type={"file"}
                accept={"image/png,image/jpeg,image/webp,image/gif"}
                onChange={__v.onAvatarUpload}
                style={{ display: "none" }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={__v.triggerFileInput}
                style={{
                  fontSize: "11.5px",
                  fontWeight: "600",
                  color: "#15904c",
                  background: "rgba(47,179,107,.12)",
                  border: "1px solid rgba(47,179,107,.25)",
                  borderRadius: "999px",
                  padding: "3px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <i className={"icon-upload"} style={{ fontSize: "12px" }}></i>
                {__v.avatar ? "Change photo" : "Upload photo"}
              </button>
              {__v.avatar ? (
                <button
                  onClick={__v.onAvatarRemove}
                  title={"Reset to default initials"}
                  style={{
                    fontSize: "11.5px",
                    fontWeight: "600",
                    color: "#dc2626",
                    background: "rgba(239,68,68,.1)",
                    border: "1px solid rgba(239,68,68,.2)",
                    borderRadius: "999px",
                    padding: "3px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <i className={"icon-trash-2"} style={{ fontSize: "12px" }}></i>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <div style={{ flex: "1 1 320px", textAlign: "center", minWidth: "0" }}>
            <div style={{ fontSize: "clamp(20px,2.2vw,25px)", fontWeight: "700", letterSpacing: "-0.2px" }}>ADJEI DENZIL ASIAM</div>
            <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "8px" }}><span style={{ color: "#374151", fontWeight: "500" }}>123456789</span> · IT OFFICER · IT DEPARTMENT · HEAD OFFICE</div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", marginTop: "10px" }}>
              <span style={{ fontSize: "12px", color: "#374151", background: "#f3f4f6", borderRadius: "999px", padding: "3px 10px" }}>{__v.roleLabel}</span>
              <span style={{ fontSize: "12px", color: "#374151", background: "#f3f4f6", borderRadius: "999px", padding: "3px 10px" }}>Target: IT Officer · Grade 10</span>
            </div>
          </div>
          <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "150px" }}>
            <span style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280" }}>OVERALL PROFICIENCY</span>
            <span style={{ fontSize: "30px", fontWeight: "700", letterSpacing: "-0.5px" }}>{__v.avgText}</span>
            <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{__v.avgLabel} · {__v.openGaps} open gaps</span>
          </div>
        </div>
        <div style={{ marginTop: "24px", background: "rgba(118,118,128,.12)", borderRadius: "12px", padding: "4px", display: "flex", gap: "6px", overflowX: "auto" }}>
          {(__v.tabs || []).map((t, $index) => (<React.Fragment key={$index}>
            <button onClick={t?.onClick} style={{ flex: "none", display: "flex", alignItems: "center", gap: "9px", height: "36px", padding: "0 14px", border: "0", borderRadius: "7px", cursor: "pointer", whiteSpace: "nowrap", font: "500 14.5px Inter,sans-serif", color: t?.color, background: t?.bg, boxShadow: t?.shadow }}><i className={t?.icon} style={{ fontSize: "15px" }}></i>{t?.label}{(t?.count) ? (<>
                <span style={{ fontSize: "10px", fontWeight: "600", background: "#e5e7eb", color: "#4b5563", borderRadius: "999px", minWidth: "17px", height: "17px", padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>{t?.count}</span>
              </>) : null}</button>
          </React.Fragment>))}
        </div>
        {(__v.tabAccount) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", marginTop: "28px", alignItems: "flex-start" }}>
            <div style={{ flex: "2 1 520px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", padding: "20px 24px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div>
                  <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Personal Information</div>
                  <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "5px" }}>Details held on file by HR.</div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#4b5563", background: "#f5f6f8", border: "1px solid rgba(15,35,65,.07)", borderRadius: "7px", padding: "4px 9px", whiteSpace: "nowrap" }}><i className={"icon-lock"} style={{ fontSize: "12px" }}></i>Read-only</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "16px", padding: "24px 24px 32px" }}>
                {(__v.personal || []).map((f, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "flex", alignItems: "center", gap: "13px", border: "1px solid rgba(15,35,65,.07)", borderRadius: "12px", padding: "11px 12px", minWidth: "0" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#e6f2ea", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", color: "#374151" }}>
                      <i className={f?.icon} style={{ fontSize: "15px" }}></i>
                    </div>
                    <div style={{ minWidth: "0" }}>
                      <div style={{ font: "500 12px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>{f?.label}</div>
                      <div style={{ fontSize: "14.5px", color: "#111827", marginTop: "4px", overflowWrap: "anywhere" }}>{f?.value}</div>
                    </div>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
            <div style={{ flex: "1 1 340px", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Role &amp; Target Profile</div>
                <div style={{ padding: "16px 24px 22px", display: "flex", flexDirection: "column", gap: "18px" }}>
                  {(__v.employment || []).map((f, $index) => (<React.Fragment key={$index}>
                    <div>
                      <div style={{ font: "500 12px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>{f?.label}</div>
                      <div style={{ fontSize: "14.5px", marginTop: "5px" }}>{f?.value}</div>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Security</div>
                <div style={{ padding: "14px 24px 8px", display: "flex", alignItems: "center", gap: "13px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#e6f4ec", color: "#15904c", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <i className={"icon-monitor"} style={{ fontSize: "15px" }}></i>
                  </div>
                  <span style={{ flex: "1", fontSize: "14.5px", color: "#374151" }}>Active Devices</span>
                  <button onClick={__v.toggleDevices} style={{ background: "none", border: "0", cursor: "pointer", font: "500 13px Inter,sans-serif", color: "#111827" }}>{__v.devicesCta}</button>
                </div>
                {(__v.devicesOpen) ? (<>
                  <div style={{ padding: "4px 24px 8px 69px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {(__v.devices || []).map((dv, $index) => (<React.Fragment key={$index}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                        <span>
                          <span style={{ color: "#111827" }}>{dv?.name}</span>
                          <br />
                          <span style={{ color: "#6b7280", fontSize: "12px" }}>{dv?.meta}</span>
                        </span>
                        {(dv?.revocable) ? (<>
                          <button onClick={dv?.revoke} style={{ background: "none", border: "0", cursor: "pointer", color: "#b91c1c", font: "500 12px Inter,sans-serif" }}>Sign out</button>
                        </>) : null}
                      </div>
                    </React.Fragment>))}
                  </div>
                </>) : null}
                <div style={{ padding: "8px 24px 16px", display: "flex", alignItems: "center", gap: "13px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#e6f4ec", color: "#15904c", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <i className={"icon-wifi-off"} style={{ fontSize: "15px" }}></i>
                  </div>
                  <span style={{ flex: "1", fontSize: "14.5px", color: "#374151" }}>Offline data on this device</span>
                  <span style={{ fontSize: "12px", color: "#15803d", background: "#dcfce7", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}>Encrypted · Synced</span>
                </div>
              </div>
            </div>
          </div>
        </>) : null}
        {(__v.tabSkills) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", marginTop: "28px", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 360px", maxWidth: __v.radarMax, minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Target vs Actual</div>
                  <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "5px" }}>Rated on the 1–5 proficiency scale</div>
                </div>
                <div style={{ padding: "10px 10px 4px", display: "flex", justifyContent: "center" }}>
                  <svg viewBox={"-70 -20 500 380"} width={"100%"} style={{ maxWidth: "420px", display: "block" }}>
                    <g>
                      {(__v.radar?.rings || []).map((r, $index) => (<React.Fragment key={$index}>
                        <polygon points={r} fill={"none"} stroke={"#e5e7eb"} strokeWidth={"1"}></polygon>
                      </React.Fragment>))}
                    </g>
                    <g>
                      {(__v.radar?.axes || []).map((a, $index) => (<React.Fragment key={$index}>
                        <line x1={"180"} y1={"170"} x2={a?.x} y2={a?.y} stroke={"#eef0f3"} strokeWidth={"1"}></line>
                      </React.Fragment>))}
                    </g>
                    <polygon points={__v.radar?.target} fill={"rgba(242,196,107,.18)"} stroke={"#e0a63a"} strokeWidth={"2"} strokeDasharray={"5 4"}></polygon>
                    <polygon points={__v.radar?.actual} fill={"rgba(10,52,36,.16)"} stroke={"#0d3b2a"} strokeWidth={"2"}></polygon>
                    <g>
                      {(__v.radar?.labels || []).map((l, $index) => (<React.Fragment key={$index}>
                        <text x={l?.x} y={l?.y} textAnchor={l?.anchor} dominantBaseline={"middle"} style={{ font: "500 11px Inter,sans-serif", fill: "#4b5563" }}>{l?.text}</text>
                      </React.Fragment>))}
                    </g>
                  </svg>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "18px", padding: "0 0 18px", fontSize: "11.5px", color: "#4b5563" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "16px", height: "3px", background: "#0d3b2a" }}></span>Actual</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "16px", borderTop: "2px dashed #e0a63a" }}></span>Target</span>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Gap Scale</div>
                <div style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(__v.gapScale || []).map((g, $index) => (<React.Fragment key={$index}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <span style={{ flex: "none", width: "118px", font: "600 11px Inter,sans-serif", borderRadius: "6px", padding: "5px 8px", background: g?.bg, color: g?.fg }}>{g?.n} · {g?.label}</span>
                      <span style={{ fontSize: "12px", lineHeight: "1.45", color: "#4b5563", paddingTop: "3px" }}>{g?.desc}</span>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
            </div>
            <div style={{ flex: "2 1 560px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", padding: "20px 24px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div>
                  <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Competency Matrix</div>
                  <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "5px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>IT DEPARTMENT <i className={"icon-arrow-right"} style={{ fontSize: "11px" }}></i> Major Skill <i className={"icon-arrow-right"} style={{ fontSize: "11px" }}></i> Specific Competency</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={__v.exportCsv} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", cursor: "pointer", font: "500 12.5px Inter,sans-serif", color: "#374151" }}><i className={"icon-download"} style={{ fontSize: "13px" }}></i>Export CSV</button>
                  <button onClick={__v.goEvidence} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 14px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 12.5px Inter,sans-serif", cursor: "pointer" }}><i className={"icon-upload"} style={{ fontSize: "13px" }}></i>Upload Evidence</button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: "640px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 140px 150px 118px", gap: "14px", padding: "10px 24px", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                    <span>COMPETENCY</span>
                    <span>IMPORTANCE</span>
                    <span>ACTUAL / TARGET</span>
                    <span>GAP</span>
                  </div>
                  {(__v.matrix || []).map((m, $index) => (<React.Fragment key={$index}>
                    <div>
                      <button onClick={m?.toggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "12px 24px", background: "rgba(255,255,255,.4)", border: "0", borderBottom: "1px solid rgba(15,35,65,.07)", cursor: "pointer", textAlign: "left" }}>
                        <i className={m?.chev} style={{ fontSize: "14px", color: "#6b7280" }}></i>
                        <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#111827", flex: "1" }}>{m?.name}</span>
                        <span style={{ font: "600 12px 'JetBrains Mono',monospace", color: "#6b7280" }}>avg {m?.actual} / {m?.target}</span>
                      </button>
                      {(m?.open) ? (<>
                        {(m?.items || []).map((c, $index) => (<React.Fragment key={$index}>
                          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 140px 150px 118px", gap: "14px", alignItems: "center", padding: "12px 24px 12px 48px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                            <div style={{ minWidth: "0" }}>
                              <div style={{ fontSize: "14px", fontWeight: "500" }}>{c?.name}</div>
                              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{c?.levelLabel}{(c?.evidence) ? (<> · <span style={{ color: "#15803d" }}>{c?.evidence}</span></>) : null}</div>
                            </div>
                            <span style={{ justifySelf: "start", font: "600 11px Inter,sans-serif", borderRadius: "6px", padding: "3px 8px", background: c?.impBg, color: c?.impFg, whiteSpace: "nowrap" }}>{c?.importance} · {c?.impShort}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ display: "flex", gap: "3px" }}>
                                {(c?.segs || []).map((sg, $index) => (<React.Fragment key={$index}>
                                  <span style={{ width: "16px", height: "8px", borderRadius: "2px", background: sg?.bg }}></span>
                                </React.Fragment>))}
                              </div>
                              <span style={{ font: "600 12px 'JetBrains Mono',monospace", color: "#374151" }}>{c?.actual}/{c?.target}</span>
                            </div>
                            <span style={{ justifySelf: "start", font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: c?.gapBg, color: c?.gapFg, whiteSpace: "nowrap" }}>{c?.gap} · {c?.gapLabel}</span>
                          </div>
                        </React.Fragment>))}
                      </>) : null}
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", padding: "14px 24px 18px", fontSize: "11.5px", color: "#4b5563" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "14px", height: "8px", borderRadius: "2px", background: "#0d3b2a" }}></span>Current level</span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "14px", height: "8px", borderRadius: "2px", background: "#f2c46b" }}></span>Shortfall to target</span>
                <span style={{ color: "#9ca3af" }}>1 Novice · 2 Basic · 3 Competent · 4 Proficient · 5 Expert</span>
              </div>
            </div>
          </div>
        </>) : null}
        {(__v.tabHistory) ? (<>
          <div style={{ marginTop: "28px", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "20px 24px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Assessment History</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "5px" }}>Self, manager and 360° assessments from every cycle</div>
              </div>
              <button onClick={__v.exportCsv} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", cursor: "pointer", font: "500 12.5px Inter,sans-serif", color: "#374151" }}><i className={"icon-download"} style={{ fontSize: "13px" }}></i>Export CSV</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "860px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "100px 170px minmax(0,1fr) 120px 70px 150px 70px", gap: "14px", padding: "10px 24px", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span>CYCLE</span>
                  <span>TYPE</span>
                  <span>ASSESSOR</span>
                  <span>DATE</span>
                  <span>SCORE</span>
                  <span>STATUS</span>
                  <span>REPORT</span>
                </div>
                {(__v.history || []).map((h, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 170px minmax(0,1fr) 120px 70px 150px 70px", gap: "14px", alignItems: "center", padding: "14px 24px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "14px" }}>
                    <span style={{ fontWeight: "600" }}>{h?.cycle}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#374151" }}><i className={h?.icon} style={{ fontSize: "15px", color: "#6b7280" }}></i>{h?.type}</span>
                    <span style={{ color: "#374151" }}>{h?.assessor}</span>
                    <span style={{ color: "#6b7280", fontSize: "13px" }}>{h?.date}</span>
                    <span style={{ font: "600 13px 'JetBrains Mono',monospace" }}>{h?.score}</span>
                    <span style={{ justifySelf: "start", font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: h?.sBg, color: h?.sFg }}>{h?.status}</span>
                    <button onClick={h?.onReport} style={{ justifySelf: "start", background: "none", border: "0", cursor: "pointer", color: "#127a42", font: "500 12.5px Inter,sans-serif", display: "flex", alignItems: "center", gap: "4px" }}><i className={"icon-file-down"} style={{ fontSize: "14px" }}></i>{h?.report}</button>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
          </div>
        </>) : null}
        {(__v.tabPlan) ? (<>
          <div style={{ marginTop: "28px", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "20px 24px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Development Plan</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "5px" }}>Actions to close your priority gaps. Your line manager approves each one.</div>
              </div>
              <button onClick={__v.toggleAdd} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 14px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}><i className={"icon-plus"} style={{ fontSize: "14px" }}></i>Add action</button>
            </div>
            {(__v.adding) ? (<>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end", padding: "16px 24px", background: "rgba(255,255,255,.4)", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <label style={{ flex: "2 1 260px", display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>ACTION<input value={__v.newAction} onChange={__v.onNewAction} placeholder={"e.g. Shadow the network team for two weeks"} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", color: "#111827" }} /></label>
                <label style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>COMPETENCY<select value={__v.newComp} onChange={__v.onNewComp} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13.5px Inter,sans-serif", background: "#fff" }}>
                    {(__v.gapComps || []).map((o, $index) => (<React.Fragment key={$index}>
                      <option value={o?.id}>{o?.label}</option>
                    </React.Fragment>))}
                  </select></label>
                <label style={{ flex: "0 1 160px", display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>DUE<input type={"month"} value={__v.newDue} onChange={__v.onNewDue} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13.5px Inter,sans-serif" }} /></label>
                <button onClick={__v.saveAction} style={{ height: "36px", padding: "0 16px", border: "0", borderRadius: "999px", background: __v.saveBg, color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>Submit for approval</button>
              </div>
            </>) : null}
            {(__v.plan || []).map((p, $index) => (<React.Fragment key={$index}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div style={{ flex: "2 1 300px", display: "flex", gap: "14px", alignItems: "center", minWidth: "0" }}>
                  <span style={{ flex: "none", font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: p?.gapBg, color: p?.gapFg }}>Gap {p?.gap}</span>
                  <div style={{ minWidth: "0" }}>
                    <div style={{ fontSize: "14.5px", fontWeight: "500" }}>{p?.action}</div>
                    <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "3px" }}>{p?.competency}</div>
                  </div>
                </div>
                <div style={{ flex: "0 0 110px" }}>
                  <div style={{ font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280" }}>DUE</div>
                  <div style={{ fontSize: "13.5px", marginTop: "3px" }}>{p?.due}</div>
                </div>
                <div style={{ flex: "1 1 150px", maxWidth: "200px" }}>
                  <div style={{ font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280" }}>PROGRESS</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                    <input type={"range"} min={"0"} max={"100"} step={"5"} value={p?.pct} onChange={p?.onPct} style={{ flex: "1", accentColor: "#0d3b2a" }} />
                    <span style={{ fontSize: "11.5px", color: "#374151", width: "32px" }}>{p?.pctText}</span>
                  </div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "4px 10px", background: p?.aBg, color: p?.aFg, whiteSpace: "nowrap" }}><i className={p?.aIcon} style={{ fontSize: "12px" }}></i>{p?.approval}</span>
              </div>
            </React.Fragment>))}
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


export default SMProfile;
