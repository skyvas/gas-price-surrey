/**
 * Gas Price Finder - Client Application
 * Surrey, Delta & White Rock, British Columbia
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
  const heroMapBtn = document.getElementById('heroMapBtn');

  // Filter Tabs
  const filterTabs = document.querySelectorAll('.filter-tab');
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
   * Get preferred Map navigation URL based on user device
   */
  function getPreferredMapUrl(station) {
    if (!station || !station.map_urls) {
      const q = encodeURIComponent(`${station.station_name}, ${station.address}, ${station.city}, BC`);
      return `https://www.google.com/maps/search/?api=1&query=${q}`;
    }

    if (isIOS) {
      // Direct Apple Maps link opens native Maps on iPhone
      return station.map_urls.apple_maps || station.map_urls.google_maps;
    } else if (isAndroid) {
      // Google Maps with query coordinates
      return station.map_urls.google_maps;
    }
    // Desktop and other platforms
    return station.map_urls.google_maps;
  }

  /**
   * Brand CSS slug generator
   */
  function getBrandSlug(name) {
    if (!name) return 'generic';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
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
      // Add cache buster when manually refreshing
      const cacheBuster = showSpin ? `?t=${Date.now()}` : '';
      const response = await fetch(`data/gas_prices.json${cacheBuster}`);
      if (!response.ok) {
        throw new Error(`Failed to load data (${response.status})`);
      }

      appData = await response.json();
      onDataLoaded();
    } catch (error) {
      console.error('Error fetching gas prices:', error);
      updateTimeText.textContent = 'Using cached prices';
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
    // Update status banner
    if (appData.metadata) {
      updateTimeText.textContent = formatRelativeTime(appData.metadata.last_updated_utc);
    }

    // Update city tab counts
    updateTabCounts();

    // Render source chips
    renderSources();

    // Render cards and hero
    render();
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
      chip.innerHTML = `${src.name} • <strong>${src.stations_found} stations</strong>`;
      sourcesList.appendChild(chip);
    });
  }

  /**
   * Filter stations according to active city and search text
   */
  function getFilteredStations() {
    let list = appData.stations || [];

    // Filter by city
    if (currentFilter.city !== 'all') {
      list = list.filter(s => s.city === currentFilter.city);
    }

    // Filter by search query
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      list = list.filter(s =>
        s.station_name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q)
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
      heroMapBtn.removeAttribute('href');
      heroMapBtn.style.pointerEvents = 'none';
      return;
    }

    cheapestCard.style.opacity = '1';
    heroMapBtn.style.pointerEvents = 'auto';

    // The top item in filtered list is the cheapest
    const topStation = filteredList[0];
    const maxPrice = filteredList[filteredList.length - 1].price;
    const priceDiff = Math.max(0, maxPrice - topStation.price).toFixed(1);

    // Dynamic Pill Text based on city filter
    if (currentFilter.city === 'all') {
      cheapestPillText.textContent = 'Lowest Price in Region';
    } else {
      cheapestPillText.textContent = `Lowest in ${currentFilter.city}`;
    }

    // Savings badge
    if (parseFloat(priceDiff) > 0) {
      cheapestSavingsBadge.style.display = 'inline-block';
      cheapestSavingsBadge.textContent = `Save up to ${priceDiff}¢/L`;
    } else {
      cheapestSavingsBadge.style.display = 'none';
    }

    // Station brand & details
    heroBrandIcon.textContent = topStation.station_name.charAt(0);
    heroBrandIcon.className = `brand-avatar ${getBrandSlug(topStation.station_name)}`;
    heroStationName.textContent = topStation.station_name;
    heroStationCity.textContent = `${topStation.city}, BC`;
    heroStationAddress.textContent = topStation.address;
    heroReportedText.textContent = topStation.last_updated || 'Recent';
    heroSource.textContent = topStation.source;

    // Price
    heroPrice.textContent = topStation.price.toFixed(1);
    heroPricePerLitre.textContent = `${topStation.price_per_litre} / Litre`;

    // Map CTA Link
    heroMapBtn.href = getPreferredMapUrl(topStation);
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

    filteredList.forEach((station, index) => {
      const isCheapest = (station.price === minPrice);
      const diff = (station.price - minPrice).toFixed(1);
      const brandSlug = getBrandSlug(station.station_name);
      const mapUrl = getPreferredMapUrl(station);

      const card = document.createElement('article');
      card.className = `station-card ${isCheapest ? 'is-top-pick' : ''}`;
      card.id = `station-${station.id}`;

      card.innerHTML = `
        <div class="card-top-row">
          <div class="station-details">
            <div class="brand-row">
              <span class="brand-badge ${brandSlug}">${station.station_name.charAt(0)}</span>
              <h3 class="station-title">${escapeHTML(station.station_name)}</h3>
              <span class="station-city-pill">${escapeHTML(station.city)}</span>
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
            <span>${escapeHTML(station.last_updated)}</span>
            <span>•</span>
            <span>${escapeHTML(station.source.split('(')[0].trim())}</span>
          </div>

          <a href="${mapUrl}" class="btn-open-maps" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHTML(station.station_name)} on ${escapeHTML(station.address)} in Maps">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
            <span>Open in Maps</span>
          </a>
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
    return str
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

    // Search Input
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
      clearSearchBtn.style.display = 'none';

      filterTabs.forEach(t => {
        const isAll = t.getAttribute('data-city') === 'all';
        t.classList.toggle('active', isAll);
        t.setAttribute('aria-selected', isAll ? 'true' : 'false');
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
