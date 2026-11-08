import './_group.css';

export function BrandGuide() {
  return (
    <main className="mobile-brand-preview">
      <section className="mobile-brand-card">
        <p className="mobile-brand-kicker">OG Landmark · Mobile</p>
        <h1 className="mobile-brand-title">Brand-guide mapping</h1>
        <p className="mobile-brand-description">
          Same shared button structure, with gold reserved for the primary action and teal for selection.
        </p>
        <div className="mobile-brand-section">
          <span className="mobile-brand-label">Primary action · gold with navy label</span>
          <button
            className="mobile-brand-button mobile-brand-primary"
            style={{ borderColor: '#C9A248', background: '#C9A248', color: '#0B1F3A' }}
          >
            Continue
          </button>
        </div>
        <div className="mobile-brand-section">
          <span className="mobile-brand-label">Secondary and quiet · navy labels</span>
          <button className="mobile-brand-button mobile-brand-secondary">View details</button>
          <button className="mobile-brand-button mobile-brand-quiet">Maybe later</button>
        </div>
        <div className="mobile-brand-section">
          <span className="mobile-brand-label">Teal selection · red destructive state</span>
          <div className="mobile-brand-selection"><span className="mobile-brand-dot" />Selected filter</div>
          <button className="mobile-brand-button mobile-brand-danger">Delete listing</button>
        </div>
      </section>
    </main>
  );
}
