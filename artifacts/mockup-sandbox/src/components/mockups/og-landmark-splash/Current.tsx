import './_group.css';

export function Current() {
  return (
    <main className="current">
      <div className="current-mark">
        <div className="current-ring current-ring-outer">
          <i className="dot dot-gold dot-top" />
          <i className="dot dot-teal dot-right" />
          <i className="dot dot-gold dot-bottom" />
          <i className="dot dot-teal dot-left" />
        </div>
        <div className="current-ring current-ring-inner">
          <i className="dot dot-teal dot-top" />
          <i className="dot dot-gold dot-right" />
          <i className="dot dot-teal dot-bottom" />
          <i className="dot dot-gold dot-left" />
        </div>
        <img src="/__mockup/images/og-landmark-brand-mark.png" alt="Current OG Landmark logo" />
      </div>
      <div className="current-brand">OG Landmark</div>
      <style>{`
        .current {
          position: relative;
          display: flex;
          min-height: 100vh;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #F5F4F0;
          color: #071428;
          font-family: Inter, Arial, sans-serif;
        }
        .current-mark {
          position: relative;
          width: min(76vw, 260px);
          aspect-ratio: 1;
          display: grid;
          place-items: center;
        }
        .current-ring {
          position: absolute;
          border: 1px solid #D9D5CC;
          border-radius: 50%;
          animation: orbit 8s linear infinite;
        }
        .current-ring-outer { inset: 4%; }
        .current-ring-inner { inset: 11%; animation-duration: 11s; animation-direction: reverse; }
        .current-mark img {
          width: 43%;
          height: 43%;
          object-fit: contain;
          position: relative;
        }
        .dot {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 999px;
        }
        .dot-gold { background: #C6A15D; }
        .dot-teal { background: #183B60; }
        .dot-top { top: -3px; left: calc(50% - 3px); }
        .dot-right { right: -3px; top: calc(50% - 3px); }
        .dot-bottom { bottom: -3px; left: calc(50% - 3px); }
        .dot-left { left: -3px; top: calc(50% - 3px); }
        .current-brand {
          position: absolute;
          top: calc(50% + 165px);
          width: 100%;
          text-align: center;
          font-family: "Playfair Display", Georgia, serif;
          font-size: 20px;
          letter-spacing: .4px;
        }
        @keyframes orbit { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .current-ring { animation: none; } }
      `}</style>
    </main>
  );
}
