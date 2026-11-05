import './_group.css';
import { useEffect, useRef } from 'react';

export function Updated() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => {
      if (!stage.current) return;
      const scale = Math.min(window.innerWidth / 390, window.innerHeight / 844);
      stage.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <main className="updated">
      <div ref={stage} className="stage">
        <div className="scene">
          <svg className="orbit orbit-one" viewBox="0 0 400 400" aria-hidden="true">
            <circle cx="200" cy="200" r="190" fill="none" stroke="#FFFFFF" strokeOpacity=".07" />
            <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="90 1104">
              <circle cx="200" cy="200" r="190" stroke="#19C3B1" transform="rotate(-30 200 200)" />
              <circle cx="200" cy="200" r="190" stroke="#F2B84B" transform="rotate(90 200 200)" />
              <circle cx="200" cy="200" r="190" stroke="#7FE0D4" transform="rotate(210 200 200)" />
            </g>
          </svg>
          <svg className="orbit orbit-two" viewBox="0 0 400 400" aria-hidden="true">
            <circle cx="200" cy="200" r="150" fill="none" stroke="#FFFFFF" strokeOpacity=".09" />
            <g fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="70 872">
              <circle cx="200" cy="200" r="150" stroke="#F2B84B" transform="rotate(140 200 200)" />
              <circle cx="200" cy="200" r="150" stroke="#19C3B1" transform="rotate(260 200 200)" />
              <circle cx="200" cy="200" r="150" stroke="#FFFFFF" strokeOpacity=".8" transform="rotate(20 200 200)" />
            </g>
          </svg>
          <div className="halo" />
          <svg className="logo" viewBox="0 -8 220 160" role="img" aria-label="OG Landmark logo">
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#19C3B1" />
                <stop offset=".5" stopColor="#7FE0D4" />
                <stop offset="1" stopColor="#F2B84B" />
              </linearGradient>
            </defs>
            <g fill="none" stroke="url(#logo-gradient)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
              <circle className="draw-o" cx="70" cy="100" r="40" pathLength="100" strokeDasharray="100" />
              <path className="draw-g" d="M182.8 77.1 A40 40 0 1 0 190 100 L152 100" pathLength="100" strokeDasharray="100" />
            </g>
            <path className="draw-roof" d="M60 38 L110 5 L160 38" fill="none" stroke="#F2B84B" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" pathLength="100" strokeDasharray="100" />
          </svg>
          <div className="wordmark"><strong>OG</strong><span>LANDMARK</span></div>
          <div className="rule" />
          <div className="category">REAL ESTATE</div>
          <div className="track"><div className="bar" /></div>
          <div className="hint">Find your next landmark</div>
        </div>
      </div>
      <style>{`
        .updated {
          position: relative;
          width: 100%;
          height: 100vh;
          min-height: 500px;
          overflow: hidden;
          background: #06122A;
        }
        .stage {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 390px;
          height: 844px;
          transform-origin: center;
          background: radial-gradient(circle at 50% 38%, #1A4A7A 0%, #0B1F3A 58%, #06122A 100%);
          color: white;
          font-family: Inter, Arial, sans-serif;
        }
        .scene {
          position: absolute;
          inset: 0;
          opacity: 0;
          animation: scene 6s linear infinite;
        }
        .orbit {
          position: absolute;
          left: -5px;
          top: 130px;
          width: 400px;
          height: 400px;
        }
        .orbit-one { animation: spin 3s linear infinite; }
        .orbit-two { animation: spin 2s linear infinite reverse; }
        .halo {
          position: absolute;
          left: 85px;
          top: 220px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(25,195,177,.3), transparent 70%);
          animation: halo 6s cubic-bezier(.22,1,.36,1) infinite;
        }
        .logo {
          position: absolute;
          left: 65px;
          top: 236px;
          width: 260px;
          height: auto;
        }
        .draw-o, .draw-g, .draw-roof {
          stroke-dashoffset: 100;
          opacity: 0;
          animation-duration: 6s;
          animation-iteration-count: infinite;
          animation-fill-mode: both;
          animation-timing-function: cubic-bezier(.22,1,.36,1);
        }
        .draw-o { animation-name: draw-o; }
        .draw-g { animation-name: draw-g; }
        .draw-roof { animation-name: draw-roof; }
        .wordmark {
          position: absolute;
          left: 0; right: 0; top: 560px;
          display: flex; align-items: center; justify-content: center;
          gap: 14px;
          font-family: Sora, Inter, Arial, sans-serif;
          font-size: 27px;
          line-height: 1;
          white-space: nowrap;
        }
        .wordmark strong { color: #F2B84B; font-weight: 800; letter-spacing: .04em; animation: og-in 6s both infinite; }
        .wordmark span { color: white; font-weight: 600; letter-spacing: .2em; animation: landmark-in 6s both infinite; }
        .rule {
          position: absolute; left: 135px; top: 614px;
          width: 120px; height: 2px; border-radius: 1px;
          background: linear-gradient(90deg, transparent, #19C3B1, #F2B84B, transparent);
          animation: rule-in 6s both infinite;
        }
        .category {
          position: absolute; left: 0; right: 0; top: 632px;
          text-align: center; padding-left: .5em;
          font-size: 11px; letter-spacing: .5em; font-weight: 600; color: #9FB3CC;
          animation: tag-in 6s both infinite;
        }
        .track {
          position: absolute; left: 135px; top: 738px;
          width: 120px; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,.15); overflow: hidden;
          animation: fade-in 6s both infinite;
        }
        .bar {
          width: 100%; height: 100%;
          transform-origin: left center;
          background: linear-gradient(90deg, #19C3B1, #F2B84B);
          animation: bar-in 6s both infinite;
        }
        .hint {
          position: absolute; left: 0; right: 0; top: 760px;
          text-align: center; font-size: 12px; letter-spacing: .08em; color: #9FB3CC;
          animation: hint-in 6s both infinite;
        }
        @keyframes scene { 0% {opacity:0} 3% {opacity:1} 92% {opacity:1} 98%,100% {opacity:0} }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes draw-o { 0%,5% {stroke-dashoffset:100;opacity:0} 5.1% {stroke-dashoffset:100;opacity:1} 25%,100% {stroke-dashoffset:0;opacity:1} }
        @keyframes draw-g { 0%,12% {stroke-dashoffset:100;opacity:0} 12.1% {stroke-dashoffset:100;opacity:1} 32%,100% {stroke-dashoffset:0;opacity:1} }
        @keyframes draw-roof { 0%,32% {stroke-dashoffset:100;opacity:0;transform:translateY(-8px)} 32.1% {stroke-dashoffset:100;opacity:1;transform:translateY(-8px)} 43%,100% {stroke-dashoffset:0;opacity:1;transform:translateY(0)} }
        @keyframes halo { 0%,25% {opacity:0;transform:scale(.6)} 45% {opacity:1;transform:scale(1)} 100% {opacity:.7;transform:scale(1.1)} }
        @keyframes og-in { 0%,43% {opacity:0;transform:translateY(12px)} 53%,100% {opacity:1;transform:none} }
        @keyframes landmark-in { 0%,45% {opacity:0;letter-spacing:.46em;transform:translateY(12px)} 63%,100% {opacity:1;letter-spacing:.2em;transform:none} }
        @keyframes rule-in { 0%,56% {opacity:0;transform:scaleX(0)} 68%,100% {opacity:1;transform:scaleX(1)} }
        @keyframes tag-in { 0%,63% {opacity:0;transform:translateY(6px)} 74%,100% {opacity:1;transform:none} }
        @keyframes fade-in { 0%,6% {opacity:0} 14%,100% {opacity:1} }
        @keyframes bar-in { 0%,10% {transform:scaleX(0)} 87%,100% {transform:scaleX(1)} }
        @keyframes hint-in { 0%,73% {opacity:0} 84%,100% {opacity:1} }
        @media (prefers-reduced-motion: reduce) { .scene, .scene * { animation: none !important; opacity: 1 !important; } }
      `}</style>
    </main>
  );
}
