#!/usr/bin/env python3
"""
Build data/generated/postal-addresses.json by joining postal codes (ken-all mirror)
with town-level coordinates from geolonia/japanese-addresses.

Run from project root: python3 scripts/build-postal-data.py

Shape per record:
  postalCode, postalCodeFormatted, prefecture, city, town,
  address, addressNormalized, kana, lat, lng
"""
import csv, io, json, sys, unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request

KENALL_BASE  = 'https://ken-all.numb86.net/csv/{}.csv'
GEOLONIA_URL = 'https://raw.githubusercontent.com/geolonia/japanese-addresses/develop/data/latest.csv'
OUT          = 'data/generated/postal-addresses.json'

PLACEHOLDER = '以下に掲載がない場合'

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def nfkc(s): return unicodedata.normalize('NFKC', s)

# ── Step 1: download postal data (reuse existing if present) ─────────────────
import os
if os.path.exists('postal_data.json'):
    print('Loading existing postal_data.json…', file=sys.stderr)
    with open('postal_data.json', encoding='utf-8') as f:
        postal_raw = json.load(f)
else:
    print('Fetching postal data from ken-all…', file=sys.stderr)
    def fetch_prefix(prefix):
        url = KENALL_BASE.format(str(prefix).zfill(3))
        try:
            body = fetch(url, timeout=15).decode('utf-8')
            rows = []
            for row in csv.reader(io.StringIO(body)):
                if len(row) < 4: continue
                suffix = row[0].strip().strip('"')
                if not suffix.isdigit() or len(suffix) != 4: continue
                rows.append([str(prefix).zfill(3) + suffix,
                             row[1].strip().strip('"'),
                             row[2].strip().strip('"'),
                             row[3].strip().strip('"')])
            return rows
        except Exception:
            return []
    postal_raw = []
    with ThreadPoolExecutor(max_workers=20) as pool:
        futs = {pool.submit(fetch_prefix, p): p for p in range(1, 1000)}
        for fut in as_completed(futs):
            postal_raw.extend(fut.result())
    postal_raw.sort(key=lambda r: r[0])

# ── Step 2: geolonia coordinates ─────────────────────────────────────────────
print('Downloading geolonia coordinates…', file=sys.stderr)
raw_csv = fetch(GEOLONIA_URL, timeout=120).decode('utf-8')
reader  = csv.reader(io.StringIO(raw_csv))
next(reader)

# Index: (pref, city, town_base) → (lat, lng)
geo = {}
for row in reader:
    if len(row) < 14: continue
    try:
        lat = float(row[12]); lng = float(row[13])
    except ValueError:
        continue
    pref = row[1]; city = row[5]
    town_full = row[8]  # may include 一丁目, 二丁目 etc.
    # strip trailing choban digits to get base town name
    import re
    town_base = re.sub(r'[一二三四五六七八九十百千\d]+丁目.*$', '', town_full).strip()
    for k in [(pref, city, town_full), (pref, city, town_base)]:
        if k not in geo:
            geo[k] = (lat, lng)

print(f'  {len(geo)} geo index entries', file=sys.stderr)

# ── Step 3: join and output ───────────────────────────────────────────────────
print('Joining and writing…', file=sys.stderr)
records = []
matched = 0
for row in postal_raw:
    code = row[0]
    pref = row[1]; city = row[2]; town = row[3]
    if PLACEHOLDER in town: town = ''
    code_fmt = code[:3] + '-' + code[3:]
    addr     = pref + city + ('　' + town if town else '')
    lat, lng = None, None
    for k in [(pref, city, town), (pref, city, '')]:
        if k in geo:
            lat, lng = geo[k]; matched += 1; break
    records.append({
        'postalCode':          code,
        'postalCodeFormatted': code_fmt,
        'prefecture':          pref,
        'city':                city,
        'town':                town,
        'address':             addr,
        'addressNormalized':   nfkc(addr),
        'kana':                '',
        'lat':                 round(lat, 6) if lat else None,
        'lng':                 round(lng, 6) if lng else None,
    })

print(f'  {len(records)} records, {matched} with coordinates ({100*matched//len(records)}%)',
      file=sys.stderr)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, separators=(',', ':'))
kb = len(open(OUT, encoding='utf-8').read()) // 1024
print(f'Done. {OUT}: {kb:,} KB', file=sys.stderr)
