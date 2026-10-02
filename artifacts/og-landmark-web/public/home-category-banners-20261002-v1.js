(() => {
  'use strict';

  const API_BANNERS_PATH = '/api/mobile/banners';
  const CATEGORY_INFO = {
    homes: {
      eyebrow: 'Find your place',
      title: 'Homes that feel like home',
      subtitle: 'Explore verified homes across Pakistan.',
      cta: 'Explore homes',
      queryCategory: 'Homes',
      propertyType: 'House',
    },
    commercial: {
      eyebrow: 'Make your next move',
      title: 'Commercial spaces with potential',
      subtitle: 'Discover shops, offices and commercial properties.',
      cta: 'Explore commercial',
      queryCategory: 'Commercial',
      propertyType: 'Commercial',
    },
    agriculture: {
      eyebrow: 'Room to grow',
      title: 'Agricultural land for tomorrow',
      subtitle: 'Find fertile land and investment opportunities.',
      cta: 'Explore land',
      queryCategory: 'Agriculture Land',
      propertyType: 'Agriculture Land',
    },
    plots: {
      eyebrow: 'Build what’s next',
      title: 'The right plot starts here',
      subtitle: 'Explore plots in the locations you love.',
      cta: 'Explore plots',
      queryCategory: 'Plots',
      propertyType: 'Plot',
    },
    projects: {
      eyebrow: 'A better way forward',
      title: 'Discover exceptional projects',
      subtitle: 'Explore thoughtfully selected developments.',
      cta: 'Explore projects',
      queryCategory: 'Projects',
      propertyType: 'Project',
    },
  };
  const CATEGORY_ORDER = ['homes', 'commercial', 'agriculture', 'plots', 'projects'];
  const fallbackImage = (category) => `/images/mobile-banners/${category}.jpg`;
  const fallbackSlides = CATEGORY_ORDER.map((category) => ({
    category,
    image: fallbackImage(category),
    ...CATEGORY_INFO[category],
  }));
  const ROOT_ID = 'og-home-category-banners';
  let mountedSection = null;
  let mountQueued = false;

  function normalizeCategory(value) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
    switch (normalized) {
      case 'home':
      case 'homes':
      case 'house':
      case 'houses':
        return 'homes';
      case 'commercial':
        return 'commercial';
      case 'agriculture':
      case 'agriculturalland':
        return 'agriculture';
      case 'plot':
      case 'plots':
        return 'plots';
      case 'project':
      case 'projects':
        return 'projects';
      default:
        return null;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function safeImageUrl(value, category) {
    if (!value) return fallbackImage(category);
    try {
      const url = new URL(String(value), window.location.origin);
      return ['http:', 'https:'].includes(url.protocol)
        ? url.href
        : fallbackImage(category);
    } catch {
      return fallbackImage(category);
    }
  }

  function mapApiBanner(banner) {
    if (!banner || !banner.active || banner.type !== 'image') return null;
    const category =
      normalizeCategory(banner.category) ||
      normalizeCategory(banner.ctaParams?.category) ||
      normalizeCategory(banner.ctaParams?.propertyType);
    if (!category) return null;

    const defaults = CATEGORY_INFO[category];
    return {
      category,
      image: safeImageUrl(banner.imageUrl, category),
      eyebrow: banner.eyebrow || defaults.eyebrow,
      title: banner.title || defaults.title,
      subtitle: banner.subtitle || defaults.subtitle,
      cta: banner.cta || defaults.cta,
      queryCategory: banner.ctaParams?.category || defaults.queryCategory,
      propertyType: banner.ctaParams?.propertyType || defaults.propertyType,
    };
  }

  function createSection() {
    const section = document.createElement('section');
    section.id = ROOT_ID;
    section.className = 'og-home-category-banners';
    section.setAttribute('aria-label', 'Explore property categories');
    section.innerHTML = `
      <div class="og-home-category-banners__inner">
        <div class="og-home-category-banners__viewport">
          <div
            class="og-home-category-banners__track"
            role="region"
            aria-label="Property category banners. Swipe or use the controls to browse."
            tabindex="0"
          ></div>
        </div>
        <div class="og-home-category-banners__pagination">
          <div class="og-home-category-banners__dots" aria-label="Choose a banner"></div>
          <span class="og-home-category-banners__label">DISCOVER</span>
        </div>
      </div>
    `;

    const track = section.querySelector('.og-home-category-banners__track');
    const dots = section.querySelector('.og-home-category-banners__dots');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let slides = fallbackSlides;
    let activeIndex = 0;
    let isPaused = false;
    let scrollFrame = 0;

    function updateActive(index, scroll) {
      if (slides.length === 0) return;
      activeIndex = (index + slides.length) % slides.length;
      const slideElements = track.querySelectorAll('.og-home-category-banners__slide');
      const dotElements = dots.querySelectorAll('.og-home-category-banners__dot');
      const countElements = track.querySelectorAll('.og-home-category-banners__count');

      dotElements.forEach((dot, dotIndex) => {
        dot.setAttribute('aria-current', dotIndex === activeIndex ? 'true' : 'false');
      });
      countElements.forEach((count) => {
        count.innerHTML = `${String(activeIndex + 1).padStart(2, '0')}<span class="og-home-category-banners__count-divider"> / </span>${String(slides.length).padStart(2, '0')}`;
        count.setAttribute(
          'aria-label',
          `Slide ${activeIndex + 1} of ${slides.length}`,
        );
      });

      if (scroll && slideElements[activeIndex]) {
        track.scrollTo({
          left: slideElements[activeIndex].offsetLeft,
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
      }
    }

    function renderSlides() {
      track.innerHTML = slides.map((slide, index) => {
        const query = new URLSearchParams({
          type: slide.propertyType,
          category: slide.queryCategory,
        });
        const href = `/properties?${query.toString()}`;
        const paddedIndex = String(index + 1).padStart(2, '0');
        return `
          <article
            class="og-home-category-banners__slide"
            role="group"
            aria-roledescription="slide"
            aria-label="${paddedIndex} of ${String(slides.length).padStart(2, '0')}"
          >
            <img
              class="og-home-category-banners__image"
              src="${escapeHtml(slide.image)}"
              alt=""
              aria-hidden="true"
            />
            <div class="og-home-category-banners__shade" aria-hidden="true"></div>
            <div class="og-home-category-banners__topline">
              <div class="og-home-category-banners__eyebrow">
                <span class="og-home-category-banners__rule" aria-hidden="true"></span>
                <span>${escapeHtml(slide.eyebrow)}</span>
              </div>
              <span class="og-home-category-banners__count" aria-label="Slide ${paddedIndex} of ${String(slides.length).padStart(2, '0')}">
                ${paddedIndex}<span class="og-home-category-banners__count-divider"> / </span>${String(slides.length).padStart(2, '0')}
              </span>
            </div>
            <div class="og-home-category-banners__copy">
              <h2 class="og-home-category-banners__title">${escapeHtml(slide.title)}</h2>
              <p class="og-home-category-banners__subtitle">${escapeHtml(slide.subtitle)}</p>
              <a class="og-home-category-banners__cta" href="${escapeHtml(href)}">
                <span>${escapeHtml(slide.cta)}</span>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 17 17 7M7 7h10v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
              </a>
            </div>
          </article>
        `;
      }).join('');

      dots.innerHTML = slides.map((slide, index) => `
        <button
          class="og-home-category-banners__dot"
          type="button"
          aria-label="Show ${escapeHtml(slide.eyebrow)} banner"
          aria-current="${index === 0 ? 'true' : 'false'}"
          data-banner-index="${index}"
        >
          <span class="og-home-category-banners__dot-mark" aria-hidden="true"></span>
        </button>
      `).join('');

      track.querySelectorAll('.og-home-category-banners__image').forEach((image, index) => {
        image.addEventListener('error', () => {
          const category = slides[index]?.category;
          const replacement = category ? fallbackImage(category) : '';
          if (replacement && !image.src.endsWith(replacement)) image.src = replacement;
        }, { once: true });
      });

      activeIndex = 0;
      updateActive(0, false);
      track.scrollLeft = 0;
    }

    dots.addEventListener('click', (event) => {
      const button = event.target.closest('[data-banner-index]');
      if (!button) return;
      updateActive(Number(button.dataset.bannerIndex), true);
    });

    track.addEventListener('scroll', () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        const width = track.clientWidth;
        if (!width) return;
        const nextIndex = Math.max(
          0,
          Math.min(slides.length - 1, Math.round(track.scrollLeft / width)),
        );
        updateActive(nextIndex, false);
      });
    }, { passive: true });

    section.addEventListener('mouseenter', () => { isPaused = true; });
    section.addEventListener('mouseleave', () => { isPaused = false; });
    section.addEventListener('focusin', () => { isPaused = true; });
    section.addEventListener('focusout', (event) => {
      if (!section.contains(event.relatedTarget)) isPaused = false;
    });

    renderSlides();

    const timer = window.setInterval(() => {
      if (
        !reduceMotion &&
        !isPaused &&
        !document.hidden &&
        section.isConnected &&
        slides.length > 1
      ) {
        updateActive(activeIndex + 1, true);
      }
    }, 5600);

    section.__ogHomeBannersCleanup = () => {
      window.clearInterval(timer);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    };

    fetch(API_BANNERS_PATH, { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!section.isConnected || !Array.isArray(data)) return;
        const liveSlides = data.map(mapApiBanner).filter(Boolean);
        if (liveSlides.length === 0) return;
        slides = liveSlides;
        renderSlides();
      })
      .catch(() => {
        // The bundled category slides are the same offline fallback used by mobile.
      });

    return section;
  }

  function syncCarousel() {
    const isHome = window.location.pathname === '/';
    if (!isHome) {
      if (mountedSection) {
        mountedSection.__ogHomeBannersCleanup?.();
        mountedSection.remove();
        mountedSection = null;
      }
      return;
    }

    if (mountedSection?.isConnected) return;
    if (mountedSection) {
      mountedSection.__ogHomeBannersCleanup?.();
      mountedSection = null;
    }
    if (document.getElementById(ROOT_ID)) return;

    const root = document.getElementById('root') || document.body;
    const heroHeading = root.querySelector('h1');
    const heroSection = heroHeading?.closest('section');
    if (!heroSection) return;

    mountedSection = createSection();
    heroSection.insertAdjacentElement('afterend', mountedSection);
  }

  function queueSync() {
    if (mountQueued) return;
    mountQueued = true;
    window.requestAnimationFrame(() => {
      mountQueued = false;
      syncCarousel();
    });
  }

  queueSync();
  if (document.body) {
    new MutationObserver(queueSync).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  window.addEventListener('popstate', queueSync);
})();