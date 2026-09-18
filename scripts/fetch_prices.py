#!/usr/bin/env python3
"""
Gas Price Scraper for Surrey, Delta, and White Rock, BC.
Exclusively accesses real-time regular gasoline prices from GasBuddy's live driver reports.

Feeds monitored:
- GasBuddy Surrey Feed (df.gasbuddy.com via GVRD)
- GasBuddy Delta Feed (df.gasbuddy.com via GVRD)
- GasBuddy White Rock Feed (df.gasbuddy.com via GVRD)
- GasBuddy Tsawwassen Feed (df.gasbuddy.com via GVRD)
- GasBuddy Ladner Feed (df.gasbuddy.com via GVRD)

Outputs structured, validated JSON to data/gas_prices.json.
Only stations with verified live reports are included.
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

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
    "cloverdale": "Surrey",
    "newton": "Surrey",
    "guildford": "Surrey",
    "fleetwood": "Surrey",
    "whalley": "Surrey",
    "south surrey": "Surrey",
}

# Brand details and brand portal URLs
BRAND_METADATA = {
    "Chevron": {
        "name": "Chevron Canada",
        "website": "https://www.chevron.ca",
        "rewards": "Journie Rewards (Save up to 7¢/L)",
        "logo_color": "#00205b",
    },
    "Shell": {
        "name": "Shell Canada",
        "website": "https://www.shell.ca",
        "rewards": "Shell App & BCAA / CAA (Save 3¢/L)",
        "logo_color": "#ffd500",
    },
    "Petro-Canada": {
        "name": "Petro-Canada",
        "website": "https://www.petro-canada.ca",
        "rewards": "Petro-Points & RBC Card Link (Save 3¢/L)",
        "logo_color": "#e31837",
    },
    "Esso": {
        "name": "Esso Canada",
        "website": "https://www.esso.ca",
        "rewards": "PC Optimum & Esso Extra (Earn 10 pts/L)",
        "logo_color": "#eb1c24",
    },
    "Mobil": {
        "name": "Mobil Canada",
        "website": "https://www.mobil.ca",
        "rewards": "PC Optimum Points",
        "logo_color": "#003b71",
    },
    "Canco": {
        "name": "Canco Petroleum",
        "website": "https://cancopetroleum.ca",
        "rewards": "Canco Cash Rewards & Everyday Low Price",
        "logo_color": "#f37021",
    },
    "Centex": {
        "name": "Centex Petroleum",
        "website": "https://centex.ca",
        "rewards": "Centex Go & Independent Pump Discounts",
        "logo_color": "#2c6c39",
    },
    "Super Save Gas": {
        "name": "Super Save Gas",
        "website": "https://supersave.ca",
        "rewards": "Independent BC Price Leader",
        "logo_color": "#ffcc00",
    },
    "Domo": {
        "name": "Domo Gasoline",
        "website": "https://domo.ca",
        "rewards": "Domo Club Member Discounts",
        "logo_color": "#ed1c24",
    },
    "Wesco": {
        "name": "Wesco Petroleum",
        "website": "https://wescoenergy.ca",
        "rewards": "Local Independent Pricing",
        "logo_color": "#005596",
    },
}

# Known station coordinates & neighborhood directory used for lookup & enrichment
# (Brand, Address, City, Neighborhood, Lat, Lon)
KNOWN_STATIONS = [
    # SURREY: CITY CENTRE & WHALLEY
    ("Chevron", "13595 104 Ave", "Surrey", "City Centre", 49.1913, -122.8465),
    ("Petro-Canada", "13588 96 Ave", "Surrey", "Whalley", 49.1768, -122.8462),
    ("Shell", "13615 108 Ave", "Surrey", "Whalley", 49.1989, -122.8458),
    ("Esso", "13620 96 Ave", "Surrey", "Whalley", 49.1770, -122.8455),
    ("Canco", "13916 Grosvenor Rd", "Surrey", "Whalley", 49.2037, -122.8364),
    ("Super Save Gas", "13999 104 Ave", "Surrey", "City Centre", 49.1915, -122.8351),
    ("Super Save Gas", "10732 128 St", "Surrey", "Whalley", 49.1979, -122.8647),
    ("Canco", "10732 128 St", "Surrey", "Whalley", 49.1979, -122.8647),

    # SURREY: GUILDFORD
    ("Chevron", "10424 152 St", "Surrey", "Guildford", 49.1920, -122.8005),
    ("Shell", "10398 152 St", "Surrey", "Guildford", 49.1914, -122.8008),
    ("Petro-Canada", "10411 152 St", "Surrey", "Guildford", 49.1918, -122.8012),
    ("Esso", "10390 152 St", "Surrey", "Guildford", 49.1910, -122.8007),
    ("Petro-Canada", "15990 104 Ave", "Surrey", "Guildford", 49.1912, -122.7788),
    ("Chevron", "15998 Fraser Hwy", "Surrey", "Guildford", 49.1685, -122.7785),
    ("Shell", "15150 108 Ave", "Surrey", "Guildford", 49.1988, -122.8020),
    ("Canco", "15989 108 Ave", "Surrey", "Guildford", 49.1985, -122.7790),

    # SURREY: FLEETWOOD
    ("Chevron", "8820 152 St", "Surrey", "Fleetwood", 49.1628, -122.8011),
    ("Shell", "8815 152 St", "Surrey", "Fleetwood", 49.1625, -122.8015),
    ("Petro-Canada", "15220 Fraser Hwy", "Surrey", "Fleetwood", 49.1622, -122.8009),
    ("Chevron", "15157 Fraser Hwy", "Surrey", "Fleetwood", 49.1618, -122.8025),
    ("Canco", "15775 Fraser Hwy", "Surrey", "Fleetwood", 49.1602, -122.7856),
    ("Esso", "15980 Fraser Hwy", "Surrey", "Fleetwood", 49.1595, -122.7790),
    ("Shell", "15785 Fraser Hwy", "Surrey", "Fleetwood", 49.1600, -122.7850),

    # SURREY: NEWTON & SCOTT ROAD CORRIDOR
    ("Centex", "7812 120 St", "Surrey", "Newton", 49.1453, -122.8901),
    ("Petro-Canada", "8024 120 St", "Surrey", "Newton", 49.1485, -122.8900),
    ("Chevron", "9610 120 St", "Surrey", "Newton", 49.1772, -122.8898),
    ("Shell", "9590 120 St", "Surrey", "Newton", 49.1765, -122.8899),
    ("Esso", "6422 120 St", "Surrey", "Newton", 49.1197, -122.8898),
    ("Chevron", "6499 120 St", "Surrey", "Newton", 49.1205, -122.8895),
    ("Shell", "12791 72 Ave", "Surrey", "Newton", 49.1342, -122.8684),
    ("Chevron", "6221 King George Blvd", "Surrey", "Newton", 49.1158, -122.8445),
    ("Wesco", "6191 King George Blvd", "Surrey", "Newton", 49.1152, -122.8448),
    ("Shell", "6808 King George Blvd", "Surrey", "Newton", 49.1265, -122.8450),
    ("Esso", "6790 King George Blvd", "Surrey", "Newton", 49.1258, -122.8452),
    ("Petro-Canada", "13588 72 Ave", "Surrey", "Newton", 49.1340, -122.8460),

    # SURREY: CLOVERDALE
    ("Petro-Canada", "17610 56 Ave", "Surrey", "Cloverdale", 49.1045, -122.7350),
    ("Esso", "17590 56 Ave", "Surrey", "Cloverdale", 49.1042, -122.7355),
    ("Petro-Canada", "18383 64 Ave", "Surrey", "Cloverdale", 49.1192, -122.7130),
    ("Shell", "18355 Fraser Hwy", "Surrey", "Cloverdale", 49.1382, -122.7135),
    ("Petro-Canada", "18777 Fraser Hwy", "Surrey", "Cloverdale", 49.1378, -122.7020),
    ("Chevron", "17980 56 Ave", "Surrey", "Cloverdale", 49.1048, -122.7240),

    # SURREY: SOUTH SURREY & SUNNYSIDE
    ("Petro-Canada", "2692 152 St", "Surrey", "South Surrey", 49.0507, -122.8007),
    ("Petro-Canada", "15188 32 Ave", "Surrey", "South Surrey", 49.0608, -122.8015),
    ("Chevron", "16045 24 Ave", "Surrey", "South Surrey", 49.0460, -122.7770),
    ("Shell", "15288 24 Ave", "Surrey", "South Surrey", 49.0458, -122.7985),
    ("Esso", "15175 24 Ave", "Surrey", "South Surrey", 49.0456, -122.8020),
    ("Canco", "14313 Crescent Road", "Surrey", "South Surrey", 49.0677, -122.8251),
    ("Chevron", "15233 16 Ave", "Surrey", "South Surrey", 49.0315, -122.8005),

    # DELTA: NORTH DELTA
    ("Canco", "8781 120 St", "Delta", "North Delta", 49.1545, -122.8904),
    ("Petro-Canada", "8985 120 St", "Delta", "North Delta", 49.1664, -122.8908),
    ("Petro-Canada", "6389 120 St", "Delta", "North Delta", 49.1191, -122.8908),
    ("Esso", "7981 120 St", "Delta", "North Delta", 49.1545, -122.8904),
    ("Domo", "8111 120 St", "Delta", "North Delta", 49.1545, -122.8904),
    ("Chevron", "7195 120 St", "Delta", "North Delta", 49.1335, -122.8906),
    ("Shell", "7165 120 St", "Delta", "North Delta", 49.1330, -122.8906),
    ("Shell", "7077 120 St", "Delta", "North Delta", 49.1310, -122.8905),
    ("Chevron", "11988 88 Ave", "Delta", "North Delta", 49.1625, -122.8908),
    ("Shell", "11915 88 Ave", "Delta", "North Delta", 49.1623, -122.8925),
    ("Petro-Canada", "11985 88 Ave", "Delta", "North Delta", 49.1627, -122.8910),
    ("Shell", "8380 112 St", "Delta", "North Delta", 49.1557, -122.9120),

    # DELTA: TILBURY & RIVER ROAD
    ("Canco", "10240 River Rd", "Delta", "Tilbury", 49.1572, -122.9394),
    ("Canco", "7389 River Rd", "Delta", "Tilbury", 49.1409, -123.0138),

    # DELTA: LADNER
    ("Shell", "5277 48 Ave", "Delta", "Ladner", 49.0901, -123.0847),
    ("Esso", "9591 Ladner Trunk Rd", "Delta", "Ladner", 49.0920, -122.9577),
    ("Petro-Canada", "5221 Ladner Trunk Rd", "Delta", "Ladner", 49.0880, -123.0830),
    ("Chevron", "5220 Ladner Trunk Rd", "Delta", "Ladner", 49.0882, -123.0835),
    ("Esso", "5198 48 Ave", "Delta", "Ladner", 49.0905, -123.0860),

    # DELTA: TSAWWASSEN
    ("Petro-Canada", "5610 12 Ave", "Delta", "Tsawwassen", 49.0245, -123.0683),
    ("Chevron", "1204 56 St", "Delta", "Tsawwassen", 49.0249, -123.0682),
    ("Shell", "1591 56 St", "Delta", "Tsawwassen", 49.0315, -123.0692),
    ("Shell", "4890 Canoe Pass Way", "Delta", "Tsawwassen", 49.0392, -123.0894),

    # WHITE ROCK
    ("Esso", "1595 Nichol Rd", "White Rock", "White Rock", 49.0309, -122.8348),
    ("Petro-Canada", "15205 16 Ave", "White Rock", "White Rock", 49.0314, -122.8015),
    ("Shell", "1548 Johnston Rd", "White Rock", "White Rock", 49.0302, -122.8022),
    ("Chevron", "15233 16 Ave", "White Rock", "White Rock", 49.0315, -122.8005),
]

# Syndicated live feeds from GasBuddy (df.gasbuddy.com)
SYNDICATED_SOURCES = [
    {
        "name": "GasBuddy (Surrey)",
        "city_hint": "Surrey",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOAmW0hjDh2feGq%2bcKr9jZGa&i=25521&url=gvrd.com/gas-prices/surrey.html",
        "page_url": "https://www.gvrd.com/gas-prices/surrey.html",
    },
    {
        "name": "GasBuddy (Delta)",
        "city_hint": "Delta",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOBkmhj0gTUL4eFJFgs9xA58&i=25506&url=gvrd.com/gas-prices/delta.html",
        "page_url": "https://www.gvrd.com/gas-prices/delta.html",
    },
    {
        "name": "GasBuddy (White Rock)",
        "city_hint": "White Rock",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOBkCCnHaMoMK9KtTz23wEFQ&i=25526&url=gvrd.com/gas-prices/white-rock.html",
        "page_url": "https://www.gvrd.com/gas-prices/white-rock.html",
    },
    {
        "name": "GasBuddy (Tsawwassen)",
        "city_hint": "Delta",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BODW5MInqJ4vyr394Rl7N9Xh&i=25522&url=gvrd.com/gas-prices/tsawwassen.html",
        "page_url": "https://www.gvrd.com/gas-prices/tsawwassen.html",
    },
    {
        "name": "GasBuddy (Ladner)",
        "city_hint": "Delta",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOCpkk1lNGvzyMnZks3yjxpD&i=25508&url=gvrd.com/gas-prices/ladner.html",
        "page_url": "https://www.gvrd.com/gas-prices/ladner.html",
    },
]


def clean_html(raw_html: str) -> str:
    """Strip HTML tags and unescape text."""
    clean = re.sub(r"<[^>]+>", "", raw_html)
    clean = clean.replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
    return clean.strip()


def normalize_station_name(raw_name: str) -> str:
    """Clean and normalize station brand names."""
    raw_lower = raw_name.lower()
    if "super save" in raw_lower:
        return "Super Save Gas"
    if "petro-canada" in raw_lower or "petro canada" in raw_lower or "petrocan" in raw_lower:
        return "Petro-Canada"
    if "chevron" in raw_lower:
        return "Chevron"
    if "shell" in raw_lower:
        return "Shell"
    if "esso" in raw_lower:
        return "Esso"
    if "mobil" in raw_lower:
        return "Mobil"
    if "canco" in raw_lower:
        return "Canco"
    if "centex" in raw_lower:
        return "Centex"
    if "wesco" in raw_lower:
        return "Wesco"
    if "domo" in raw_lower:
        return "Domo"

    link_match = re.search(r">([^<]+)</a>", raw_name)
    if link_match:
        name = link_match.group(1).strip()
    else:
        name = clean_html(raw_name)

    name = re.sub(r"<[^>]*", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def normalize_address(raw_addr: str) -> str:
    """Clean address string."""
    addr = clean_html(raw_addr)
    addr = re.sub(r"^\s*<br\s*/?>", "", addr, flags=re.IGNORECASE)
    addr = re.sub(r"\s+", " ", addr).strip()
    return addr


def normalize_city(raw_city: str, city_hint: str = "") -> str:
    """Normalize city string to one of the target cities."""
    text = clean_html(raw_city).lower().strip()
    if not text and city_hint:
        text = city_hint.lower().strip()

    for k, v in CITY_NORMALIZATION.items():
        if k in text:
            return v

    return ""


def generate_map_urls(station_name: str, address: str, city: str, lat: float = None, lon: float = None):
    """
    Generate universal turn-by-turn map navigation links for iPhone, Android, and Web.
    Uses exact destination text so Maps pins the precise gas station address.
    """
    destination = f"{station_name}, {address}, {city}, BC"
    encoded_dest = urllib.parse.quote(destination)

    return {
        "google_maps": f"https://www.google.com/maps/dir/?api=1&destination={encoded_dest}",
        "google_maps_search": f"https://www.google.com/maps/search/?api=1&query={encoded_dest}",
        "apple_maps": f"https://maps.apple.com/?daddr={encoded_dest}&dirflg=d",
        "apple_maps_search": f"https://maps.apple.com/?q={encoded_dest}",
        "android_geo": f"geo:0,0?q={encoded_dest}",
        "ios_maps_scheme": f"maps://?daddr={encoded_dest}&dirflg=d",
    }


def infer_neighborhood(address: str, city: str) -> str:
    """Infer neighborhood from street name and city when not in catalog."""
    addr_lower = address.lower()
    if "120 st" in addr_lower or "scott" in addr_lower:
        return "North Delta / Scott Rd" if city == "Delta" else "Newton / Scott Rd"
    elif "56 st" in addr_lower or "canoe" in addr_lower or "tsawwassen" in addr_lower:
        return "Tsawwassen"
    elif "48 ave" in addr_lower or "ladner" in addr_lower:
        return "Ladner"
    elif "river rd" in addr_lower or "tilbury" in addr_lower:
        return "Tilbury"
    elif "fraser hwy" in addr_lower or "176 st" in addr_lower or "56 ave" in addr_lower:
        return "Cloverdale"
    elif "152 st" in addr_lower or "108 ave" in addr_lower or "104 ave" in addr_lower:
        return "Guildford"
    elif "king george" in addr_lower or "132 st" in addr_lower or "128 st" in addr_lower or "grosvenor" in addr_lower:
        return "Whalley / City Centre"
    elif "16 ave" in addr_lower or "24 ave" in addr_lower or "32 ave" in addr_lower or "crescent" in addr_lower:
        return "South Surrey"
    elif city == "White Rock":
        return "White Rock"
    return "Local District"


def find_known_station(brand: str, address: str, city: str):
    """Match a live report to KNOWN_STATIONS catalog to retrieve accurate coords and neighborhood."""
    num_m = re.search(r"^\d+", address)
    num_str = num_m.group(0) if num_m else ""

    for k_brand, k_addr, k_city, k_neigh, k_lat, k_lon in KNOWN_STATIONS:
        if k_city.lower() != city.lower():
            continue
        k_num_m = re.search(r"^\d+", k_addr)
        k_num_str = k_num_m.group(0) if k_num_m else ""

        # Match by street number and partial street name or brand
        if num_str and k_num_str and num_str == k_num_str:
            return k_neigh, k_lat, k_lon

    # Fallback to defaults
    default_coords = {
        "Surrey": (49.1044, -122.8011),
        "Delta": (49.0880, -123.0830),
        "White Rock": (49.0302, -122.8022),
    }
    coords = default_coords.get(city, (49.1044, -122.8011))
    neighborhood = infer_neighborhood(address, city)
    return neighborhood, coords[0], coords[1]


def fetch_syndicated_feed(source_info: dict) -> list:
    """Fetch and parse live JavaScript syndicated feed from df.gasbuddy.com."""
    url = source_info["url"]
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": source_info.get("page_url", "https://www.gvrd.com/"),
        "Accept": "*/*",
    }

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=12) as response:
        js_content = response.read().decode("utf-8", errors="replace")

    stations_data = {}
    lines = js_content.split(";")

    for line in lines:
        m = re.search(r"document\.getElementById\('([^']+)'\)\.innerHTML\s*=\s*'([^']*)'", line)
        if not m:
            continue
        elem_id, val = m.group(1), m.group(2)

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
        if price_val < 10.0:
            price_val = round(price_val * 100, 1)

        station_name = normalize_station_name(item.get("station_raw", ""))
        address = normalize_address(item.get("address_raw", ""))
        city = normalize_city(item.get("area_raw", ""), source_info.get("city_hint", ""))

        if not city or city not in VALID_CITIES:
            continue
        if not station_name or not address:
            continue

        time_str = clean_html(item.get("time_raw", "")).strip() or "Recently reported"

        results.append({
            "station_name": station_name,
            "price": price_val,
            "address": address,
            "city": city,
            "last_updated": time_str,
            "source_name": source_info["name"],
            "source_url": source_info["page_url"],
        })

    return results


def build_live_station_record(item: dict) -> dict:
    """Construct standard output station dictionary from live GasBuddy report."""
    brand = item["station_name"]
    address = item["address"]
    city = item["city"]
    price_val = item["price"]
    time_str = item["last_updated"]
    source_name = item["source_name"]
    source_url = item["source_url"]

    meta = BRAND_METADATA.get(brand, {
        "website": "https://www.google.com/search?q=" + urllib.parse.quote(f"{brand} gas station BC"),
        "rewards": "Local station rewards",
        "logo_color": "#2563eb",
    })

    neighborhood, lat, lon = find_known_station(brand, address, city)
    map_urls = generate_map_urls(brand, address, city, lat, lon)
    station_id = f"{city.lower()}_{re.sub(r'[^a-zA-Z0-9]', '', address).lower()}"

    return {
        "id": station_id,
        "station_name": brand,
        "brand": brand,
        "brand_official_url": meta["website"],
        "brand_rewards": meta["rewards"],
        "brand_color": meta["logo_color"],
        "neighborhood": neighborhood,
        "price": round(price_val, 1),
        "price_formatted": f"{price_val:.1f}¢",
        "price_per_litre": f"${price_val / 100:.3f}",
        "fuel_type": "regular",
        "address": address,
        "city": city,
        "province": "BC",
        "country": "Canada",
        "last_updated": time_str,
        "is_live": True,
        "source": "via Live Report, GasBuddy",
        "source_name": "via Live Report, GasBuddy",
        "feed_origin": source_name,
        "source_url": source_url,
        "latitude": lat,
        "longitude": lon,
        "map_urls": map_urls,
    }


def fetch_all_prices():
    """Main execution: exclusively fetches live reports from GasBuddy feeds and saves to JSON."""
    print(f"[{datetime.now(timezone.utc).isoformat()}] Fetching live gas prices exclusively from GasBuddy...")

    all_sources_summary = []
    live_reports_by_key = {}

    for src in SYNDICATED_SOURCES:
        print(f"Fetching from {src['name']}...")
        try:
            items = fetch_syndicated_feed(src)
            print(f"  -> Extracted {len(items)} live reported stations from {src['name']}")
            for item in items:
                # Key on city + street number (or clean address) for deduplication
                num_m = re.search(r"^\d+", item["address"])
                addr_key = num_m.group(0) if num_m else re.sub(r"[^a-zA-Z0-9]", "", item["address"]).lower()
                key = f"{item['city'].lower()}_{addr_key}"

                if key not in live_reports_by_key:
                    live_reports_by_key[key] = item
                else:
                    # If already present, keep the lower price
                    if item["price"] < live_reports_by_key[key]["price"]:
                        live_reports_by_key[key] = item

            all_sources_summary.append({
                "name": src["name"],
                "url": src["page_url"],
                "type": "GasBuddy Real-Time Live Feed",
                "status": "active (verified)",
                "stations_reported": len(items),
            })
        except Exception as e:
            print(f"  -> Error fetching {src['name']}: {e}")
            all_sources_summary.append({
                "name": src["name"],
                "url": src["page_url"],
                "type": "GasBuddy Real-Time Live Feed",
                "status": f"error: {str(e)}",
                "stations_reported": 0,
            })

    # Build compiled stations list solely from live reports
    compiled_stations = []
    for key, report in live_reports_by_key.items():
        record = build_live_station_record(report)
        compiled_stations.append(record)

    # Sort strictly by price ascending (cheapest first)
    compiled_stations.sort(key=lambda s: s["price"])

    cheapest_overall = compiled_stations[0] if compiled_stations else None
    cheapest_by_city = {}
    for c in VALID_CITIES:
        city_stations = [s for s in compiled_stations if s["city"] == c]
        if city_stations:
            cheapest_by_city[c] = city_stations[0]["id"]

    now_utc = datetime.now(timezone.utc)
    output_payload = {
        "metadata": {
            "title": "Surrey, Delta & White Rock Gas Prices",
            "last_updated_utc": now_utc.isoformat(),
            "last_updated_formatted": now_utc.strftime("%B %d, %Y at %I:%M %p UTC"),
            "target_region": "Surrey, Delta, White Rock, British Columbia",
            "fuel_type_default": "regular",
            "supported_fuel_types": ["regular", "diesel", "premium"],
            "total_stations": len(compiled_stations),
            "data_source_description": "100% Real-Time GasBuddy Live Driver Reports",
            "sources": all_sources_summary,
            "cheapest_overall_id": cheapest_overall["id"] if cheapest_overall else None,
        },
        "cheapest_by_city": cheapest_by_city,
        "stations": compiled_stations,
    }

    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "gas_prices.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)

    print(f"Successfully compiled and saved {len(compiled_stations)} live stations to {os.path.abspath(output_path)}.")
    if cheapest_overall:
        print(f"Cheapest overall: {cheapest_overall['brand']} at {cheapest_overall['address']}, {cheapest_overall['city']} ({cheapest_overall['price_formatted']})")


if __name__ == "__main__":
    fetch_all_prices()
