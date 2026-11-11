import './_group.css';

export function FeaturedOverlay() {
  return (
    <main className="latest-card-preview">
      <section className="latest-card-preview__content">
        <p className="latest-card-preview__label">Updated · Latest Properties</p>
        <article className="latest-card-preview__card">
          <div className="latest-card-preview__image">
            <img src="/__mockup/images/latest-property-preview.jpg" alt="Modern home with pool" />
            <span className="latest-card-preview__status">For Sale</span>
            <div className="latest-card-preview__actions">
              <span className="latest-card-preview__circle">↗</span>
              <span className="latest-card-preview__circle">♡</span>
            </div>
            <div className="latest-card-preview__bottom-overlay">
              <span className="latest-card-preview__featured latest-card-preview__featured--inline">★ FEATURED</span>
              <span className="latest-card-preview__video latest-card-preview__video--row">
                <span className="latest-card-preview__video-icon">▶</span>
                Video visit
              </span>
            </div>
          </div>
          <div className="latest-card-preview__detail">
            <p className="latest-card-preview__price">PKR 4,800,000</p>
            <p className="latest-card-preview__title">5 Marla House — Model Town</p>
            <p className="latest-card-preview__meta">Okara · 3 Beds · 2 Baths</p>
          </div>
        </article>
      </section>
    </main>
  );
}
