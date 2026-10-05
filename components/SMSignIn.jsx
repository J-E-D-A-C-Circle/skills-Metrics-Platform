'use client';
import React from 'react';


const UKEY = 'skm-users';
const FALLBACK = [{ id: 0, name: 'Adjei Denzil Asiam', email: 'denzilasiam.adjei@dvla.gov.gh', username: 'denzilasiam.adjei', password: 'Password@1', mustChange: false, role: 'Administrator', status: 'Active' }];
class SMSignIn extends React.Component {
  state = { step: 'login', ident: '', pw: '', show: false, err: '', forgot: false, user: null, np: '', cp: '' };
  users() { try { const u = JSON.parse(localStorage.getItem(UKEY) || 'null'); if (Array.isArray(u) && u.length) return u; } catch (e) {} return FALLBACK; }
  signIn() {
    const s = this.state, id = s.ident.trim().toLowerCase();
    if (!id || !s.pw) return this.setState({ err: 'Enter your username or email and your password.' });
    const u = this.users().find(x => (x.username || '').toLowerCase() === id || (x.email || '').toLowerCase() === id);
    if (!u || u.password !== s.pw) return this.setState({ err: 'The username/email or password is incorrect.' });
    if (u.status === 'Suspended') return this.setState({ err: 'This account is suspended. Contact your administrator.' });
    if (u.mustChange) return this.setState({ step: 'change', user: u, err: '', np: '', cp: '' });
    this.done(u);
  }
  done(u) {
    try { const all = this.users().map(x => x.id === u.id ? { ...x, last: 'Now' } : x); localStorage.setItem(UKEY, JSON.stringify(all)); } catch (e) {}
    this.props.onSignedIn && this.props.onSignedIn(u);
  }
  renderVals() {
    const s = this.state, vw = this.props.vw || 1440;
    const np = s.np, u = s.user;
    const rules = [['At least 8 characters', np.length >= 8], ['An uppercase letter', /[A-Z]/.test(np)], ['A lowercase letter', /[a-z]/.test(np)], ['A number', /\d/.test(np)], ['A symbol (e.g. ! @ # $)', /[^A-Za-z0-9]/.test(np)], ['Different from your temporary password', !!np && u && np !== u.password]];
    const okCount = rules.filter(r => r[1]).length, allOk = okCount === rules.length, match = np && np === s.cp;
    const users = this.users();
    const demos = [FALLBACK[0], ...users.filter(x => x.mustChange).slice(-2)].filter((x, i, a) => a.findIndex(y => y.username === x.username) === i)
      .map(x => ({ user: x.username, note: x.mustChange ? 'temp: ' + x.password : x.password, fill: () => this.setState({ ident: x.username, pw: x.password, err: '' }) }));
    return {
      showBrand: vw >= 900, isLogin: s.step === 'login', isChange: s.step === 'change',
      ident: s.ident, pw: s.pw, onIdent: e => this.setState({ ident: e.target.value, err: '' }), onPw: e => this.setState({ pw: e.target.value, err: '' }),
      onKey: e => { if (e.key === 'Enter') this.signIn(); },
      pwType: s.show ? 'text' : 'password', pwIcon: s.show ? 'icon-eye-off' : 'icon-eye', pwToggleText: s.show ? 'Hide passwords' : 'Show passwords', togglePw: () => this.setState({ show: !s.show }),
      err: s.err, signIn: () => this.signIn(), forgot: s.forgot, toggleForgot: () => this.setState({ forgot: !s.forgot }), demos,
      firstName: u ? u.name.split(' ')[0] : '', np, cp: s.cp, onNp: e => this.setState({ np: e.target.value, err: '' }), onCp: e => this.setState({ cp: e.target.value, err: '' }),
      cpBorder: s.cp && !match ? '#fca5a5' : 'rgba(15,35,65,.14)',
      rules: rules.map(([label, ok]) => ({ label, icon: ok ? 'icon-circle-check' : 'icon-circle', color: ok ? '#15803d' : '#6b7280' })),
      strengthPct: (okCount / rules.length * 100) + '%', strengthColor: okCount <= 2 ? '#dc2626' : okCount <= 4 ? '#f2a516' : '#16a34a',
      saveBg: allOk && match ? '#15904c' : '#a3acb9', saveCursor: allOk && match ? 'pointer' : 'not-allowed',
      savePw: () => { if (!allOk) return this.setState({ err: 'Your new password needs to meet every rule.' }); if (!match) return this.setState({ err: "The passwords don't match." });
        const nu = { ...u, password: np, mustChange: false, status: 'Active' };
        try { localStorage.setItem(UKEY, JSON.stringify(users.map(x => x.id === u.id ? nu : x))); } catch (e) {}
        this.done(nu); },
      backToLogin: () => this.setState({ step: 'login', pw: '', user: null }),
    };
  }
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      <div style={{ minHeight: "100vh", display: "flex", background: "transparent", fontFamily: "Inter,system-ui,sans-serif", color: "#111827" }}>
        {(__v.showBrand) ? (<>
          <div style={{ flex: "1 1 50%", position: "relative", background: "#0d3b2a", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 48px", overflow: "hidden" }}>
            <div style={{
              position: "absolute",
              inset: "0",
              backgroundImage: "url('/assets/dvla-head-office.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center 35%",
              opacity: ".25",
              filter: "saturate(1.2)"
            }}></div>
            <div style={{ position: "absolute", inset: "0", background: "linear-gradient(160deg, rgba(13,59,42,0.9) 0%, rgba(15,64,44,0.82) 50%, rgba(9,38,27,0.94) 100%)" }}></div>
            <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
              <img src="/assets/dvla-logo.png" alt="DVLA" style={{ width: "38px", height: "38px", objectFit: "contain" }} />
              <span style={{ fontSize: "17px", fontWeight: "700" }}>Skill Matrix &amp; Assessment Platform</span>
            </div>
            <div style={{ position: "relative", maxWidth: "460px" }}>
              <div style={{ fontSize: "clamp(28px,3vw,40px)", fontWeight: "700", letterSpacing: "-0.6px", lineHeight: "1.15" }}>Know your skills.<br />Close the gaps.</div>
              <div style={{ fontSize: "15px", color: "#cfe6d8", marginTop: "14px", lineHeight: "1.6" }}>Timed assessments, manager evaluations and development plans in one place.</div>
            </div>
            <div style={{ position: "relative", fontSize: "12.5px", color: "#a9cdb9" }}>© 2026 Skill Matrix &amp; Assessment Platform</div>
          </div>
        </>) : null}
        <div style={{ flex: "1 1 50%", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(20px,4vw,48px) 16px" }}>
          <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "18px" }}>
            {(__v.isLogin) ? (<>
              <div>
                <h1 style={{ margin: "0", fontSize: "28px", fontWeight: "700", letterSpacing: "-0.4px" }}>Sign in</h1>
                <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "6px" }}>Use your username or work email</div>
              </div>
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
                <button onClick={__v.signIn} style={{ height: "46px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 15px Inter,sans-serif", cursor: "pointer" }}>Sign in</button>
                <button onClick={__v.toggleForgot} style={{ alignSelf: "center", background: "none", border: "0", cursor: "pointer", color: "#127a42", font: "500 13px Inter,sans-serif" }}>Forgot password?</button>
                {(__v.forgot) ? (<>
                  <div style={{ padding: "12px", borderRadius: "9px", background: "#e6f4ec", color: "#1e3a8a", fontSize: "13px", lineHeight: "1.5" }}>Ask your system administrator to reset your password. They'll give you a new temporary password, and you'll set your own the next time you sign in.</div>
                </>) : null}
              </div>
              <div style={{ border: "1px dashed rgba(15,35,65,.14)", borderRadius: "12px", padding: "12px 14px", fontSize: "12.5px", color: "#4b5563", display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".5px", color: "#9ca3af" }}>DEMO ACCOUNTS</span>
                {(__v.demos || []).map((d, $index) => (<React.Fragment key={$index}>
                  <button onClick={d?.fill} style={{ display: "flex", justifyContent: "space-between", gap: "10px", background: "none", border: "0", padding: "2px 0", cursor: "pointer", textAlign: "left", font: "400 12.5px Inter,sans-serif", color: "#374151" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{d?.user}</span>
                    <span style={{ color: "#6b7280" }}>{d?.note}</span>
                  </button>
                </React.Fragment>))}
              </div>
            </>) : null}
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
