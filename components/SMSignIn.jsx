'use client';
// =============================================================================
// SMSignIn · Sign-in screen plus forced "Set your password" step for accounts on a temporary password
// Screen / URL: "/signin" (shown whenever nobody is signed in)
// Who sees it: everyone before signing in
// Used by: components/SkillMatrixApp.jsx   Depends on: React, lib/passwordRules.js, POST /api/auth/login, /api/auth/password, /api/auth/logout
// Sections (search for these markers): SIGN IN · Constants, Component, Sign-in check, Finish sign-in, State & helpers, Render,
//   Page layout, Brand panel, Brand panel animations, DVLA photo slideshow (full background), Form panel, Sign-in form, Username & password fields, Set your password,
//   Password rules checklist, Save & Cancel buttons
// =============================================================================
import React from 'react';
import { PASSWORD_RULES } from '../lib/passwordRules';


// ===== SIGN IN · Constants =====
// Accounts live on the server (PostgreSQL). Passwords are checked by POST /api/auth/login and never stored in the browser.
// The rules for a new password come from lib/passwordRules.js, which the server also enforces.
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  .then(async r => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }))
  .catch(() => ({ ok: false, status: 0, data: { error: "Can't reach the server. Check your connection and try again." } }));
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
      {/* ===== SIGN IN · Page layout ===== */}
      <div style={{ minHeight: "100vh", display: "flex", background: "transparent", fontFamily: "Inter,system-ui,sans-serif", color: "#111827" }}>
        {/* ===== SIGN IN · Brand panel (left, wide screens only) ===== */}
        {(__v.showBrand) ? (<>
          {/* ===== SIGN IN · Brand panel animations ===== */}
          {/* Background slideshow: 3 DVLA photos, 6s each (18s loop). Each fades in, slowly zooms/pans while on screen, then cross-fades into the next.
              Slide 2 and 3 start 6s and 12s later. Headline fades up on load. Reduced motion: first photo only, no movement. */}
          <style>{`
            @keyframes skmSigninRise { from { opacity: 0; transform: translateY(24px) scale(.98); } to { opacity: 1; transform: none; } }
            @keyframes skmSigninSlide {
              0% { opacity: 0; transform: scale(1) translateX(0); }
              6% { opacity: 1; }
              33% { opacity: 1; }
              40% { opacity: 0; transform: scale(1.1) translateX(-3%); }
              100% { opacity: 0; transform: scale(1.1) translateX(-3%); }
            }
            .skm-signin-slide { opacity: 0; animation: skmSigninSlide 18s linear infinite both; transform-origin: 50% 45%; will-change: opacity, transform; }
            .skm-signin-slide:nth-child(2) { animation-delay: 6s; }
            .skm-signin-slide:nth-child(3) { animation-delay: 12s; }
            .skm-signin-text { animation: skmSigninRise .9s cubic-bezier(.2,.7,.2,1) .3s both; }
            @media (prefers-reduced-motion: reduce) { .skm-signin-slide, .skm-signin-text { animation: none; } .skm-signin-slide:first-child { opacity: 1; } }
          `}</style>
          <div style={{ flex: "1 1 50%", position: "relative", background: "#0d3b2a", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 48px", overflow: "hidden" }}>
            {/* ===== SIGN IN · DVLA photo slideshow (full background) ===== */}
            {/* Covers the whole green panel. Photos live in public/assets: dvla-login-1.jpg (MLNR building), dvla-login-2.jpg (DVLA Adentan office),
                dvla-login-3.jpg (DVLA Head Office). To change or add photos, edit the list below (a 4th photo also needs an nth-child delay above and a longer loop).
                Each slide is slightly oversized (inset -6%) so the zoom/pan never shows an edge. */}
            <div style={{ position: "absolute", inset: "0" }}>
              {['/assets/dvla-login-1.jpg', '/assets/dvla-login-2.jpg', '/assets/dvla-login-3.jpg'].map(src => (
                <div key={src} className="skm-signin-slide" style={{ position: "absolute", inset: "-6%", backgroundImage: "url('" + src + "')", backgroundSize: "cover", backgroundPosition: "center", filter: "saturate(1.15) contrast(1.05)" }}></div>
              ))}
            </div>
            {/* Green tint over the photo: lighter in the middle so the building shows, darker at top and bottom so the text stays readable. */}
            <div style={{ position: "absolute", inset: "0", background: "linear-gradient(180deg, rgba(13,59,42,0.78) 0%, rgba(15,64,44,0.45) 38%, rgba(15,64,44,0.55) 62%, rgba(9,38,27,0.88) 100%)" }}></div>
            <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
              <img src="/assets/dvla-logo.png" alt="DVLA" style={{ width: "38px", height: "38px", objectFit: "contain" }} />
              <span style={{ fontSize: "17px", fontWeight: "700" }}>Skill Matrix &amp; Assessment Platform</span>
            </div>
            <div className="skm-signin-text" style={{ position: "relative", maxWidth: "460px", textShadow: "0 2px 18px rgba(0,0,0,.35)" }}>
              <div style={{ fontSize: "clamp(28px,3vw,40px)", fontWeight: "700", letterSpacing: "-0.6px", lineHeight: "1.15" }}>Know your skills.<br />Close the gaps.</div>
              <div style={{ fontSize: "15px", color: "#cfe6d8", marginTop: "14px", lineHeight: "1.6" }}>Timed assessments, automatic scoring, manager review and training needs in one place.</div>
            </div>
            <div style={{ position: "relative", fontSize: "12.5px", color: "#a9cdb9" }}>© 2026 Skill Matrix &amp; Assessment Platform</div>
          </div>
        </>) : null}
        {/* ===== SIGN IN · Form panel (right) ===== */}
        <div style={{ flex: "1 1 50%", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(20px,4vw,48px) 16px" }}>
          <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* ===== SIGN IN · Sign-in form (step 1) ===== */}
            {(__v.isLogin) ? (<>
              <div>
                <h1 style={{ margin: "0", fontSize: "28px", fontWeight: "700", letterSpacing: "-0.4px" }}>Sign in</h1>
                <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "6px" }}>Use your username or work email</div>
              </div>
              {/* ===== SIGN IN · Username & password fields, error, Forgot password ===== */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", font: "600 12px Inter,sans-serif", color: "#374151" }}>Username or email<input value={__v.ident} onChange={__v.onIdent} onKeyDown={__v.onKey} autoComplete={"username"} placeholder={"e.g. ama.owusu"} style={{ height: "44px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "12px", padding: "0 12px", font: "400 15px Inter,sans-serif", background: "#fff" }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", font: "600 12px Inter,sans-serif", color: "#374151" }}>Password
            <div style={{ display: "flex", alignItems: "center", height: "44px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "12px", background: "#fff", padding: "0 6px 0 12px" }}>
                    <input type={__v.pwType} value={__v.pw} onChange={__v.onPw} onKeyDown={__v.onKey} autoComplete={"current-password"} style={{ flex: "1", minWidth: "0", border: "0", outline: "0", font: "400 15px Inter,sans-serif", background: "transparent" }} />
                    <button onClick={__v.togglePw} type={"button"} style={{ background: "none", border: "0", cursor: "pointer", color: "#6b7280", display: "flex", padding: "6px" }}>
                      <i className={__v.pwIcon} style={{ fontSize: "16px" }}></i>
                    </button>
                  </div></label>
                {(__v.err) ? (<>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "10px 12px", borderRadius: "9px", background: "#fef2f2", color: "#991b1b", fontSize: "13px" }}><i className={"icon-circle-alert"} style={{ fontSize: "15px", marginTop: "1px" }}></i>{__v.err}</div>
                </>) : null}
                <button onClick={__v.signIn} disabled={__v.busy} style={{ height: "46px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 15px Inter,sans-serif", cursor: "pointer" }}>{__v.signInText}</button>
                <button onClick={__v.toggleForgot} style={{ alignSelf: "center", background: "none", border: "0", cursor: "pointer", color: "#127a42", font: "500 13px Inter,sans-serif" }}>Forgot password?</button>
                {(__v.forgot) ? (<>
                  <div style={{ padding: "12px", borderRadius: "9px", background: "#e6f4ec", color: "#1e3a8a", fontSize: "13px", lineHeight: "1.5" }}>Ask your system administrator to reset your password. They'll give you a new temporary password, and you'll set your own the next time you sign in.</div>
                </>) : null}
              </div>
            </>) : null}
            {/* ===== SIGN IN · Set your password (forced change on first sign-in) ===== */}
            {(__v.isChange) ? (<>
              <div>
                <span style={{ font: "700 10px Inter,sans-serif", letterSpacing: ".5px", color: "#92400e", background: "#fef3c7", borderRadius: "999px", padding: "3px 9px" }}>FIRST SIGN-IN</span>
                <h1 style={{ margin: "12px 0 0", fontSize: "26px", fontWeight: "700", letterSpacing: "-0.4px" }}>Set your password</h1>
                <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "6px", lineHeight: "1.5" }}>Welcome, {__v.firstName}. You signed in with a temporary password. Choose your own password to continue.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", font: "600 12px Inter,sans-serif", color: "#374151" }}>New password<input type={__v.pwType} value={__v.np} onChange={__v.onNp} autoComplete={"new-password"} style={{ height: "44px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "12px", padding: "0 12px", font: "400 15px Inter,sans-serif", background: "#fff" }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", font: "600 12px Inter,sans-serif", color: "#374151" }}>Confirm new password<input type={__v.pwType} value={__v.cp} onChange={__v.onCp} autoComplete={"new-password"} style={{ height: "44px", border: `1px solid ${__v.cpBorder ?? ""}`, borderRadius: "12px", padding: "0 12px", font: "400 15px Inter,sans-serif", background: "#fff" }} /></label>
                <button onClick={__v.togglePw} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px", background: "none", border: "0", padding: "0", cursor: "pointer", color: "#4b5563", font: "500 12.5px Inter,sans-serif" }}><i className={__v.pwIcon} style={{ fontSize: "14px" }}></i>{__v.pwToggleText}</button>
                {/* ===== SIGN IN · Password rules checklist & strength bar ===== */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px 14px", borderRadius: "12px", background: "#fff", border: "1px solid rgba(15,35,65,.07)" }}>
                  <div style={{ height: "6px", borderRadius: "999px", background: "#eef0f3", overflow: "hidden", marginBottom: "4px" }}>
                    <div style={{ height: "100%", borderRadius: "999px", background: __v.strengthColor, width: __v.strengthPct }}></div>
                  </div>
                  {(__v.rules || []).map((r, $index) => (<React.Fragment key={$index}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: r?.color }}><i className={r?.icon} style={{ fontSize: "14px" }}></i>{r?.label}</div>
                  </React.Fragment>))}
                </div>
                {(__v.err) ? (<>
                  <div style={{ padding: "10px 12px", borderRadius: "9px", background: "#fef2f2", color: "#991b1b", fontSize: "13px" }}>{__v.err}</div>
                </>) : null}
                {/* ===== SIGN IN · Save & Cancel buttons ===== */}
                <button onClick={__v.savePw} style={{ height: "46px", border: "0", borderRadius: "999px", background: __v.saveBg, color: "#fff", font: "600 15px Inter,sans-serif", cursor: __v.saveCursor }}>Save password &amp; continue</button>
                <button onClick={__v.backToLogin} style={{ alignSelf: "center", background: "none", border: "0", cursor: "pointer", color: "#6b7280", font: "500 13px Inter,sans-serif" }}>Cancel</button>
              </div>
            </>) : null}
          </div>
        </div>
      </div>
    </>
    );
  }
}


export default SMSignIn;
