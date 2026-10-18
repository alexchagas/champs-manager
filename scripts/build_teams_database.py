#!/usr/bin/env python3
import json
import os
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
    68: 17, # Estados Unidos (EUA)
    131: 17,# México
    162: 17,# Rússia
    188: 17,# Turquia
    186: 17,# Suíça
}

def _load_all_country_names() -> dict:
    names = {
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
        66: "Essuatíni", 67: "Estônia", 68: "Estados Unidos", 69: "Etiópia", 70: "Fiji",
        71: "Filipinas", 72: "França", 73: "Gabão", 74: "Gâmbia", 75: "Gana",
        76: "Geórgia", 77: "Gibraltar", 78: "Granada", 79: "Grécia", 80: "Guam",
        81: "Guatemala", 82: "Guiana", 83: "Guiana Francesa", 84: "Guiné", 85: "Holanda",
        86: "Honduras", 87: "Hong Kong", 88: "Hungria", 89: "Iêmen", 90: "Índia",
        91: "Indonésia", 92: "Inglaterra", 93: "Irã", 94: "Iraque", 95: "Irlanda",
        96: "Irlanda do Norte", 97: "Inglaterra", 98: "Islândia", 99: "Israel", 100: "Itália",
        104: "Itália", 107: "Japão", 131: "México", 141: "Marrocos", 143: "Nova Zelândia",
        148: "Noruega", 150: "Paraguai", 151: "Peru", 154: "Portugal", 162: "Rússia",
        174: "Suécia", 175: "Suíça", 186: "Suíça", 188: "Turquia", 190: "Ucrânia", 195: "Uruguai",
        198: "Venezuela"
    }
    # Load authoritative country names from official Brasfoot default_lang.xml
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

def map_club_level_to_n7(level: int) -> int:
    """Non-linear level mapping from Brasfoot best/f_0.java:596"""
    if level <= 15:
        return level
    mapping = {
        16: 17,
        17: 18,
        18: 19,
        19: 21,
        20: 25,
        21: 26,
        22: 27,
        23: 28,
        24: 29,
        25: 30,
    }
    return mapping.get(level, level)

def calculate_player_strength(
    club_level: int,
    division: int,
    reputation: int,
    country_id: int,
    is_starter: bool,
    is_star: bool,
    is_world_top: bool,
    is_junior: bool,
    player_id: int,
    hash_val: int
) -> int:
    """
    Faithful Brasfoot 22-26 player strength calculation (f_0.fI())
    """
    if division == 1:
        n5 = 20
    elif division == 2:
        n5 = 15
    elif division == 3:
        n5 = 5
    elif division > 3:
        n5 = 3
    else:
        if reputation >= 5:
            n5 = 22
        elif reputation == 4:
            n5 = 15
        else:
            n5 = 5

    n7 = map_club_level_to_n7(club_level)

    seed = (player_id * 17 + hash_val * 7) % 3
    force = n7 + n5 + seed

    if is_starter:
        starter_bonus = 8 + ((player_id * 13 + hash_val) % 2)
        force += starter_bonus

    if is_star or is_world_top:
        star_bonus = 9 + ((player_id * 23 + hash_val) % 3)
        force += star_bonus

    if is_junior:
        force -= 23
        if force < 10:
            force = 10

    c_level = COUNTRY_LEVELS.get(country_id, 15)
    if c_level <= 13:
        if club_level <= 5:
            force = round(force * 0.4)
        elif club_level < 10:
            force = round(force * 0.65)
        else:
            force = round(force * 0.75)
    elif club_level < 10:
        if club_level < 3:
            force = round(force * 0.5)
        elif club_level < 5:
            force = round(force * 0.6)
        else:
            force = round(force * 0.7)

    return max(1, min(100, int(force)))

def calculate_market_value(strength: int, age: int, is_starter: bool, is_star: bool, is_attacker: bool, club_level: int) -> int:
    factor = 700 if club_level >= 20 else (500 if club_level >= 15 else 350)
    if is_star:
        factor = int(factor * 1.8)
    if is_starter:
        factor = int(factor * 1.2)
    if is_attacker:
        factor = int(factor * 1.25)

    base = strength * strength * factor

    if age < 21:
        age_mult = 1.35
    elif age <= 25:
        age_mult = 1.2
    elif age <= 29:
        age_mult = 1.0
    elif age <= 33:
        age_mult = 0.75
    else:
        age_mult = 0.5

    val = int(base * age_mult)
    return max(10000, val)

def calculate_salary(market_value: int, strength: int, division: int) -> int:
    divisor = 50 if division <= 1 else (65 if division == 2 else 85)
    salary = market_value // divisor
    if strength >= 65:
        salary = max(150000, salary)
    elif strength >= 55:
        salary = max(50000, salary)
    elif strength >= 45:
        salary = max(15000, salary)
    else:
        salary = max(2500, min(12000, salary))
    return int(salary)

def calculate_initial_balance(division: int, reputation: int, country_id: int) -> int:
    """
    Classical Brasfoot balance based on decompiled aq.sC:
    Div 1: R$ 15,000,000
    Div 2: R$ 12,000,000
    Div 3: R$ 10,000,000
    Div 4: R$ 3,500,000
    Other / Access: R$ 3,500,000
    Foreign elite clubs (Europe rep >= 4) scaled proportionally.
    """
    if country_id == 29: # Brasil
        if division == 1:
            return 15_000_000
        elif division == 2:
            return 12_000_000
        elif division == 3:
            return 10_000_000
        elif division == 4:
            return 3_500_000
        else:
            return 3_500_000
    else:
        if division == 1:
            if reputation >= 5:
                return 30_000_000
            elif reputation == 4:
                return 20_000_000
            else:
                return 15_000_000
        elif division == 2:
            return 12_000_000
        elif division == 3:
            return 10_000_000
        else:
            return 3_500_000

def calculate_ticket_price(division: int, reputation: int) -> int:
    """
    Classical Brasfoot ticket price based on decompiled aq.sB:
    Div 1: 25 - 30
    Div 2: 20
    Div 3: 15
    Div 4: 10
    """
    if division == 1:
        return 30 if reputation >= 4 else 25
    elif division == 2:
        return 20
    elif division == 3:
        return 15
    else:
        return 10

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    raw_path = os.path.join(root, "data/teams.json")
    out_path = os.path.join(root, "web/src/data/teamsDatabase.json")

    print(f"Loading {raw_path}...")
    with open(raw_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    clubs = data["clubs"]
    leagues = data["leagues"]
    states_data = data["states"]

    print(f"Loaded {len(clubs)} clubs, {len(leagues)} leagues, {len(states_data)} states.")

    # Load previous club metadata to preserve stable IDs and balances (e.g. Flamengo ID 255, Palmeiras balance)
    prev_meta = {}
    if os.path.exists(out_path):
        try:
            with open(out_path, "r", encoding="utf-8") as pf:
                prev_json = json.load(pf)
            for pc in prev_json.get("clubs", []):
                prev_meta[pc["name"]] = {
                    "id": pc["id"],
                    "balance": pc.get("balance"),
                    "ticketPrice": pc.get("ticketPrice")
                }
            print(f"Preserving stable metadata for {len(prev_meta)} clubs from repository.")
        except Exception as e:
            print(f"Could not load previous metadata: {e}")
    club_by_orig_id = {c["id"]: c for c in clubs}
    selected = set()

    # 1. Brazil: divisions 1-4 and division 5 (Acesso / Estaduais)
    bra_leagues = [l for l in leagues if l["country_id"] == 29]
    div1_raw = bra_leagues[0]["club_ids"][:20] if len(bra_leagues) > 0 else []
    div2_raw = bra_leagues[1]["club_ids"][:20] if len(bra_leagues) > 1 else []
    div3_raw = bra_leagues[2]["club_ids"][:20] if len(bra_leagues) > 2 else []
    div4_raw = bra_leagues[3]["club_ids"][:64] if len(bra_leagues) > 3 else []

    national_bra = list(div1_raw + div2_raw + div3_raw + div4_raw)
    div5_raw = [c["id"] for c in clubs if c["country_id"] == 29 and c["id"] not in national_bra]

    # Select ALL 3,216 clubs from Brasfoot (no artificial cutoffs!)
    selected = set(c["id"] for c in clubs)
    print(f"Total clubs selected: {len(selected)} clubs across all countries.")

    # Build stable ID map preserving legacy IDs where available
    id_map = {}
    used_ids = set()
    for c in clubs:
        if c["id"] not in selected:
            continue
        cname = c["name"]
        if cname in prev_meta and prev_meta[cname]["id"] not in used_ids:
            final_id = prev_meta[cname]["id"]
            id_map[c["id"]] = final_id
            used_ids.add(final_id)

    next_id = 1
    for c in clubs:
        if c["id"] not in selected:
            continue
        if c["id"] not in id_map:
            while next_id in used_ids:
                next_id += 1
            id_map[c["id"]] = next_id
            used_ids.add(next_id)

    # Build league info with filtered mapped clubIds
    club_league_info = {}
    leagues_out = []
    countries_map = {}

    # Define standard Brazilian divisions
    bra_div_defs = [
        (1, "Série A", "Brasileirão", [id_map[cid] for cid in div1_raw if cid in id_map]),
        (2, "Série B", "Brasileirão", [id_map[cid] for cid in div2_raw if cid in id_map]),
        (3, "Série C", "Brasileirão", [id_map[cid] for cid in div3_raw if cid in id_map]),
        (4, "Série D", "Brasileirão", [id_map[cid] for cid in div4_raw if cid in id_map]),
        (5, "Acesso / Estaduais", "Divisão de Acesso / Estaduais", [id_map[cid] for cid in div5_raw if cid in id_map]),
    ]
    for div, div_name, l_name, club_ids in bra_div_defs:
        leagues_out.append({
            "countryId": 29,
            "countryName": "Brasil",
            "name": l_name,
            "division": div,
            "divisionName": div_name,
            "teamCount": len(club_ids),
            "clubIds": club_ids,
            "relegated": 4
        })
        for mid in club_ids:
            club_league_info[mid] = (div, div_name, l_name, "Brasil")

    countries_map[29] = {
        "id": 29,
        "name": "Brasil",
        "clubCount": 0,
        "divisionCount": 5
    }

    # International leagues (capped at 4 main divisions per Brasfoot Z.java, plus Divisão de Acesso for remaining clubs)
    intl_leagues_by_c = defaultdict(list)
    for l in leagues:
        c_id = l["country_id"]
        if c_id != 29:
            intl_leagues_by_c[c_id].append(l)

    all_clubs_by_c = defaultdict(list)
    for c in clubs:
        if c["id"] in selected:
            all_clubs_by_c[c["country_id"]].append(id_map[c["id"]])

    for c_id, c_leagues in intl_leagues_by_c.items():
        c_name = COUNTRY_NAMES.get(c_id, f"País {c_id}")
        c_leagues.sort(key=lambda x: x.get("division", 1))
        assigned_in_c = set()
        access_ids = []
        max_main_div = 0

        for l in c_leagues:
            div = l["division"]
            div_name = l["division_name"]
            l_name = l["name"]
            filtered_ids = [id_map[cid] for cid in l["club_ids"] if cid in selected and id_map[cid] not in assigned_in_c]
            if not filtered_ids:
                continue

            if div <= 4 and (len(filtered_ids) >= 16 or div == 1):
                max_main_div = max(max_main_div, div)
                leagues_out.append({
                    "countryId": c_id,
                    "countryName": c_name,
                    "name": l_name,
                    "division": div,
                    "divisionName": div_name,
                    "teamCount": len(filtered_ids),
                    "clubIds": filtered_ids,
                    "relegated": l.get("relegated", 4)
                })
                for mapped_id in filtered_ids:
                    assigned_in_c.add(mapped_id)
                    club_league_info[mapped_id] = (div, div_name, l_name, c_name)
            else:
                for mapped_id in filtered_ids:
                    assigned_in_c.add(mapped_id)
                    access_ids.append(mapped_id)

        # Any remaining clubs of this country not listed in its main divisions go to Divisão de Acesso
        for mapped_id in all_clubs_by_c[c_id]:
            if mapped_id not in assigned_in_c:
                assigned_in_c.add(mapped_id)
                access_ids.append(mapped_id)

        if access_ids:
            acc_div = max_main_div + 1 if max_main_div > 0 else 1
            acc_div_name = "Divisão de Acesso" if max_main_div > 0 else "1ª Divisão"
            acc_l_name = f"{c_name} • Divisão de Acesso" if max_main_div > 0 else f"Liga {c_name}"
            leagues_out.append({
                "countryId": c_id,
                "countryName": c_name,
                "name": acc_l_name,
                "division": acc_div,
                "divisionName": acc_div_name,
                "teamCount": len(access_ids),
                "clubIds": access_ids,
                "relegated": 4 if max_main_div > 0 else 0
            })
            for mapped_id in access_ids:
                club_league_info[mapped_id] = (acc_div, acc_div_name, acc_l_name, c_name)
            max_main_div = max(max_main_div, acc_div)

        countries_map[c_id] = {
            "id": c_id,
            "name": c_name,
            "clubCount": 0,
            "divisionCount": max(1, max_main_div)
        }

    # Process clubs
    clubs_out = []
    state_clubs_map = {s_id: [] for s_id in range(27)}

    for c in clubs:
        orig_id = c["id"]
        if orig_id not in selected:
            continue

        cid = id_map[orig_id]
        c_id = c["country_id"]
        if c_id not in countries_map:
            c_name = COUNTRY_NAMES.get(c_id, f"País {c_id}")
            countries_map[c_id] = {
                "id": c_id,
                "name": c_name,
                "clubCount": 0,
                "divisionCount": 1
            }
        countries_map[c_id]["clubCount"] += 1

        div_info = club_league_info.get(cid)
        if div_info:
            division, division_name, league_name, country_name = div_info
        else:
            division = 1
            division_name = "1ª Divisão"
            league_name = f"Liga {COUNTRY_NAMES.get(c_id, f'País {c_id}')}"
            country_name = COUNTRY_NAMES.get(c_id, f"País {c_id}")

        state_id = c.get("state_id", 0)
        state_code, state_name = STATE_NAMES.get(state_id, ("BR", "Brasil"))
        if c_id == 29 and state_id in state_clubs_map:
            state_clubs_map[state_id].append(cid)

        # Select exactly 11 starters for the club (4-4-2: 1 GOL, 2 LAT, 2 ZAG, 4 MEI, 2 ATA)
        raw_squad = c["squad"]
        chosen_starters = set()
        for pos_code_target, count in [(0, 1), (1, 2), (2, 2), (3, 4), (4, 2)]:
            cands = [p for p in raw_squad if p.get("position_code", 3) == pos_code_target]
            cands.sort(key=lambda x: (not x.get("starter", False), -int(x.get("star", False)), x["id"]))
            for cand in cands[:count]:
                chosen_starters.add(cand["id"])
        if len(chosen_starters) < 11:
            rem = [p for p in raw_squad if p["id"] not in chosen_starters and p.get("position_code", 3) != 0]
            rem.sort(key=lambda x: (not x.get("starter", False), -int(x.get("star", False)), x["id"]))
            for cand in rem[:11 - len(chosen_starters)]:
                chosen_starters.add(cand["id"])

        squad_out = []
        for idx, p in enumerate(c["squad"]):
            pos_code = p.get("position_code", 3)
            pos_name = POSITIONS[pos_code] if 0 <= pos_code < len(POSITIONS) else "MEI"
            is_starter = (p["id"] in chosen_starters)
            is_star = bool(p.get("star", False))
            is_world_top = bool(p.get("world_top", False))
            is_attacker = (pos_code == 4)

            strength = calculate_player_strength(
                club_level=c.get("level", 10),
                division=division,
                reputation=c.get("reputation", 3),
                country_id=c_id,
                is_starter=is_starter,
                is_star=is_star,
                is_world_top=is_world_top,
                is_junior=False,
                player_id=p["id"],
                hash_val=p.get("hash", 0)
            )

            m_val = calculate_market_value(
                strength=strength,
                age=p.get("age", 25),
                is_starter=is_starter,
                is_star=is_star,
                is_attacker=is_attacker,
                club_level=c.get("level", 10)
            )

            salary = calculate_salary(m_val, strength, division)

            t1 = p.get("trait1", 0)
            t2 = p.get("trait2", 1)
            skill1 = SKILLS[t1] if 0 <= t1 < len(SKILLS) else "Passe"
            skill2 = SKILLS[t2] if 0 <= t2 < len(SKILLS) else "Desarme"

            foot_code = p.get("foot", "right")
            if foot_code == "left":
                foot = "E"
            elif foot_code == "both":
                foot = "A"
            else:
                foot = "D"

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
                "suspended": False
            })

        squad_ids = [sp["id"] for sp in squad_out]
        captain_id = squad_ids[0] if squad_ids else 0
        penalty_id = squad_ids[-1] if squad_ids else 0
        freekick_id = squad_ids[min(len(squad_ids)-1, 10)] if squad_ids else 0
        corner_id = squad_ids[min(len(squad_ids)-1, 7)] if squad_ids else 0

        rep = c.get("reputation", 3)
        lvl = c.get("level", 10)
        cname = c["name"]
        base_bal = calculate_initial_balance(division, rep, c_id)
        ticket = calculate_ticket_price(division, rep)

        file_ref = c.get("file_ref", "")
        crest_url = f"/escudos/{file_ref}.png"
        crest_mini_url = f"/escudosMini/{file_ref}.png"

        clubs_out.append({
            "id": cid,
            "name": c["name"],
            "fileRef": file_ref,
            "countryId": c_id,
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
        })

    # Ensure any country with clubs has at least one league entry in leagues_out
    existing_league_cids = set(l["countryId"] for l in leagues_out)
    unleagued_clubs_by_c = defaultdict(list)
    for c in clubs_out:
        if c["countryId"] not in existing_league_cids:
            unleagued_clubs_by_c[c["countryId"]].append(c["id"])

    for c_id, c_club_ids in unleagued_clubs_by_c.items():
        c_name = COUNTRY_NAMES.get(c_id, f"País {c_id}")
        leagues_out.append({
            "countryId": c_id,
            "countryName": c_name,
            "name": f"Liga {c_name}",
            "division": 1,
            "divisionName": "1ª Divisão",
            "teamCount": len(c_club_ids),
            "clubIds": c_club_ids,
            "relegated": 0
        })

    states_out = []
    for s_id, (code, name) in STATE_NAMES.items():
        c_list = state_clubs_map.get(s_id, [])
        states_out.append({
            "id": s_id,
            "code": code,
            "name": name,
            "clubCount": len(c_list),
            "clubIds": c_list,
            "divisions": 1
        })

    countries_out = sorted(list(countries_map.values()), key=lambda x: (-(x["clubCount"]), x["name"]))

    output_db = {
        "version": 2026,
        "totalClubs": len(clubs_out),
        "countries": countries_out,
        "leagues": leagues_out,
        "states": states_out,
        "clubs": clubs_out
    }

    print(f"Writing {len(clubs_out)} clubs to {out_path}...")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_db, f, ensure_ascii=False)

    print("Success! Database generated.")

if __name__ == "__main__":
    main()
