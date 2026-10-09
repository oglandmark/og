/* Editable source for listing-photo UI; keep it isolated from the legacy compiled admin bundle. */
(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.OGAdminListingMedia = api;
    if (root.document) api.mount(root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const PHOTO_HEADER = 'data-og-listing-photo-header';
  const PHOTO_CELL = 'data-og-listing-photo-cell';
  const REVIEW_BUTTON = 'data-og-listing-review';
  const LIST_PATH = /\/admin\/properties\/?$/;

  function resolveMediaUrl(value, siteOrigin) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const url = value.trim();
    if (/^(https?:|data:image\/)/i.test(url)) return url;
    if (url.startsWith('//')) return `https:${url}`;
    try {
      return new URL(url, siteOrigin).href;
    } catch {
      return '';
    }
  }

  function galleryImages(property) {
    if (!property || typeof property !== 'object') return [];
    const images = Array.isArray(property.images) ? property.images : [];
    const urls = images
      .map((image) => typeof image === 'string' ? image : image?.url)
      .filter((url) => typeof url === 'string' && url.trim())
      .map((url) => url.trim());
    const cover = typeof property.coverImage === 'string' ? property.coverImage.trim() : '';
    if (cover && !urls.includes(cover)) urls.push(cover);
    return [...new Set(urls)];
  }

  function propertyList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.properties)) return payload.properties;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function isPropertyListRequest(input) {
    const requestUrl = typeof input === 'string' ? input : input?.url;
    if (typeof requestUrl !== 'string') return false;
    try {
      return LIST_PATH.test(new URL(requestUrl, 'https://oglandmark.invalid').pathname);
    } catch {
      return false;
    }
  }

  function mount(windowRef) {
    const documentRef = windowRef.document;
    if (!documentRef || windowRef.__ogAdminListingMediaMounted) return;
    windowRef.__ogAdminListingMediaMounted = true;

    let properties = [];
    let modal;
    let observer;
    const originalFetch = windowRef.fetch.bind(windowRef);

    windowRef.fetch = function (input, init) {
      const result = originalFetch(input, init);
      if (!isPropertyListRequest(input) || !result || typeof result.then !== 'function') {
        return result;
      }
      return result.then((response) => {
        response.clone().json().then((payload) => {
          properties = propertyList(payload);
          scheduleEnhancement();
        }).catch(() => {});
        return response;
      });
    };

    function mediaSource(value) {
      return resolveMediaUrl(value, windowRef.location.origin);
    }

    function scheduleEnhancement() {
      windowRef.requestAnimationFrame(enhanceTables);
    }

    function matchingProperty(row, columns, columnOffset, usedIds) {
      const cellText = (index) => index >= 0
        ? row.cells[index + columnOffset]?.textContent?.trim() || ''
        : '';
      const titleCell = row.cells[columns.title + columnOffset];
      const title = titleCell?.querySelector('div')?.textContent?.trim()
        || titleCell?.textContent?.trim();
      if (!title) return null;

      const city = cellText(columns.city);
      const seller = cellText(columns.seller);
      const price = cellText(columns.price).replace(/[^\d]/g, '');
      const status = cellText(columns.status);
      const rowMatches = (property) => {
        if (String(property.title || 'Untitled') !== title) return false;
        if (city && property.city && String(property.city) !== city) return false;
        if (seller && property.sellerName && String(property.sellerName) !== seller) return false;
        const propertyPrice = property.price == null ? '' : String(property.price).replace(/[^\d]/g, '');
        if (price && propertyPrice && price !== propertyPrice) return false;
        const propertyStatus = property.approvalStatus || property.listingStatus || '';
        if (status && status !== '—' && propertyStatus && status !== propertyStatus) return false;
        return true;
      };

      const previousId = row.getAttribute('data-og-listing-id');
      const previous = previousId == null
        ? null
        : properties.find((property) => String(property.id) === previousId && rowMatches(property));
      if (previous) {
        usedIds.add(previousId);
        return previous;
      }

      const matched = properties.find((property) => {
        const id = String(property.id ?? `${property.title}:${property.city}:${property.sellerName}`);
        return !usedIds.has(id) && rowMatches(property);
      });
      if (matched) {
        const id = String(matched.id ?? `${matched.title}:${matched.city}:${matched.sellerName}`);
        row.setAttribute('data-og-listing-id', id);
        usedIds.add(id);
      }
      return matched || null;
    }

    function columnIndex(headers, label) {
      return headers.findIndex((header) => header.textContent.trim() === label);
    }

    function matchingColumns(headers) {
      return {
        title: columnIndex(headers, 'Title'),
        city: columnIndex(headers, 'City'),
        seller: columnIndex(headers, 'Seller'),
        price: columnIndex(headers, 'Price'),
        status: columnIndex(headers, 'Status'),
      };
    }

    function addPhotoHeader(table, titleIndex) {
      const headerRow = table.querySelector('thead tr');
      if (!headerRow || headerRow.querySelector(`[${PHOTO_HEADER}]`)) return;
      const photoHeader = documentRef.createElement('th');
      photoHeader.setAttribute(PHOTO_HEADER, '');
      photoHeader.className = 'text-left px-4 py-3 font-semibold';
      photoHeader.textContent = 'Photo';
      headerRow.insertBefore(photoHeader, headerRow.children[titleIndex] || null);
    }

    function makePhotoCell(property) {
      const cell = documentRef.createElement('td');
      cell.setAttribute(PHOTO_CELL, '');
      cell.className = 'px-4 py-3';

      const content = documentRef.createElement('div');
      content.className = 'og-listing-photo-content';
      const imageUrl = galleryImages(property)[0];
      if (imageUrl) {
        const image = documentRef.createElement('img');
        image.className = 'og-listing-thumbnail';
        image.src = mediaSource(imageUrl);
        image.alt = `${property.title || 'Listing'} photo`;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
          image.replaceWith(makePhotoPlaceholder('Photo unavailable'));
        }, { once: true });
        content.appendChild(image);
      } else {
        content.appendChild(makePhotoPlaceholder('No photo'));
      }

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'og-listing-review-button';
      button.setAttribute(REVIEW_BUTTON, '');
      button.addEventListener('click', () => openReview(property, button));
      content.appendChild(button);
      cell.appendChild(content);
      updatePhotoCell(cell, property);
      return cell;
    }

    function makePhotoPlaceholder(label) {
      const placeholder = documentRef.createElement('span');
      placeholder.className = 'og-listing-photo-placeholder';
      placeholder.textContent = label;
      return placeholder;
    }

    function updatePhotoCell(cell, property) {
      const photos = galleryImages(property);
      const imageUrl = photos[0];
      const existingImage = cell.querySelector('img.og-listing-thumbnail');
      const placeholder = cell.querySelector('.og-listing-photo-placeholder');

      if (imageUrl && !existingImage) {
        const image = documentRef.createElement('img');
        image.className = 'og-listing-thumbnail';
        image.src = mediaSource(imageUrl);
        image.alt = `${property.title || 'Listing'} photo`;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
          image.replaceWith(makePhotoPlaceholder('Photo unavailable'));
        }, { once: true });
        placeholder?.replaceWith(image);
      } else if (imageUrl && existingImage && existingImage.src !== mediaSource(imageUrl)) {
        existingImage.src = mediaSource(imageUrl);
      } else if (!imageUrl && !placeholder) {
        existingImage?.replaceWith(makePhotoPlaceholder('No photo'));
      }

      const button = cell.querySelector(`[${REVIEW_BUTTON}]`);
      const label = photos.length ? `Review photos (${photos.length})` : 'Review photos';
      if (button.textContent !== label) button.textContent = label;
      const ariaLabel = `Review photos for ${property.title || 'listing'}`;
      if (button.getAttribute('aria-label') !== ariaLabel) button.setAttribute('aria-label', ariaLabel);
      button.__ogListingProperty = property;
    }

    function enhanceTables() {
      const tables = [...documentRef.querySelectorAll('table')];
      for (const table of tables) {
        const headers = [...table.querySelectorAll('thead th')];
        const appHeaders = headers.filter((header) => !header.hasAttribute(PHOTO_HEADER));
        const columns = matchingColumns(appHeaders);
        const titleIndex = columns.title;
        if (titleIndex < 0) continue;

        addPhotoHeader(table, titleIndex);
        const usedIds = new Set();
        for (const row of table.querySelectorAll('tbody tr')) {
          if (!row.cells.length || row.querySelector('td[colspan]')) continue;
          const photoCell = row.querySelector(`[${PHOTO_CELL}]`);
          const columnOffset = photoCell ? 1 : 0;
          const property = matchingProperty(row, columns, columnOffset, usedIds);
          if (!property) continue;

          if (!photoCell) {
            const newPhotoCell = makePhotoCell(property);
            row.insertBefore(newPhotoCell, row.cells[titleIndex] || null);
          } else {
            updatePhotoCell(photoCell, property);
          }
        }
      }
    }

    function ensureModal() {
      if (modal) return modal;
      const style = documentRef.createElement('style');
      style.textContent = `
        .og-listing-review-backdrop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,14,24,.72)}
        .og-listing-review-dialog{width:min(920px,100%);max-height:min(88vh,900px);overflow:auto;border-radius:18px;background:#fff;box-shadow:0 24px 80px rgba(0,0,0,.28);font-family:DM Sans,system-ui,sans-serif;color:#0B1F3A}
        .og-listing-review-header{position:sticky;top:0;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px 24px;background:#fff;border-bottom:1px solid #e2e8f0}
        .og-listing-review-title{margin:0;font-size:20px;font-weight:700;line-height:1.3}
        .og-listing-review-subtitle{margin:5px 0 0;color:#64748b;font-size:13px}
        .og-listing-review-close{display:grid;place-items:center;width:36px;height:36px;flex:none;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#334155;font-size:22px;cursor:pointer}
        .og-listing-review-body{padding:22px 24px 26px}
        .og-listing-review-count{margin:0 0 14px;color:#64748b;font-size:13px}
        .og-listing-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
        .og-listing-gallery figure{margin:0;overflow:hidden;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}
        .og-listing-gallery img{display:block;width:100%;height:190px;object-fit:cover}
        .og-listing-gallery figcaption{padding:9px 11px;color:#64748b;font-size:12px}
        .og-listing-empty{padding:36px 20px;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;color:#64748b;text-align:center;font-size:14px}
        .og-listing-error{padding:24px;border-radius:12px;background:#fef2f2;color:#b91c1c;font-size:14px}
        .og-listing-photo-content{display:flex;min-width:130px;align-items:center;gap:9px}
        .og-listing-thumbnail{width:62px;height:48px;flex:none;object-fit:cover;border:1px solid #e2e8f0;border-radius:7px;background:#f1f5f9}
        .og-listing-photo-placeholder{display:grid;width:62px;height:48px;flex:none;place-items:center;padding:3px;border:1px dashed #cbd5e1;border-radius:7px;background:#f8fafc;color:#64748b;text-align:center;font-size:10px;line-height:1.2}
        .og-listing-review-button{padding:0;border:0;background:none;color:#0B1F3A;font:600 11px/1.4 DM Sans,system-ui,sans-serif;text-align:left;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
        .og-listing-review-button:hover{color:#9a7839}
        @media(max-width:600px){.og-listing-review-backdrop{padding:10px}.og-listing-review-header,.og-listing-review-body{padding:16px}.og-listing-gallery{grid-template-columns:1fr 1fr;gap:9px}.og-listing-gallery img{height:135px}}
      `;
      documentRef.head.appendChild(style);

      modal = documentRef.createElement('div');
      modal.className = 'og-listing-review-backdrop';
      modal.hidden = true;
      modal.innerHTML = `
        <section class="og-listing-review-dialog" role="dialog" aria-modal="true" aria-labelledby="og-listing-review-title">
          <header class="og-listing-review-header">
            <div><h2 id="og-listing-review-title" class="og-listing-review-title"></h2><p class="og-listing-review-subtitle"></p></div>
            <button type="button" class="og-listing-review-close" aria-label="Close photo review">&times;</button>
          </header>
          <div class="og-listing-review-body"><div class="og-listing-review-content"></div></div>
        </section>`;
      modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.closest('.og-listing-review-close')) closeReview();
      });
      documentRef.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) closeReview();
      });
      documentRef.body.appendChild(modal);
      return modal;
    }

    function closeReview() {
      if (!modal) return;
      modal.hidden = true;
      documentRef.body.style.overflow = '';
    }

    function showReviewContent(target, property) {
      const photos = galleryImages(property);
      target.replaceChildren();
      const count = documentRef.createElement('p');
      count.className = 'og-listing-review-count';
      count.textContent = photos.length === 1 ? '1 photo' : `${photos.length} photos`;
      target.appendChild(count);

      if (!photos.length) {
        const empty = documentRef.createElement('div');
        empty.className = 'og-listing-empty';
        empty.textContent = 'No photos have been added to this listing.';
        target.appendChild(empty);
        return;
      }

      const gallery = documentRef.createElement('div');
      gallery.className = 'og-listing-gallery';
      photos.forEach((photoUrl, index) => {
        const figure = documentRef.createElement('figure');
        const image = documentRef.createElement('img');
        image.src = mediaSource(photoUrl);
        image.alt = `${property.title || 'Listing'} photo ${index + 1}`;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
          image.replaceWith(makePhotoPlaceholder('Photo unavailable'));
        }, { once: true });
        const caption = documentRef.createElement('figcaption');
        caption.textContent = `Photo ${index + 1}`;
        figure.append(image, caption);
        gallery.appendChild(figure);
      });
      target.appendChild(gallery);
    }

    async function openReview(summary, trigger) {
      const dialog = ensureModal();
      const title = dialog.querySelector('.og-listing-review-title');
      const subtitle = dialog.querySelector('.og-listing-review-subtitle');
      const content = dialog.querySelector('.og-listing-review-content');
      const property = summary || trigger.__ogListingProperty || {};
      const dialogTrigger = trigger;
      dialog.hidden = false;
      documentRef.body.style.overflow = 'hidden';
      title.textContent = property.title || 'Listing photo review';
      subtitle.textContent = [property.city, property.approvalStatus || property.listingStatus]
        .filter(Boolean).join(' · ');
      content.replaceChildren();
      const loading = documentRef.createElement('div');
      loading.className = 'og-listing-empty';
      loading.textContent = 'Loading listing photos…';
      content.appendChild(loading);
      dialog.querySelector('.og-listing-review-close').focus();

      try {
        const base = String(windowRef.__OG_API_BASE__ || '/api').replace(/\/+$/, '');
        const token = windowRef.localStorage?.getItem('og_token');
        const headers = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const endpoint = `${base}/admin/properties/${encodeURIComponent(property.id)}/review`;
        const response = await originalFetch(endpoint, { headers });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || payload.message || `Could not load photos (${response.status}).`);
        }
        const fullProperty = payload.property || payload.data?.property || payload;
        title.textContent = fullProperty.title || property.title || 'Listing photo review';
        subtitle.textContent = [fullProperty.city, fullProperty.approvalStatus || fullProperty.listingStatus]
          .filter(Boolean).join(' · ');
        showReviewContent(content, fullProperty);
      } catch (error) {
        content.replaceChildren();
        const message = documentRef.createElement('div');
        message.className = 'og-listing-error';
        message.textContent = error instanceof Error ? error.message : 'Could not load listing photos.';
        content.appendChild(message);
      }

      if (!dialog.hidden) dialog.__ogLastTrigger = dialogTrigger;
    }

    function start() {
      ensureModal();
      observer = new windowRef.MutationObserver(scheduleEnhancement);
      observer.observe(documentRef.body, { childList: true, subtree: true });
      scheduleEnhancement();
    }

    if (documentRef.readyState === 'loading') {
      documentRef.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }

    return () => {
      observer?.disconnect();
      windowRef.fetch = originalFetch;
      modal?.remove();
      windowRef.__ogAdminListingMediaMounted = false;
    };
  }

  return {
    galleryImages,
    isPropertyListRequest,
    mount,
    propertyList,
    resolveMediaUrl,
  };
});
