import './_group.css';

export function Current() {
  return (
    <main className="mobile-brand-preview">
      <section className="mobile-brand-card">
        <p className="mobile-brand-kicker">OG Landmark · Mobile</p>
        <h1 className="mobile-brand-title">Shared button styles</h1>
        <p className="mobile-brand-description">
          Extracted from the shared mobile Button component. This is the current color mapping.
        </p>
        <div className="mobile-brand-section">
          <span className="mobile-brand-label">Primary action</span>
          <button className="mobile-brand-button mobile-brand-primary">Continue</button>
        </div>
        <div className="mobile-brand-section">
          <span className="mobile-brand-label">Secondary and quiet</span>
          <button className="mobile-brand-button mobile-brand-secondary">View details</button>
          <button className="mobile-brand-button mobile-brand-quiet">Maybe later</button>
        </div>
        <div className="mobile-brand-section">
          <span className="mobile-brand-label">Selected and destructive states</span>
          <div className="mobile-brand-selection"><span className="mobile-brand-dot" />Selected filter</div>
          <button className="mobile-brand-button mobile-brand-danger">Delete listing</button>
        </div>
      </section>
    </main>
  );
}
