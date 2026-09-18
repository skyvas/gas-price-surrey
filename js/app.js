/**
 * Gas Price Finder - Client Application
 * Surrey, Delta & White Rock, British Columbia
 * Multi-Brand Search & Official Websites Directory
 */

(function () {
  'use strict';

  // Application State
  let appData = {
    metadata: null,
    cheapest_by_city: {},
    stations: []
  };

  let currentFilter = {
    city: 'all',
    brand: 'all',
    search: ''
  };

  // DOM Elements
  const updateTimeText = document.getElementById('updateTimeText');
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshIcon = document.getElementById('refreshIcon');
  const stationSearchInput = document.getElementById('stationSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const stationsList = document.getElementById('stationsList');
  const emptyState = document.getElementById('emptyState');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const showingCountText = document.getElementById('showingCountText');
  const sourcesList = document.getElementById('sourcesList');

  // Live Stats Elements
  const statLiveCount = document.getElementById('statLiveCount');

  // Hero Card Elements
  const cheapestCard = document.getElementById('cheapestCard');
  const cheapestPillText = document.getElementById('cheapestPillText');
  const cheapestSavingsBadge = document.getElementById('cheapestSavingsBadge');
  const heroBrandIcon = document.getElementById('heroBrandIcon');
  const heroStationName = document.getElementById('heroStationName');
  const heroStationCity = document.getElementById('heroStationCity');
  const heroStationAddress = document.getElementById('heroStationAddress');
  const heroReportedText = document.getElementById('heroReportedText');
  const heroSource = document.getElementById('heroSource');
  const heroPrice = document.getElementById('heroPrice');
  const heroPricePerLitre = document.getElementById('heroPricePerLitre');
  const heroGoogleMapBtn = document.getElementById('heroGoogleMapBtn');
  const heroAppleMapBtn = document.getElementById('heroAppleMapBtn');

  // Filter Tabs & Brand Pills
  const filterTabs = document.querySelectorAll('.filter-tab');
  const brandPills = document.querySelectorAll('.brand-pill');
  const countAll = document.getElementById('countAll');
  const countSurrey = document.getElementById('countSurrey');
  const countDelta = document.getElementById('countDelta');
  const countWhiteRock = document.getElementById('countWhiteRock');

  /**
   * Device and platform detection for Maps navigation
   */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(navigator.userAgent);

  /**
   * Get direct Google Maps Directions URL anchored to exact address
   */
  function getGoogleMapsUrl(station) {
    if (!station) return '#';
    const dest = `${station.station_name || station.brand}, ${station.address}, ${station.city}, BC`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  }

  /**
   * Get direct Apple Maps Directions URL anchored to exact address
   */
  function getAppleMapsUrl(station) {
    if (!station) return '#';
    const dest = `${station.station_name || station.brand}, ${station.address}, ${station.city}, BC`;
    return `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}&dirflg=d`;
  }

  /**
   * Brand CSS slug generator
   */
  function getBrandSlug(name) {
    if (!name) return 'generic';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  }

  /**
   * Return high-quality inline SVG logo for each brand
   */
  function getBrandLogoSvg(brandName, brandSlug) {
    const slug = brandSlug || getBrandSlug(brandName);

    if (slug.includes('shell')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Shell Logo">
        <rect width="32" height="32" rx="6" fill="#DD1D21"/>
        <path d="M16 5.5C12.5 5.5 8 9.5 7.5 15.5C7.2 19 9 22.2 11.5 24L12.8 25.5H19.2L20.5 24C23 22.2 24.8 19 24.5 15.5C24 9.5 19.5 5.5 16 5.5Z" fill="#FBCE07"/>
        <path d="M16 6.5V25M12.5 8C13.5 13 13 20 13.8 25M19.5 8C18.5 13 19 20 18.2 25M9.5 11C11.5 15 13 21 14.5 25M22.5 11C20.5 15 19 21 17.5 25" stroke="#DD1D21" stroke-width="0.8" stroke-linecap="round"/>
      </svg>`;
    }

    if (slug.includes('chevron')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Chevron Logo">
        <rect width="32" height="32" rx="6" fill="#FFFFFF"/>
        <path d="M7 8.5L16 14.5L25 8.5V13.5L16 19.5L7 13.5V8.5Z" fill="#005DAA"/>
        <path d="M7 15L16 21L25 15V20L16 26L7 20V15Z" fill="#ED1C24"/>
      </svg>`;
    }

    if (slug.includes('petro-canada') || slug.includes('petro')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Petro-Canada Logo">
        <rect width="32" height="32" rx="6" fill="#D9262E"/>
        <rect x="5" y="5" width="22" height="22" rx="4" fill="#FFFFFF"/>
        <path d="M16 8L17.5 12H19.5L18 13.5L19.8 15.2L18.2 15.8L19.2 18.5L17.2 17.8L16.6 21.5H15.4L14.8 17.8L12.8 18.5L13.8 15.8L12.2 15.2L14 13.5L12.5 12H14.5L16 8Z" fill="#D9262E"/>
        <rect x="23.5" y="7" width="2" height="18" fill="#D9262E"/>
      </svg>`;
    }

    if (slug.includes('esso')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Esso Logo">
        <rect width="32" height="32" rx="6" fill="#0C2340"/>
        <ellipse cx="16" cy="16" rx="14" ry="10.5" fill="#FFFFFF" stroke="#D9262E" stroke-width="2"/>
        <text x="16" y="20" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="11" fill="#003399" text-anchor="middle" letter-spacing="-0.5">Esso</text>
      </svg>`;
    }

    if (slug.includes('mobil')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Mobil Logo">
        <rect width="32" height="32" rx="6" fill="#FFFFFF"/>
        <text x="16" y="21" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="10.5" fill="#003399" text-anchor="middle" letter-spacing="-0.3">M<tspan fill="#DC2626">o</tspan>bil</text>
      </svg>`;
    }

    if (slug.includes('centex')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Centex Logo">
        <rect width="32" height="32" rx="6" fill="#15803D"/>
        <circle cx="16" cy="16" rx="11" fill="#16A34A"/>
        <path d="M19.5 11.5C18.2 10.5 16.5 10 14.5 10C10.5 10 7.5 13 7.5 17C7.5 21 10.5 24 14.5 24C16.8 24 18.8 23 20 21.5L17.5 19.5C16.8 20.3 15.8 20.8 14.5 20.8C12.4 20.8 10.8 19.2 10.8 17C10.8 14.8 12.4 13.2 14.5 13.2C15.6 13.2 16.5 13.6 17.2 14.2L19.5 11.5Z" fill="#FFFFFF"/>
        <path d="M19 13C21 14.5 22 17 21.5 19.5C21 17.5 20.5 16 19 14.5V13Z" fill="#FACC15"/>
      </svg>`;
    }

    if (slug.includes('canco')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Canco Logo">
        <rect width="32" height="32" rx="6" fill="#0284C7"/>
        <circle cx="16" cy="16" r="10" fill="#0369A1"/>
        <path d="M16 8L22 13V18C22 21.5 19.5 24 16 25C12.5 24 10 21.5 10 18V13L16 8Z" fill="#FFFFFF"/>
        <text x="16" y="19" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="7.5" fill="#0284C7" text-anchor="middle">CANCO</text>
      </svg>`;
    }

    if (slug.includes('super-save') || slug.includes('supersave')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Super Save Logo">
        <rect width="32" height="32" rx="6" fill="#EAB308"/>
        <ellipse cx="16" cy="16" rx="13" ry="10" fill="#1E3A8A"/>
        <text x="16" y="17" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="6.5" fill="#FACC15" text-anchor="middle" letter-spacing="0.2">SUPER</text>
        <text x="16" y="22" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="5" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">SAVE</text>
      </svg>`;
    }

    if (slug.includes('domo')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Domo Logo">
        <rect width="32" height="32" rx="6" fill="#DC2626"/>
        <circle cx="16" cy="16" r="11" fill="#991B1B"/>
        <text x="16" y="20" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-style="italic" font-size="8.5" fill="#FFFFFF" text-anchor="middle">DOMO</text>
      </svg>`;
    }

    if (slug.includes('wesco')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Wesco Logo">
        <rect width="32" height="32" rx="6" fill="#EA580C"/>
        <text x="16" y="20.5" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="8" fill="#FFFFFF" text-anchor="middle">WESCO</text>
      </svg>`;
    }

    // Default Gas Station Icon
    return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Fuel Pump">
      <rect width="32" height="32" rx="6" fill="#1F2937"/>
      <path d="M10 9H18V24H10V9Z" fill="#374151" stroke="#9CA3AF" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 12H16V15H12V12Z" fill="#10B981"/>
      <path d="M18 13H20C21.1 13 22 13.9 22 15V21C22 22.1 21.1 23 20 23V23" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="21" cy="11" r="1.5" fill="#9CA3AF"/>
    </svg>`;
  }

  /**
   * Format relative time from ISO timestamp
   */
  function formatRelativeTime(isoString) {
    if (!isoString) return 'Just now';
    try {
      const updateDate = new Date(isoString);
      const now = new Date();
      const diffMs = now - updateDate;
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 1) return 'Updated just now';
      if (diffMins === 1) return 'Updated 1 min ago';
      if (diffMins < 60) return `Updated ${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) return 'Updated 1 hour ago';
      if (diffHours < 24) return `Updated ${diffHours} hours ago`;
      return `Updated on ${updateDate.toLocaleDateString()}`;
    } catch (e) {
      return 'Recently updated';
    }
  }

  /**
   * Fetch latest price data from data/gas_prices.json
   */
  async function loadGasPrices(showSpin = false) {
    if (showSpin) {
      refreshBtn.classList.add('spinning');
    }

    try {
      const cacheBuster = showSpin ? `?t=${Date.now()}` : '';
      const response = await fetch(`data/gas_prices.json${cacheBuster}`);
      if (!response.ok) {
        throw new Error(`Failed to load data (${response.status})`);
      }

      appData = await response.json();
      onDataLoaded();
    } catch (error) {
      console.error('Error fetching gas prices:', error);
      updateTimeText.textContent = 'Using cached directory';
      if (appData.stations && appData.stations.length > 0) {
        render();
      }
    } finally {
      if (showSpin) {
        setTimeout(() => {
          refreshBtn.classList.remove('spinning');
        }, 500);
      }
    }
  }

  /**
   * Process loaded data and refresh UI
   */
  function onDataLoaded() {
    if (appData.metadata) {
      updateTimeText.textContent = formatRelativeTime(appData.metadata.last_updated_utc);
      updateLiveStats();
    }

    updateTabCounts();
    renderSources();
    render();
  }

  /**
   * Update live stations count in header strip
   */
  function updateLiveStats() {
    if (statLiveCount) {
      statLiveCount.textContent = appData.stations ? appData.stations.length : 0;
    }
  }

  /**
   * Update numbers inside city tabs
   */
  function updateTabCounts() {
    const stations = appData.stations || [];
    countAll.textContent = stations.length;

    const surreyCount = stations.filter(s => s.city === 'Surrey').length;
    countSurrey.textContent = surreyCount;

    const deltaCount = stations.filter(s => s.city === 'Delta').length;
    countDelta.textContent = deltaCount;

    const whiteRockCount = stations.filter(s => s.city === 'White Rock').length;
    countWhiteRock.textContent = whiteRockCount;
  }

  /**
   * Render sources list in bottom transparency card
   */
  function renderSources() {
    if (!appData.metadata || !appData.metadata.sources) return;
    sourcesList.innerHTML = '';

    appData.metadata.sources.forEach(src => {
      const chip = document.createElement('a');
      chip.className = 'source-chip';
      chip.href = src.url;
      chip.target = '_blank';
      chip.rel = 'noopener noreferrer';
      
      let label = src.name;
      if (src.status && src.status.includes('active')) {
        label += ' • Active';
      }
      if (src.stations_reported !== undefined && src.stations_reported > 0) {
        label += ` (${src.stations_reported} live)`;
      }

      chip.textContent = label;
      sourcesList.appendChild(chip);
    });
  }

  /**
   * Filter stations according to active city, brand, truth tier, and multi-field search
   */
  function getFilteredStations() {
    let list = appData.stations || [];

    // Filter by city
    if (currentFilter.city !== 'all') {
      list = list.filter(s => s.city === currentFilter.city);
    }

    // Filter by brand
    if (currentFilter.brand !== 'all') {
      const b = currentFilter.brand.toLowerCase();
      list = list.filter(s => {
        const sBrand = (s.brand || s.station_name || '').toLowerCase();
        return sBrand.includes(b);
      });
    }


    // Filter by search query (brand, address, neighborhood, city, or source)
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      list = list.filter(s =>
        (s.station_name && s.station_name.toLowerCase().includes(q)) ||
        (s.brand && s.brand.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.neighborhood && s.neighborhood.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.source && s.source.toLowerCase().includes(q))
      );
    }

    // Always sort by price ascending (cheapest first)
    list.sort((a, b) => a.price - b.price);

    return list;
  }

  /**
   * Render Hero "Cheapest Gas" card
   */
  function renderHeroCard(filteredList) {
    if (!filteredList || filteredList.length === 0) {
      cheapestCard.style.opacity = '0.4';
      cheapestPillText.textContent = 'No Stations in Filter';
      heroStationName.textContent = 'None Available';
      heroStationAddress.textContent = 'Please adjust your filter.';
      heroPrice.textContent = '--.-';
      heroPricePerLitre.textContent = '$0.000 / Litre';
      if (heroGoogleMapBtn) {
        heroGoogleMapBtn.removeAttribute('href');
        heroGoogleMapBtn.style.pointerEvents = 'none';
      }
      if (heroAppleMapBtn) {
        heroAppleMapBtn.removeAttribute('href');
        heroAppleMapBtn.style.pointerEvents = 'none';
      }
      return;
    }

    cheapestCard.style.opacity = '1';
    if (heroGoogleMapBtn) heroGoogleMapBtn.style.pointerEvents = 'auto';
    if (heroAppleMapBtn) heroAppleMapBtn.style.pointerEvents = 'auto';

    const topStation = filteredList[0];
    const maxPrice = filteredList[filteredList.length - 1].price;
    const priceDiff = Math.max(0, maxPrice - topStation.price).toFixed(1);

    // Dynamic Pill Text based on active filters
    let pillText = 'Lowest Price in Region';
    if (currentFilter.brand !== 'all' && currentFilter.city !== 'all') {
      pillText = `Lowest ${currentFilter.brand} in ${currentFilter.city}`;
    } else if (currentFilter.brand !== 'all') {
      pillText = `Lowest ${currentFilter.brand} Price`;
    } else if (currentFilter.city !== 'all') {
      pillText = `Lowest in ${currentFilter.city}`;
    }
    cheapestPillText.textContent = pillText;

    // Savings badge & Truth Badge
    if (parseFloat(priceDiff) > 0) {
      cheapestSavingsBadge.style.display = 'inline-block';
      cheapestSavingsBadge.textContent = `Save up to ${priceDiff}¢/L`;
    } else {
      cheapestSavingsBadge.style.display = 'none';
    }

    // Station brand & details with logo
    const brandName = topStation.brand || topStation.station_name;
    const brandSlug = getBrandSlug(brandName);
    heroBrandIcon.innerHTML = getBrandLogoSvg(brandName, brandSlug);
    heroBrandIcon.className = `brand-avatar ${brandSlug}`;
    heroStationName.textContent = brandName;
    heroStationCity.textContent = `${topStation.neighborhood ? topStation.neighborhood + ' • ' : ''}${topStation.city}, BC`;
    heroStationAddress.textContent = topStation.address;
    heroReportedText.textContent = topStation.last_updated || 'Recent';
    heroSource.textContent = topStation.source || 'GasBuddy Live';

    // Price
    heroPrice.textContent = topStation.price.toFixed(1);
    heroPricePerLitre.textContent = `${topStation.price_per_litre} / Litre`;

    // Map CTA Links for Google Maps & Apple Maps
    if (heroGoogleMapBtn) heroGoogleMapBtn.href = getGoogleMapsUrl(topStation);
    if (heroAppleMapBtn) heroAppleMapBtn.href = getAppleMapsUrl(topStation);
  }

  /**
   * Render station list items
   */
  function renderStationList(filteredList) {
    stationsList.innerHTML = '';

    if (filteredList.length === 0) {
      emptyState.style.display = 'block';
      showingCountText.textContent = '0 stations';
      return;
    }

    emptyState.style.display = 'none';
    showingCountText.textContent = `Showing ${filteredList.length} of ${appData.stations.length} stations`;

    const minPrice = filteredList[0].price;

    filteredList.forEach((station) => {
      const isCheapest = (station.price === minPrice);
      const diff = (station.price - minPrice).toFixed(1);
      const brandName = station.brand || station.station_name;
      const brandSlug = getBrandSlug(brandName);
      const googleMapUrl = getGoogleMapsUrl(station);
      const appleMapUrl = getAppleMapsUrl(station);

      const liveBadgeHtml = `<span class="live-badge" title="Live driver report via GasBuddy">⚡ Live Report</span>`;

      const card = document.createElement('article');
      card.className = `station-card ${isCheapest ? 'is-top-pick' : ''}`;
      card.id = `station-${station.id}`;

      card.innerHTML = `
        <div class="card-top-row">
          <div class="station-details">
            <div class="brand-row">
              <span class="brand-badge ${brandSlug}">${getBrandLogoSvg(brandName, brandSlug)}</span>
              <h3 class="station-title">${escapeHTML(brandName)}</h3>
              <span class="station-city-pill">${escapeHTML(station.city)}</span>
              ${station.neighborhood ? `<span class="station-neighborhood-tag">${escapeHTML(station.neighborhood)}</span>` : ''}
            </div>
            <p class="station-card-address">${escapeHTML(station.address)}</p>
          </div>

          <div class="station-price-box">
            <div class="price-main">
              <span class="price-digits">${station.price.toFixed(1)}</span>
              <span class="price-symbol">¢</span>
            </div>
            <span class="price-diff-tag ${isCheapest ? 'cheapest' : ''}">
              ${isCheapest ? '★ Lowest price' : `+${diff}¢ / L`}
            </span>
          </div>
        </div>

        <div class="card-bottom-row">
          <div class="card-meta-left">
            ${liveBadgeHtml}
            <span class="meta-time">${escapeHTML(station.last_updated)}</span>
          </div>

          <div class="card-directions-actions">
            <a href="${googleMapUrl}" class="btn-map-action btn-google" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHTML(brandName)} in Google Maps" title="Open in Google Maps">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                <circle cx="12" cy="9" r="2.5"></circle>
              </svg>
              <span class="map-label-short">Google</span>
              <span class="map-label-full">Google Maps</span>
            </a>

            <a href="${appleMapUrl}" class="btn-map-action btn-apple" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHTML(brandName)} in Apple Maps" title="Open in Apple Maps">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
              </svg>
              <span class="map-label-short">Apple</span>
              <span class="map-label-full">Apple Maps</span>
            </a>
          </div>
        </div>
      `;

      stationsList.appendChild(card);
    });
  }

  /**
   * Helper to escape HTML characters
   */
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Main render dispatch
   */
  function render() {
    const filtered = getFilteredStations();
    renderHeroCard(filtered);
    renderStationList(filtered);
  }

  /**
   * Event Listeners Setup
   */
  function setupEvents() {
    // City Filter Tabs
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        currentFilter.city = tab.getAttribute('data-city');
        render();
      });
    });

    // Brand Filter Pills
    brandPills.forEach(pill => {
      pill.addEventListener('click', () => {
        brandPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        currentFilter.brand = pill.getAttribute('data-brand');
        render();
      });
    });

    // Search Input (supports brand, street, neighborhood, city, source)
    stationSearchInput.addEventListener('input', (e) => {
      currentFilter.search = e.target.value.trim();
      clearSearchBtn.style.display = currentFilter.search ? 'flex' : 'none';
      render();
    });

    // Clear Search Button
    clearSearchBtn.addEventListener('click', () => {
      stationSearchInput.value = '';
      currentFilter.search = '';
      clearSearchBtn.style.display = 'none';
      stationSearchInput.focus();
      render();
    });

    // Reset Filters Button
    resetFiltersBtn.addEventListener('click', () => {
      stationSearchInput.value = '';
      currentFilter.search = '';
      currentFilter.city = 'all';
      currentFilter.brand = 'all';
      clearSearchBtn.style.display = 'none';

      filterTabs.forEach(t => {
        const isAll = t.getAttribute('data-city') === 'all';
        t.classList.toggle('active', isAll);
        t.setAttribute('aria-selected', isAll ? 'true' : 'false');
      });

      brandPills.forEach(p => {
        const isAll = p.getAttribute('data-brand') === 'all';
        p.classList.toggle('active', isAll);
      });

      render();
    });

    // Manual Refresh Button
    refreshBtn.addEventListener('click', () => {
      loadGasPrices(true);
    });

    // Auto periodic refresh in browser every 5 minutes
    setInterval(() => {
      loadGasPrices(false);
    }, 5 * 60 * 1000);
  }

  // Initialize
  setupEvents();
  loadGasPrices(false);
})();
