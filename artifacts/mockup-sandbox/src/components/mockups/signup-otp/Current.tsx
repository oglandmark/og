import React from "react";
import { ChevronLeft } from "lucide-react";
import "./_group.css";

export function Current() {
  return (
    <main className="otp-current relative">
      <button className="otp-current__back" aria-label="Go back" type="button">
        <ChevronLeft size={26} strokeWidth={1.8} />
      </button>

      <header className="otp-current__brand">
        <img
          src="/__mockup/images/og-landmark-brand-mark-color.png"
          alt="OG Landmark logo"
        />
        <span className="otp-current__brand-name">OG Landmark</span>
        <span className="otp-current__brand-sub">REAL ESTATE</span>
      </header>

      <section className="otp-current__content" aria-labelledby="current-otp-title">
        <h1 className="otp-current__title" id="current-otp-title">Verify your email</h1>
        <p className="otp-current__instruction">
          Enter the six-digit code sent to ali.khan@example.com. The code expires in 10 minutes.
        </p>
        <label className="otp-current__label" htmlFor="current-otp-code">VERIFICATION CODE</label>
        <input
          className="otp-current__input"
          id="current-otp-code"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          readOnly
          value=""
        />
        <button className="otp-current__verify" type="button">Verify email</button>
        <button className="otp-current__resend" type="button">Resend code</button>
      </section>
    </main>
  );
}
