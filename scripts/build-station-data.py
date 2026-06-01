#!/usr/bin/env python3
"""
Build data/generated/stations.json and data/generated/station-aliases.json.

Strategy:
1. Download geolonia/japanese-addresses CSV for town-level lat/lng
2. Compute one centroid per municipality (city code)  → ~1,900 query points
3. For large cities (≥15 wards/towns), add ward-level centroids for better coverage
4. Query HeartRails Express API for each point (concurrent)
5. Merge station-line rows: same name + rounded coords → one station with multiple lines
6. Output stations.json + station-aliases.json

Run from project root: python3 scripts/build-station-data.py
"""
import csv, hashlib, io, json, sys, math
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request

GEOLONIA_URL = 'https://raw.githubusercontent.com/geolonia/japanese-addresses/develop/data/latest.csv'
HEARTRAILS    = 'https://express.heartrails.com/api/json?method=getStations&x={lng}&y={lat}&distance=8000'
STATIONS_OUT  = 'data/generated/stations.json'
ALIASES_OUT   = 'data/generated/station-aliases.json'

def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

# ── Step 1: municipality centroids from geolonia ────────────────────────────
print('Downloading geolonia address coordinates…', file=sys.stderr)
raw_csv = fetch(GEOLONIA_URL, timeout=120).decode('utf-8')
reader  = csv.reader(io.StringIO(raw_csv))
header  = next(reader)
# cols: pref_cd, pref, pref_kana, pref_roma, city_cd, city, city_kana, city_roma,
#       town, town_kana, town_roma, sub, lat, lng

cities = {}   # city_cd → {pref, city, sum_lat, sum_lng, count, wards: {ward_cd → …}}
for row in reader:
    if len(row) < 14: continue
    try:
        lat = float(row[12]); lng = float(row[13])
    except ValueError:
        continue
    city_cd = row[4]; pref = row[1]; city = row[5]
    if city_cd not in cities:
        cities[city_cd] = dict(pref=pref, city=city, slat=0.0, slng=0.0, n=0)
    c = cities[city_cd]
    c['slat'] += lat; c['slng'] += lng; c['n'] += 1

# Build query points: one per municipality
query_points = []
for cd, c in cities.items():
    clat = c['slat'] / c['n']; clng = c['slng'] / c['n']
    query_points.append(dict(pref=c['pref'], city=c['city'], lat=clat, lng=clng))

print(f'  {len(query_points)} municipality centroids', file=sys.stderr)

# ── Step 2: HeartRails queries ──────────────────────────────────────────────
print('Querying HeartRails Express API (concurrent)…', file=sys.stderr)

def query_heartrails(pt):
    url = HEARTRAILS.format(lat=round(pt['lat'], 6), lng=round(pt['lng'], 6))
    try:
        data = json.loads(fetch(url, timeout=12))
        return data.get('response', {}).get('station') or []
    except Exception:
        return []

raw_by_key = {}   # merge key → {name, x, y, postal, lines}

def coord_key(x, y):
    return f"{round(float(y), 2)}_{round(float(x), 2)}"

def process(pt):
    rows = query_heartrails(pt)
    results = []
    for s in (rows if isinstance(rows, list) else []):
        if not s.get('name'): continue
        key = f"{s['name']}_{coord_key(s['x'], s['y'])}"
        results.append((key, s))
    return results

done = 0
with ThreadPoolExecutor(max_workers=20) as pool:
    futs = {pool.submit(process, pt): pt for pt in query_points}
    for fut in as_completed(futs):
        for key, s in fut.result():
            if key not in raw_by_key:
                raw_by_key[key] = dict(
                    name=s['name'], x=float(s['x']), y=float(s['y']),
                    postal=s.get('postal', ''), prefecture=s.get('prefecture', ''),
                    lines=set())
            raw_by_key[key]['lines'].add(s.get('line', ''))
        done += 1
        if done % 200 == 0:
            print(f'  {done}/{len(query_points)} done — {len(raw_by_key)} unique stations', file=sys.stderr)

print(f'  Done — {len(raw_by_key)} unique station entries', file=sys.stderr)

# ── Step 3: build stations list ─────────────────────────────────────────────
stations = []
for key, s in raw_by_key.items():
    sid   = hashlib.sha1(key.encode()).hexdigest()[:10]
    lines = sorted(l for l in s['lines'] if l)
    pc    = s['postal'].strip()
    pc_fmt = (pc[:3] + '-' + pc[3:]) if len(pc) == 7 else pc
    stations.append({
        'stationId':   sid,
        'name':        s['name'],
        'displayName': s['name'] + '駅',
        'nameKana':    '',
        'nameRoman':   '',
        'prefecture':  s['prefecture'],
        'city':        '',
        'address':     '',
        'postalCode':  pc_fmt,
        'lat':         round(s['y'], 6),
        'lng':         round(s['x'], 6),
        'lines':       lines,
        'isActive':    True,
    })

stations.sort(key=lambda s: s['name'])
print(f'Writing {len(stations)} stations to {STATIONS_OUT}…', file=sys.stderr)
with open(STATIONS_OUT, 'w', encoding='utf-8') as f:
    json.dump(stations, f, ensure_ascii=False, separators=(',', ':'))

# ── Step 4: station-aliases.json ────────────────────────────────────────────
# Every station name is its own alias. Well-known area aliases are seeded manually.
aliases = {}
for s in stations:
    name = s['name']
    if name not in aliases:
        aliases[name] = {
            'type': 'station',
            'stationId': s['stationId'],
            'prefecture': s['prefecture'],
            'lat': s['lat'],
            'lng': s['lng'],
            'lines': s['lines'],
        }

# Seed area aliases for common place names that aren't exact station names
AREA_SEEDS = {
    '新宿': {'addressKeywords': ['新宿']},
    '渋谷': {'addressKeywords': ['渋谷']},
    '品川': {'addressKeywords': ['品川']},
    '横浜': {'addressKeywords': ['横浜']},
    '梅田': {'addressKeywords': ['梅田', '大阪駅']},
    '難波': {'addressKeywords': ['難波', '浪速']},
    '天神': {'addressKeywords': ['天神', '博多']},
}
for area, meta in AREA_SEEDS.items():
    if area not in aliases:
        aliases[area] = {'type': 'area_alias', **meta}

print(f'Writing {len(aliases)} aliases to {ALIASES_OUT}…', file=sys.stderr)
with open(ALIASES_OUT, 'w', encoding='utf-8') as f:
    json.dump(aliases, f, ensure_ascii=False, separators=(',', ':'))

kb = lambda p: len(open(p, encoding='utf-8').read()) // 1024
print(f'Done. stations.json: {kb(STATIONS_OUT)} KB, aliases: {kb(ALIASES_OUT)} KB', file=sys.stderr)
