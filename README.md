# ⛽ Gas Price Finder (Surrey • Delta • White Rock, BC)

A modern, mobile-first web application that displays live regular gasoline prices in **Surrey**, **Delta** (including Tsawwassen & Ladner), and **White Rock**, British Columbia.

Stations are automatically sorted by price with the cheapest pump highlighted in a featured hero card. Each station includes a one-tap **"Open in Maps"** button that deep links into **Apple Maps on iPhone** or **Google Maps on Android** directly to the station.

---

## ✨ Features

- **Cheapest Gas Spotlight**: Featured hero card prominently displaying the lowest price available in the selected region and calculating fuel savings.
- **City Filters**: One-tap filtering for **All Areas**, **Surrey**, **Delta**, and **White Rock** with live station counts.
- **Instant Search**: Search across station brand names (Shell, Esso, Petro-Canada, Chevron, Centex, Canco, Super Save, etc.) and street addresses.
- **Turn-by-Turn Navigation**: Smart "Open in Maps" action that detects iOS / Android / Desktop and launches the native maps application directly pointing to that gas station.
- **Multi-Source Aggregation**: Pulls and normalizes live prices from GasBuddy syndicated publisher feeds, GVRD directory, and local community updates.
- **Automated Every 30 Minutes**: GitHub Actions workflow fetches new prices, updates data, commits to the repository, and publishes live to **GitHub Pages**.
- **Graceful Error Handling**: If any third-party source is temporarily slow or unavailable, the website seamlessly utilizes cached data without breaking.
- **Modern & Tactile Design**: Dark-mode glassmorphic interface, smooth gradients, high-contrast typography, and tactile button feedback.

---

## 🗺️ Live Gas Price Sources

1. **GVRD Directory & GasBuddy Feeds**:
   - Surrey (`gvrd.com/gas-prices/surrey.html`)
   - Delta (`gvrd.com/gas-prices/delta.html`)
   - Tsawwassen & Ladner (`gvrd.com/gas-prices/tsawwassen.html`)
   - White Rock (`gvrd.com/gas-prices/white-rock.html`)
2. **Delta Optimist Gas Prices** (`delta-optimist.com/gas-prices`)
3. **GasBuddy** (`gasbuddy.com/gasprices/british-columbia/surrey`)

The scraper cleans HTML strings, normalizes station names, filters out any stations outside the strict geographic borders of Surrey, Delta, and White Rock, and deduplicates multiple reports for the same location.

---

## 🚀 GitHub Pages & Automated Workflow Setup

### 1. Enable GitHub Pages in Repository Settings
1. Go to your GitHub repository.
2. Click on **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.

### 2. Automated 30-Minute Workflow (`.github/workflows/update-prices.yml`)
- Runs on a cron schedule every 30 minutes: `*/30 * * * *`.
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
