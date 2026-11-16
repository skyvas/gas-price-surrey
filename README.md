# ⛽ Gas Price Finder (Surrey • Delta • White Rock, BC)

A modern, mobile-first web application that displays real-time regular gasoline prices in **Surrey**, **Delta** (including Tsawwassen & Ladner), and **White Rock**, British Columbia.

Gasoline prices are sourced **exclusively from GasBuddy's real-time live community driver reports**. Stations are automatically sorted by price with the cheapest pump highlighted in a featured hero card. Each station includes one-tap **"Open in Maps"** buttons that deep-link directly into **Apple Maps on iPhone** or **Google Maps on Android**.

---

## ✨ Features

- **Cheapest Gas Spotlight**: Featured hero card prominently displaying the lowest price available in the selected region and calculating fuel savings.
- **Regular Gasoline, Reported Live**: All prices are verified, real-time reports directly from drivers at the pump across Surrey, Delta, and White Rock. No synthetic baselines or unverified website scrapers — and no estimated grades: the feed reports Regular only, so Midgrade / Premium / Diesel are not shown as live prices.
- **Freshness You Can See**: Every price carries the time it was reported. Reports older than 24 hours are dropped, reports older than 6 hours are flagged stale, and the page shows the last *successful* fetch time — if a fetch fails, the site keeps showing the last good data and says so instead of going blank or stale-silently.
- **City & Brand Filters**: One-tap filtering for **All Areas**, **Surrey**, **Delta**, and **White Rock**, plus brand filtering (Chevron, Shell, Petro-Canada, Esso, Canco, Centex, Super Save, etc.).
- **Authentic Brand Logos**: High-resolution vector logos for Shell, Chevron, Petro-Canada, Esso, Mobil, Centex, Canco, Super Save, Domo, and Wesco.
- **Turn-by-Turn Navigation (Google Maps & Apple Maps)**: One-tap dual action buttons on all stations to launch directions in **Google Maps** or **Apple Maps** directly to the verified station address.
- **Automated Updates**: A GitHub Actions workflow fetches new prices, validates them, updates the data, and publishes live to **GitHub Pages** (see below — the schedule is every 5 minutes, but GitHub gives no timing guarantee, so the real cadence is whatever `data/history.jsonl` shows).

---

## 🗺️ Live Gas Price Sources

**Primary — GasBuddy syndicated feeds (`df.gasbuddy.com`, via gvrd.com).**
This is GasBuddy's own syndication feed for the GVRD city pages — the same
live driver reports GasBuddy shows on the web, served as a structured feed
with no API key. It is the best free station-level source for Surrey: there
is **no official free API** for live BC station prices. GasBuddy/PDI's
official API is commercial, NRCan publishes only city averages (see below),
and paid aggregators (CollectAPI/RapidAPI free tier is 10 requests/month)
cannot sustain a 5-minute cadence. The feed returns the 10 cheapest reported
stations per city page, Regular gasoline only.

- **Surrey**: City Centre, Whalley, Guildford, Fleetwood, Newton, Cloverdale, South Surrey.
- **Delta**: North Delta, Tilbury, Ladner, Tsawwassen.
- **White Rock**.

The scraper normalizes station names, addresses, and geographic borders, and deduplicates multi-feed reports — keeping the **freshest** report per station, not the lowest — to ensure accurate, up-to-date pricing.

**Sanity anchor — Natural Resources Canada (official, weekly).**
NRCan publishes a weekly average regular price for Vancouver (RSS feed, no
key). It is a city average, not station-level and not live, so it never
overrides a station price. The fetcher records it in
`metadata.nrcan_anchor` and flags the run if the median station price is
more than 25¢/L away from it.

## ✅ How the data stays solid

`scripts/fetch_prices.py` enforces this on every run:

- **Regular only** — midgrade/premium/diesel are not reported by the feed,
  so they are not estimated from fixed offsets and not shown as live.
- **Freshness** — each report's time is parsed (Pacific time); reports older
  than 24h are dropped, older than 6h are flagged stale. Median/max report
  age is recorded in `metadata.report_freshness`.
- **Plausibility** — prices outside 100–300 ¢/L are rejected.
- **Retries** — each feed is tried 3 times before it counts as failed.
- **Never overwrite good data with a bad run** — if fewer than 20 stations
  or fewer than 5 feeds come back, the previous `data/gas_prices.json` is
  kept and the run is marked `fetch_status: "degraded"`, with the error in
  `metadata.fetch_errors`. The site shows the last good fetch time.
- **History** — every run appends one line to `data/history.jsonl`
  (timestamp, status, station count, cheapest overall/Surrey, median,
  NRCan anchor), kept to the last 2000 runs. That file is the honest record
  of how often the updater actually runs.
- **Coordinates** — stations are matched to a catalog by street number *and*
  street name. Stations with no catalog entry are flagged
  `coordinates_source: "city_fallback"` (map links still use the exact
  address text, so navigation is unaffected).

## 🚀 GitHub Pages & Automated Workflow Setup

### 1. Enable GitHub Pages in Repository Settings
1. Go to your GitHub repository.
2. Click on **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.

### 2. Automated Workflow (`.github/workflows/update-prices.yml`)
- Runs on a cron schedule every 5 minutes: `*/5 * * * *` — the fastest
  interval GitHub Actions allows. **But GitHub gives no timing SLA:**
  scheduled runs may be delayed or dropped under load, and in practice this
  repo has averaged roughly one run every ~6 hours (Nov 2026). Do not rely
  on 5-minute freshness; check `data/history.jsonl` or the "last updated"
  time on the site for the real cadence. If true 5-minute updates matter,
  an external scheduler (e.g. a free cron service calling the workflow's
  `workflow_dispatch` API) is needed — GitHub's own scheduler will not
  guarantee it.
- Can also be triggered manually anytime via the **Run workflow** button under the **Actions** tab (`workflow_dispatch`).
- If scheduled runs stop entirely, check the Actions tab: in a public repo
  GitHub automatically disables scheduled workflows after 60 days without
  repository activity — re-enable the workflow there.
- Steps executed:
  1. Checks out the `gh-pages` branch (the site deploys from it).
  2. Runs `python scripts/fetch_prices.py` (with retries, freshness
     filtering, NRCan anchor, and the degraded-run guardrail).
  3. Validates `data/gas_prices.json` (station count, price range,
     regular-only prices).
  4. Commits and pushes any updated price data and `data/history.jsonl`.
  5. Syncs those two data files back to `main`, so the default branch
     never goes stale.
  6. Deploys the static site directly to GitHub Pages, and writes a
     per-run summary visible in the Actions run.

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
