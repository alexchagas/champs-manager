#!/usr/bin/env python3
"""
compile_calendars.py
Parses official Brasfoot calendar files from `Brasfoot 2026/arquivos/calendario_*.txt`
into a structured JSON file `web/src/data/officialCalendars.json`.
"""

import json
import os
import glob

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    brasfoot_dir = os.path.join(root, "Brasfoot 2026/arquivos")
    out_path = os.path.join(root, "web/src/data/officialCalendars.json")

    calendars = {}
    pattern = os.path.join(brasfoot_dir, "calendario_*.txt")

    for fpath in sorted(glob.glob(pattern)):
        fname = os.path.basename(fpath)
        key = fname.replace("calendario_", "").replace(".txt", "")
        with open(fpath, "r", encoding="latin-1") as f:
            dates = [line.strip() for line in f if line.strip()]
        calendars[key] = dates

    print(f"Loaded {len(calendars)} official Brasfoot calendars.")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(calendars, f, indent=2, ensure_ascii=False)

    print(f"Successfully generated {out_path} ({os.path.getsize(out_path)} bytes).")

if __name__ == "__main__":
    main()
