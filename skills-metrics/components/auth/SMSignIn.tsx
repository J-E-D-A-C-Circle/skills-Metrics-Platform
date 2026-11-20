// @ts-nocheck
'use client';
// =============================================================================
// SMSignIn · Sign-in screen plus forced "Set your password" step for accounts on a temporary password
// Screen / URL: "/signin" (shown whenever nobody is signed in)
// Who sees it: everyone before signing in
// Used by: components/SkillMatrixApp.jsx   Depends on: React, lib/passwordRules.js, POST /api/auth/login, /api/auth/password, /api/auth/logout
// Sections (search for these markers): SIGN IN · Constants, Component, Sign-in check, Finish sign-in, State & helpers, Render,
//   Styles & animations, Page layout, Brand side, Glass card, Sign-in form, Username & password fields, Set your password,
//   Password rules checklist, Save & Cancel buttons
// =============================================================================
import React from 'react';
import { PASSWORD_RULES } from '@/lib/passwordRules';


// ===== SIGN IN · Constants =====
// Accounts live on the server (MySQL). Passwords are checked by POST /api/auth/login and never stored in the browser.
// The rules for a new password come from lib/passwordRules.js, which the server also enforces.
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  .then(async r => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }))
  .catch(() => ({ ok: false, status: 0, data: { error: "Can't reach the server. Check your connection and try again." } }));
// Small inline icons for the input fields (no extra icon font needed).
const UserIcon = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
const LockIcon = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>);
const CheckIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>);
// What the platform does, shown on the brand side.
const HIGHLIGHTS = [
  ['Role-based assessments', 'Questions matched to every job level and department.'],
  ['Automatic scoring', 'One scoring engine for results, gaps and reports.'],
  ['Training priorities', 'See exactly where skills gaps need attention.'],
];
// ===== SIGN IN · Component =====
class SMSignIn extends React.Component {
  // step: 'login' (sign-in form) or 'change' (forced password change). ident = username or email typed.
  // busy = waiting for the server (stops double clicks sending two requests).
  state = { step: 'login', ident: '', pw: '', show: false, err: '', forgot: false, user: null, np: '', cp: '', busy: false };
  // ===== SIGN IN · Sign-in check =====
  // The server matches username or email and password, refuses suspended accounts and locks out repeated failures.
  // Accounts on a temporary password go to the 'Set your password' step instead of signing in.
  async signIn() {
    const s = this.state, id = s.ident.trim();
    if (s.busy) return;
    if (!id || !s.pw) return this.setState({ err: 'Enter your username or email and your password.' });
    this.setState({ busy: true, err: '' });
    const r = await post('/api/auth/login', { identifier: id, password: s.pw });
    if (!r.ok) return this.setState({ busy: false, err: r.data.error || 'Sign-in failed. Please try again.' });
    if (r.data.user.mustChange) return this.setState({ busy: false, step: 'change', user: r.data.user, err: '', np: '', cp: '' });
    this.setState({ busy: false });
    this.done(r.data.user);
  }
  // ===== SIGN IN · Finish sign-in =====
  // Hands the signed-in user (from the server) to the parent (SkillMatrixApp), which goes Home.
  done(u) {
    this.props.onSignedIn && this.props.onSignedIn(u);
  }
  // ===== SIGN IN · State & helpers (renderVals) =====
  renderVals() {
    const s = this.state, vw = this.props.vw || 1440;
    const np = s.np, u = s.user;
    // New-password rules shown as a checklist; every rule must pass and both boxes must match before saving.
    const rules = PASSWORD_RULES.map(([label, test]) => [label, test(np, s.pw)]);
    const okCount = rules.filter(r => r[1]).length, allOk = okCount === rules.length, match = np && np === s.cp;
    return {
      showBrand: vw >= 900, isLogin: s.step === 'login', isChange: s.step === 'change',
      ident: s.ident, pw: s.pw, onIdent: e => this.setState({ ident: e.target.value, err: '' }), onPw: e => this.setState({ pw: e.target.value, err: '' }),
      onKey: e => { if (e.key === 'Enter') this.signIn(); },
      pwType: s.show ? 'text' : 'password', pwIcon: s.show ? 'icon-eye-off' : 'icon-eye', pwToggleText: s.show ? 'Hide passwords' : 'Show passwords', togglePw: () => this.setState({ show: !s.show }),
      err: s.err, signIn: () => this.signIn(), forgot: s.forgot, toggleForgot: () => this.setState({ forgot: !s.forgot }), busy: s.busy, signInText: s.busy ? 'Signing in…' : 'Sign in',
      firstName: u ? u.name.split(' ')[0] : '', np, cp: s.cp, onNp: e => this.setState({ np: e.target.value, err: '' }), onCp: e => this.setState({ cp: e.target.value, err: '' }),
      cpBorder: s.cp && !match ? '#fca5a5' : 'rgba(15,35,65,.14)',
      rules: rules.map(([label, ok]) => ({ label, icon: ok ? 'icon-circle-check' : 'icon-circle', color: ok ? '#15803d' : '#6b7280' })),
      strengthPct: (okCount / rules.length * 100) + '%', strengthColor: okCount <= 2 ? '#dc2626' : okCount <= 4 ? '#f2a516' : '#16a34a',
      saveBg: allOk && match ? 'linear-gradient(180deg,#2fb36b,#15904c)' : '#a3acb9', saveCursor: allOk && match ? 'pointer' : 'not-allowed',
      // Save new password: the server checks the rules again, clears "must change password", then the person is signed in.
      savePw: async () => { if (!allOk) return this.setState({ err: 'Your new password needs to meet every rule.' }); if (!match) return this.setState({ err: "The passwords don't match." });
        if (s.busy) return;
        this.setState({ busy: true, err: '' });
        const r = await post('/api/auth/password', { currentPassword: s.pw, newPassword: np });
        if (!r.ok) return this.setState({ busy: false, err: r.data.error || 'Could not save your password. Please try again.' });
        this.setState({ busy: false, pw: '', np: '', cp: '' });
        this.done(r.data.user); },
      backToLogin: () => { post('/api/auth/logout', {}); this.setState({ step: 'login', pw: '', user: null }); },
    };
  }
  // ===== SIGN IN · Render =====
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      {/* ===== SIGN IN · Styles & animations ===== */}
      {/* Background slideshow: 3 DVLA photos, 6s each (18s loop), cross-fading with a slow zoom/pan. The card rises in on load.
          Reduced motion: first photo only, no movement. */}
      <style>{`
        @keyframes skmSigninRise { from { opacity: 0; transform: translateY(24px) scale(.98); } to { opacity: 1; transform: none; } }
        @keyframes skmSigninFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes skmSigninSlide {
          0% { opacity: 0; transform: scale(1) translateX(0); }
          6% { opacity: 1; }
          33% { opacity: 1; }
          40% { opacity: 0; transform: scale(1.1) translateX(-3%); }
          100% { opacity: 0; transform: scale(1.1) translateX(-3%); }
        }
        @keyframes skmSigninGlow { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-24px) scale(1.12); } }
        .skm-signin-slide { opacity: 0; animation: skmSigninSlide 18s linear infinite both; transform-origin: 50% 45%; will-change: opacity, transform; }
        .skm-signin-slide:nth-child(2) { animation-delay: 6s; }
        .skm-signin-slide:nth-child(3) { animation-delay: 12s; }
        .skm-signin-card { animation: skmSigninRise .8s cubic-bezier(.2,.7,.2,1) .15s both; }
        .skm-signin-brand > * { animation: skmSigninFade .8s cubic-bezier(.2,.7,.2,1) both; }
        .skm-signin-brand > *:nth-child(2) { animation-delay: .15s; }
        .skm-signin-brand > *:nth-child(3) { animation-delay: .3s; }
        .skm-signin-glow { animation: skmSigninGlow 14s ease-in-out infinite; }
        .skm-signin-field { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 8px 0 14px; border-radius: 14px; background: rgba(255,255,255,.85); border: 1.5px solid rgba(15,35,65,.10); color: #6b7280; transition: border-color .18s, box-shadow .18s, background .18s; }
        .skm-signin-field:focus-within { border-color: #2fb36b; background: #fff; color: #15904c; box-shadow: 0 0 0 4px rgba(47,179,107,.16); }
        .skm-signin-field input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; font: 400 15px Inter,system-ui,sans-serif; color: #111827; }
        .skm-signin-field input::placeholder { color: #9ca3af; }
        .skm-signin-btn { height: 48px; border: 0; border-radius: 999px; background: linear-gradient(180deg,#2fb36b,#15904c); box-shadow: 0 8px 20px rgba(21,144,76,.34), inset 0 1px 0 rgba(255,255,255,.35); color: #fff; font: 600 15px Inter,system-ui,sans-serif; cursor: pointer; transition: transform .15s, box-shadow .15s, filter .15s; }
        .skm-signin-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(21,144,76,.42), inset 0 1px 0 rgba(255,255,255,.35); filter: brightness(1.04); }
        .skm-signin-btn:active:not(:disabled) { transform: translateY(0); }
        .skm-signin-btn:disabled { opacity: .7; cursor: progress; }
        .skm-signin-link { background: none; border: 0; cursor: pointer; font: 500 13px Inter,system-ui,sans-serif; transition: color .15s, opacity .15s; }
        .skm-signin-link:hover { opacity: .75; }
        @media (prefers-reduced-motion: reduce) { .skm-signin-slide, .skm-signin-card, .skm-signin-brand > *, .skm-signin-glow { animation: none; } .skm-signin-slide:first-child { opacity: 1; } }
      `}</style>
      {/* ===== SIGN IN · Page layout ===== */}
      {/* Photos live in public/assets: dvla-login-1.jpg (MLNR building), dvla-login-2.jpg (DVLA Adentan office), dvla-login-3.jpg (DVLA Head Office).
          To change or add photos, edit the list below (a 4th photo also needs an nth-child delay above and a longer loop).
          Each slide is slightly oversized (inset -6%) so the zoom/pan never shows an edge. */}
      <div style={{ position: "relative", minHeight: "100vh", display: "flex", background: "#0d3b2a", fontFamily: "Inter,system-ui,sans-serif", color: "#111827", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "0" }}>
          {['/assets/dvla-login-1.jpg', '/assets/dvla-login-2.jpg', '/assets/dvla-login-3.jpg'].map(src => (
            <div key={src} className="skm-signin-slide" style={{ position: "absolute", inset: "-6%", backgroundImage: "url('" + src + "')", backgroundSize: "cover", backgroundPosition: "center", filter: "saturate(1.1) contrast(1.05)" }}></div>
          ))}
        </div>
        {/* Deep green wash: darker on the left where the text sits, lighter on the right behind the card. */}
        <div style={{ position: "absolute", inset: "0", background: "linear-gradient(105deg, rgba(8,40,28,.92) 0%, rgba(11,52,36,.78) 45%, rgba(13,59,42,.55) 100%)" }}></div>
        <div className="skm-signin-glow" style={{ position: "absolute", width: "520px", height: "520px", right: "-120px", top: "-140px", borderRadius: "50%", background: "radial-gradient(circle, rgba(47,179,107,.38), transparent 68%)", pointerEvents: "none" }}></div>
        <div className="skm-signin-glow" style={{ position: "absolute", width: "420px", height: "420px", left: "-100px", bottom: "-160px", borderRadius: "50%", background: "radial-gradient(circle, rgba(47,179,107,.20), transparent 68%)", pointerEvents: "none", animationDelay: "-6s" }}></div>

        {/* ===== SIGN IN · Brand side (left, wide screens only) ===== */}
        {(__v.showBrand) ? (
          <div className="skm-signin-brand" style={{ position: "relative", zIndex: 1, flex: "1 1 55%", minWidth: "0", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "44px 56px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "46px", height: "46px", borderRadius: "14px", background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.28)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src="/assets/dvla-logo.png" alt="DVLA" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
              </div>
              <span style={{ fontSize: "17px", fontWeight: "700", letterSpacing: "-0.2px" }}>Skill Matrix &amp; Assessment Platform</span>
            </div>
            <div style={{ maxWidth: "520px", textShadow: "0 2px 18px rgba(0,0,0,.3)" }}>
              <div style={{ display: "inline-block", fontSize: "11.5px", fontWeight: "700", letterSpacing: "1.2px", textTransform: "uppercase", color: "#9be3bd", background: "rgba(47,179,107,.18)", border: "1px solid rgba(155,227,189,.35)", borderRadius: "999px", padding: "5px 12px", marginBottom: "18px" }}>Driver &amp; Vehicle Licensing Authority</div>
              <div style={{ fontSize: "clamp(32px,3.6vw,50px)", fontWeight: "800", letterSpacing: "-1.2px", lineHeight: "1.08", color: "#ffffff" }}>Know your skills.<br />Close the gaps.</div>
              <div style={{ fontSize: "15.5px", color: "#d4eadd", marginTop: "16px", lineHeight: "1.65" }}>Assessments, automatic scoring, manager review and training needs, all in one place.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "30px" }}>
                {HIGHLIGHTS.map(([title, text]) => (
                  <div key={title} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", borderRadius: "16px", background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.16)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
                    <span style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(180deg,#2fb36b,#15904c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(21,144,76,.4)" }}><CheckIcon /></span>
                    <span style={{ lineHeight: "1.35" }}><span style={{ display: "block", fontSize: "14px", fontWeight: "700" }}>{title}</span><span style={{ display: "block", fontSize: "12.5px", color: "#bfe0cd" }}>{text}</span></span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: "12.5px", color: "#a9cdb9" }}>© 2026 Skill Matrix &amp; Assessment Platform</div>
          </div>
        ) : null}

        {/* ===== SIGN IN · Glass card (right) ===== */}
        <div style={{ position: "relative", zIndex: 1, flex: "1 1 45%", minWidth: "0", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(20px,4vw,48px) clamp(16px,3vw,40px)" }}>
          <div className="skm-signin-card" style={{ position: "relative", overflow: "hidden", width: "100%", maxWidth: "448px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "22px", padding: "clamp(28px,4vw,42px) clamp(24px,4vw,40px) clamp(22px,3vw,28px)", borderRadius: "30px", background: "linear-gradient(180deg, rgba(255,255,255,.94), rgba(244,250,246,.90))", backdropFilter: "blur(34px) saturate(180%)", WebkitBackdropFilter: "blur(34px) saturate(180%)", border: "1px solid rgba(255,255,255,.9)", boxShadow: "inset 0 1px 0 #fff, 0 2px 0 rgba(47,179,107,.18), 0 34px 80px rgba(3,22,14,.5), 0 0 0 6px rgba(255,255,255,.08)" }}>
            {/* Accent bar across the top of the card and a soft green glow behind the emblem. */}
            <div style={{ position: "absolute", top: "0", left: "0", right: "0", height: "5px", background: "linear-gradient(90deg,#15904c,#2fb36b 50%,#34d399)" }}></div>
            <div style={{ position: "absolute", top: "-90px", left: "50%", width: "260px", height: "200px", transform: "translateX(-50%)", background: "radial-gradient(ellipse, rgba(47,179,107,.22), transparent 70%)", pointerEvents: "none" }}></div>
            {/* Emblem: the DVLA logo in a white ring. Always shown so the card stands on its own. */}
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "68px", height: "68px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 4px rgba(47,179,107,.18), 0 10px 26px rgba(21,144,76,.28)" }}>
                <img src="/assets/dvla-logo.png" alt="DVLA" style={{ width: "46px", height: "46px", objectFit: "contain" }} />
              </div>
              <span style={{ font: "700 10.5px Inter,sans-serif", letterSpacing: "1.4px", textTransform: "uppercase", color: "#15904c" }}>Skill Matrix &amp; Assessment Platform</span>
            </div>
            {/* ===== SIGN IN · Sign-in form (step 1) ===== */}
            {(__v.isLogin) ? (<>
              <div style={{ textAlign: "center" }}>
                <h1 style={{ margin: "0", fontSize: "29px", fontWeight: "800", letterSpacing: "-0.7px", color: "#0d3b2a" }}>Welcome back</h1>
                <div style={{ fontSize: "14px", color: "#5b6572", marginTop: "6px" }}>Sign in with your username or work email.</div>
              </div>
              {/* ===== SIGN IN · Username & password fields, error, Forgot password ===== */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "7px", font: "600 12.5px Inter,sans-serif", color: "#374151" }}>Username or email
                  <div className="skm-signin-field">
                    <UserIcon />
                    <input value={__v.ident} onChange={__v.onIdent} onKeyDown={__v.onKey} autoComplete={"username"} placeholder={"e.g. ama.owusu"} />
                  </div>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "7px", font: "600 12.5px Inter,sans-serif", color: "#374151" }}>Password
                  <div className="skm-signin-field">
                    <LockIcon />
                    <input type={__v.pwType} value={__v.pw} onChange={__v.onPw} onKeyDown={__v.onKey} autoComplete={"current-password"} placeholder={"Enter your password"} />
                    <button onClick={__v.togglePw} type={"button"} aria-label={__v.pwToggleText} style={{ background: "none", border: "0", cursor: "pointer", color: "#6b7280", display: "flex", padding: "8px" }}>
                      <i className={__v.pwIcon} style={{ fontSize: "17px" }}></i>
                    </button>
                  </div>
                </label>
                {(__v.err) ? (
                  <div role="alert" style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "11px 13px", borderRadius: "12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "13px" }}><i className={"icon-circle-alert"} style={{ fontSize: "15px", marginTop: "1px" }}></i>{__v.err}</div>
                ) : null}
                <button className="skm-signin-btn" onClick={__v.signIn} disabled={__v.busy} style={{ marginTop: "2px" }}>{__v.signInText}</button>
                <button className="skm-signin-link" onClick={__v.toggleForgot} type={"button"} style={{ alignSelf: "center", color: "#127a42" }}>Forgot password?</button>
                {(__v.forgot) ? (
                  <div style={{ padding: "13px 14px", borderRadius: "12px", background: "#e6f4ec", border: "1px solid #bfe3cf", color: "#14532d", fontSize: "13px", lineHeight: "1.55" }}>Ask your system administrator to reset your password. They'll give you a new temporary password, and you'll set your own the next time you sign in.</div>
                ) : null}
              </div>
            </>) : null}
            {/* ===== SIGN IN · Set your password (forced change on first sign-in) ===== */}
            {(__v.isChange) ? (<>
              <div>
                <span style={{ font: "700 10px Inter,sans-serif", letterSpacing: ".6px", color: "#92400e", background: "#fef3c7", borderRadius: "999px", padding: "4px 10px" }}>FIRST SIGN-IN</span>
                <h1 style={{ margin: "14px 0 0", fontSize: "27px", fontWeight: "800", letterSpacing: "-0.6px", color: "#0d3b2a" }}>Set your password</h1>
                <div style={{ fontSize: "14px", color: "#5b6572", marginTop: "6px", lineHeight: "1.5" }}>Welcome, {__v.firstName}. You signed in with a temporary password. Choose your own password to continue.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "7px", font: "600 12.5px Inter,sans-serif", color: "#374151" }}>New password
                  <div className="skm-signin-field"><LockIcon /><input type={__v.pwType} value={__v.np} onChange={__v.onNp} autoComplete={"new-password"} /></div>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "7px", font: "600 12.5px Inter,sans-serif", color: "#374151" }}>Confirm new password
                  <div className="skm-signin-field" style={{ borderColor: __v.cpBorder }}><LockIcon /><input type={__v.pwType} value={__v.cp} onChange={__v.onCp} autoComplete={"new-password"} /></div>
                </label>
                <button className="skm-signin-link" onClick={__v.togglePw} type={"button"} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px", padding: "0", color: "#4b5563", fontSize: "12.5px" }}><i className={__v.pwIcon} style={{ fontSize: "14px" }}></i>{__v.pwToggleText}</button>
                {/* ===== SIGN IN · Password rules checklist & strength bar ===== */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "13px 15px", borderRadius: "14px", background: "rgba(255,255,255,.85)", border: "1px solid rgba(15,35,65,.08)" }}>
                  <div style={{ height: "6px", borderRadius: "999px", background: "#eef0f3", overflow: "hidden", marginBottom: "4px" }}>
                    <div style={{ height: "100%", borderRadius: "999px", background: __v.strengthColor, width: __v.strengthPct, transition: "width .25s, background .25s" }}></div>
                  </div>
                  {(__v.rules || []).map((r, $index) => (<React.Fragment key={$index}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: r?.color }}><i className={r?.icon} style={{ fontSize: "14px" }}></i>{r?.label}</div>
                  </React.Fragment>))}
                </div>
                {(__v.err) ? (
                  <div role="alert" style={{ padding: "11px 13px", borderRadius: "12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "13px" }}>{__v.err}</div>
                ) : null}
                {/* ===== SIGN IN · Save & Cancel buttons ===== */}
                <button className="skm-signin-btn" onClick={__v.savePw} style={{ background: __v.saveBg, cursor: __v.saveCursor }}>Save password &amp; continue</button>
                <button className="skm-signin-link" onClick={__v.backToLogin} type={"button"} style={{ alignSelf: "center", color: "#6b7280" }}>Cancel</button>
              </div>
            </>) : null}
            {/* Footer: reassurance line under a hairline divider. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", paddingTop: "16px", borderTop: "1px solid rgba(15,35,65,.08)", font: "500 12px Inter,sans-serif", color: "#6b7280" }}>
              <span style={{ display: "flex", color: "#15904c" }}><LockIcon /></span>Secure sign-in · Access depends on your role
            </div>
          </div>
        </div>
      </div>
    </>
    );
  }
}


export default SMSignIn;
