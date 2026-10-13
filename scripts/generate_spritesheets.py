#!/usr/bin/env python3
"""
Generates partitioned WebP spritesheets (texture atlases) for Champs Manager crests.

Partitions:
1. Mini Crests (18x18 px):
   - mini_crests_global.webp (All 8,400+ clubs)
   - mini_crests_map.json { "file_ref": [x, y] }

2. Normal Crests (60x60 px):
   - crests_brazil.webp (All Brazilian clubs)
   - crests_europe_top.webp (Spain, England, Italy, Germany, France, Portugal)
   - crests_conmebol.webp (Argentina, Uruguay, Colombia, Chile, Paraguay, Peru, Bolivia, Ecuador, Venezuela)
   - crests_world_rest.webp (All other international clubs)
   - crests_map.json { "file_ref": { "atlas": "brazil"|"europe_top"|"conmebol"|"world_rest", "x": x, "y": y } }
"""

import os
import sys
import json
import glob
from math import ceil, sqrt
from PIL import Image

def get_country_partition(country_id: int) -> str:
    if country_id == 29:
        return "brazil"
    if country_id in (65, 97, 104, 3, 72, 154):
        return "europe_top"
    if country_id in (11, 195, 46, 42, 150, 151, 26, 60, 198):
        return "conmebol"
    return "world_rest"

def build_atlas(images_dict, icon_w, icon_h, out_webp_path, max_width=2048):
    """
    Packs images into a grid texture atlas and saves as WebP.
    Returns coordinate map: { slug: [x, y] }
    """
    total = len(images_dict)
    if total == 0:
        return {}

    cols = min(total, max_width // icon_w)
    rows = ceil(total / cols)
    sheet_w = cols * icon_w
    sheet_h = rows * icon_h

    print(f"  Generating atlas {os.path.basename(out_webp_path)}: {sheet_w}x{sheet_h} px ({cols} cols x {rows} rows) for {total} icons...")
    atlas = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    coords = {}

    sorted_slugs = sorted(images_dict.keys())
    for idx, slug in enumerate(sorted_slugs):
        col = idx % cols
        row = idx // cols
        x = col * icon_w
        y = row * icon_h
        coords[slug] = [x, y]

        filepath = images_dict[slug]
        try:
            with Image.open(filepath) as img:
                img = img.convert("RGBA")
                if img.size != (icon_w, icon_h):
                    img = img.resize((icon_w, icon_h), Image.Resampling.LANCZOS)
                atlas.paste(img, (x, y))
        except Exception as e:
            print(f"    Warning: could not process {filepath}: {e}")

    atlas.save(out_webp_path, "WEBP", quality=92, method=6)
    size_kb = os.path.getsize(out_webp_path) / 1024
    print(f"  Saved {out_webp_path}: {size_kb:.1f} KB")
    return coords

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    teams_json_path = os.path.join(root, "data/teams.json")
    mini_dir = os.path.join(root, "web/public/escudosMini")
    norm_dir = os.path.join(root, "web/public/escudos")
    out_dir = os.path.join(root, "web/public/sprites")

    os.makedirs(out_dir, exist_ok=True)

    # 1. Map club file_ref to country_id
    file_ref_country = {}
    if os.path.exists(teams_json_path):
        print(f"Loading {teams_json_path}...")
        with open(teams_json_path, "r", encoding="utf-8") as f:
            tdata = json.load(f)
            for c in tdata.get("clubs", []):
                ref = c.get("file_ref", "").strip()
                cid = c.get("country_id", 0)
                if ref:
                    file_ref_country[ref] = cid

    # 2. Collect all mini crests
    print("\n[1/3] Packing Mini Crests (18x18)...")
    mini_files = {}
    for p in glob.glob(os.path.join(mini_dir, "*.png")):
        slug = os.path.splitext(os.path.basename(p))[0]
        mini_files[slug] = p

    mini_atlas_path = os.path.join(out_dir, "mini_crests_global.webp")
    mini_map = build_atlas(mini_files, 18, 18, mini_atlas_path, max_width=2048)

    mini_map_path = os.path.join(out_dir, "mini_crests_map.json")
    with open(mini_map_path, "w", encoding="utf-8") as f:
        json.dump(mini_map, f, separators=(',', ':'))
    print(f"  Saved {mini_map_path}: {os.path.getsize(mini_map_path)/1024:.1f} KB")

    # 3. Collect normal crests and group by region
    print("\n[2/3] Partitioning Normal Crests (60x60)...")
    norm_files_by_region = {
        "brazil": {},
        "europe_top": {},
        "conmebol": {},
        "world_rest": {}
    }

    for p in glob.glob(os.path.join(norm_dir, "*.png")):
        slug = os.path.splitext(os.path.basename(p))[0]
        cid = file_ref_country.get(slug, 0)
        # Infer region if not in file_ref_country
        if cid == 0:
            if "_bra" in slug or "_sp" in slug or "_rj" in slug or "_mg" in slug or "_rs" in slug or "_pr" in slug or "_ba" in slug or "_pe" in slug:
                region = "brazil"
            elif "_esp" in slug or "_ing" in slug or "_ita" in slug or "_ale" in slug or "_fra" in slug or "_por" in slug:
                region = "europe_top"
            elif "_arg" in slug or "_uru" in slug or "_col" in slug or "_chi" in slug or "_par" in slug:
                region = "conmebol"
            else:
                region = "world_rest"
        else:
            region = get_country_partition(cid)

        norm_files_by_region[region][slug] = p

    for r, rdict in norm_files_by_region.items():
        print(f"  Region '{r}': {len(rdict)} clubs")

    # 4. Generate Regional Normal Atlases
    print("\n[3/3] Generating Regional Atlases (60x60)...")
    full_norm_map = {}
    for region, rdict in norm_files_by_region.items():
        atlas_path = os.path.join(out_dir, f"crests_{region}.webp")
        # 60x60: allow max width up to 2040 (34 columns)
        r_coords = build_atlas(rdict, 60, 60, atlas_path, max_width=2040)
        for slug, (x, y) in r_coords.items():
            full_norm_map[slug] = [region, x, y]

    norm_map_path = os.path.join(out_dir, "crests_map.json")
    with open(norm_map_path, "w", encoding="utf-8") as f:
        json.dump(full_norm_map, f, separators=(',', ':'))
    print(f"  Saved {norm_map_path}: {os.path.getsize(norm_map_path)/1024:.1f} KB")

    print("\n" + "=" * 50)
    print("Spritesheet generation complete! All assets in web/public/sprites/")
    print("=" * 50)

if __name__ == "__main__":
    main()
