import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import "./_group.css";

export function Polished() {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const verify = () => {
    setNotice("");
    if (code.length !== 6) {
      setError("Enter all six digits to continue.");
      return;
    }
    setError("");
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setError("We couldn’t verify that code. Check it and try again.");
    }, 950);
  };

  const resend = () => {
    if (loading) return;
    setError("");
    setNotice("A fresh code has been requested for your email.");
  };

  return (
    <main className="otp-polished">
      <style>{`
        .otp-polished, .otp-polished * { box-sizing: border-box; }
        .otp-polished {
          --ink: #0b1f3a;
          --teal: #168d84;
          --teal-pale: #e9f5f2;
          --gold: #d99e35;
          --paper: #faf9f5;
          --muted: #65717a;
          --line: #dce4e1;
          position: relative;
          display: flex;
          min-height: 844px;
          width: 100%;
          flex-direction: column;
          overflow: hidden;
          padding: 28px 24px 24px;
          color: var(--ink);
          background:
            radial-gradient(ellipse at 100% 0%, rgba(22,141,132,.09), transparent 36%),
            var(--paper);
          font-family: "DM Sans", "Avenir Next", sans-serif;
        }
        .otp-polished::before {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 5px;
          content: "";
          background: linear-gradient(90deg, var(--teal) 0 72%, var(--gold) 72% 100%);
        }
        .otp-polished__top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 42px;
        }
        .otp-polished__back {
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border: 1px solid #e3e9e5;
          border-radius: 14px;
          color: var(--ink);
          background: rgba(255,255,255,.72);
          cursor: pointer;
          transition: transform .18s ease, background .18s ease;
        }
        .otp-polished__back:hover { transform: translateX(-2px); background: white; }
        .otp-polished__step {
          color: #77827f;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.7px;
          text-transform: uppercase;
        }
        .otp-polished__brand {
          display: flex;
          align-items: center;
          flex-direction: column;
          margin: 27px auto 31px;
          animation: otp-rise .55s both;
        }
        .otp-polished__brand img { width: 68px; height: 68px; object-fit: contain; }
        .otp-polished__brand-name {
          margin-top: 6px;
          color: var(--ink);
          font-family: "Playfair Display", Georgia, serif;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: .15px;
        }
        .otp-polished__brand-sub {
          margin-top: 1px;
          color: var(--gold);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 2.9px;
        }
        .otp-polished__content {
          width: 100%;
          max-width: 430px;
          margin: 0 auto;
          animation: otp-rise .6s .08s both;
        }
        .otp-polished__eyebrow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-bottom: 12px;
          color: var(--teal);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }
        .otp-polished__title {
          margin: 0;
          color: var(--ink);
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(30px, 8vw, 35px);
          font-weight: 600;
          letter-spacing: -.65px;
          line-height: 1.12;
          text-align: center;
        }
        .otp-polished__intro {
          max-width: 320px;
          margin: 13px auto 0;
          color: #5d686d;
          font-size: 14px;
          line-height: 1.65;
          text-align: center;
        }
        .otp-polished__email {
          display: inline-block;
          color: var(--ink);
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .otp-polished__mail-card {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0 26px;
          padding: 13px 15px;
          border: 1px solid #dce9e4;
          border-radius: 16px;
          background: rgba(255,255,255,.72);
        }
        .otp-polished__mail-icon {
          display: grid;
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 12px;
          color: var(--teal);
          background: var(--teal-pale);
        }
        .otp-polished__mail-copy { min-width: 0; }
        .otp-polished__mail-title {
          margin: 0 0 3px;
          color: var(--ink);
          font-size: 12px;
          font-weight: 700;
        }
        .otp-polished__mail-address {
          margin: 0;
          color: #65717a;
          font-size: 12px;
          overflow-wrap: anywhere;
        }
        .otp-polished__field-label {
          display: block;
          margin-bottom: 11px;
          color: #606d71;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.3px;
          text-align: center;
        }
        .otp-polished__code-wrap {
          position: relative;
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          padding: 3px;
          border-radius: 14px;
          outline: 0;
        }
        .otp-polished__code-wrap:focus-within {
          box-shadow: 0 0 0 3px rgba(22,141,132,.13);
        }
        .otp-polished__digit {
          display: grid;
          height: 56px;
          place-items: center;
          border: 1px solid var(--line);
          border-radius: 12px;
          color: var(--ink);
          background: #fff;
          font-family: "DM Sans", sans-serif;
          font-size: 23px;
          font-weight: 700;
          transition: border-color .16s ease, background .16s ease, transform .16s ease;
        }
        .otp-polished__digit.is-active {
          border-color: var(--teal);
          background: #f5fbf9;
          transform: translateY(-1px);
        }
        .otp-polished__digit.is-filled { border-color: #a9d3ca; }
        .otp-polished__digit.is-error { border-color: #c45b54; background: #fff8f6; }
        .otp-polished__input {
          position: absolute;
          inset: 0;
          z-index: 2;
          width: 100%;
          height: 100%;
          opacity: .01;
          cursor: text;
        }
        .otp-polished__hint {
          margin: 11px 0 0;
          color: #75807f;
          font-size: 12px;
          text-align: center;
        }
        .otp-polished__error, .otp-polished__notice {
          margin: 12px 0 0;
          font-size: 12px;
          line-height: 1.45;
          text-align: center;
        }
        .otp-polished__error { color: #a6423d; }
        .otp-polished__notice { color: #14746d; }
        .otp-polished__verify {
          display: flex;
          width: 100%;
          height: 54px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: 25px;
          border: 0;
          border-radius: 15px;
          color: #fff;
          background: var(--ink);
          box-shadow: 0 8px 18px rgba(11,31,58,.12);
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
        }
        .otp-polished__verify:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #123554;
          box-shadow: 0 10px 20px rgba(11,31,58,.17);
        }
        .otp-polished__verify:disabled { opacity: .82; cursor: progress; }
        .otp-polished__spinner { animation: otp-spin 1s linear infinite; }
        .otp-polished__resend-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin-top: 20px;
          color: #737d7d;
          font-size: 13px;
        }
        .otp-polished__resend {
          padding: 5px 3px;
          border: 0;
          color: var(--teal);
          background: transparent;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .otp-polished__resend:hover { text-decoration: underline; text-underline-offset: 3px; }
        .otp-polished__resend:disabled { opacity: .55; cursor: not-allowed; }
        .otp-polished__footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin: auto auto 0;
          padding-top: 34px;
          color: #7a8584;
          font-size: 11px;
          letter-spacing: .1px;
        }
        .otp-polished__footer svg { color: var(--teal); }
        @keyframes otp-rise {
          from { opacity: 0; transform: translateY(9px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes otp-spin { to { transform: rotate(360deg); } }
        @media (max-width: 360px) {
          .otp-polished { min-height: 100dvh; padding: 22px 18px 20px; }
          .otp-polished__brand { margin: 19px auto 25px; }
          .otp-polished__mail-card { margin: 20px 0 22px; }
          .otp-polished__code-wrap { gap: 6px; }
          .otp-polished__digit { height: 50px; border-radius: 10px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .otp-polished *, .otp-polished *::before, .otp-polished *::after {
            animation-duration: .01ms !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <div className="otp-polished__top">
        <button className="otp-polished__back" type="button" aria-label="Go back">
          <ArrowLeft size={19} strokeWidth={1.8} />
        </button>
        <span className="otp-polished__step">Account setup</span>
      </div>

      <header className="otp-polished__brand">
        <img src="/__mockup/images/og-landmark-brand-mark-color.png" alt="OG Landmark logo" />
        <span className="otp-polished__brand-name">OG Landmark</span>
        <span className="otp-polished__brand-sub">REAL ESTATE</span>
      </header>

      <section className="otp-polished__content" aria-labelledby="polished-otp-title">
        <div className="otp-polished__eyebrow"><Mail size={14} strokeWidth={1.9} /> One last step</div>
        <h1 className="otp-polished__title" id="polished-otp-title">Verify your email</h1>
        <p className="otp-polished__intro">
          Enter the six-digit code we sent to{" "}
          <span className="otp-polished__email">ali.khan@example.com</span>.
          The code expires in 10 minutes.
        </p>

        <div className="otp-polished__mail-card" aria-hidden="true">
          <span className="otp-polished__mail-icon"><Mail size={18} strokeWidth={1.8} /></span>
          <div className="otp-polished__mail-copy">
            <p className="otp-polished__mail-title">Check your inbox</p>
            <p className="otp-polished__mail-address">ali.khan@example.com</p>
          </div>
        </div>

        <label className="otp-polished__field-label" htmlFor="polished-otp-code">VERIFICATION CODE</label>
        <div className="otp-polished__code-wrap">
          {Array.from({ length: 6 }, (_, index) => (
            <span
              className={[
                "otp-polished__digit",
                code[index] ? "is-filled" : "",
                focused && index === Math.min(code.length, 5) ? "is-active" : "",
                error ? "is-error" : "",
              ].filter(Boolean).join(" ")}
              aria-hidden="true"
              key={index}
            >
              {code[index] || ""}
            </span>
          ))}
          <input
            className="otp-polished__input"
            id="polished-otp-code"
            aria-label="Six-digit email verification code"
            aria-describedby="polished-otp-hint polished-otp-message"
            aria-invalid={Boolean(error)}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
              setNotice("");
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </div>
        <p className="otp-polished__hint" id="polished-otp-hint">Enter the code exactly as it appears in your email.</p>
        <div id="polished-otp-message" aria-live="polite" aria-atomic="true">
          {error && <p className="otp-polished__error" role="alert">{error}</p>}
          {notice && <p className="otp-polished__notice" role="status">{notice}</p>}
        </div>

        <button className="otp-polished__verify" type="button" onClick={verify} disabled={loading}>
          {loading ? <><LoaderCircle size={17} className="otp-polished__spinner" /> Verifying…</> : <>Verify email <ArrowRight size={17} /></>}
        </button>
        <div className="otp-polished__resend-row">
          <span>Didn’t receive a code?</span>
          <button className="otp-polished__resend" type="button" onClick={resend} disabled={loading}>Resend code</button>
        </div>
      </section>

      <footer className="otp-polished__footer">
        <ShieldCheck size={15} strokeWidth={1.7} />
        <span>Your details stay protected</span>
        <Check size={13} strokeWidth={2} />
      </footer>
    </main>
  );
}
