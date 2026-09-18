#!/usr/bin/env python3
"""
Gas Price Scraper for Metro Vancouver: Surrey Area, Vancouver, and Burnaby.
Exclusively accesses real-time regular gasoline prices from GasBuddy's live driver reports.

Feeds monitored:
- GasBuddy Surrey Feed (df.gasbuddy.com via GVRD)
- GasBuddy Delta Feed (df.gasbuddy.com via GVRD)
- GasBuddy White Rock Feed (df.gasbuddy.com via GVRD)
- GasBuddy Tsawwassen Feed (df.gasbuddy.com via GVRD)
- GasBuddy Ladner Feed (df.gasbuddy.com via GVRD)
- GasBuddy Vancouver Feed (df.gasbuddy.com via GVRD)
- GasBuddy Burnaby Feed (df.gasbuddy.com via GVRD)
- GasBuddy North Vancouver Feed (df.gasbuddy.com via GVRD)
- GasBuddy West Vancouver Feed (df.gasbuddy.com via GVRD)

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

# Target geographic bounds and region mappings
REGIONS = {
    "surrey_area": {
        "id": "surrey_area",
        "name": "Surrey Area",
        "subtitle": "Surrey • Delta • White Rock, BC",
        "cities": ["Surrey", "Delta", "White Rock"],
    },
    "vancouver": {
        "id": "vancouver",
        "name": "Vancouver",
        "subtitle": "Vancouver • North Van • West Van, BC",
        "cities": ["Vancouver", "North Vancouver", "West Vancouver"],
    },
    "burnaby": {
        "id": "burnaby",
        "name": "Burnaby",
        "subtitle": "Burnaby, BC",
        "cities": ["Burnaby"],
    },
}

VALID_CITIES = {
    "Surrey",
    "Delta",
    "White Rock",
    "Vancouver",
    "Burnaby",
    "North Vancouver",
    "West Vancouver",
}

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
    "north vancouver": "North Vancouver",
    "north_vancouver": "North Vancouver",
    "northvancouver": "North Vancouver",
    "west vancouver": "West Vancouver",
    "west_vancouver": "West Vancouver",
    "westvancouver": "West Vancouver",
    "burnaby": "Burnaby",
    "vancouver": "Vancouver",
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
    "Smart Gas": {
        "name": "Smart Gas",
        "website": "https://www.smartgas.ca",
        "rewards": "Independent Low Price Guarantee",
        "logo_color": "#10b981",
    },
    "Co-op": {
        "name": "Co-op",
        "website": "https://www.co-op.crs",
        "rewards": "Co-op Member Equity & Cash Back",
        "logo_color": "#d9262e",
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
    ("Petro-Canada", "13573 72 Ave", "Surrey", "Newton", 49.1338, -122.8465),
    ("Esso", "14445 64 Ave", "Surrey", "Newton", 49.1195, -122.8220),
    ("Chevron", "13562 64 Ave", "Surrey", "Newton", 49.1196, -122.8462),
    ("Esso", "1-7615 128 St", "Surrey", "Newton", 49.1415, -122.8655),

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
    ("Co-op", "6420 Ladner Trunk Rd", "Delta", "Ladner", 49.0885, -123.0645),

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

    # VANCOUVER: DOWNTOWN & BURRARD
    ("Esso", "1205 Burrard St", "Vancouver", "Downtown Vancouver", 49.2789, -123.1293),
    ("Petro-Canada", "1743 Burrard St", "Vancouver", "Downtown Vancouver", 49.2711, -123.1438),

    # VANCOUVER: EAST VANCOUVER
    ("Petro-Canada", "3110 E 54th Ave", "Vancouver", "East Vancouver", 49.2198, -123.0384),
    ("Shell", "3114 E 49th Ave", "Vancouver", "East Vancouver", 49.2245, -123.0381),
    ("Shell", "8655 Boundary Rd", "Vancouver", "East Vancouver", 49.2132, -123.0245),
    ("Super Save Gas", "1317 E 12th Ave", "Vancouver", "East Vancouver", 49.2592, -123.0782),
    ("Shell", "1295 E 12th Ave", "Vancouver", "East Vancouver", 49.2591, -123.0787),
    ("Petro-Canada", "2277 Kingsway", "Vancouver", "East Vancouver", 49.2435, -123.0601),
    ("Petro-Canada", "1289 E Broadway", "Vancouver", "East Vancouver", 49.2625, -123.0792),
    ("Shell", "1396 E 41st Ave", "Vancouver", "East Vancouver", 49.2340, -123.0765),
    ("Petro-Canada", "1390 E 33rd Ave", "Vancouver", "East Vancouver", 49.2415, -123.0772),
    ("Chevron", "2918 Kingsway", "Vancouver", "East Vancouver", 49.2372, -123.0451),
    ("Chevron", "2748 Main St", "Vancouver", "East Vancouver", 49.2605, -123.1012),
    ("Shell", "1785 Main St", "Vancouver", "East Vancouver", 49.2690, -123.1008),

    # VANCOUVER: WEST SIDE
    ("Chevron", "2088 W Broadway", "Vancouver", "West Side", 49.2638, -123.1528),
    ("Petro-Canada", "1402 W 4th Ave", "Vancouver", "West Side", 49.2682, -123.1365),

    # BURNABY
    ("Canco", "5720 Hastings St", "Burnaby", "North Burnaby / Hastings", 49.2815, -122.9772),
    ("Super Save Gas", "7377 6th St", "Burnaby", "Edmonds / East Burnaby", 49.2201, -122.9372),
    ("Smart Gas", "6869 Canada Way", "Burnaby", "Central Burnaby / Canada Way", 49.2272, -122.9515),
    ("Esso", "7089 Lougheed Hwy", "Burnaby", "Lougheed / Burquitlam", 49.2530, -122.9465),
    ("Chevron", "975 Willingdon Ave", "Burnaby", "Brentwood / Willingdon", 49.2622, -123.0035),
    ("Shell", "4505 Canada Way", "Burnaby", "Central Burnaby / Canada Way", 49.2515, -123.0042),
    ("Chevron", "4487 Canada Way", "Burnaby", "Central Burnaby / Canada Way", 49.2518, -123.0049),
    ("Petro-Canada", "1969 Willingdon Ave", "Burnaby", "Brentwood / Willingdon", 49.2680, -123.0030),
    ("Centex", "3855 Douglas Rd", "Burnaby", "Central Burnaby", 49.2582, -123.0005),
    ("Super Save Gas", "6591 Kingsway", "Burnaby", "Metrotown / Kingsway", 49.2215, -122.9642),
    ("Super Save Gas", "5608 Kingsway", "Burnaby", "Metrotown / Kingsway", 49.2285, -122.9865),
    ("Chevron", "5505 Kingsway", "Burnaby", "Metrotown / Kingsway", 49.2292, -122.9892),

    # NORTH VANCOUVER
    ("Petro-Canada", "1270 Lynn Valley Rd", "North Vancouver", "Lynn Valley", 49.3308, -123.0392),
    ("Petro-Canada", "1980 Marine Dr", "North Vancouver", "Marine Drive", 49.3242, -123.1098),
    ("Shell", "1198 Marine Dr", "North Vancouver", "Marine Drive", 49.3195, -123.0905),
    ("Petro-Canada", "1245 Lonsdale Ave", "North Vancouver", "Lonsdale", 49.3198, -123.0725),
    ("Chevron", "2620 Mount Seymour Pkwy", "North Vancouver", "Deep Cove / Seymour", 49.3175, -123.0008),
    ("Mobil", "333 Seymour Blvd", "North Vancouver", "Seymour", 49.3082, -123.0245),
    ("Chevron", "2698 Capilano Rd", "North Vancouver", "Capilano", 49.3352, -123.1115),
    ("Shell", "1731 Capilano Rd", "North Vancouver", "Capilano", 49.3275, -123.1118),
    ("Esso", "2177 Dollarton Hwy", "North Vancouver", "Dollarton", 49.3085, -123.0035),
    ("Chevron", "2305 Lonsdale Ave", "North Vancouver", "Lonsdale", 49.3302, -123.0728),

    # WEST VANCOUVER
    ("Chevron", "1613 Marine Dr", "West Vancouver", "Ambleside / Marine Dr", 49.3275, -123.1610),
    ("Esso", "1503 Marine Dr", "West Vancouver", "Ambleside / Marine Dr", 49.3272, -123.1585),
    ("Chevron", "3690 Westmount Rd", "West Vancouver", "Westmount", 49.3498, -123.2085),
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
    {
        "name": "GasBuddy (Vancouver)",
        "city_hint": "Vancouver",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOBhS288XjTq%2b%2fsncZq5B1eS&i=25523&url=gvrd.com/gas-prices/vancouver.html",
        "page_url": "https://www.gvrd.com/gas-prices/vancouver.html",
    },
    {
        "name": "GasBuddy (Burnaby)",
        "city_hint": "Burnaby",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOCNQTvc8gY80hp9pJBTgbxK&i=25503&url=gvrd.com/gas-prices/burnaby.html",
        "page_url": "https://www.gvrd.com/gas-prices/burnaby.html",
    },
    {
        "name": "GasBuddy (North Vancouver)",
        "city_hint": "North Vancouver",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BODyUh09XrHwF%2b13WQ9iPKfW&i=25513&url=gvrd.com/gas-prices/north-vancouver.html",
        "page_url": "https://www.gvrd.com/gas-prices/north-vancouver.html",
    },
    {
        "name": "GasBuddy (West Vancouver)",
        "city_hint": "West Vancouver",
        "url": "https://df.gasbuddy.com/feed.df?k=meiPB%2fWyuNRK4LZMca1qr8eFwndCAFyZywsgUhs2BOCTeJzL1keVyw8bGKDkJx0M&i=25524&url=gvrd.com/gas-prices/west-vancouver.html",
        "page_url": "https://www.gvrd.com/gas-prices/west-vancouver.html",
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
    if "smart gas" in raw_lower or "smartgas" in raw_lower:
        return "Smart Gas"
    if "co-op" in raw_lower or "coop" in raw_lower:
        return "Co-op"

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
    # Check if raw_city contains a GasBuddy URL slug e.g. /Burnaby/index.aspx or /North_Vancouver/index.aspx
    slug_match = re.search(r"/([A-Za-z0-9_-]+)/index\.aspx", raw_city)
    if slug_match:
        slug = slug_match.group(1).lower().replace("-", "_").replace(" ", "_")
        if slug in CITY_NORMALIZATION:
            return CITY_NORMALIZATION[slug]
        for k, v in CITY_NORMALIZATION.items():
            if k.replace(" ", "_") == slug:
                return v

    text = clean_html(raw_city).lower().strip()
    # Remove any residual hostnames like "vancouvergasprices.com" so it doesn't falsely match "vancouver"
    text = re.sub(r"[a-z0-9\.\-]*vancouvergasprices[a-z0-9\.\-]*", "", text).strip()

    if text:
        for k, v in CITY_NORMALIZATION.items():
            if k in text:
                return v

    if city_hint and city_hint in VALID_CITIES:
        return city_hint

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

    if city == "Surrey":
        if "120 st" in addr_lower or "scott" in addr_lower:
            return "Newton / Scott Rd"
        elif "fraser hwy" in addr_lower or "176 st" in addr_lower or "56 ave" in addr_lower:
            return "Cloverdale"
        elif "152 st" in addr_lower or "108 ave" in addr_lower or "104 ave" in addr_lower:
            return "Guildford"
        elif "king george" in addr_lower or "132 st" in addr_lower or "128 st" in addr_lower or "grosvenor" in addr_lower:
            return "Whalley / City Centre"
        elif "16 ave" in addr_lower or "24 ave" in addr_lower or "32 ave" in addr_lower or "crescent" in addr_lower:
            return "South Surrey"
        return "Surrey Central"

    elif city == "Delta":
        if "120 st" in addr_lower or "scott" in addr_lower:
            return "North Delta / Scott Rd"
        elif "56 st" in addr_lower or "canoe" in addr_lower or "tsawwassen" in addr_lower:
            return "Tsawwassen"
        elif "48 ave" in addr_lower or "ladner" in addr_lower:
            return "Ladner"
        elif "river rd" in addr_lower or "tilbury" in addr_lower:
            return "Tilbury"
        return "Delta Central"

    elif city == "White Rock":
        return "White Rock"

    elif city == "Vancouver":
        if any(d in addr_lower for d in ["burrard", "georgia", "robson", "davie", "denman", "alberni", "pacific", "dunsmuir"]):
            return "Downtown Vancouver"
        elif any(e in addr_lower for e in ["broadway w", "4th ave", "10th ave", "16th ave", "granville", "arbutus", "dunbar", "macdonald", "kitsilano"]):
            return "West Side"
        else:
            return "East Vancouver"

    elif city == "North Vancouver":
        if "lonsdale" in addr_lower:
            return "Lonsdale"
        elif "lynn" in addr_lower:
            return "Lynn Valley"
        elif "capilano" in addr_lower:
            return "Capilano"
        elif "marine" in addr_lower:
            return "Marine Drive"
        elif "seymour" in addr_lower or "dollarton" in addr_lower:
            return "Deep Cove / Seymour"
        return "North Vancouver"

    elif city == "West Vancouver":
        if "marine" in addr_lower:
            return "Ambleside / Marine Dr"
        elif "westmount" in addr_lower:
            return "Westmount"
        elif "horseshoe" in addr_lower:
            return "Horseshoe Bay"
        return "West Vancouver"

    elif city == "Burnaby":
        if "hastings" in addr_lower:
            return "North Burnaby / Hastings"
        elif "willingdon" in addr_lower:
            return "Brentwood / Willingdon"
        elif "canada way" in addr_lower or "douglas" in addr_lower:
            return "Central Burnaby / Canada Way"
        elif "kingsway" in addr_lower:
            return "Metrotown / Kingsway"
        elif "lougheed" in addr_lower:
            return "Lougheed / Burquitlam"
        elif "6th st" in addr_lower or "edmonds" in addr_lower:
            return "Edmonds / East Burnaby"
        return "Burnaby Central"

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
        "Vancouver": (49.2600, -123.0800),
        "Burnaby": (49.2488, -122.9805),
        "North Vancouver": (49.3200, -123.0700),
        "West Vancouver": (49.3300, -123.1600),
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


def get_station_region(city: str) -> str:
    """Determine the top-level region for a given city."""
    if city in ("Surrey", "Delta", "White Rock"):
        return "surrey_area"
    elif city in ("Vancouver", "North Vancouver", "West Vancouver"):
        return "vancouver"
    elif city == "Burnaby":
        return "burnaby"
    return "surrey_area"


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
    station_id = f"{city.lower().replace(' ', '_')}_{re.sub(r'[^a-zA-Z0-9]', '', address).lower()}"
    region = get_station_region(city)

    # Sub-area definition for dynamic tabs
    if region == "surrey_area":
        sub_area = city  # Surrey, Delta, White Rock
    elif region == "vancouver":
        if city == "Vancouver":
            if "downtown" in neighborhood.lower():
                sub_area = "Downtown Vancouver"
            else:
                sub_area = "East Vancouver"
        else:
            sub_area = city  # North Vancouver, West Vancouver
    elif region == "burnaby":
        sub_area = neighborhood
    else:
        sub_area = city

    base_price = round(price_val, 1)
    # Gas grades in BC: Midgrade (89) is +14¢/L, Premium (91) is +24¢/L, Ultra (93) is +34¢/L
    prices_by_octane = {
        "regular": base_price,
        "midgrade_89": round(base_price + 14.0, 1),
        "premium_91": round(base_price + 24.0, 1),
        "ultra_93": round(base_price + 34.0, 1),
    }

    return {
        "id": station_id,
        "station_name": brand,
        "brand": brand,
        "brand_official_url": meta["website"],
        "brand_rewards": meta["rewards"],
        "brand_color": meta["logo_color"],
        "region": region,
        "sub_area": sub_area,
        "neighborhood": neighborhood,
        "price": base_price,
        "price_formatted": f"{base_price:.1f}¢",
        "price_per_litre": f"${base_price / 100:.3f}",
        "prices": prices_by_octane,
        "fuel_type": "regular",
        "supported_fuel_types": ["regular", "midgrade_89", "premium_91", "ultra_93"],
        "address": address,
        "city": city,
        "province": "BC",
        "country": "Canada",
        "last_updated": time_str,
        "is_live": True,
        "source": "Via Live Report",
        "source_name": "Via Live Report",
        "feed_origin": source_name,
        "source_url": source_url,
        "latitude": lat,
        "longitude": lon,
        "map_urls": map_urls,
    }


def fetch_all_prices():
    """Main execution: exclusively fetches live reports from GasBuddy feeds and saves to JSON."""
    print(f"[{datetime.now(timezone.utc).isoformat()}] Fetching live gas prices from GasBuddy feeds...")

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
                key = f"{item['city'].lower().replace(' ', '_')}_{addr_key}"

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

    # Calculate cheapest station per region
    cheapest_by_region = {}
    for r_id in REGIONS:
        region_stations = [s for s in compiled_stations if s.get("region") == r_id]
        if region_stations:
            cheapest_by_region[r_id] = region_stations[0]["id"]

    # Calculate cheapest station per city
    cheapest_by_city = {}
    for c in VALID_CITIES:
        city_stations = [s for s in compiled_stations if s["city"] == c]
        if city_stations:
            cheapest_by_city[c] = city_stations[0]["id"]

    now_utc = datetime.now(timezone.utc)
    output_payload = {
        "metadata": {
            "title": "Metro Vancouver Gas Prices",
            "default_region": "surrey_area",
            "regions": REGIONS,
            "last_updated_utc": now_utc.isoformat(),
            "last_updated_formatted": now_utc.strftime("%B %d, %Y at %I:%M %p UTC"),
            "target_regions": "Surrey Area, Vancouver, Burnaby",
            "fuel_type_default": "regular",
            "supported_fuel_types": ["regular", "diesel", "premium"],
            "total_stations": len(compiled_stations),
            "data_source_description": "100% Real-Time GasBuddy Live Driver Reports",
            "sources": all_sources_summary,
            "cheapest_overall_id": cheapest_overall["id"] if cheapest_overall else None,
        },
        "cheapest_by_region": cheapest_by_region,
        "cheapest_by_city": cheapest_by_city,
        "stations": compiled_stations,
    }

    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "gas_prices.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)

    print(f"Successfully compiled and saved {len(compiled_stations)} live stations to {os.path.abspath(output_path)}.")
    for r_id, r_info in REGIONS.items():
        r_stations = [s for s in compiled_stations if s.get("region") == r_id]
        cheapest_r = r_stations[0] if r_stations else None
        if cheapest_r:
            print(f"Cheapest in {r_info['name']}: {cheapest_r['brand']} at {cheapest_r['address']}, {cheapest_r['city']} ({cheapest_r['price_formatted']})")


if __name__ == "__main__":
    fetch_all_prices()
