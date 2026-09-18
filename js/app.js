/**
 * Gas Price Finder - Client Application
 * Surrey Area, Vancouver & Burnaby, British Columbia
 * Multi-Brand Search, Multi-Octane Gasoline & User Configuration Persistence
 */

(function () {
  'use strict';

  // Region Configurations
  const REGION_CONFIGS = {
    surrey_area: {
      id: 'surrey_area',
      name: 'Surrey Area',
      subtitle: 'Surrey • Delta • White Rock, BC',
      heroPillPrefix: 'Lowest in Surrey Area',
      heading: 'Gas Stations in Surrey, Delta & White Rock',
      tabs: [
        { id: 'all', label: 'All Surrey Area', shortLabel: 'All' },
        { id: 'Surrey', label: 'Surrey' },
        { id: 'Delta', label: 'Delta' },
        { id: 'White Rock', label: 'White Rock' }
      ]
    },
    vancouver: {
      id: 'vancouver',
      name: 'Vancouver',
      subtitle: 'Vancouver • North Van • West Van, BC',
      heroPillPrefix: 'Lowest in Vancouver Area',
      heading: 'Gas Stations in Vancouver, North Van & West Van',
      tabs: [
        { id: 'all', label: 'All Vancouver', shortLabel: 'All' },
        { id: 'East Vancouver', label: 'East Vancouver' },
        { id: 'Downtown Vancouver', label: 'Downtown' },
        { id: 'North Vancouver', label: 'North Vancouver' },
        { id: 'West Vancouver', label: 'West Vancouver' }
      ]
    },
    burnaby: {
      id: 'burnaby',
      name: 'Burnaby',
      subtitle: 'Burnaby, BC',
      heroPillPrefix: 'Lowest in Burnaby',
      heading: 'Gas Stations in Burnaby',
      tabs: [
        { id: 'all', label: 'All Burnaby', shortLabel: 'All' },
        { id: 'North Burnaby', label: 'North Burnaby' },
        { id: 'Central Burnaby', label: 'Central / Canada Way' },
        { id: 'Metrotown', label: 'Metrotown / Kingsway' },
        { id: 'Brentwood', label: 'Brentwood / Willingdon' }
      ]
    },
    all_metro: {
      id: 'all_metro',
      name: 'All Metro Vancouver',
      subtitle: 'Metro Vancouver, BC',
      heroPillPrefix: 'Lowest in Metro Vancouver',
      heading: 'All Metro Vancouver Gas Stations',
      tabs: [
        { id: 'all', label: 'All Metro', shortLabel: 'All' },
        { id: 'surrey_area', label: 'Surrey Area' },
        { id: 'vancouver', label: 'Vancouver' },
        { id: 'burnaby', label: 'Burnaby' }
      ]
    }
  };

  // Fuel Octane Configurations
  const FUEL_CONFIGS = {
    regular: {
      id: 'regular',
      name: 'Regular',
      octane: 'Regular 87',
      badge: 'Regular Gas (87)',
      offset: 0
    },
    midgrade_89: {
      id: 'midgrade_89',
      name: 'Midgrade',
      octane: 'Midgrade 89',
      badge: 'Midgrade (89)',
      offset: 14.0
    },
    premium_91: {
      id: 'premium_91',
      name: 'Premium',
      octane: 'Premium 91',
      badge: 'Premium (91)',
      offset: 24.0
    },
    ultra_93: {
      id: 'ultra_93',
      name: 'Ultra / 94',
      octane: 'Ultra 93+',
      badge: 'Ultra (93+)',
      offset: 34.0
    }
  };

  // Storage Keys for Defaults
  const STORAGE_KEYS = {
    REGION: 'bc_gas_pref_region',
    FUEL: 'bc_gas_pref_fuel'
  };

  // Application State
  let appData = {
    metadata: null,
    cheapest_by_region: {},
    cheapest_by_city: {},
    stations: []
  };

  let currentFilter = {
    region: 'surrey_area', // Default: Surrey Area
    fuelType: 'regular',   // Default: Regular (87)
    city: 'all',
    brand: 'all',
    search: ''
  };

  // DOM Elements
  const regionSelect = document.getElementById('regionSelect');
  const fuelTypeSelect = document.getElementById('fuelTypeSelect');
  const saveDefaultBtn = document.getElementById('saveDefaultBtn');
  const saveBtnText = document.getElementById('saveBtnText');
  const saveToast = document.getElementById('saveToast');
  const saveToastText = document.getElementById('saveToastText');
  const headerSubtitle = document.getElementById('headerSubtitle');
  const updateTimeText = document.getElementById('updateTimeText');
  const fuelBadgeText = document.getElementById('fuelBadgeText');
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshIcon = document.getElementById('refreshIcon');
  const filterTabsContainer = document.getElementById('filterTabsContainer');
  const brandPills = document.querySelectorAll('.brand-pill');
  const stationSearchInput = document.getElementById('stationSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const stationListHeading = document.getElementById('stationListHeading');
  const showingCountText = document.getElementById('showingCountText');
  const stationsList = document.getElementById('stationsList');
  const emptyState = document.getElementById('emptyState');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
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
  const heroGoogleMapBtn = document.getElementById('heroGoogleMapBtn');
  const heroAppleMapBtn = document.getElementById('heroAppleMapBtn');

  /**
   * Device and platform detection for Maps navigation
   */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(navigator.userAgent);

  /**
   * Load saved user default preferences from localStorage
   */
  function loadSavedPreferences() {
    try {
      const savedRegion = localStorage.getItem(STORAGE_KEYS.REGION);
      const savedFuel = localStorage.getItem(STORAGE_KEYS.FUEL);

      if (savedRegion && REGION_CONFIGS[savedRegion]) {
        currentFilter.region = savedRegion;
        if (regionSelect) regionSelect.value = savedRegion;
      }
      if (savedFuel && FUEL_CONFIGS[savedFuel]) {
        currentFilter.fuelType = savedFuel;
        if (fuelTypeSelect) fuelTypeSelect.value = savedFuel;
      }
    } catch (e) {
      console.warn('Storage not accessible:', e);
    }
  }

  /**
   * Save the currently selected area and fuel type to localStorage
   */
  function saveCurrentAsDefault() {
    try {
      localStorage.setItem(STORAGE_KEYS.REGION, currentFilter.region);
      localStorage.setItem(STORAGE_KEYS.FUEL, currentFilter.fuelType);

      if (saveDefaultBtn) {
        saveDefaultBtn.classList.add('saved');
        if (saveBtnText) saveBtnText.textContent = 'Saved as Default ✓';
      }

      if (saveToast) {
        const regName = REGION_CONFIGS[currentFilter.region] ? REGION_CONFIGS[currentFilter.region].name : 'Area';
        const fuelName = FUEL_CONFIGS[currentFilter.fuelType] ? FUEL_CONFIGS[currentFilter.fuelType].octane : 'Fuel';
        if (saveToastText) {
          saveToastText.textContent = `Default saved: ${regName} • ${fuelName}`;
        }
        saveToast.style.display = 'flex';
        clearTimeout(saveToast._timeout);
        saveToast._timeout = setTimeout(() => {
          saveToast.style.display = 'none';
          if (saveDefaultBtn) {
            saveDefaultBtn.classList.remove('saved');
            if (saveBtnText) saveBtnText.textContent = 'Save as Default';
          }
        }, 2800);
      }
    } catch (e) {
      console.warn('Unable to save preferences to localStorage:', e);
    }
  }

  /**
   * Get price for station based on the active fuel type (octane)
   */
  function getStationPrice(station, fuelType = currentFilter.fuelType) {
    if (!station) return 0;
    if (station.prices && station.prices[fuelType] !== undefined) {
      return Number(station.prices[fuelType]);
    }
    const offset = (FUEL_CONFIGS[fuelType] && FUEL_CONFIGS[fuelType].offset) || 0;
    const base = Number(station.price) || 0;
    return Number((base + offset).toFixed(1));
  }

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

    if (slug.includes('smart-gas') || slug.includes('smartgas')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Smart Gas Logo">
        <rect width="32" height="32" rx="6" fill="#047857"/>
        <circle cx="16" cy="16" r="11" fill="#10B981"/>
        <path d="M16 8C13 12 11 14 11 17C11 19.8 13.2 22 16 22C18.8 22 21 19.8 21 17C21 14 19 12 16 8Z" fill="#FFFFFF"/>
        <text x="16" y="27" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="5" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">SMART</text>
      </svg>`;
    }

    if (slug.includes('co-op') || slug.includes('coop')) {
      return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Co-op Logo">
        <rect width="32" height="32" rx="6" fill="#DC2626"/>
        <rect x="5" y="5" width="22" height="22" rx="4" fill="#FFFFFF"/>
        <text x="16" y="20" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="8.5" fill="#DC2626" text-anchor="middle" letter-spacing="-0.2">CO-OP</text>
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
   * Crucial: refresh preserves currentFilter.region and currentFilter.fuelType exactly.
   */
  async function loadGasPrices(showSpin = false) {
    if (showSpin && refreshBtn) {
      refreshBtn.classList.add('spinning');
    }

    try {
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(`data/gas_prices.json${cacheBuster}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error(`Failed to load data (${response.status})`);
      }

      appData = await response.json();
      onDataLoaded();
    } catch (error) {
      console.error('Error fetching gas prices:', error);
      if (updateTimeText) updateTimeText.textContent = 'Using cached directory';
      if (appData.stations && appData.stations.length > 0) {
        render();
      }
    } finally {
      if (showSpin && refreshBtn) {
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
    if (appData.metadata && updateTimeText) {
      updateTimeText.textContent = formatRelativeTime(appData.metadata.last_updated_utc);
    }

    updateHeaderSubtitle();
    updateFuelBadge();
    renderFilterTabs();
    renderSources();
    render();
  }

  /**
   * Update fuel badge in status strip
   */
  function updateFuelBadge() {
    const activeFuel = FUEL_CONFIGS[currentFilter.fuelType] || FUEL_CONFIGS.regular;
    if (fuelBadgeText) {
      fuelBadgeText.textContent = activeFuel.badge;
    }
  }

  /**
   * Update header subtitle according to selected region
   */
  function updateHeaderSubtitle() {
    const regConfig = REGION_CONFIGS[currentFilter.region] || REGION_CONFIGS.surrey_area;
    if (headerSubtitle) {
      headerSubtitle.textContent = regConfig.subtitle;
    }
    if (stationListHeading) {
      stationListHeading.textContent = regConfig.heading;
    }
  }

  /**
   * Render sources list in bottom transparency card
   */
  function renderSources() {
    if (!appData.metadata || !appData.metadata.sources || !sourcesList) return;
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
   * Check if a station matches a specific tab identifier
   */
  function stationMatchesCityTab(station, tabId) {
    if (tabId === 'all') return true;

    // Direct matches
    if (station.city === tabId) return true;
    if (station.sub_area === tabId) return true;

    const tabLower = tabId.toLowerCase();
    const neighLower = (station.neighborhood || '').toLowerCase();
    const cityLower = (station.city || '').toLowerCase();

    if (tabLower === 'east vancouver') {
      return neighLower.includes('east vancouver') || 
             (cityLower === 'vancouver' && !neighLower.includes('downtown') && !neighLower.includes('west side'));
    }
    if (tabLower === 'downtown vancouver') {
      return neighLower.includes('downtown') || neighLower.includes('burrard');
    }
    if (tabLower === 'north burnaby') {
      return neighLower.includes('hastings') || neighLower.includes('north burnaby');
    }
    if (tabLower === 'central burnaby') {
      return neighLower.includes('canada way') || neighLower.includes('central burnaby') || neighLower.includes('douglas');
    }
    if (tabLower === 'metrotown') {
      return neighLower.includes('metrotown') || neighLower.includes('kingsway') || neighLower.includes('edmonds') || neighLower.includes('6th st');
    }
    if (tabLower === 'brentwood') {
      return neighLower.includes('brentwood') || neighLower.includes('willingdon');
    }

    return neighLower.includes(tabLower) || cityLower.includes(tabLower);
  }

  /**
   * Get all stations belonging to the active region
   */
  function getRegionStations() {
    const list = appData.stations || [];
    if (currentFilter.region === 'all_metro') {
      return list;
    }
    return list.filter(s => s.region === currentFilter.region);
  }

  /**
   * Dynamically render filter tabs for the selected region
   */
  function renderFilterTabs() {
    if (!filterTabsContainer) return;
    const regConfig = REGION_CONFIGS[currentFilter.region] || REGION_CONFIGS.surrey_area;
    filterTabsContainer.innerHTML = '';

    const regionStations = getRegionStations();

    regConfig.tabs.forEach(tab => {
      const btn = document.createElement('button');
      const isActive = currentFilter.city === tab.id;
      btn.className = `filter-tab ${isActive ? 'active' : ''}`;
      btn.setAttribute('data-city', tab.id);
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');

      // Calculate count for this tab
      let count = 0;
      if (tab.id === 'all') {
        count = regionStations.length;
      } else if (currentFilter.region === 'all_metro') {
        count = appData.stations.filter(s => s.region === tab.id).length;
      } else {
        count = regionStations.filter(s => stationMatchesCityTab(s, tab.id)).length;
      }

      const fullLabel = tab.label;
      const shortLabel = tab.shortLabel || tab.label;

      btn.innerHTML = `
        <span class="tab-label-full">${escapeHTML(fullLabel)}</span>
        <span class="tab-label-short">${escapeHTML(shortLabel)}</span>
        <span class="tab-count">${count}</span>
      `;

      btn.addEventListener('click', () => {
        const allTabs = filterTabsContainer.querySelectorAll('.filter-tab');
        allTabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        currentFilter.city = tab.id;
        render();
      });

      filterTabsContainer.appendChild(btn);
    });
  }

  /**
   * Filter stations according to active region, city, brand, and multi-field search
   * Sort strictly by price for the currently active gasoline type.
   */
  function getFilteredStations() {
    let list = getRegionStations();

    // Filter by city / district tab
    if (currentFilter.city !== 'all') {
      if (currentFilter.region === 'all_metro') {
        list = list.filter(s => s.region === currentFilter.city);
      } else {
        list = list.filter(s => stationMatchesCityTab(s, currentFilter.city));
      }
    }

    // Filter by brand
    if (currentFilter.brand !== 'all') {
      const b = currentFilter.brand.toLowerCase();
      list = list.filter(s => {
        const sBrand = (s.brand || s.station_name || '').toLowerCase();
        return sBrand.includes(b);
      });
    }

    // Filter by search query (brand, address, neighborhood, city, sub_area, source)
    if (currentFilter.search) {
      const q = currentFilter.search.toLowerCase();
      list = list.filter(s =>
        (s.station_name && s.station_name.toLowerCase().includes(q)) ||
        (s.brand && s.brand.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.neighborhood && s.neighborhood.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.sub_area && s.sub_area.toLowerCase().includes(q)) ||
        (s.source && s.source.toLowerCase().includes(q))
      );
    }

    // Always sort by active gasoline octane price ascending (cheapest first)
    list.sort((a, b) => getStationPrice(a) - getStationPrice(b));

    return list;
  }

  /**
   * Render Hero "Cheapest Gas" card for the selected area and octane rating
   */
  function renderHeroCard(filteredList) {
    const regConfig = REGION_CONFIGS[currentFilter.region] || REGION_CONFIGS.surrey_area;
    const activeFuel = FUEL_CONFIGS[currentFilter.fuelType] || FUEL_CONFIGS.regular;

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
    const topPrice = getStationPrice(topStation);
    const maxStation = filteredList[filteredList.length - 1];
    const maxPrice = getStationPrice(maxStation);
    const priceDiff = Math.max(0, maxPrice - topPrice).toFixed(1);

    // Dynamic Pill Text based on active area, brand, and gasoline type
    let pillText = `Lowest ${activeFuel.octane} in Region`;
    if (currentFilter.brand !== 'all' && currentFilter.city !== 'all') {
      pillText = `Lowest ${currentFilter.brand} (${activeFuel.octane}) in ${currentFilter.city}`;
    } else if (currentFilter.brand !== 'all') {
      pillText = `Lowest ${currentFilter.brand} (${activeFuel.octane}) in ${regConfig.name}`;
    } else if (currentFilter.city !== 'all') {
      pillText = `Lowest ${activeFuel.octane} in ${currentFilter.city}`;
    } else {
      pillText = `Lowest ${activeFuel.octane} in ${regConfig.name}`;
    }
    cheapestPillText.textContent = pillText;

    // Savings badge
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
    heroSource.textContent = `⚡ Via Live Report • ${activeFuel.octane}`;

    // Price for selected gasoline type
    heroPrice.textContent = topPrice.toFixed(1);
    heroPricePerLitre.textContent = `$${(topPrice / 100).toFixed(3)} / Litre`;

    // Map CTA Links for Google Maps & Apple Maps
    if (heroGoogleMapBtn) heroGoogleMapBtn.href = getGoogleMapsUrl(topStation);
    if (heroAppleMapBtn) heroAppleMapBtn.href = getAppleMapsUrl(topStation);
  }

  /**
   * Render station list items reflecting active gasoline type
   */
  function renderStationList(filteredList) {
    stationsList.innerHTML = '';

    const regionTotal = getRegionStations().length;
    const activeFuel = FUEL_CONFIGS[currentFilter.fuelType] || FUEL_CONFIGS.regular;

    if (filteredList.length === 0) {
      emptyState.style.display = 'block';
      showingCountText.textContent = '0 stations';
      return;
    }

    emptyState.style.display = 'none';
    showingCountText.textContent = `Showing ${filteredList.length} of ${regionTotal} stations (${activeFuel.octane})`;

    const minPrice = getStationPrice(filteredList[0]);

    filteredList.forEach((station) => {
      const stPrice = getStationPrice(station);
      const isCheapest = (stPrice === minPrice);
      const diff = (stPrice - minPrice).toFixed(1);
      const brandName = station.brand || station.station_name;
      const brandSlug = getBrandSlug(brandName);
      const googleMapUrl = getGoogleMapsUrl(station);
      const appleMapUrl = getAppleMapsUrl(station);

      const liveBadgeHtml = `<span class="live-badge" title="Reported live via GasBuddy">⚡ Via Live Report • ${activeFuel.octane}</span>`;

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
              <span class="price-digits">${stPrice.toFixed(1)}</span>
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
    // City Area / Region Dropdown
    if (regionSelect) {
      regionSelect.addEventListener('change', (e) => {
        currentFilter.region = e.target.value;
        currentFilter.city = 'all'; // Reset to All for this region
        updateHeaderSubtitle();
        renderFilterTabs();
        render();
      });
    }

    // Gasoline Type (Octane) Dropdown
    if (fuelTypeSelect) {
      fuelTypeSelect.addEventListener('change', (e) => {
        currentFilter.fuelType = e.target.value;
        updateFuelBadge();
        render();
      });
    }

    // Save as Default Configuration Button (saves area and fuelType to localStorage)
    if (saveDefaultBtn) {
      saveDefaultBtn.addEventListener('click', () => {
        saveCurrentAsDefault();
      });
    }

    // Brand Filter Pills
    brandPills.forEach(pill => {
      pill.addEventListener('click', () => {
        brandPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        currentFilter.brand = pill.getAttribute('data-brand');
        render();
      });
    });

    // Search Input
    if (stationSearchInput) {
      stationSearchInput.addEventListener('input', (e) => {
        currentFilter.search = e.target.value.trim();
        if (clearSearchBtn) {
          clearSearchBtn.style.display = currentFilter.search ? 'flex' : 'none';
        }
        render();
      });
    }

    // Clear Search Button
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        stationSearchInput.value = '';
        currentFilter.search = '';
        clearSearchBtn.style.display = 'none';
        stationSearchInput.focus();
        render();
      });
    }

    // Reset Filters Button
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        stationSearchInput.value = '';
        currentFilter.search = '';
        currentFilter.city = 'all';
        currentFilter.brand = 'all';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';

        // Reset brand pills
        brandPills.forEach(p => {
          const isAll = p.getAttribute('data-brand') === 'all';
          p.classList.toggle('active', isAll);
        });

        renderFilterTabs();
        render();
      });
    }

    // Manual Refresh Button: cleans and reloads from server, strictly preserving region & fuelType
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadGasPrices(true);
      });
    }

    // Auto periodic refresh in browser every 5 minutes (preserves region & fuelType)
    setInterval(() => {
      loadGasPrices(false);
    }, 5 * 60 * 1000);
  }

  // Initialize: load saved defaults first, setup listeners, then load fresh data
  loadSavedPreferences();
  setupEvents();
  loadGasPrices(false);
})();
