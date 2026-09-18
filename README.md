# ⛽ Gas Price Finder (Surrey • Delta • White Rock, BC)

A modern, mobile-first web application that displays real-time regular gasoline prices in **Surrey**, **Delta** (including Tsawwassen & Ladner), and **White Rock**, British Columbia.

Gasoline prices are sourced **exclusively from GasBuddy's real-time live community driver reports**. Stations are automatically sorted by price with the cheapest pump highlighted in a featured hero card. Each station includes one-tap **"Open in Maps"** buttons that deep-link directly into **Apple Maps on iPhone** or **Google Maps on Android**.

---

## ✨ Features

- **Cheapest Gas Spotlight**: Featured hero card prominently displaying the lowest price available in the selected region and calculating fuel savings.
- **100% Live GasBuddy Reports**: All prices are verified, real-time reports directly from drivers at the pump across Surrey, Delta, and White Rock. No synthetic baselines or unverified website scrapers.
- **City & Brand Filters**: One-tap filtering for **All Areas**, **Surrey**, **Delta**, and **White Rock**, plus brand filtering (Chevron, Shell, Petro-Canada, Esso, Canco, Centex, Super Save, etc.).
- **Authentic Brand Logos**: High-resolution vector logos for Shell, Chevron, Petro-Canada, Esso, Mobil, Centex, Canco, Super Save, Domo, and Wesco.
- **Turn-by-Turn Navigation (Google Maps & Apple Maps)**: One-tap dual action buttons on all stations to launch directions in **Google Maps** or **Apple Maps** directly to the verified station address.
- **Automated Every 5 Minutes**: GitHub Actions workflow fetches new prices, updates data, commits to the repository, and publishes live to **GitHub Pages**.

---

## 🗺️ Live Gas Price Sources

Real-time syndication feeds from **GasBuddy** covering:
- **Surrey**: City Centre, Whalley, Guildford, Fleetwood, Newton, Cloverdale, South Surrey.
- **Delta**: North Delta, Tilbury, Ladner, Tsawwassen.
- **White Rock**.

The scraper normalizes station names, addresses, and geographic borders, and deduplicates multi-feed reports to ensure accurate, up-to-date pricing.

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
This updates `data/gas_prices.json` with fresh live GasBuddy data.

### 2. Run Local Web Server
```bash
python3 -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser (or use mobile developer emulation mode in DevTools).

---

## 📱 Mobile Optimizations

- **iPhone**: Uses `apple-mobile-web-app-capable` tags, viewport safe area padding, and Apple Maps URL schemes (`maps://?daddr=...`).
- **Android**: Supports Google Maps intent navigation and responsive touch targets (> 44px).
- **Fast & Lightweight**: Pure Vanilla HTML, CSS, and JavaScript with zero build steps or heavy dependencies.
