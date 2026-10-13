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
    131: 17,# EUA
    68: 17, # México
    162: 17,# Rússia
    188: 17,# Turquia
    186: 17,# Suíça
}

COUNTRY_NAMES = {
    1: "África do Sul", 2: "Albânia", 3: "Alemanha", 4: "Andorra", 5: "Angola",
    6: "Anguilla", 7: "Antígua e Barbuda", 8: "Curaçao", 9: "Arábia Saudita", 10: "Argélia",
    11: "Argentina", 12: "Armênia", 13: "Aruba", 14: "Austrália", 15: "Áustria",
    16: "Azerbaijão", 17: "Bahamas", 18: "Bahrein", 19: "Bangladesh", 20: "Barbados",
    21: "Bélgica", 22: "Belize", 23: "Benin", 24: "Bermudas", 25: "Belarus",
    26: "Bolívia", 27: "Bósnia e Herzegovina", 28: "Botsuana", 29: "Brasil", 30: "Brunei",
    31: "Bulgária", 32: "Burkina Faso", 33: "Burundi", 34: "Butão", 35: "Cabo Verde",
    36: "Camarões", 37: "Camboja", 38: "Canadá", 39: "Catar", 40: "Cazaquistão",
    41: "Chade", 42: "Chile", 43: "China", 44: "Chipre", 45: "Timor-Leste",
    46: "Colômbia", 47: "Congo", 48: "Coreia do Norte", 49: "Coreia do Sul", 50: "Costa do Marfim",
    51: "Costa Rica", 52: "Croácia", 53: "Cuba", 54: "Dinamarca", 55: "Djibuti",
    56: "Dominica", 57: "Egito", 58: "El Salvador", 59: "Emirados Árabes", 60: "Equador",
    61: "Eritreia", 62: "Escócia", 63: "Eslováquia", 64: "Eslovênia", 65: "Espanha",
    66: "Essuatíni", 67: "Estônia", 68: "México", 69: "Etiópia", 70: "Fiji",
    71: "Filipinas", 72: "França", 73: "Gabão", 74: "Gâmbia", 75: "Gana",
    76: "Geórgia", 77: "Gibraltar", 78: "Granada", 79: "Grécia", 80: "Guam",
    81: "Guatemala", 82: "Guiana", 83: "Guiana Francesa", 84: "Guiné", 85: "Holanda",
    86: "Honduras", 87: "Hong Kong", 88: "Hungria", 89: "Iêmen", 90: "Índia",
    91: "Indonésia", 92: "Inglaterra", 93: "Irã", 94: "Iraque", 95: "Irlanda",
    96: "Irlanda do Norte", 97: "Inglaterra", 98: "Islândia", 99: "Israel", 100: "Itália",
    104: "Itália", 107: "Japão", 131: "Estados Unidos", 141: "Marrocos", 143: "Nova Zelândia",
    148: "Noruega", 150: "Paraguai", 151: "Peru", 154: "Portugal", 162: "Rússia",
    174: "Suécia", 175: "Suíça", 186: "Suíça", 188: "Turquia", 190: "Ucrânia", 195: "Uruguai",
    198: "Venezuela"
}

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
    131: "usa",
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
    raw_path = os.path.join(root, "data/teams.json")
    out_dir = os.path.join(root, "web/public/data/leagues")
    os.makedirs(out_dir, exist_ok=True)

    print(f"Loading {raw_path}...")
    with open(raw_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    clubs = raw["clubs"]
    leagues = raw["leagues"]
    states_data = raw.get("states", [])

    # Load existing web teamsDatabase to guarantee 100% stable IDs for existing clubs
    prev_meta = {}
    prev_db_path = os.path.join(root, "web/src/data/teamsDatabase.json")
    if os.path.exists(prev_db_path):
        with open(prev_db_path, "r", encoding="utf-8") as f:
            prev_json = json.load(f)
            for pc in prev_json.get("clubs", []):
                prev_meta[pc["name"]] = {
                    "id": pc["id"],
                    "balance": pc.get("balance"),
                    "ticketPrice": pc.get("ticketPrice")
                }
    print(f"Found {len(prev_meta)} clubs with existing stable IDs.")

    used_ids = set(info["id"] for info in prev_meta.values())
    id_map = {} # orig_id -> mapped_id

    for c in clubs:
        cname = c["name"]
        if cname in prev_meta:
            id_map[c["id"]] = prev_meta[cname]["id"]

    next_id = 1001
    for c in clubs:
        if c["id"] not in id_map:
            # If original ID is free and >= 1000, keep it; else allocate next_id
            cand_id = c["id"]
            if cand_id >= 1000 and cand_id not in used_ids:
                id_map[c["id"]] = cand_id
                used_ids.add(cand_id)
            else:
                while next_id in used_ids:
                    next_id += 1
                id_map[c["id"]] = next_id
                used_ids.add(next_id)

    # Map leagues
    leagues_out = []
    club_league_info = {} # mapped_id -> (division, division_name, league_name, country_name)
    countries_map = {}

    for l in leagues:
        c_id = l["country_id"]
        c_name = COUNTRY_NAMES.get(c_id, f"País {c_id}")
        div = l.get("division", 1)
        div_name = l.get("division_name", f"{div}ª Divisão")
        l_name = l.get("name", f"Campeonato {c_name}")
        mapped_ids = [id_map[cid] for cid in l.get("club_ids", []) if cid in id_map]

        if not mapped_ids:
            continue

        leagues_out.append({
            "id": len(leagues_out) + 1,
            "countryId": c_id,
            "countryName": c_name,
            "name": l_name,
            "division": div,
            "divisionName": div_name,
            "teamCount": len(mapped_ids),
            "clubIds": mapped_ids,
            "relegated": l.get("relegated", 4)
        })

        if c_id not in countries_map:
            countries_map[c_id] = {
                "id": c_id,
                "name": c_name,
                "clubCount": 0,
                "divisionCount": 0,
                "bundleKey": COUNTRY_BUNDLE_MAP.get(c_id, "world_rest")
            }
        countries_map[c_id]["divisionCount"] = max(countries_map[c_id]["divisionCount"], div)

        for mid in mapped_ids:
            if mid not in club_league_info:
                club_league_info[mid] = (div, div_name, l_name, c_name)

    # Process all 3,216 clubs
    processed_clubs = []
    clubs_index = []
    bundles_dict = defaultdict(list)

    for c in clubs:
        cid = id_map[c["id"]]
        c_id = c.get("country_id", 29)
        c_name = COUNTRY_NAMES.get(c_id, f"País {c_id}")

        if c_id in countries_map:
            countries_map[c_id]["clubCount"] += 1

        div_info = club_league_info.get(cid)
        if div_info:
            division, division_name, league_name, _ = div_info
        else:
            division = 1
            division_name = "1ª Divisão"
            league_name = f"Campeonato de {c_name}"

        state_id = c.get("state_id", 0) if c_id == 29 else None
        state_code = STATE_NAMES.get(state_id, ("", ""))[0] if (c_id == 29 and state_id in STATE_NAMES) else None
        state_name = STATE_NAMES.get(state_id, ("", ""))[1] if (c_id == 29 and state_id in STATE_NAMES) else None

        rep = c.get("reputation", 3)
        lvl = c.get("level", 10)
        cname = c["name"]

        if cname in prev_meta:
            base_bal = prev_meta[cname].get("balance") or ((rep * 4000000) + (lvl * 1500000))
            ticket = prev_meta[cname].get("ticketPrice") or (25 + (rep * 10) + (lvl * 2))
        else:
            base_bal = (rep * 4000000) + (lvl * 1500000)
            ticket = 25 + (rep * 10) + (lvl * 2)

        file_ref = c.get("file_ref", "")
        crest_url = f"/escudos/{file_ref}.png"
        crest_mini_url = f"/escudosMini/{file_ref}.png"

        # Squad
        squad_out = []
        for p in c.get("squad", []):
            pos_code = p.get("position_code", 3)
            pos_name = POSITIONS[pos_code] if 0 <= pos_code < len(POSITIONS) else "MEI"
            is_starter = p.get("starter", False)
            is_star = p.get("star", False)
            is_world_top = p.get("world_top", False)
            is_attacker = pos_name == "ATA"

            strength = calculate_player_strength(
                club_level=lvl,
                division=division,
                reputation=rep,
                country_id=c_id,
                is_starter=is_starter,
                is_star=is_star,
                is_world_top=is_world_top,
                is_junior=p.get("age", 25) < 21,
                player_id=p["id"],
                hash_val=p.get("hash", 0)
            )

            m_val = calculate_market_value(
                strength=strength,
                age=p.get("age", 25),
                is_starter=is_starter,
                is_star=is_star,
                is_attacker=is_attacker,
                club_level=lvl
            )

            salary = calculate_salary(m_val, strength, division)
            t1 = p.get("trait1", 0)
            t2 = p.get("trait2", 1)
            skill1 = SKILLS[t1] if 0 <= t1 < len(SKILLS) else "Passe"
            skill2 = SKILLS[t2] if 0 <= t2 < len(SKILLS) else "Desarme"

            foot_code = p.get("foot", "right")
            foot = "E" if foot_code == "left" else ("A" if foot_code == "both" else "D")

            squad_out.append({
                "id": p["id"],
                "name": p["name"],
                "age": p.get("age", 25),
                "position": pos_name,
                "foot": foot,
                "strength": strength,
                "energy": 96 + (p["id"] % 5),
                "salary": salary,
                "marketValue": m_val,
                "isStarter": is_starter,
                "isStar": is_star,
                "isWorldTop": is_world_top,
                "skill1": skill1,
                "skill2": skill2,
                "goals": 0,
                "assists": 0,
                "yellowCards": 0,
                "redCards": 0,
                "injured": False,
                "suspended": False,
                "contractYears": 1 + ((p["id"] + cid) % 3)
            })

        squad_ids = [sp["id"] for sp in squad_out]
        captain_id = squad_ids[0] if squad_ids else 0
        penalty_id = squad_ids[-1] if squad_ids else 0
        freekick_id = squad_ids[min(len(squad_ids)-1, 10)] if squad_ids else 0
        corner_id = squad_ids[min(len(squad_ids)-1, 7)] if squad_ids else 0

        club_obj = {
            "id": cid,
            "name": cname,
            "fileRef": file_ref,
            "countryId": c_id,
            "countryName": c_name,
            "stateId": state_id,
            "stateCode": state_code,
            "stateName": state_name,
            "reputation": rep,
            "level": lvl,
            "stadium": c.get("stadium", "Estádio Municipal"),
            "capacity": c.get("stadium_capacity", 20000),
            "coach": c.get("coach", "Técnico"),
            "primaryColor": c.get("primary_color", "#000000"),
            "secondaryColor": c.get("secondary_color", "#ffffff"),
            "balance": base_bal,
            "ticketPrice": ticket,
            "crestUrl": crest_url,
            "crestMiniUrl": crest_mini_url,
            "division": division,
            "divisionName": division_name,
            "leagueName": league_name,
            "tactics": {
                "formation": "4-4-2",
                "mentality": "Equilibrada",
                "penaltyTakerId": penalty_id,
                "freeKickTakerId": freekick_id,
                "cornerTakerId": corner_id,
                "captainId": captain_id
            },
            "squad": squad_out
        }

        # Lightweight club index entry for snappy menus
        club_index_entry = {
            "id": cid,
            "name": cname,
            "fileRef": file_ref,
            "countryId": c_id,
            "countryName": c_name,
            "stateId": state_id,
            "stateCode": state_code,
            "division": division,
            "divisionName": division_name,
            "leagueName": league_name,
            "reputation": rep,
            "level": lvl,
            "stadium": c.get("stadium", "Estádio Municipal"),
            "capacity": c.get("stadium_capacity", 20000),
            "coach": c.get("coach", "Técnico"),
            "primaryColor": c.get("primary_color", "#000000"),
            "secondaryColor": c.get("secondary_color", "#ffffff"),
            "bundleKey": COUNTRY_BUNDLE_MAP.get(c_id, "world_rest")
        }

        clubs_index.append(club_index_entry)
        bundle_key = COUNTRY_BUNDLE_MAP.get(c_id, "world_rest")
        bundles_dict[bundle_key].append(club_obj)
        processed_clubs.append(club_obj)

    states_out = []
    for s_id, (code, name) in STATE_NAMES.items():
        bra_clubs = [c["id"] for c in processed_clubs if c.get("stateId") == s_id and c.get("countryId") == 29]
        states_out.append({
            "id": s_id,
            "code": code,
            "name": name,
            "clubCount": len(bra_clubs),
            "clubIds": bra_clubs
        })

    countries_out = sorted(list(countries_map.values()), key=lambda x: (-(x["clubCount"]), x["name"]))

    meta_doc = {
        "version": 2026,
        "totalClubs": len(processed_clubs),
        "countries": countries_out,
        "leagues": leagues_out,
        "states": states_out,
        "clubsIndex": sorted(clubs_index, key=lambda x: (-x["reputation"], x["name"]))
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

    print("Success! All modular league bundles generated.")

if __name__ == "__main__":
    main()
