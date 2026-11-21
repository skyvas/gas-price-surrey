/**
 * Gas Price Finder - Client Application (v6.0)
 * Metro Vancouver, British Columbia
 * Closest stations first by default; cheapest one tap away.
 * One list, one order. The view is session-only — every fresh open
 * is Closest. Only the fuel type is remembered.
 */

(function () {
  'use strict';

  // Metro Vancouver configuration (v5.3: no area setting any more — the
  // app always shows the whole of Metro Vancouver). The tabs below are
  // just city filters on that one list, not an area you set up.
  const REGION_CONFIGS = {
    all_metro: {
      id: 'all_metro',
      name: 'Metro Vancouver',
      tabs: [
        { id: 'all', label: 'All Metro', shortLabel: 'All' },
        { id: 'surrey_area', label: 'Surrey Area' },
        { id: 'vancouver', label: 'Vancouver' },
        { id: 'burnaby', label: 'Burnaby' }
      ]
    }
  };

  // Fuel Octane Configurations.
  // Only Regular is reported live by the GasBuddy feed (see data notes).
  // The other grades stay listed so they can be enabled when a real
  // multi-grade source exists — but they must NEVER be estimated from
  // fixed offsets. getStationPrice returns null for unreported grades.
  const FUEL_CONFIGS = {
    regular: {
      id: 'regular',
      name: 'Regular',
      octane: 'Regular 87',
      badge: 'Regular Gas (87)'
    },
    midgrade_89: {
      id: 'midgrade_89',
      name: 'Midgrade',
      octane: 'Midgrade 89',
      badge: 'Midgrade (89)'
    },
    premium_91: {
      id: 'premium_91',
      name: 'Premium',
      octane: 'Premium 91',
      badge: 'Premium (91)'
    },
    ultra_93: {
      id: 'ultra_93',
      name: 'Ultra / 94',
      octane: 'Ultra 93+',
      badge: 'Ultra (93+)'
    }
  };

  // Storage Keys for Defaults
  const STORAGE_KEYS = {
    REGION: 'bc_gas_pref_region',
    FUEL: 'bc_gas_pref_fuel',
    SORT: 'bc_gas_pref_sort' // v6.0: the view is session-only now; the key is only removed, never read
  };

  // Application State
  let appData = {
    metadata: null,
    stations: []
  };

  // No area setting any more (v5.3): the app always shows the whole of
  // Metro Vancouver, nearest to your location. Region is fixed.
  let currentFilter = {
    fuelType: 'regular',   // Default: Regular (87)
    city: 'all',
    brand: 'all',
    search: '',
    view: 'closest'        // Closest | Cheapest. Session-only, always starts Closest.
  };

  // True when the price file failed to load and there is no data at all
  // (first load). The page then shows an explicit error + retry instead
  // of looking like it is still loading forever.
  let dataLoadFailed = false;

  // DOM Elements
  const fuelTypeSelect = document.getElementById('fuelTypeSelect');
  const fuelBadgeText = document.getElementById('fuelBadgeText');
  const fuelPillBtn = document.getElementById('fuelPillBtn');
  const headerStatusText = document.getElementById('headerStatusText');
  const refreshPricesBtn = document.getElementById('refreshPricesBtn');
  const filterTabsContainer = document.getElementById('filterTabsContainer');
  const filterBtn = document.getElementById('filterBtn');
  const filterActiveText = document.getElementById('filterActiveText');
  const filterSheet = document.getElementById('filterSheet');
  const filterBackdrop = document.getElementById('filterBackdrop');
  const closeFilterSheetBtn = document.getElementById('closeFilterSheetBtn');
  const applyFilterBtn = document.getElementById('applyFilterBtn');
  const clearFilterBtn = document.getElementById('clearFilterBtn');
  const brandPills = document.querySelectorAll('.brand-pill');
  const stationSearchInput = document.getElementById('stationSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const stationListHeading = document.getElementById('stationListHeading');
  const listAccuracyText = document.getElementById('listAccuracyText');
  const updateLocationBtn = document.getElementById('updateLocationBtn');
  const viewClosestBtn = document.getElementById('viewClosestBtn');
  const viewCheapestBtn = document.getElementById('viewCheapestBtn');
  const showingCountText = document.getElementById('showingCountText');
  const listSkeleton = document.getElementById('listSkeleton');
  const stationsList = document.getElementById('stationsList');
  const emptyState = document.getElementById('emptyState');
  const emptyStateTitle = document.getElementById('emptyStateTitle');
  const emptyStateText = document.getElementById('emptyStateText');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  // Fuel sheet elements
  const configDrawer = document.getElementById('configDrawer');
  const closeConfigDrawerBtn = document.getElementById('closeConfigDrawerBtn');
  const configBackdrop = document.getElementById('configBackdrop');
  const applyPreferencesBtn = document.getElementById('applyPreferencesBtn');

  // Hero elements (nearest station)
  const cheapestCard = document.getElementById('cheapestCard');
  const cheapestPillText = document.getElementById('cheapestPillText');
  const heroBrandIcon = document.getElementById('heroBrandIcon');
  const heroStationName = document.getElementById('heroStationName');
  const heroStationCity = document.getElementById('heroStationCity');
  const heroStationAddress = document.getElementById('heroStationAddress');
  const heroDistanceText = document.getElementById('heroDistanceText');
  const heroPrice = document.getElementById('heroPrice');
  const heroPricePerLitre = document.getElementById('heroPricePerLitre');
  const heroNavigateBtn = document.getElementById('heroNavigateBtn');
  const heroNavigateText = document.getElementById('heroNavigateText');
  const locationOffCard = document.getElementById('locationOffCard');
  const locationOffText = document.getElementById('locationOffText');
  const turnOnLocationBtn = document.getElementById('turnOnLocationBtn');
  const cheapestLine = document.getElementById('cheapestLine');
  const cheapestLineText = document.getElementById('cheapestLineText');

  /**
   * Preferences Drawer Modal visibility controllers
   */
  function openConfigDrawer() {
    if (!configDrawer) return;
    if (fuelTypeSelect) fuelTypeSelect.value = currentFilter.fuelType;
    configDrawer.style.display = 'flex';
    configDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeConfigDrawer() {
    if (!configDrawer) return;
    configDrawer.style.display = 'none';
    configDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /**
   * Filter sheet visibility controllers (same sheet pattern as fuel)
   */
  function openFilterSheet() {
    if (!filterSheet) return;
    filterSheet.style.display = 'flex';
    filterSheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeFilterSheet() {
    if (!filterSheet) return;
    filterSheet.style.display = 'none';
    filterSheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /**
   * The Filter button shows what is active, so the collapsed filters
   * are still visible at a glance ("Filter • Chevron").
   */
  function updateFilterButton() {
    if (!filterActiveText) return;
    const parts = [];
    if (currentFilter.brand !== 'all') parts.push(currentFilter.brand);
    if (currentFilter.search) parts.push('“' + currentFilter.search + '”');
    filterActiveText.textContent = parts.length ? ' • ' + parts.join(' • ') : '';
  }

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
      // The area setting was removed in v5.3 — the app always shows the
      // whole of Metro Vancouver now. Drop any saved area from before.
      try { localStorage.removeItem(STORAGE_KEYS.REGION); } catch (e) { /* ignore */ }
      const savedFuel = localStorage.getItem(STORAGE_KEYS.FUEL);

      if (savedFuel && FUEL_CONFIGS[savedFuel]) {
        currentFilter.fuelType = savedFuel;
        if (fuelTypeSelect) fuelTypeSelect.value = savedFuel;
      }
      // The view used to be persisted (v5.x). v6.0: every fresh open is
      // Closest — drop any saved sort so one old "Lowest price" tap can
      // no longer silently change the default for a returning user.
      try { localStorage.removeItem(STORAGE_KEYS.SORT); } catch (e) { /* ignore */ }
    } catch (e) {
      console.warn('Storage not accessible:', e);
    }
  }

  /**
   * Fuel is the one preference that is remembered. It is saved the
   * moment you change it — there is no save button any more.
   */
  function saveFuelPreference() {
    try {
      localStorage.setItem(STORAGE_KEYS.FUEL, currentFilter.fuelType);
    } catch (e) {
      console.warn('Unable to save fuel preference:', e);
    }
  }

  /**
   * Your location — used only in this page, in memory, to sort stations
   * by distance. It is never stored, never sent anywhere, and the app
   * keeps working (sorted by lowest price) if you decline or it fails.
   * Geolocation needs a secure (https) page; GitHub Pages is https.
   */
  let userLocation = null; // { lat, lng, accuracy, timestamp } once known
  let locationState = 'unknown'; // unknown | locating | ready | denied | unavailable
  let userPickedCheapest = false; // the user tapped Cheapest themselves this session
  // True when the fix we are showing came from an earlier, successful
  // request and a later request failed (e.g. location revoked) or the
  // fix is older than 15 minutes (e.g. driving). The heading then says
  // so instead of presenting stale distances as fresh.
  let locationStale = false;
  // Generation counter for location requests: callbacks from an older
  // request (getCurrentPosition is not cancellable) must never kill a
  // newer request's watch or flip its view.
  let locationRequestId = 0;

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /**
   * Distance from you to a station in km, or null when it can't be
   * computed (no location yet, or the station has no coordinates).
   */
  function getStationDistanceKm(station) {
    if (!userLocation || !station) return null;
    if (typeof station.latitude !== 'number' || typeof station.longitude !== 'number') return null;
    return haversineKm(userLocation.lat, userLocation.lng, station.latitude, station.longitude);
  }

  function formatDistanceKm(station) {
    const km = getStationDistanceKm(station);
    if (km === null) return null;
    // Stations pinned only to their city centre (coordinates_source
    // 'city_fallback') get an approximate '~' — the distance is rough.
    const approx = station.coordinates_source === 'city_fallback' ? '~' : '';
    return km < 1 ? `${approx}${(km * 1000).toFixed(0)} m` : `${approx}${km.toFixed(1)} km`;
  }

  let locationWatchId = null;
  let locationWatchTimer = null;
  let locationBestAccuracy = Infinity;

  // The one location action lives in the list header. While a fix is
  // being acquired it is disabled so a second tap can't stack requests.
  function updateLocationButton() {
    if (!updateLocationBtn) return;
    const locating = locationState === 'locating';
    updateLocationBtn.disabled = locating;
    updateLocationBtn.textContent = locating ? 'Locating…' : 'Update location';
  }

  function stopLocationWatch() {
    if (locationWatchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(locationWatchId);
    }
    locationWatchId = null;
    if (locationWatchTimer !== null) {
      clearTimeout(locationWatchTimer);
      locationWatchTimer = null;
    }
    updateLocationButton();
  }

  // The view switch is session-only and never persisted: every fresh
  // open is Closest. Only the fuel type is remembered.
  function updateViewUI() {
    const isClosest = currentFilter.view === 'closest';
    if (viewClosestBtn) {
      viewClosestBtn.classList.toggle('active', isClosest);
      viewClosestBtn.setAttribute('aria-selected', isClosest ? 'true' : 'false');
    }
    if (viewCheapestBtn) {
      viewCheapestBtn.classList.toggle('active', !isClosest);
      viewCheapestBtn.setAttribute('aria-selected', !isClosest ? 'true' : 'false');
    }
  }

  function setViewMode(mode, { fromUser = false } = {}) {
    if (mode !== 'cheapest' && mode !== 'closest') return;
    if (fromUser) userPickedCheapest = (mode === 'cheapest');
    currentFilter.view = mode;
    updateViewUI();
    render();
  }

  /**
   * Fetch your live location and keep refining it. The first fix from
   * the phone is often coarse (cell/Wi-Fi, hundreds of metres off), so
   * we watch for a better GPS fix and re-sort as it improves, then stop
   * watching after 20 seconds or once the fix is within 50 m. A fresh
   * fix is always requested (maximumAge 0) — never a stale cached one.
   */
  function requestLocation() {
    if (!('geolocation' in navigator)) {
      // Explicit, labelled fallback: the list becomes cheapest-first and
      // the heading + switch both say so. Nothing flips silently.
      locationState = 'unavailable';
      currentFilter.view = 'cheapest';
      updateLocationButton();
      if (appData.stations && appData.stations.length) render();
      return;
    }
    stopLocationWatch();
    // Keep the best fix we already have as the bar: a coarse first fix
    // from a new request must not overwrite a good GPS fix from before.
    locationBestAccuracy = (userLocation && typeof userLocation.accuracy === 'number')
      ? userLocation.accuracy : Infinity;
    locationState = 'locating';
    updateLocationButton();
    if (appData.stations && appData.stations.length) render();

    const reqId = ++locationRequestId;

    const onFix = (pos) => {
      const acc = pos.coords.accuracy;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      // Keep only the best fix so far; ignore noisier later fixes.
      if (typeof acc === 'number' && acc > locationBestAccuracy) return;
      // Same quality but barely moved — skip the re-render churn.
      if (userLocation && typeof acc === 'number' && acc === locationBestAccuracy) {
        if (haversineKm(userLocation.lat, userLocation.lng, lat, lng) < 0.05) return;
      }
      if (typeof acc === 'number') locationBestAccuracy = acc;
      userLocation = { lat, lng, accuracy: acc, timestamp: Date.now() };
      locationStale = false;
      locationState = 'ready';
      // A fix means the default applies again — Closest — unless you
      // explicitly picked Cheapest yourself this session.
      if (!userPickedCheapest) currentFilter.view = 'closest';
      if (appData.stations && appData.stations.length) render();
      if (typeof acc === 'number' && acc <= 50) stopLocationWatch();
    };
    const onErr = (err) => {
      stopLocationWatch();
      // A later failure must not throw away a good fix we already have —
      // but it must not be silent either: the fix is now last-known, and
      // the heading says so, so a tap that appears to do nothing is
      // explained instead of looking broken.
      if (userLocation) { locationState = 'ready'; locationStale = true; render(); return; }
      locationState = (err && err.code === 1) ? 'denied' : 'unavailable';
      // Explicit, labelled fallback: the list becomes cheapest-first and
      // the heading + switch both say so. Nothing flips silently.
      currentFilter.view = 'cheapest';
      if (appData.stations && appData.stations.length) render();
    };
    const opts = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
    // Generation-guarded callbacks: getCurrentPosition cannot be
    // cancelled, so a stale callback from an earlier request must not
    // stop this request's watch or flip its view.
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (reqId === locationRequestId) onFix(pos); },
      (err) => { if (reqId === locationRequestId) onErr(err); },
      opts);
    locationWatchId = navigator.geolocation.watchPosition(
      (pos) => { if (reqId === locationRequestId) onFix(pos); },
      (err) => { if (reqId === locationRequestId) onErr(err); },
      opts);
    // If no callback ever arrives (neither fix nor error), resolve the
    // state after 20 s instead of leaving the page on skeletons forever.
    locationWatchTimer = setTimeout(() => {
      if (reqId !== locationRequestId) return;
      stopLocationWatch();
      if (locationState === 'locating' && !userLocation) {
        locationState = 'unavailable';
        currentFilter.view = 'cheapest';
        render();
      }
    }, 20000);
  }

  /**
   * Get price for station based on the active fuel type (octane).
   * Returns the live reported price, or null when that grade is not
   * reported for the station. Never estimates a grade from an offset.
   */
  function getStationPrice(station, fuelType = currentFilter.fuelType) {
    if (!station) return null;
    if (station.prices && station.prices[fuelType] !== undefined) {
      return Number(station.prices[fuelType]);
    }
    return null;
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
   * Crucial: refresh preserves currentFilter.fuelType and view exactly.
   */
  async function loadGasPrices(showSpin = false) {
    if (showSpin && refreshPricesBtn) {
      refreshPricesBtn.disabled = true;
      refreshPricesBtn.textContent = 'Refreshing…';
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
      dataLoadFailed = false;
      onDataLoaded();
    } catch (error) {
      console.error('Error fetching gas prices:', error);
      if (appData.stations && appData.stations.length > 0) {
        // We still have the last good data: keep showing it, and say so.
        if (headerStatusText) headerStatusText.textContent = 'Using cached directory';
        render();
      } else {
        // No data at all: show an explicit error + retry instead of
        // leaving the page looking like it is still loading forever.
        dataLoadFailed = true;
        if (headerStatusText) headerStatusText.textContent = "Couldn't load prices";
        render();
      }
    } finally {
      if (showSpin && refreshPricesBtn) {
        setTimeout(() => {
          refreshPricesBtn.disabled = false;
          refreshPricesBtn.textContent = 'Refresh prices';
        }, 500);
      }
    }
  }

  /**
   * Process loaded data and refresh UI
   */
  function onDataLoaded() {
    applySupportedFuels();
    updateHeaderStatus();
    updateFuelBadge();
    renderFilterTabs();
    render();
  }

  /**
   * One status line under the header: how fresh the prices are, how
   * many stations, and that the reports are live.
   */
  function updateHeaderStatus() {
    if (!headerStatusText) return;
    let text = 'Updating prices…';
    if (appData.metadata) {
      text = formatRelativeTime(appData.metadata.last_updated_utc);
      if (appData.metadata.fetch_status === 'degraded') {
        text += ' — showing last good fetch, latest attempt had errors';
      }
    }
    const count = (appData.stations && appData.stations.length) || 0;
    // Kept short on purpose: the full line has to fit on a phone next
    // to the Refresh button without truncating.
    headerStatusText.textContent = count ? `${text} · ${count} stations` : text;
  }

  /**
   * Only offer fuel grades the data actually reports live
   * (metadata.supported_fuel_types). Anything else is disabled in the
   * picker and a saved preference for it falls back to Regular, so the
   * page can never show an estimated grade as a live price.
   */
  function applySupportedFuels() {
    const supported = (appData.metadata && appData.metadata.supported_fuel_types) || ['regular'];
    if (fuelTypeSelect) {
      Array.from(fuelTypeSelect.options).forEach((opt) => {
        const isSupported = supported.includes(opt.value);
        opt.disabled = !isSupported;
        if (!isSupported && !opt.textContent.includes('not reported live')) {
          opt.textContent += ' — not reported live';
        }
      });
    }
    if (!supported.includes(currentFilter.fuelType)) {
      currentFilter.fuelType = 'regular';
      if (fuelTypeSelect) fuelTypeSelect.value = 'regular';
      try { localStorage.removeItem(STORAGE_KEYS.FUEL); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Update the fuel pill in the header ("Regular 87").
   */
  function updateFuelBadge() {
    const activeFuel = FUEL_CONFIGS[currentFilter.fuelType] || FUEL_CONFIGS.regular;
    if (fuelBadgeText) {
      fuelBadgeText.textContent = activeFuel.octane;
    }
  }

  /**
   * The scope name for headings and the cheapest line: "Metro Vancouver"
   * for the whole list, or the city tab's name when one is active.
   */
  function scopeName() {
    if (currentFilter.city === 'all') return 'Metro Vancouver';
    const tab = REGION_CONFIGS.all_metro.tabs.find(t => t.id === currentFilter.city);
    return tab ? tab.label : 'Metro Vancouver';
  }

  /**
   * The cheapest label must name what the number actually is. The line
   * and the heading are computed from the fully filtered list (city +
   * brand + search), so when a brand or search filter is active the
   * label says so — "Cheapest Shell", not "Cheapest in Metro Vancouver"
   * for the cheapest Shell.
   */
  function cheapestScopeLabel() {
    if (currentFilter.brand !== 'all') {
      return currentFilter.city === 'all'
        ? `Cheapest ${currentFilter.brand}`
        : `Cheapest ${currentFilter.brand} in ${scopeName()}`;
    }
    if (currentFilter.search) {
      return currentFilter.city === 'all'
        ? `Cheapest matching “${currentFilter.search}”`
        : `Cheapest matching “${currentFilter.search}” in ${scopeName()}`;
    }
    return `Cheapest in ${scopeName()}`;
  }

  /**
   * The list heading says what the list actually is. "Near you" only
   * when the list really is nearest-first; otherwise it honestly says
   * "Cheapest in …". Accuracy appears once, next to the heading — and
   * never as "±0 m". A fix that is last-known (a later request failed,
   * or it is older than 15 minutes) is labelled as such.
   */
  function updateListHeading() {
    if (!stationListHeading) return;
    if (dataLoadFailed && !(appData.stations && appData.stations.length)) {
      stationListHeading.textContent = 'Prices unavailable';
      if (listAccuracyText) listAccuracyText.textContent = '';
      return;
    }
    const locating = locationState === 'locating' && !userLocation;
    if (locating) {
      stationListHeading.textContent = 'Near you';
    } else if (currentFilter.view === 'cheapest' || !userLocation) {
      stationListHeading.textContent = cheapestScopeLabel();
    } else {
      stationListHeading.textContent = 'Near you';
    }
    if (listAccuracyText) {
      const acc = userLocation && userLocation.accuracy;
      const stale = locationStale || (userLocation && userLocation.timestamp
        && (Date.now() - userLocation.timestamp > 15 * 60 * 1000));
      listAccuracyText.textContent = (userLocation && typeof acc === 'number' && isFinite(acc) && acc > 0)
        ? `±${Math.round(acc)} m${stale ? ' · last known' : ''}` : '';
    }
  }

  /**
   * One Navigate action: Apple Maps on iOS, Google Maps everywhere else.
   */
  function getNavigateUrl(station) {
    return isIOS ? getAppleMapsUrl(station) : getGoogleMapsUrl(station);
  }

  /**
   * Get all stations — the whole of Metro Vancouver, no area scoping.
   */
  function getRegionStations() {
    return appData.stations || [];
  }

  /**
   * Dynamically render filter tabs (city filters across Metro Vancouver)
   */
  function renderFilterTabs() {
    if (!filterTabsContainer) return;
    const regConfig = REGION_CONFIGS.all_metro;
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
      } else {
        count = appData.stations.filter(s => s.region === tab.id).length;
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
   * Filter stations across the whole of Metro Vancouver by city tab,
   * brand, and multi-field search, then order by the active view:
   * cheapest first, or closest to you.
   */
  function getFilteredStations() {
    // Always work on a copy: sorting the master array in place made the
    // order depend on whatever a previous sort left behind (e.g. which
    // tied-cheapest station came first changed with location history).
    let list = (getRegionStations() || []).slice();

    // Filter by city tab (All Metro shows every station)
    if (currentFilter.city !== 'all') {
      list = list.filter(s => s.region === currentFilter.city);
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

    // Cheapest: cheapest first; stations without a live price sort last.
    // Closest: closest first (price breaks ties); stations with no usable
    // coordinates sort last. Without a location yet, closest falls back
    // to cheapest so the list is never unsorted.
    // Tie-breaks are explicit and location-independent for the primary
    // key, so the same data always gives the same order: Cheapest ties
    // break by file order (never by whether a distance sort ran before),
    // Closest ties break by price, then file order.
    const indexed = list.map((s, i) => ({ s, i }));
    if (currentFilter.view === 'closest' && userLocation) {
      indexed.sort((a, b) => {
        const da = getStationDistanceKm(a.s);
        const db = getStationDistanceKm(b.s);
        if (da === null && db === null) return a.i - b.i;
        if (da === null) return 1;
        if (db === null) return -1;
        if (da !== db) return da - db;
        const pa = getStationPrice(a.s);
        const pb = getStationPrice(b.s);
        const na = pa === null ? Infinity : pa;
        const nb = pb === null ? Infinity : pb;
        if (na !== nb) return na - nb;
        return a.i - b.i;
      });
    } else {
      indexed.sort((a, b) => {
        const pa = getStationPrice(a.s);
        const pb = getStationPrice(b.s);
        const na = pa === null ? Infinity : pa;
        const nb = pb === null ? Infinity : pb;
        if (na !== nb) return na - nb;
        return a.i - b.i;
      });
    }

    return indexed.map(x => x.s);
  }

  /**
   * Render the hero: the CLOSEST station in the current filter — the
   * first row of the nearest list, visually elevated. The hero never
   * changes with the view switch; it is always the closest station,
   * one hero, one meaning. The cheapest fact lives in the quiet line
   * underneath it. While the location is still being found, the hero
   * waits: no numbers until there's a fix. When location is off, the
   * hero becomes one plain card with one action.
   */
  function renderHeroCard(filteredList) {
    const locating = locationState === 'locating' && !userLocation;
    const locationOff = !userLocation && (locationState === 'denied' || locationState === 'unavailable');
    const noData = dataLoadFailed && !(appData.stations && appData.stations.length);

    // Location off: one plain card, one action. The hero card hides.
    if (locationOffCard) locationOffCard.hidden = !locationOff;
    if (cheapestCard) cheapestCard.style.display = locationOff ? 'none' : '';
    if (locationOff && locationOffText) {
      locationOffText.textContent = locationState === 'denied'
        ? "We can't show what's near you without your location. Allow location for this site in your browser settings, or tap below to try again."
        : "Your browser can't share location, so we can't show what's near you.";
    }

    // Cheapest in scope: one quiet line, always visible in Closest view
    // (hidden in Cheapest view, where the list itself shows it).
    renderCheapestLine(filteredList);

    if (locationOff) return;

    // No data at all: an explicit error with a retry, not a hero that
    // looks like it is still loading.
    if (noData) {
      cheapestCard.style.opacity = '1';
      cheapestPillText.textContent = 'Prices unavailable';
      heroStationName.textContent = 'Prices unavailable';
      heroStationCity.textContent = '';
      heroStationAddress.textContent = "Couldn't load the latest prices. Check your connection and try again.";
      heroDistanceText.textContent = '';
      heroPrice.textContent = '--.-';
      heroPricePerLitre.textContent = '';
      if (heroNavigateText) heroNavigateText.textContent = 'Try again';
      if (heroNavigateBtn) {
        heroNavigateBtn.removeAttribute('href');
        heroNavigateBtn.style.pointerEvents = 'auto';
      }
      return;
    }
    if (heroNavigateText) heroNavigateText.textContent = 'Navigate';

    // While the location is still being found, the hero waits — before
    // any filter conclusion. An empty filter must not make the hero say
    // "No Stations in Filter" while the list area still shows skeletons
    // and "Finding your location…".
    if (locating) {
      cheapestCard.style.opacity = '1';
      cheapestPillText.textContent = currentFilter.city === 'all'
        ? 'Closest to you'
        : `Closest to you in ${scopeName()}`;
      heroStationName.textContent = 'Finding the closest gas…';
      heroStationCity.textContent = '';
      heroStationAddress.textContent = '';
      heroDistanceText.textContent = '';
      heroPrice.textContent = '--.-';
      heroPricePerLitre.textContent = '';
      if (heroNavigateBtn) {
        heroNavigateBtn.removeAttribute('href');
        heroNavigateBtn.style.pointerEvents = 'none';
      }
      return;
    }

    if (!filteredList || filteredList.length === 0) {
      cheapestCard.style.opacity = '0.4';
      cheapestPillText.textContent = 'No Stations in Filter';
      heroStationName.textContent = 'None Available';
      heroStationCity.textContent = '';
      heroStationAddress.textContent = 'Please adjust your filter.';
      heroDistanceText.textContent = '';
      heroPrice.textContent = '--.-';
      heroPricePerLitre.textContent = '';
      if (heroNavigateBtn) {
        heroNavigateBtn.removeAttribute('href');
        heroNavigateBtn.style.pointerEvents = 'none';
      }
      return;
    }

    cheapestCard.style.opacity = '1';
    if (heroNavigateBtn) heroNavigateBtn.style.pointerEvents = 'auto';

    // Pill states the scope when a city tab is active, so the hero's
    // meaning never changes silently.
    cheapestPillText.textContent = currentFilter.city === 'all'
      ? 'Closest to you'
      : `Closest to you in ${scopeName()}`;

    let topStation = null;
    if (userLocation) {
      const indexed = filteredList.map((s, i) => ({ s, i }));
      indexed.sort((a, b) => {
        const da = getStationDistanceKm(a.s);
        const db = getStationDistanceKm(b.s);
        if (da === null && db === null) return a.i - b.i;
        if (da === null) return 1;
        if (db === null) return -1;
        if (da !== db) return da - db;
        const pa = getStationPrice(a.s);
        const pb = getStationPrice(b.s);
        const na = pa === null ? Infinity : pa;
        const nb = pb === null ? Infinity : pb;
        if (na !== nb) return na - nb;
        return a.i - b.i;
      });
      topStation = indexed[0].s;
    } else {
      // No location and not locating (should not normally happen — the
      // off card covers denied/unavailable): fall back to the cheapest.
      const priced = filteredList.filter(s => getStationPrice(s) !== null);
      topStation = priced.length
        ? priced.reduce((a, b) => (getStationPrice(a) <= getStationPrice(b) ? a : b))
        : filteredList[0];
    }

    if (!topStation) {
      heroStationName.textContent = 'Finding the closest gas…';
      heroStationCity.textContent = '';
      heroStationAddress.textContent = '';
      heroDistanceText.textContent = '';
      heroPrice.textContent = '--.-';
      heroPricePerLitre.textContent = '';
      if (heroNavigateBtn) {
        heroNavigateBtn.removeAttribute('href');
        heroNavigateBtn.style.pointerEvents = 'none';
      }
      return;
    }

    const topPrice = getStationPrice(topStation);
    const brandName = topStation.brand || topStation.station_name;
    const brandSlug = getBrandSlug(brandName);
    heroBrandIcon.innerHTML = getBrandLogoSvg(brandName, brandSlug);
    heroBrandIcon.className = `brand-avatar ${brandSlug}`;
    heroStationName.textContent = brandName;
    heroStationCity.textContent = `${topStation.neighborhood ? topStation.neighborhood + ' • ' : ''}${topStation.city}, BC`;
    heroStationAddress.textContent = topStation.address;
    const heroDistance = formatDistanceKm(topStation);
    heroDistanceText.textContent = heroDistance ? `${heroDistance} away · straight-line` : '';

    // Price for selected gasoline type ('--.-' when not reported live)
    heroPrice.textContent = topPrice === null ? '--.-' : topPrice.toFixed(1);
    heroPricePerLitre.textContent = topPrice === null
      ? 'Not reported live'
      : `$${(topPrice / 100).toFixed(3)} / Litre`;

    if (heroNavigateBtn) heroNavigateBtn.href = getNavigateUrl(topStation);
  }

  /**
   * The quiet cheapest line under the hero. Tapping it switches the
   * list to Cheapest view. Hidden in Cheapest view (the list shows it)
   * and when the filter has no priced station.
   */
  function renderCheapestLine(filteredList) {
    if (!cheapestLine) return;
    const locating = locationState === 'locating' && !userLocation;
    const priced = (filteredList || []).filter(s => getStationPrice(s) !== null);
    // Hidden in Cheapest view (the list shows it), when the filter has
    // no priced station, and while the location is still being found
    // (the line names a station without a distance while the hero waits).
    if (!priced.length || currentFilter.view !== 'closest' || locating) {
      cheapestLine.hidden = true;
      return;
    }
    const cheapest = priced.reduce((a, b) => (getStationPrice(a) <= getStationPrice(b) ? a : b));
    const price = getStationPrice(cheapest);
    const dist = formatDistanceKm(cheapest);
    const brand = cheapest.brand || cheapest.station_name;
    cheapestLineText.textContent = `${cheapestScopeLabel()}: ${brand} · ${cheapest.address} — ${price.toFixed(1)}¢${dist ? ` · ${dist} away` : ''}`;
    cheapestLine.hidden = false;
  }

  /**
   * Render station list items reflecting active gasoline type
   */
  function renderStationList(filteredList) {
    // A keyboard/voiceover user tabbed onto a card loses focus when the
    // list is rebuilt on every improving fix; restore it by card id.
    const activeCardId = document.activeElement && document.activeElement.id;
    stationsList.innerHTML = '';

    const regionTotal = getRegionStations().length;
    const activeFuel = FUEL_CONFIGS[currentFilter.fuelType] || FUEL_CONFIGS.regular;

    if (filteredList.length === 0) {
      emptyState.style.display = 'block';
      showingCountText.textContent = '0 stations';
      return;
    }

    emptyState.style.display = 'none';
    const sortLabel = currentFilter.view === 'closest' && userLocation ? 'closest first' : 'cheapest first';
    showingCountText.textContent = `Showing ${filteredList.length} of ${regionTotal} stations (${activeFuel.octane}) · ${sortLabel}`;

    // Cheapest price across the filtered list — computed from the prices,
    // not from list order, so it stays right when sorted by distance.
    const pricedList = filteredList.filter(s => getStationPrice(s) !== null);
    const minPrice = pricedList.length ? Math.min(...pricedList.map(s => getStationPrice(s))) : null;
    // Only the first station at the minimum price gets the ★ tag — the
    // one the cheapest line names. (Several stations can tie at 159.9¢.)
    let cheapestTagged = false;

    filteredList.forEach((station, index) => {
      const stPrice = getStationPrice(station);
      const isCheapest = stPrice !== null && (stPrice === minPrice) && !cheapestTagged;
      if (isCheapest) cheapestTagged = true;
      const diff = (stPrice === null || minPrice === null) ? null : (stPrice - minPrice).toFixed(1);
      const brandName = station.brand || station.station_name;
      const brandSlug = getBrandSlug(brandName);
      const navigateUrl = getNavigateUrl(station);
      const distanceText = formatDistanceKm(station);
      const isNearest = currentFilter.view === 'closest' && userLocation && index === 0 && distanceText !== null;

      // One row, one order. The whole row navigates — no chevron, no
      // dual map buttons, no per-row timestamp or live badge (identical
      // on all rows = zero information; freshness lives in the header).
      // Price + distance sit together on the right: the two decision
      // numbers. The ★ tag keeps the cheapest findable inside the
      // nearest view.
      const card = document.createElement('article');
      card.className = `station-card ${isCheapest ? 'is-top-pick' : ''}`;
      card.id = `station-${station.id}`;
      card.setAttribute('role', 'link');
      card.tabIndex = 0;
      card.setAttribute('aria-label', `${brandName}, ${station.address}, ${stPrice === null ? 'price not reported live' : stPrice.toFixed(1) + ' cents per litre'}${distanceText ? ', ' + distanceText + ' away' : ''}. Tap to navigate.`);

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
              <span class="price-digits">${stPrice === null ? '—' : stPrice.toFixed(1)}</span>
              <span class="price-symbol">¢</span>
            </div>
            <span class="price-diff-tag ${isCheapest ? 'cheapest' : ''}">
              ${stPrice === null ? 'Not reported live' : (isCheapest ? '★ Lowest price' : `+${diff}¢ / L`)}
            </span>
            ${distanceText ? `<span class="distance-chip"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path><circle cx="12" cy="9" r="2.5"></circle></svg>${isNearest ? 'Nearest • ' : ''}${escapeHTML(distanceText)}</span>` : ''}
          </div>
        </div>
      `;

      card.addEventListener('click', () => window.open(navigateUrl, '_blank'));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.open(navigateUrl, '_blank');
        }
      });

      stationsList.appendChild(card);
    });

    if (activeCardId) {
      const restored = document.getElementById(activeCardId);
      if (restored) restored.focus({ preventScroll: true });
    }
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
   * Main render dispatch — one list, one order. While the location is
   * still being found, the list shows skeletons: no numbers until
   * there's a fix.
   */
  function render() {
    const filtered = getFilteredStations();
    updateLocationButton();
    updateViewUI();
    updateFilterButton();
    updateListHeading();
    renderHeroCard(filtered);
    // No data at all: the empty state becomes the error state (title,
    // copy, and a Try again button) instead of a filter message.
    const noData = dataLoadFailed && !(appData.stations && appData.stations.length);
    if (noData) {
      if (emptyStateTitle) emptyStateTitle.textContent = 'Prices unavailable';
      if (emptyStateText) emptyStateText.textContent = "Couldn't load the latest prices. Check your connection and try again.";
      if (resetFiltersBtn) resetFiltersBtn.textContent = 'Try again';
    } else {
      if (emptyStateTitle) emptyStateTitle.textContent = 'No gas stations found';
      if (emptyStateText) emptyStateText.textContent = 'Try clearing your search or filters.';
      if (resetFiltersBtn) resetFiltersBtn.textContent = 'Reset Filters';
    }
    const locating = locationState === 'locating' && !userLocation && !noData;
    if (listSkeleton) listSkeleton.hidden = !locating;
    if (locating) {
      if (stationsList) stationsList.innerHTML = '';
      if (emptyState) emptyState.style.display = 'none';
      if (showingCountText) showingCountText.textContent = 'Finding your location…';
    } else {
      renderStationList(filtered);
    }
  }

  /**
   * Event Listeners Setup
   */
  function setupEvents() {
    // Fuel sheet: the header pill opens it, Done closes it.
    if (fuelPillBtn) {
      fuelPillBtn.addEventListener('click', openConfigDrawer);
    }
    if (closeConfigDrawerBtn) {
      closeConfigDrawerBtn.addEventListener('click', closeConfigDrawer);
    }
    if (configBackdrop) {
      configBackdrop.addEventListener('click', closeConfigDrawer);
    }
    if (applyPreferencesBtn) {
      applyPreferencesBtn.addEventListener('click', closeConfigDrawer);
    }

    // Filter sheet: brand + search, one place. Done closes it.
    if (filterBtn) {
      filterBtn.addEventListener('click', openFilterSheet);
    }
    if (closeFilterSheetBtn) {
      closeFilterSheetBtn.addEventListener('click', closeFilterSheet);
    }
    if (filterBackdrop) {
      filterBackdrop.addEventListener('click', closeFilterSheet);
    }
    if (applyFilterBtn) {
      applyFilterBtn.addEventListener('click', closeFilterSheet);
    }
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener('click', () => {
        if (stationSearchInput) stationSearchInput.value = '';
        currentFilter.search = '';
        currentFilter.brand = 'all';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        brandPills.forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-brand') === 'all');
        });
        updateFilterButton();
        closeFilterSheet();
        render();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (configDrawer && configDrawer.style.display !== 'none') closeConfigDrawer();
        if (filterSheet && filterSheet.style.display !== 'none') closeFilterSheet();
      }
    });

    // Gasoline Type (Octane) Dropdown — applies immediately and is
    // saved at once. There is no save step any more.
    if (fuelTypeSelect) {
      fuelTypeSelect.addEventListener('change', (e) => {
        currentFilter.fuelType = e.target.value;
        saveFuelPreference();
        updateFuelBadge();
        render();
      });
    }

    // Brand Filter Pills (inside the filter sheet): tap applies, and
    // the sheet closes — one tap, done.
    brandPills.forEach(pill => {
      pill.addEventListener('click', () => {
        brandPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        currentFilter.brand = pill.getAttribute('data-brand');
        updateFilterButton();
        closeFilterSheet();
        render();
      });
    });

    // Search Input (inside the filter sheet; filters live as you type)
    if (stationSearchInput) {
      stationSearchInput.addEventListener('input', (e) => {
        currentFilter.search = e.target.value.trim();
        if (clearSearchBtn) {
          clearSearchBtn.style.display = currentFilter.search ? 'flex' : 'none';
        }
        updateFilterButton();
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
        updateFilterButton();
        render();
      });
    }

    // Reset Filters Button — or Try again when there is no data at all.
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        if (dataLoadFailed && !(appData.stations && appData.stations.length)) {
          loadGasPrices(true);
          return;
        }
        if (stationSearchInput) stationSearchInput.value = '';
        currentFilter.search = '';
        currentFilter.city = 'all';
        currentFilter.brand = 'all';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';

        // Reset brand pills
        brandPills.forEach(p => {
          const isAll = p.getAttribute('data-brand') === 'all';
          p.classList.toggle('active', isAll);
        });

        updateFilterButton();
        renderFilterTabs();
        render();
      });
    }

    // View switch: Closest | Cheapest. Session-only — never remembered.
    // Tapping Closest re-acquires a fresh fix (in case you moved).
    if (viewClosestBtn) {
      viewClosestBtn.addEventListener('click', () => {
        setViewMode('closest', { fromUser: true });
        requestLocation();
      });
    }
    if (viewCheapestBtn) {
      viewCheapestBtn.addEventListener('click', () => setViewMode('cheapest', { fromUser: true }));
    }

    // Update location (list header) and Turn on location (off card):
    // the one location action, in both places it appears.
    if (updateLocationBtn) {
      updateLocationBtn.addEventListener('click', () => requestLocation());
    }
    if (turnOnLocationBtn) {
      turnOnLocationBtn.addEventListener('click', () => requestLocation());
    }

    // Cheapest line: switch the list to Cheapest and scroll to it.
    if (cheapestLine) {
      cheapestLine.addEventListener('click', () => {
        setViewMode('cheapest', { fromUser: true });
        const listEl = document.querySelector('.stations-list-section');
        if (listEl) listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Refresh prices (header status line), strictly preserving fuel and view
    if (refreshPricesBtn) {
      refreshPricesBtn.addEventListener('click', () => {
        loadGasPrices(true);
      });
    }

    // Hero Navigate button: normally an anchor to maps; when the price
    // file failed to load it is a Try again button instead.
    if (heroNavigateBtn) {
      heroNavigateBtn.addEventListener('click', (e) => {
        if (dataLoadFailed && !(appData.stations && appData.stations.length)) {
          e.preventDefault();
          loadGasPrices(true);
        }
      });
    }

    // Auto periodic refresh in browser every 30 minutes (preserves fuel
    // and view). New prices arrive whenever the GitHub updater runs — the
    // page picks them up on the next refresh.
    setInterval(() => {
      loadGasPrices(false);
    }, 30 * 60 * 1000);
  }

  // Initialize: load saved defaults first, setup listeners, then load fresh data
  loadSavedPreferences();
  setupEvents();
  updateViewUI();
  updateFilterButton();
  requestLocation();
  loadGasPrices(false);
})();
