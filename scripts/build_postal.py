#!/usr/bin/env python3
"""
Build postal_data.json from ken-all.numb86.net (mirrors Japan Post KEN_ALL data).
Run from project root: python3 scripts/build_postal.py
Re-run periodically to refresh data (Japan Post updates monthly).

Data format per record: [code7, prefecture, city, town]
"""
import csv, io, json, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request

BASE = 'https://ken-all.numb86.net/csv/{}.csv'
OUT  = 'postal_data.json'

def fetch_prefix(prefix):
    url = BASE.format(str(prefix).zfill(3))
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as r:
            if r.status != 200:
                return prefix, []
            body = r.read().decode('utf-8')
        rows = []
        for row in csv.reader(io.StringIO(body)):
            if len(row) < 4:
                continue
            suffix = row[0].strip().strip('"')
            if not suffix.isdigit() or len(suffix) != 4:
                continue
            code = str(prefix).zfill(3) + suffix
            pref = row[1].strip().strip('"')
            city = row[2].strip().strip('"')
            town = row[3].strip().strip('"')
            rows.append([code, pref, city, town])
        return prefix, rows
    except Exception:
        return prefix, []

# Valid Japanese postal code prefixes: 001–999 (000 is 403 forbidden)
prefixes = list(range(1, 1000))

print(f'Fetching {len(prefixes)} prefix files (concurrent)...', file=sys.stderr)
all_records = []
done = 0

with ThreadPoolExecutor(max_workers=20) as pool:
    futures = {pool.submit(fetch_prefix, p): p for p in prefixes}
    for fut in as_completed(futures):
        prefix, rows = fut.result()
        all_records.extend(rows)
        done += 1
        if done % 100 == 0:
            print(f'  {done}/{len(prefixes)} files, {len(all_records):,} records so far', file=sys.stderr)

# Sort by postal code for deterministic output
all_records.sort(key=lambda r: r[0])

print(f'Writing {len(all_records):,} records to {OUT}...', file=sys.stderr)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(all_records, f, ensure_ascii=False, separators=(',', ':'))

size_kb = len(open(OUT, encoding='utf-8').read()) // 1024
print(f'Done. {OUT}: {size_kb:,} KB, {len(all_records):,} records', file=sys.stderr)
