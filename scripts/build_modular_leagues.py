#!/usr/bin/env python3
"""
build_modular_leagues.py
Parses all 3,216 clubs from `data/teams.json` into modular, load-on-demand country/regional JSON files
in `web/public/data/leagues/`, plus a lightweight index `leagues_meta.json` for snappy UI browsing.
"""

import json
import os
import subprocess
from collections import defaultdict

SKILLS = [
    "Colocação",        # 0
    "Defesa Penalty",   # 1
    "Reflexo",          # 2
    "Saída Gol",        # 3
    "Armação",          # 4
    "Cabeceio",         # 5
    "Cruzamento",       # 6
    "Desarme",          # 7
    "Drible",           # 8
    "Finalização",      # 9
    "Marcação",         # 10
    "Passe",            # 11
    "Resistência",      # 12
    "Velocidade"        # 13
]

POSITIONS = ["GOL", "LAT", "ZAG", "MEI", "ATA"]

STATE_NAMES = {
    0: ("AC", "Acre"),
    1: ("AL", "Alagoas"),
    2: ("AM", "Amazonas"),
    3: ("AP", "Amapá"),
    4: ("BA", "Bahia"),
    5: ("CE", "Ceará"),
    6: ("DF", "Distrito Federal"),
    7: ("ES", "Espírito Santo"),
    8: ("GO", "Goiás"),
    9: ("MA", "Maranhão"),
    10: ("MG", "Minas Gerais"),
    11: ("MS", "Mato Grosso do Sul"),
    12: ("MT", "Mato Grosso"),
    13: ("PA", "Pará"),
    14: ("PB", "Paraíba"),
    15: ("PE", "Pernambuco"),
    16: ("PI", "Piauí"),
    17: ("PR", "Paraná"),
    18: ("RJ", "Rio de Janeiro"),
    19: ("RN", "Rio Grande do Norte"),
    20: ("RO", "Rondônia"),
    21: ("RR", "Roraima"),
    22: ("RS", "Rio Grande do Sul"),
    23: ("SC", "Santa Catarina"),
    24: ("SE", "Sergipe"),
    25: ("SP", "São Paulo"),
    26: ("TO", "Tocantins"),
}

COUNTRY_LEVELS = {
    29: 20, # Brasil
    65: 20, # Espanha
    97: 20, # Inglaterra
    72: 20, # França
    3: 20,  # Alemanha
    104: 20,# Itália
    11: 20, # Argentina
    154: 19,# Portugal
    85: 19, # Holanda
    21: 19, # Bélgica
    195: 18,# Uruguai
    42: 18, # Chile
    46: 18, # Colômbia
    68: 17, # EUA
    131: 17,# México
    162: 17,# Rússia
    188: 17,# Turquia
    186: 17,# Suíça
}

def _load_all_country_names() -> dict:
    names = {
        68: "Estados Unidos",
        131: "México",
    }
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    lang_xml = os.path.join(root, "Brasfoot 2026/arquivos/default_lang.xml")
    if os.path.exists(lang_xml):
        try:
            import xml.etree.ElementTree as ET
            tree = ET.parse(lang_xml)
            for entry in tree.getroot():
                k = entry.attrib.get("key")
                if k and k.startswith("P") and k[1:].isdigit():
                    cid = int(k[1:])
                    val = entry.text.strip()
                    if cid == 68 and val == "EUA":
                        val = "Estados Unidos"
                    names[cid] = val
        except Exception:
            pass
    return names

COUNTRY_NAMES = _load_all_country_names()

COUNTRY_BUNDLE_MAP = {
    29: "brazil",
    154: "portugal",
    65: "spain",
    97: "england",
    104: "italy",
    3: "germany",
    72: "france",
    11: "argentina",
    85: "netherlands",
    68: "usa",
    131: "mexico",
    151: "south_america",
    195: "south_america",
    46: "south_america",
    42: "south_america",
    150: "south_america",
    26: "south_america",
    60: "south_america",
    198: "south_america",
}

def map_club_level_to_n7(level: int) -> int:
    if level <= 15:
        return level
    mapping = {16: 17, 17: 18, 18: 19, 19: 21, 20: 25, 21: 26, 22: 27, 23: 28, 24: 29, 25: 30}
    return mapping.get(level, level)

def calculate_player_strength(club_level, division, reputation, country_id, is_starter, is_star, is_world_top, is_junior, player_id, hash_val):
    if division == 1:
        n5 = 20
    elif division == 2:
        n5 = 15
    elif division == 3:
        n5 = 5
    elif division > 3:
        n5 = 3
    else:
        if reputation >= 5: n5 = 22
        elif reputation == 4: n5 = 15
        else: n5 = 5

    n7 = map_club_level_to_n7(club_level)
    seed = (player_id * 17 + hash_val * 7) % 3
    force = n7 + n5 + seed
    if is_starter:
        force += 8 + ((player_id * 13 + hash_val) % 2)
    if is_star or is_world_top:
        force += 9 + ((player_id * 23 + hash_val) % 3)
    if is_junior:
        force -= 23
        if force < 10: force = 10

    c_level = COUNTRY_LEVELS.get(country_id, 15)
    if c_level <= 13:
        if club_level <= 5: force = round(force * 0.4)
        elif club_level < 10: force = round(force * 0.65)
        else: force = round(force * 0.75)
    elif club_level < 10:
        if club_level < 3: force = round(force * 0.5)
        elif club_level < 5: force = round(force * 0.6)
        else: force = round(force * 0.7)

    return max(1, min(100, int(force)))

def calculate_market_value(strength, age, is_starter, is_star, is_attacker, club_level):
    factor = 700 if club_level >= 20 else (500 if club_level >= 15 else 350)
    if is_star: factor = int(factor * 1.8)
    if is_starter: factor = int(factor * 1.2)
    if is_attacker: factor = int(factor * 1.25)
    base = strength * strength * factor
    if age < 21: age_mult = 1.35
    elif age <= 25: age_mult = 1.2
    elif age <= 29: age_mult = 1.0
    elif age <= 33: age_mult = 0.75
    else: age_mult = 0.5
    return max(10000, int(base * age_mult))

def calculate_salary(market_value, strength, division):
    divisor = 50 if division <= 1 else (65 if division == 2 else 85)
    salary = market_value // divisor
    if strength >= 65: salary = max(150000, salary)
    elif strength >= 55: salary = max(50000, salary)
    elif strength >= 45: salary = max(15000, salary)
    else: salary = max(2500, min(12000, salary))
    return int(salary)

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(root, "web/src/data/teamsDatabase.json")
    out_dir = os.path.join(root, "web/public/data/leagues")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Loading authoritative database from {db_path}...")
    with open(db_path, "r", encoding="utf-8") as f:
        db = json.load(f)

    clubs = db["clubs"]
    leagues = db["leagues"]
    states_out = db["states"]
    countries = db["countries"]

    country_names = {c["id"]: c["name"] for c in countries}

    leagues_out = []
    for idx, l in enumerate(leagues, 1):
        leagues_out.append({
            "id": idx,
            "countryId": l["countryId"],
            "countryName": l.get("countryName") or country_names.get(l["countryId"], f"País {l['countryId']}"),
            "name": l["name"],
            "division": l["division"],
            "divisionName": l["divisionName"],
            "teamCount": l["teamCount"],
            "clubIds": l["clubIds"],
            "relegated": l.get("relegated", 4),
        })

    countries_out = []
    for c in countries:
        cid = c["id"]
        countries_out.append({
            "id": cid,
            "name": c["name"],
            "clubCount": c["clubCount"],
            "divisionCount": c["divisionCount"],
            "bundleKey": COUNTRY_BUNDLE_MAP.get(cid, "world_rest"),
        })
    countries_out.sort(key=lambda x: (-(x["clubCount"]), x["name"]))

    clubs_index = []
    bundles_dict = defaultdict(list)

    for c in clubs:
        cid = c["id"]
        c_id = c.get("countryId", 29)
        c_name = c.get("countryName") or country_names.get(c_id, f"País {c_id}")
        bkey = COUNTRY_BUNDLE_MAP.get(c_id, "world_rest")

        squad_out = []
        for p in c.get("squad", []):
            p_copy = dict(p)
            if "contractYears" not in p_copy:
                p_copy["contractYears"] = 1 + ((p_copy["id"] + cid) % 3)
            squad_out.append(p_copy)

        club_obj = dict(c)
        club_obj["countryName"] = c_name
        club_obj["squad"] = squad_out
        if c_id != 29:
            club_obj["stateId"] = None
            club_obj["stateCode"] = None
            club_obj["stateName"] = None

        club_index_entry = {
            "id": cid,
            "name": c["name"],
            "fileRef": c.get("fileRef", ""),
            "countryId": c_id,
            "countryName": c_name,
            "stateId": club_obj.get("stateId"),
            "stateCode": club_obj.get("stateCode"),
            "division": c.get("division", 1),
            "divisionName": c.get("divisionName", "1ª Divisão"),
            "leagueName": c.get("leagueName", f"Liga {c_name}"),
            "reputation": c.get("reputation", 3),
            "level": c.get("level", 10),
            "stadium": c.get("stadium", "Estádio Municipal"),
            "capacity": c.get("capacity", 20000),
            "coach": c.get("coach", "Técnico"),
            "primaryColor": c.get("primaryColor", "#000000"),
            "secondaryColor": c.get("secondaryColor", "#ffffff"),
            "bundleKey": bkey,
        }

        clubs_index.append(club_index_entry)
        bundles_dict[bkey].append(club_obj)

    meta_doc = {
        "version": 2026,
        "totalClubs": len(clubs),
        "countries": countries_out,
        "leagues": leagues_out,
        "states": states_out,
        "clubsIndex": sorted(clubs_index, key=lambda x: (-x["reputation"], x["name"])),
    }

    meta_path = os.path.join(out_dir, "leagues_meta.json")
    print(f"Writing leagues_meta.json ({len(clubs_index)} clubs index) to {meta_path}...")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_doc, f, ensure_ascii=False)

    for bkey, bclubs in bundles_dict.items():
        bundle_path = os.path.join(out_dir, f"{bkey}.json")
        print(f"Writing bundle {bkey}.json with {len(bclubs)} clubs to {bundle_path}...")
        with open(bundle_path, "w", encoding="utf-8") as f:
            json.dump(bclubs, f, ensure_ascii=False)

    print("Success! All modular league bundles generated from teamsDatabase.json.")

if __name__ == "__main__":
    main()

