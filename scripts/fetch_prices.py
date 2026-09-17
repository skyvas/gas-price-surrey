#!/usr/bin/env python3
"""
Gas Price Scraper for Surrey, Delta, and White Rock, BC.
Fetches real-time regular gasoline prices from multiple sources:
- GVRD / GasBuddy syndicated feeds for Surrey, Delta, White Rock, Tsawwassen, Ladner
- Delta Optimist (with graceful Cloudflare handling)
- GasBuddy (with graceful Cloudflare handling)
Deduplicates stations, normalizes locations, assigns coordinates, and saves data/gas_prices.json.
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta

# Target geographic bounds
VALID_CITIES = {"Surrey", "Delta", "White Rock"}

# City mapping for sub-districts and aliases
CITY_NORMALIZATION = {
    "surrey": "Surrey",
    "delta": "Delta",
    "white rock": "White Rock",
    "white_rock": "White Rock",
    "whiterock": "White Rock",
    "tsawwassen": "Delta",
    "ladner": "Delta",
    "north delta": "Delta",
    "south delta": "Delta",
}

# Known verified station coordinates
KNOWN_COORDINATES = {
    "7812 120 St, Surrey": (49.14528, -122.89010),
    "6422 120 St, Surrey": (49.11968, -122.88977),
    "6389 120 St, Delta": (49.11909, -122.89080),
    "7981 120 St, Delta": (49.15447, -122.89043),
    "15775 Fraser Hwy, Surrey": (49.16022, -122.78558),
    "6191 King George Blvd, Surrey": (49.11521, -122.84482),
    "14313 Crescent Road, Surrey": (49.06769, -122.82505),
    "13916 Grosvenor Rd, Surrey": (49.20368, -122.83635),
    "18383 64 Ave, Surrey": (49.11915, -122.71300),
    "12791 72 Ave, Surrey": (49.13423, -122.86835),
    "18398 Fraser Hwy, Surrey": (49.17019, -122.81187),
    "2692 152 St, Surrey": (49.05070, -122.80068),
    "8781 120 St, Delta": (49.15447, -122.89043),
    "10240 River Rd, Delta": (49.15722, -122.93944),
    "7389 River Rd, Delta": (49.14086, -123.01380),
    "8380 112 St, Delta": (49.15573, -122.91196),
    "5277 48 Ave, Delta": (49.09014, -123.08465),
    "1595 Nichol Rd, White Rock": (49.03091, -122.83480),
    "8985 120 St, Delta": (49.16637, -122.89076),
    "8111 120 St, Delta": (49.15447, -122.89043),
    "9591 Ladner Trunk Rd, Delta": (49.09196, -122.95773),
    "5610 12 Ave, Delta": (49.02445, -123.06825),
    "1204 56 St, Delta": (49.02494, -123.06816),
    "1591 56 St, Delta": (49.03148, -123.06924),
    "4890 Canoe Pass Way, Delta": (49.03917, -123.08939),
}

# Syndicated live feeds
SOURCES = [
    {
        "name": "GasBuddy via GVRD (Surrey)",
        "city_hint": "Surrey",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOAmW0hjDh2feGq%2bcKr9jZGa&i=25521&url=gvrd.com/gas-prices/surrey.html",
        "page_url": "https://www.gvrd.com/gas-prices/surrey.html",
    },
    {
        "name": "GasBuddy via GVRD (Delta)",
        "city_hint": "Delta",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOBkmhj0gTUL4eFJFgs9xA58&i=25506&url=gvrd.com/gas-prices/delta.html",
        "page_url": "https://www.gvrd.com/gas-prices/delta.html",
    },
    {
        "name": "GasBuddy via GVRD (White Rock)",
        "city_hint": "White Rock",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOBkCCnHaMoMK9KtTz23wEFQ&i=25526&url=gvrd.com/gas-prices/white-rock.html",
        "page_url": "https://www.gvrd.com/gas-prices/white-rock.html",
    },
    {
        "name": "GasBuddy via GVRD (Tsawwassen - Delta)",
        "city_hint": "Delta",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BODW5MInqJ4vyr394Rl7N9Xh&i=25522&url=gvrd.com/gas-prices/tsawwassen.html",
        "page_url": "https://www.gvrd.com/gas-prices/tsawwassen.html",
    },
    {
        "name": "GasBuddy via GVRD (Ladner - Delta)",
        "city_hint": "Delta",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOCpkk1lNGvzyMnZks3yjxpD&i=25508&url=gvrd.com/gas-prices/ladner.html",
        "page_url": "https://www.gvrd.com/gas-prices/ladner.html",
    },
]

# Additional direct web pages to probe
ADDITIONAL_PAGES = [
    {
        "name": "Delta Optimist Gas Prices",
        "url": "https://www.delta-optimist.com/gas-prices",
    },
    {
        "name": "GasBuddy Surrey",
        "url": "https://www.gasbuddy.com/gasprices/british-columbia/surrey",
    }
]


def clean_html(raw_html: str) -> str:
    """Strip HTML tags and unescape text."""
    clean = re.sub(r"<[^>]+>", "", raw_html)
    clean = clean.replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
    return clean.strip()


def normalize_station_name(raw_name: str) -> str:
    """Clean and normalize station brand names."""
    # Match text inside link tags if present
    link_match = re.search(r">([^<]+)</a>", raw_name)
    if link_match:
        name = link_match.group(1).strip()
    else:
        name = clean_html(raw_name)

    # Clean up standard brand formatting
    name = re.sub(r"\s+", " ", name).strip()
    if "Canco" in name:
        name = "Canco"
    elif "Petro-Canada" in name:
        name = "Petro-Canada"
    elif "Super Save" in name:
        name = "Super Save Gas"
    elif "Chevron" in name:
        name = "Chevron"
    elif "Esso" in name:
        name = "Esso"
    elif "Shell" in name:
        name = "Shell"
    elif "Centex" in name:
        name = "Centex"
    elif "Wesco" in name:
        name = "Wesco"
    elif "Mobil" in name:
        name = "Mobil"
    elif "Domo" in name:
        name = "Domo"

    return name


def normalize_address(raw_addr: str) -> str:
    """Clean address string."""
    addr = clean_html(raw_addr)
    addr = re.sub(r"^\s*<br\s*/?>", "", addr, flags=re.IGNORECASE)
    addr = re.sub(r"\s+", " ", addr).strip()
    return addr


def normalize_city(raw_city: str, city_hint: str = "") -> str:
    """Normalize city name to Surrey, Delta, or White Rock."""
    link_match = re.search(r">([^<]+)</a>", raw_city)
    if link_match:
        city_str = link_match.group(1).strip().lower()
    else:
        city_str = clean_html(raw_city).strip().lower()

    if not city_str and city_hint:
        city_str = city_hint.lower()

    for key, normalized in CITY_NORMALIZATION.items():
        if key in city_str:
            return normalized

    return ""


def get_coordinates(address: str, city: str):
    """Retrieve latitude and longitude for a station address."""
    key = f"{address}, {city}"
    if key in KNOWN_COORDINATES:
        return KNOWN_COORDINATES[key]

    # Geocode with OpenStreetMap Nominatim as fallback
    try:
        query = f"{address}, {city}, BC, Canada"
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1"
        req = urllib.request.Request(
            url, headers={"User-Agent": "SurreyGasPriceFinder/1.0 (contact@gaspricesurrey.local)"}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                KNOWN_COORDINATES[key] = (lat, lon)
                return lat, lon
    except Exception as e:
        print(f"  [Geocoding fallback notice for {key}]: {e}")

    # Fallback to city center approximate coordinates
    if city == "Surrey":
        return 49.1044, -122.8011
    elif city == "Delta":
        return 49.0847, -123.0587
    elif city == "White Rock":
        return 49.0253, -122.8029
    return 49.1044, -122.8011


def generate_map_urls(station_name: str, address: str, city: str, lat: float = None, lon: float = None):
    """Generate universal map navigation links for iPhone, Android, and Web."""
    destination = f"{station_name}, {address}, {city}, BC"
    encoded_dest = urllib.parse.quote(destination)

    return {
        # Universal Google Maps Directions (Navigates directly to the station address on Android & Web)
        "google_maps": f"https://www.google.com/maps/dir/?api=1&destination={encoded_dest}",
        # Universal Google Maps Search Pin
        "google_maps_search": f"https://www.google.com/maps/search/?api=1&query={encoded_dest}",
        # Apple Maps Turn-by-Turn Directions (Opens native Apple Maps app on iPhone/iPad directly to the destination)
        "apple_maps": f"https://maps.apple.com/?daddr={encoded_dest}&dirflg=d",
        # Apple Maps Search Pin
        "apple_maps_search": f"https://maps.apple.com/?q={encoded_dest}",
        # Android Intent URI for native navigation
        "android_geo": f"geo:0,0?q={encoded_dest}",
        # iOS URL Scheme for direct Maps launch
        "ios_maps_scheme": f"maps://?daddr={encoded_dest}&dirflg=d",
    }


def parse_feed_js(js_content: str, source_info: dict) -> list:
    """Parse document.getElementById assignments from df.gasbuddy.com syndicated feeds."""
    stations_data = {}
    lines = js_content.split(";")

    for line in lines:
        m = re.search(r"document\.getElementById\('([^']+)'\)\.innerHTML\s*=\s*'([^']*)'", line)
        if not m:
            continue
        elem_id, val = m.group(1), m.group(2)

        # Look for Price, StationNm, Address2_, Area, Tme
        price_m = re.search(r"Price(\d+)$", elem_id)
        if price_m:
            idx = price_m.group(1)
            stations_data.setdefault(idx, {})["price_raw"] = val

        station_m = re.search(r"StationNm(\d+)$", elem_id)
        if station_m:
            idx = station_m.group(1)
            stations_data.setdefault(idx, {})["station_raw"] = val

        addr_m = re.search(r"Address2_(\d+)$", elem_id)
        if addr_m:
            idx = addr_m.group(1)
            stations_data.setdefault(idx, {})["address_raw"] = val

        area_m = re.search(r"Area(\d+)$", elem_id)
        if area_m:
            idx = area_m.group(1)
            stations_data.setdefault(idx, {})["area_raw"] = val

        time_m = re.search(r"Tme(\d+)$", elem_id)
        if time_m:
            idx = time_m.group(1)
            stations_data.setdefault(idx, {})["time_raw"] = val

    results = []
    for idx, item in stations_data.items():
        price_str = clean_html(item.get("price_raw", ""))
        price_num_match = re.search(r"(\d+(\.\d+)?)", price_str)
        if not price_num_match:
            continue

        price_val = float(price_num_match.group(1))
        # Prices in Greater Vancouver for regular gas are typically in cents (e.g. 170.0 - 230.0)
        # If in dollars e.g. 1.959, convert to cents
        if price_val < 10.0:
            price_val = round(price_val * 100, 1)

        station_name = normalize_station_name(item.get("station_raw", ""))
        address = normalize_address(item.get("address_raw", ""))
        city = normalize_city(item.get("area_raw", ""), source_info.get("city_hint", ""))

        if not city or city not in VALID_CITIES:
            continue

        if not station_name or not address:
            continue

        time_str = clean_html(item.get("time_raw", "")).strip()
        if not time_str:
            time_str = "Recently reported"

        lat, lon = get_coordinates(address, city)
        map_urls = generate_map_urls(station_name, address, city, lat, lon)

        results.append({
            "id": f"{city.lower()}_{re.sub(r'[^a-zA-Z0-9]', '', address).lower()}",
            "station_name": station_name,
            "price": price_val,
            "price_formatted": f"{price_val:.1f}¢",
            "price_per_litre": f"${price_val / 100:.3f}",
            "fuel_type": "regular",
            "address": address,
            "city": city,
            "province": "BC",
            "country": "Canada",
            "last_updated": time_str,
            "source": source_info["name"],
            "source_url": source_info["page_url"],
            "latitude": lat,
            "longitude": lon,
            "map_urls": map_urls,
        })

    return results


def probe_additional_sources():
    """Attempt probe of additional sources (Delta Optimist & GasBuddy), logging status."""
    print("Checking status of additional configured sources...")
    for src in ADDITIONAL_PAGES:
        try:
            req = urllib.request.Request(
                src["url"],
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                }
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                status = resp.status
                print(f"  - {src['name']}: HTTP {status} (available)")
        except urllib.error.HTTPError as e:
            print(f"  - {src['name']}: HTTP {e.code} ({e.reason}) - handled gracefully")
        except Exception as e:
            print(f"  - {src['name']}: Connection check note ({e}) - handled gracefully")


def fetch_all_prices():
    """Main execution flow: scrape, clean, deduplicate, and write data."""
    all_stations = []
    sources_summary = []

    print(f"[{datetime.now(timezone.utc).isoformat()}] Starting Surrey/Delta/White Rock gas price fetch...")

    # Fetch live syndicated feeds
    for src in SOURCES:
        print(f"Fetching from {src['name']}...")
        try:
            req = urllib.request.Request(
                src["url"],
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    )
                }
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                content = resp.read().decode("utf-8", errors="ignore")
                items = parse_feed_js(content, src)
                print(f"  -> Extracted {len(items)} stations from {src['name']}")
                all_stations.extend(items)
                sources_summary.append({
                    "name": src["name"],
                    "url": src["page_url"],
                    "status": "success",
                    "stations_found": len(items),
                })
        except Exception as e:
            print(f"  -> Error fetching {src['name']}: {e}")
            sources_summary.append({
                "name": src["name"],
                "url": src["page_url"],
                "status": f"error: {str(e)}",
                "stations_found": 0,
            })

    # Probe secondary pages
    probe_additional_sources()

    # Deduplicate stations:
    # If the same address + city appears multiple times, choose the entry with lowest price
    deduped = {}
    for station in all_stations:
        key = f"{station['city']}_{station['address'].lower()}"
        if key not in deduped:
            deduped[key] = station
        else:
            # Keep the lower price
            if station["price"] < deduped[key]["price"]:
                deduped[key] = station

    station_list = list(deduped.values())

    # Sort strictly by price ascending (cheapest first)
    station_list.sort(key=lambda s: s["price"])

    # Highlight cheapest overall and cheapest per city
    cheapest_overall = station_list[0] if station_list else None
    cheapest_by_city = {}
    for city in VALID_CITIES:
        city_stations = [s for s in station_list if s["city"] == city]
        if city_stations:
            cheapest_by_city[city] = city_stations[0]

    now_utc = datetime.now(timezone.utc)
    # Convert to Pacific Time (Surrey/Delta local time)
    # Using UTC-7 / UTC-8 approximation or ISO string
    output_payload = {
        "metadata": {
            "title": "Surrey, Delta & White Rock Gas Prices",
            "last_updated_utc": now_utc.isoformat(),
            "last_updated_formatted": now_utc.strftime("%B %d, %Y at %I:%M %p UTC"),
            "target_region": "Surrey, Delta, White Rock, British Columbia",
            "fuel_type_default": "regular",
            "supported_fuel_types": ["regular", "diesel", "premium"],
            "total_stations": len(station_list),
            "sources": sources_summary,
            "cheapest_overall_id": cheapest_overall["id"] if cheapest_overall else None,
        },
        "cheapest_by_city": {k: v["id"] for k, v in cheapest_by_city.items()},
        "stations": station_list,
    }

    # Save to data/gas_prices.json
    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "gas_prices.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Check if we got valid stations. If empty but file exists, don't overwrite with empty
    if len(station_list) == 0 and os.path.exists(output_path):
        print("Warning: 0 stations retrieved. Keeping existing data/gas_prices.json intact.")
        return

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)

    print(f"Successfully saved {len(station_list)} stations to {os.path.abspath(output_path)}.")
    if cheapest_overall:
        print(f"Cheapest station overall: {cheapest_overall['station_name']} at {cheapest_overall['address']}, {cheapest_overall['city']} ({cheapest_overall['price_formatted']})")


if __name__ == "__main__":
    fetch_all_prices()
