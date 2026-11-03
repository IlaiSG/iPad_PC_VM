import { CircleHelp, Monitor, MousePointer2, Power, RefreshCw, ShieldCheck, Wifi } from "lucide-react";

export default function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="VMConnect home">
          <MousePointer2 className="brand-mark" size={25} strokeWidth={1.9} />
          <span>VMConnect</span>
        </a>
        <button className="icon-button" aria-label="Help" title="Setup help">
          <CircleHelp size={19} />
        </button>
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
        <div className="computer-info">
          <h2 id="computer-title">Windows PC</h2>
          <p>Windows virtual machine · Your computer</p>
        </div>
        <button className="connect-button" disabled>
          <Power size={17} /> Connect
        </button>
        <p className="card-note">Connection will be enabled once the host controller is installed and paired.</p>
      </section>

      <section className="details">
        <div className="detail-row">
          <div className="detail-icon"><ShieldCheck size={18} /></div>
          <div><strong>Private by design</strong><span>Your computer is reached through your private network.</span></div>
        </div>
        <div className="detail-row">
          <div className="detail-icon"><Wifi size={18} /></div>
          <div><strong>On-demand startup</strong><span>Your virtual machine starts only when you request it.</span></div>
        </div>
        <div className="detail-row">
          <div className="detail-icon"><RefreshCw size={18} /></div>
          <div><strong>Reconnect any time</strong><span>Disconnecting will not shut down your Windows session.</span></div>
        </div>
      </section>

      <footer>
        <span>VMConnect <span className="version">0.1.0 · Preview</span></span>
        <span className="footer-mark">Your PC, wherever you are.</span>
      </footer>
    </main>
  );
}