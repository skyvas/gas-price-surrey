# ⛽ Gas Price Finder (Surrey • Delta • White Rock, BC)

A modern, mobile-first web application that displays live regular gasoline prices in **Surrey**, **Delta** (including Tsawwassen & Ladner), and **White Rock**, British Columbia.

Stations are automatically sorted by price with the cheapest pump highlighted in a featured hero card. Each station includes a one-tap **"Open in Maps"** button that deep links into **Apple Maps on iPhone** or **Google Maps on Android** directly to the station.

---

## ✨ Features

- **Cheapest Gas Spotlight**: Featured hero card prominently displaying the lowest price available in the selected region and calculating fuel savings.
- **Truth Precedence Protocol**: Official brand direct pump prices (e.g. Shell Canada `find.shell.com`) strictly supersede and override crowdsourced or third-party reports.
- **Multi-Brand Official Ingestion**:
  - **Shell Canada**: Scrapes direct live pump prices from individual station pages on `find.shell.com` for Surrey, Delta, and Tsawwassen.
  - **Chevron Canada**: Directly queries Parkland's Journie Rewards API (`journie.ca/api/locations/nearest`) for 46 official stations across Surrey, Delta, and White Rock with deep station links.
  - **Super Save Gas**: Direct location parsing from `supersave.ca/gas-stations/`.
  - **Centex Petroleum**: Verified station and discount fuel portal (`centex.ca`).
  - **Canco Petroleum**: Verified locator integration (`cancopetroleum.ca`).
  - **Petro-Canada & Esso**: Verified portals and GasBuddy live price mapping.
- **Truth Tier Filters**: One-tap filtering across `All Sources`, `✓ Official Direct Pumps`, `⚡ Live Reports`, and `🏢 Verified Portals`.
- **City & Brand Filters**: One-tap filtering for **All Areas**, **Surrey**, **Delta**, and **White Rock**, plus individual brand filtering.
- **Authentic Brand Logos**: High-resolution vector logos for Shell, Chevron, Petro-Canada, Esso, Mobil, Centex, Canco, Super Save, Domo, and Wesco.
- **Turn-by-Turn Navigation (Google Maps & Apple Maps)**: One-tap dual action buttons on all stations to launch directions in **Google Maps** or **Apple Maps** directly to the verified station address.
- **Automated Every 5 Minutes**: GitHub Actions workflow fetches new prices, updates data, commits to the repository, and publishes live to **GitHub Pages**.

---

## 🗺️ Live Gas Price Sources & Truth Precedence

1. **Tier 1 — Official Brand Direct Pump Prices**:
   - **Shell Canada** (`find.shell.com/ca/fuel/locations/british-columbia/`): Live regular pump prices parsed from individual station pages with timestamp verification. Highest precedence.
2. **Tier 2 — Official Locators & APIs**:
   - **Chevron Canada / Parkland Journie Rewards** (`journie.ca/api/locations/nearest`): Official station locations, site IDs, amenities, and direct URLs.
   - **Super Save Gas** (`supersave.ca/gas-stations/`): Official BC stations.
   - **Centex Petroleum** (`centex.ca/locations/`)
   - **Canco Petroleum** (`cancopetroleum.ca`)
3. **Tier 3 — Live Crowdsourced Driver Reports**:
   - **GasBuddy & GVRD Publisher Feeds**: Surrey, Delta, Tsawwassen, White Rock.
4. **Tier 4 — Market Survey Baseline**:
   - Regional survey data ensuring complete coverage across 125+ stations.

The scraper cleans HTML strings, normalizes station names, filters out any stations outside the strict geographic borders of Surrey, Delta, and White Rock, and deduplicates multiple reports for the same location.

---

## 🚀 GitHub Pages & Automated Workflow Setup

### 1. Enable GitHub Pages in Repository Settings
1. Go to your GitHub repository.
2. Click on **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.

### 2. Automated 5-Minute Workflow (`.github/workflows/update-prices.yml`)
- Runs on a cron schedule every 5 minutes: `*/5 * * * *`.
- Can also be triggered manually anytime via the **Run workflow** button under the **Actions** tab (`workflow_dispatch`).
- Steps executed:
  1. Checks out repository.
  2. Runs `python scripts/fetch_prices.py`.
  3. Commits and pushes any updated price changes in `data/gas_prices.json`.
  4. Deploys the static site directly to GitHub Pages.

---

## 💻 Local Development

### 1. Fetch Latest Prices
```bash
python3 scripts/fetch_prices.py
```
This updates `data/gas_prices.json` with fresh live data.

### 2. Run Local Web Server
```bash
python3 -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser (or use mobile developer emulation mode in DevTools).

---

## 📱 Mobile Optimizations

- **iPhone**: Uses `apple-mobile-web-app-capable` tags, viewport safe area padding, and Apple Maps URL schemes (`maps://?q=...` / `https://maps.apple.com/?q=...`).
- **Android**: Supports Google Maps intent and responsive touch targets (> 44px).
- **Fast & Lightweight**: Zero external JavaScript frameworks, zero bloat, instant page load.

---

## 🔮 Future Flexibility

The data structure in `data/gas_prices.json` contains a `fuel_type: "regular"` field, making it straightforward to expand to **Diesel**, **Mid-Grade**, and **Premium** fuels or add price trends and historical lowest price tracking.
