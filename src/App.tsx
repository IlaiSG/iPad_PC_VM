import { useEffect, useState, FormEvent } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { CircleHelp, Monitor, Power, RefreshCw, ShieldCheck, Wifi, ArrowLeft, Mail, LockKeyhole, LogOut, MousePointer2 } from "lucide-react";

type Stage = "email" | "code";

function apiError(data: any, status: number, fallback: string): string {
  const candidate = data?.error;
  if (typeof candidate === "string" && candidate.trim()) return candidate;
  if (candidate && typeof candidate === "object") {
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
    if (typeof candidate.error_description === "string" && candidate.error_description.trim()) return candidate.error_description;
  }
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  return `${fallback} (HTTP ${status})`;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passkeySetup, setPasskeySetup] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const lockWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        setAuthenticated(false);
        setPasskeySetup(false);
        setStage("email");
        setCode("");
        setMessage("");
        setError("");
      }
    };
    document.addEventListener("visibilitychange", lockWhenHidden);
    return () => document.removeEventListener("visibilitychange", lockWhenHidden);
  }, []);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setEmail(cleanEmail);
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(new URL("/api/auth/send-code", window.location.origin), {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, response.status, "Unable to request a code."));
      setStage("code");
      setMessage(data.message || "If the address is authorised, a code will be sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(new URL("/api/auth/verify-code", window.location.origin), {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, response.status, "The code could not be verified."));
      setAuthenticated(true);
      setPasskeySetup(!data.hasPasskey);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }


  async function signInWithPasskey() {
    setPasskeyBusy(true); setError(""); setMessage("");
    try {
      const optionsResponse = await fetch("/api/auth/passkey/options", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: "{}"
      });
      const options = await optionsResponse.json().catch(() => ({}));
      if (!optionsResponse.ok) throw new Error(apiError(options, optionsResponse.status, "Passkey sign-in is unavailable."));
      const credential = await startAuthentication({ optionsJSON: options });
      const response = await fetch("/api/auth/passkey/authenticate", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify(credential)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, response.status, "Passkey sign-in failed."));
      setAuthenticated(true);
      setPasskeySetup(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-in was cancelled or failed.");
    } finally { setPasskeyBusy(false); }
  }

  async function createPasskey() {
    setPasskeyBusy(true); setError(""); setMessage("");
    try {
      const optionsResponse = await fetch("/api/auth/passkey/register-options", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: "{}"
      });
      const options = await optionsResponse.json().catch(() => ({}));
      if (!optionsResponse.ok) throw new Error(apiError(options, optionsResponse.status, "Passkey setup is unavailable."));
      const credential = await startRegistration({ optionsJSON: options });
      const response = await fetch("/api/auth/passkey/register", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify(credential)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(data, response.status, "Passkey registration failed."));
      setPasskeySetup(false);
      setMessage("Passkey created. This device is now trusted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey registration was cancelled or failed.");
    } finally { setPasskeyBusy(false); }
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAuthenticated(false); setPasskeySetup(false); setStage("email"); setCode(""); setMessage(""); setError("");
    }
  }


  if (passkeySetup) {
    return (
      <main className="shell auth-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="VMConnect home"><MousePointer2 className="brand-mark" size={25} strokeWidth={1.9} /><span>VMConnect</span></a>
        </header>
        <section className="welcome auth-welcome">
          <p className="eyebrow">TRUST THIS DEVICE</p>
          <h1>Make it<br /><em>yours.</em></h1>
          <p className="intro">Your email is verified. Create a passkey on this device so you can sign in here securely next time.</p>
        </section>
        <section className="computer-card auth-card">
          <div className="auth-card-icon"><ShieldCheck size={21} /></div>
          <h2>Set up your passkey</h2>
          <p className="card-note">Use Face ID, Touch ID, or your device passcode when your device offers it. Your passkey's private key stays with your authenticator.</p>
          <button className="connect-button auth-submit" disabled={passkeyBusy} onClick={createPasskey} type="button">{passkeyBusy ? "Setting up…" : "Create passkey"}</button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </section>
        <p className="auth-footnote"><ShieldCheck size={14} /> New devices must verify by email before they can be trusted.</p>
        <footer><span>VMConnect <span className="version">0.1.0 · Preview</span></span><span className="footer-mark">Your PC, wherever you are.</span></footer>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="shell auth-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="VMConnect home">
            <MousePointer2 className="brand-mark" size={25} strokeWidth={1.9} />
            <span>VMConnect</span>
          </a>
          <button className="icon-button" aria-label="Help" title="Setup help"><CircleHelp size={19} /></button>
        </header>
        <section className="welcome auth-welcome">
          <p className="eyebrow">PRIVATE ACCESS</p>
          <h1>{stage === "email" ? <>Your PC,<br /><em>within reach.</em></> : <>Check your<br /><em>inbox.</em></>}</h1>
          <p className="intro">{stage === "email" ? "Sign in with the authorised email address for your private VMConnect account." : `Enter the six-digit verification code sent to ${email}.`}</p>
        </section>
        <section className="computer-card auth-card">
          <div className="auth-card-icon">{stage === "email" ? <Mail size={21} /> : <LockKeyhole size={21} />}</div>
          {stage === "email" ? (
            <>
            <button className="text-button" type="button" onClick={signInWithPasskey} disabled={passkeyBusy}>{passkeyBusy ? "Checking…" : "Sign in with a passkey"}</button>
            <form noValidate onSubmit={requestCode}>
              <label className="field-label" htmlFor="owner-email">Email address</label>
              <input id="owner-email" className="auth-input" type="text" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              <button className="connect-button auth-submit" disabled={busy || !email.trim()} type="submit">{busy ? "Sending…" : "Continue with email"}</button>
            </form>
            </>
          ) : (
            <form noValidate onSubmit={verifyCode}>
              <label className="field-label" htmlFor="verification-code">Verification code</label>
              <input id="verification-code" className="auth-input code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />
              <button className="connect-button auth-submit" disabled={busy || code.length !== 6} type="submit">{busy ? "Verifying…" : "Verify and sign in"}</button>
              <button className="text-button" type="button" onClick={() => { setStage("email"); setCode(""); setError(""); setMessage(""); }}><ArrowLeft size={14} /> Change email address</button>
            </form>
          )}
          {message && <p className="form-message">{message}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </section>
        <p className="auth-footnote"><ShieldCheck size={14} /> Access is restricted to your authorised email address.</p>
        <footer><span>VMConnect <span className="version">0.1.0 · Preview</span></span><span className="footer-mark">Your PC, wherever you are.</span></footer>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="VMConnect home"><MousePointer2 className="brand-mark" size={25} strokeWidth={1.9} /><span>VMConnect</span></a>
        <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={18} /></button>
      </header>
      <section className="welcome">
        <p className="eyebrow">YOUR PRIVATE PC</p>
        <h1>Your PC,<br /><em>wherever you are.</em></h1>
        <p className="intro">Connect to your Windows virtual machine, hosted securely on your own computer.</p>
      </section>
      <section className="computer-card" aria-labelledby="computer-title">
        <div className="card-topline">
          <div className="device-icon"><Monitor size={22} strokeWidth={1.7} /></div>
          <span className="status"><span className="status-dot" />Setup required</span>
        </div>
        <div className="computer-info"><h2 id="computer-title">Windows PC</h2><p>Windows virtual machine · Your computer</p></div>
        <button className="connect-button" disabled><Power size={17} /> Connect</button>
        <p className="card-note">Connection will be enabled once the host controller is installed and paired.</p>
      </section>
      <section className="details">
        <div className="detail-row"><div className="detail-icon"><ShieldCheck size={18} /></div><div><strong>Private by design</strong><span>Your computer is reached through your private network.</span></div></div>
        <div className="detail-row"><div className="detail-icon"><Wifi size={18} /></div><div><strong>On-demand startup</strong><span>Your virtual machine starts only when you request it.</span></div></div>
        <div className="detail-row"><div className="detail-icon"><RefreshCw size={18} /></div><div><strong>Reconnect any time</strong><span>Disconnecting will not shut down your Windows session.</span></div></div>
      </section>
      <footer><span>VMConnect <span className="version">0.1.0 · Preview</span></span><span className="footer-mark">Your PC, wherever you are.</span></footer>
    </main>
  );
}
