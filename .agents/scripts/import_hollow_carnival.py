"""Add The Hollow Carnival to the running app using its campaign-scoped APIs.

No existing campaign data is replaced. Re-running skips matching records.
Printed enemy statistics are extracted from the supplied PDF, not inferred.
Un-statted civilian profiles explicitly disclose their commoner tracker baseline.
"""
import argparse
import csv
import io
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.request

import fitz

SOURCE = Path("attached_assets/The_Hollow_Carnival_Final_1792078281949.pdf")
OUT = Path("generated-artifacts/hollow-carnival")
TITLE = "The Hollow Carnival"
PREGENS = {"Marcus Ironwood", "Lydia Quicktongue", "Brother Aldric", "Ember Nightwhisper"}
BASELINE = (
    "The module provides no combat stat block for this NPC. For tracker use only, "
    "AC 10, HP 4 (1d8), and ability scores 10 use the 5e Commoner baseline; "
    "these are NOT printed module statistics. No equipment or spellcasting is inferred. "
    "Adjust these values if the NPC enters combat."
)


def compact(text):
    return re.sub(r"\s+", " ", text).strip()


def page_text(doc, number):
    text = doc[number - 1].get_text(sort=True)
    text = re.sub(r"^\s*\d+\s+BEASTBOUND PRESS[^\n]*$", "", text, flags=re.M)
    return text.strip()


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def source_note(pages):
    return f"Source: {TITLE}, Beastbound Press; PDF page(s) {pages} (printed page = PDF page minus 1)."


def parse_block(raw, page):
    name, classification = raw.split("\n", 1)[0].split(" — ", 1)
    size, creature_type, alignment = re.match(r"(\w+) (.*), ([^,]+)$", classification).groups()
    ac = int(re.search(r"\bAC (\d+)", raw)[1])
    hp, hit_dice = re.search(r"\bHP (\d+) \(([^)]+)\)", raw).groups()
    abilities = {key.lower(): int(value) for key, value in re.findall(r"\b(STR|DEX|CON|INT|WIS|CHA)\s+(\d+)", raw)}
    assert len(abilities) == 6, name
    sections = {}
    headings = list(re.finditer(r"^[ \t]*(Traits|Actions|Bonus Actions|Reactions|Legendary Actions):[ \t]*$", raw, re.M))
    assert headings, f"Missing stat-block sections for {name}"
    for index, heading in enumerate(headings):
        content = raw[heading.end():headings[index + 1].start() if index + 1 < len(headings) else len(raw)]
        entries = []
        for bullet in re.split(r"\s*·\s*", content):
            bullet = compact(bullet)
            if not bullet:
                continue
            action_name, separator, desc = bullet.partition(". ")
            assert separator, (name, bullet)
            action = {"name": action_name, "desc": desc}
            bonus = re.search(r"[+]([0-9]+) to hit", desc)
            if bonus:
                action["attack_bonus"] = int(bonus[1])
            entries.append(action)
        sections[heading[1]] = entries
    speed = compact(re.search(r"\bSpeed ([^\n]+)", raw)[1])
    actions = list(sections.get("Actions", []))
    for category in ("Bonus Actions", "Reactions", "Legendary Actions"):
        for entry in sections.get(category, []):
            actions.append({**entry, "name": f"{category}: {entry['name']}"})
    traits = list(sections.get("Traits", []))
    metadata = {"name": "Source and Printed Defenses", "desc": source_note(page) + " " + compact(raw[:headings[0].start()])}
    monster = {
        "index": "hollow-carnival-" + slug(name), "name": name,
        "hp": int(hp), "hit_dice": compact(hit_dice), "ac": ac,
        "cr": re.search(r"\bCR ([\d/]+)", raw)[1],
        "size": size, "type": creature_type, "alignment": alignment,
        "speed": {"walk": speed}, **abilities,
        **{key + "Mod": (value - 10) // 2 for key, value in abilities.items()},
        "actions": actions, "special_abilities": [*traits, metadata],
        "source": TITLE, "sourcePage": page - 1, "description": source_note(page),
    }
    categories = {"Actions": "action", "Bonus Actions": "bonus", "Reactions": "reaction", "Legendary Actions": "legendary"}
    monster["detailedActions"] = [
        {"name": action["name"], "description": action["desc"], "category": category,
         **({"attackBonus": action["attack_bonus"]} if "attack_bonus" in action else {})}
        for heading, category in categories.items() for action in sections.get(heading, [])
    ]
    saves_line = re.search(r"^[ \t]*Saves ([^\n]+)", raw, re.M)
    if saves_line:
        monster["savingThrows"] = {ability.lower(): int(bonus) for ability, bonus in re.findall(
            r"(Str|Dex|Con|Int|Wis|Cha)\s+([+-]\d+)", saves_line[1])}
    spell_dc = re.search(r"spell\s+save\s+DC\s+(\d+)", raw, re.I)
    spell_attack = re.search(r"([+-]\d+)\s+to\s+hit\s+with\s+spell\s+attacks", raw, re.I)
    if spell_dc:
        monster["spellSaveDc"] = int(spell_dc[1])
    if spell_attack:
        monster["spellAttackBonus"] = int(spell_attack[1])
    for label, key in (("Senses", "senses"), ("Languages", "languages"), ("Cond. Immune", "conditionImmunities")):
        value = re.search(rf"^[ \t]*{re.escape(label)} ([^\n]+)", raw, re.M)
        if value:
            monster[key] = [part.strip() for part in value[1].split(",")] if key == "conditionImmunities" else value[1].strip()
    for prefix, key in (("Resist", "resistances"), ("Immune", "immunities")):
        match = re.search(rf"^[ \t]*{prefix} ([^\n]+)", raw, re.M)
        if match:
            monster[key] = [value.strip() for value in match[1].split(",")]
    # The legacy campaign CSV has five action columns. Preserve every source
    # detail in a readable final source entry instead of truncating the block.
    csv_actions = [
        {"actionName": action["name"], "actionDescription": action["desc"], "attackBonus": action.get("attack_bonus")}
        for action in sections.get("Actions", [])
    ]
    if traits:
        csv_actions.append({"actionName": "Traits and Spellcasting", "actionDescription": " ".join(f"{item['name']}. {item['desc']}" for item in traits)})
    csv_actions.append({"actionName": "Complete Printed Stat Block and Source", "actionDescription": source_note(page) + " " + compact(raw)})
    assert len(csv_actions) <= 5, name
    return {"monster": monster, "csvActions": csv_actions, "raw": compact(raw), "kind": "enemy"}


def npc(name, notes, page, kind="friendly", child=False, reference=False):
    profile_label = "Reference Only — No Printed Stat Block" if reference else (
        "Friendly NPC Profile" if kind == "friendly" else "Neutral NPC Profile"
    )
    profile = compact(notes) + " " + source_note(page)
    monster = {
        "index": "hollow-carnival-" + slug(name), "name": name,
        "hp": 0 if reference else 4, "ac": 0 if reference else 10,
        "cr": "—", "type": "NPC reference" if reference else "Humanoid (NPC; commoner tracker baseline)",
        "size": "Small" if child else "Medium",
        "source": TITLE, "description": profile,
        "special_abilities": [
            {"name": profile_label, "desc": profile},
            {"name": "Combat Statistics", "desc": "No combat statistics are provided; this is a reference, not a ready-to-run enemy." if reference else BASELINE},
        ],
        "actions": [],
    }
    if not reference:
        monster.update({"hit_dice": "1d8", **{key: 10 for key in ("str", "dex", "con", "int", "wis", "cha")},
                        **{key + "Mod": 0 for key in ("str", "dex", "con", "int", "wis", "cha")}})
    csv_actions = [
        {"actionName": ability["name"], "actionDescription": ability["desc"]}
        for ability in monster["special_abilities"]
    ]
    return {"monster": monster, "csvActions": csv_actions, "kind": "reference" if reference else kind}


def build(doc):
    texts = {number: page_text(doc, number) for number in range(1, len(doc) + 1)}
    gate = texts[14].split("Animated Gate Panel — ", 1)[1].split("\nStakes", 1)[0]
    stallion = texts[18].split("The Gilded Stallion — ", 1)[1]
    horse = texts[19].split("Animated Carousel Horse — ", 1)[1].split("\nStakes", 1)[0]
    quill = texts[20].split("Pellinore Quill, The Ringmaster — ", 1)[1] + "\n" + texts[21].split("\nStakes", 1)[0]
    enemies = [
        parse_block("Animated Gate Panel — " + gate, 14),
        parse_block("The Gilded Stallion — " + stallion, 18),
        parse_block("Animated Carousel Horse — " + horse, 19),
        parse_block("Pellinore Quill, The Ringmaster — " + quill, 20),
    ]
    quill_profile = (
        "His dying carnival and inability to feel joy drove him to a fey bargain that preserved both but hollowed out his soul. "
        "He now steals others' wonder to maintain an eternal performance, luring townsfolk with music and binding them into attractions. "
        "Voice: courteous theatrical showman's patter, grandiose performance language, never raises his voice. "
        "The short character profile calls Charm Person, Hold Person, and Suggestion at-will; the full encounter stat block "
        "instead gives spell slots, which are preserved verbatim rather than silently reconciled. " + source_note(8)
    )
    enemies[-1]["monster"]["special_abilities"].append({"name": "Roleplaying Profile", "desc": quill_profile})
    enemies[-1]["csvActions"][-1]["actionDescription"] += " Roleplaying profile: " + quill_profile
    cast = [
        npc("Esme (Madame Esmerelda)", texts[9], 9),
        npc("Halden Crowe", texts[10], 10),
        npc("Wrenna Ashe", texts[11], 11),
        npc("Tobin Ashe", texts[12] + " The session opening identifies Tobin as eight years old.", "12–13", child=True),
    ]
    captives = [
        npc("William Ashbrook", "Named in Quill's contract ledger as Carousel Horse #3. No further biography or statistics are supplied.", 19),
        npc("Sara Mills", "Named in Quill's contract ledger as Mirror #7. The module also names Little Sara in a different handout, but does not establish that they are the same person; preserved as distinct reference profiles.", 19),
        npc("Marcus Fell", "The player-handout ledger names this captive as Carousel, Bay Mare. Not the pregenerated player character Marcus Ironwood.", 32),
        npc("Little Sara", "The player-handout ledger names this captive as Carousel, Painted Pony. Kept separate from Sara Mills because the source does not establish an alias.", 32, child=True),
        npc("Heinrich Gross", "The player-handout ledger names this captive as Strongman, Forever Lifting.", 32),
    ]
    town_text = texts[31].split("Townfolk Names & Trades (d10)", 1)[1].split("Carnival Complications", 1)[0]
    townsfolk = []
    for line in town_text.splitlines():
        match = re.match(r"\s*\d+\.\s+([^,]+),\s+(.+)", line)
        if match:
            townsfolk.append(npc(match[1], match[2] + ". Optional townfolk from the module's d10 table, not mandatory scene participants.", 31, kind="neutral"))
    assert len(townsfolk) == 10
    supporting = [
        npc("Freed Carousel Villagers", "Two unnamed villagers from previous towns are imprisoned in the carousel's central post. Destroying the post frees them. Freed villagers can become allies in the final confrontation; their identities are not specified. Do not assume they are the named ledger captives.", "18–19"),
        npc("Bound Performers", "Esme leads these contract-bound performers. They communicate in secret signals, coded warnings, and small acts of rebellion, hoping to regain their freedom.", "7, 9"),
        npc("Entranced Townspeople", "Optional complication: a group of townspeople with glazed eyes walks toward the big top. They are victims of the carnival's compulsion, not enemies to kill. The module supplies no group count.", 31),
        npc("Animated Puppets", "The ledger handout mentions a sideshow tent guarded by animated puppets. No stat block, number, or fully specified combat encounter is supplied. This differs from the main Contract Tent scene, which is described as warded but not trapped. Kept as a source reference only; no invented puppet encounter.", 32, reference=True),
        npc("Mirror Guardians", "The running advice mentions adding or removing mirror guardians in the Hall of Mirrors to scale combat. No stat block, base count, or actual guardian combat encounter is supplied.", 4, reference=True),
        npc("Phantom Audience", "Phantom applause echoes from the empty bleachers; exposing Quill with his ledger and turning the audience against him can break his power. The map description depicts phantoms in the seats. No combat statistics or creature count are supplied.", "19–21, 27", reference=True),
        npc("The Impresario", "Sequel hook: a mysterious collector of exotic performances for an audience beyond mortal understanding. Only mentioned by name; identity, alignment, and statistics are not specified. Not an encounter opponent in this adventure.", 22, reference=True),
    ]
    profiles = enemies + cast + captives + townsfolk + supporting
    for profile in profiles:
        profile["monster"]["disposition"] = {
            "combatantType": "monster" if profile["kind"] == "enemy" else "npc",
            "stance": "enemy" if profile["kind"] == "enemy" else ("ally" if profile["kind"] == "friendly" else "neutral"),
            "referenceOnly": profile["kind"] == "reference",
        }
    assert len(profiles) == 30
    assert not PREGENS.intersection(profile["monster"]["name"] for profile in profiles)
    by_name = {profile["monster"]["name"]: profile for profile in profiles}

    def combatant(name, count=None, encounter_notes=None):
        profile = by_name[name]
        monster = json.loads(json.dumps(profile["monster"]))
        assert profile["kind"] != "reference"
        if encounter_notes:
            monster["special_abilities"].append({"name": "Encounter Notes", "desc": encounter_notes})
        friendly = profile["kind"] in ("friendly", "neutral")
        row = {
            "id": monster["index"], "name": name, "initiative": 0, "initiativeRolled": False,
            "hp": monster["hp"], "maxHp": monster["hp"], "tempHp": 0, "ac": monster["ac"],
            "isMonster": True, "combatantType": "npc" if friendly else "monster",
            "conditions": [], "isDown": False, "isDead": False, "isStable": False,
            "deathSaveSuccesses": 0, "deathSaveFailures": 0, "joiningNextRound": False,
            "stance": "ally" if profile["kind"] == "friendly" else ("neutral" if friendly else "enemy"),
            "monsterData": monster,
        }
        if count is not None:
            row.update({"isGroup": True, "memberHp": [monster["hp"]] * count,
                        "memberConditions": [[] for _ in range(count)],
                        "memberConditionDurations": [{} for _ in range(count)]})
        return row

    def encounter(name, rows):
        return {"name": name, "data": {"combatants": rows, "round": 1, "activeIndex": 0,
                                     "combatState": "setup", "selectedVersions": ["5e"]}}

    gate_notes = (
        "Optional Easy combat if the party forces entry or refuses Esme's warnings. "
        "The source says panels (plural) but specifies no starting count: this imported group uses an editable assumption of 2. "
        "The module suggests adding one panel for a larger party. Panels target spellcasters and block retreat. "
        "Esme takes cover behind her booth and is not an enemy. Fog conceals the map edges. PDF pp. 14, 23."
    )
    carousel_notes = (
        "Printed roster: The Gilded Stallion and TWO Animated Carousel Horses. "
        "The Stallion uses charging rocking leaps; horses flank and attack prone targets. "
        "While calliope music plays, the Stallion has advantage on attacks and saves. "
        "If music stops, all constructs move at half speed and the Stallion loses its advantage. "
        "Destroying the central post frees two unnamed villagers. Additional horses are optional scaling only. PDF pp. 18–19, 25."
    )
    quill_notes = (
        "Hard final confrontation. Quill prefers negotiation; preserve exposure and voluntary-bargain alternatives. "
        "For EACH captive freed before the encounter, apply -1 to Quill's attacks, saving throws, and spell save DC "
        "(source says minimum +1 bonus). The number freed is not assumed or pre-applied. "
        "Freed captives may be rallied as allies (DC 17 Persuasion). At half HP he offers frantic bargains. "
        "Legendary actions and Dramatic Reversal reaction are retained in the stat block. PDF pp. 20–21, 27."
    )
    encounters = [
        encounter("01 — The Painted Gate (Easy)", [combatant("Animated Gate Panel", 2, gate_notes)]),
        encounter("02 — The Enchanted Carousel (Medium)", [
            combatant("The Gilded Stallion", encounter_notes=carousel_notes),
            combatant("Animated Carousel Horse", 2, carousel_notes),
        ]),
        encounter("03 — The Big Top: Pellinore Quill (Hard)", [
            combatant("Pellinore Quill, The Ringmaster", encounter_notes=quill_notes),
        ]),
        encounter("04 — Allies and Captives (NPC Reference Roster)", [
            combatant(profile["monster"]["name"], 2 if profile["monster"]["name"] == "Freed Carousel Villagers" else None)
            for profile in cast + captives + supporting[:3]
        ]),
        encounter("05 — Millhaven Townsfolk (NPC Reference Roster)", [
            combatant(profile["monster"]["name"]) for profile in townsfolk
        ]),
    ]
    for saved in encounters:
        assert all(row["combatantType"] != "pc" for row in saved["data"]["combatants"])
    return {"profiles": profiles, "encounters": encounters}


def request(base, path, method="GET", body=None, content_type="application/json"):
    data = None if body is None else (json.dumps(body).encode() if content_type == "application/json" else body.encode())
    req = urllib.request.Request(base + path, data=data, method=method, headers={"Content-Type": content_type})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"{method} {path}: HTTP {error.code}: {error.read().decode()}") from error


def profile_csv(profiles):
    fields = ["name", "type", "size", "alignment", "ac", "hp", "hit_dice", "dex", "cr"]
    for index in range(1, 6):
        fields += [f"action{index}_name", f"action{index}_desc", f"action{index}_attack_bonus"]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for profile in profiles:
        monster = profile["monster"]
        reference = profile["kind"] == "reference"
        row = {"name": monster["name"], "type": monster["type"], "size": monster["size"],
               "alignment": monster.get("alignment", ""), "ac": "" if reference else monster["ac"],
               "hp": "" if reference else monster["hp"], "hit_dice": monster.get("hit_dice", ""),
               "dex": monster.get("dex", ""), "cr": monster["cr"]}
        for index, action in enumerate(profile["csvActions"], 1):
            row.update({f"action{index}_name": action["actionName"],
                        f"action{index}_desc": compact(action["actionDescription"]),
                        f"action{index}_attack_bonus": action.get("attackBonus", "")})
        writer.writerow(row)
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Create missing campaign records through the running app")
    parser.add_argument("--enrich-profiles", action="store_true", help="Fill missing structured profiles without changing existing rich profiles or saved rosters")
    args = parser.parse_args()
    payload = build(fitz.open(SOURCE))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "import-manifest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    (OUT / "profiles.csv").write_text(profile_csv(payload["profiles"]))
    print(f"Prepared {len(payload['profiles'])} campaign profiles and {len(payload['encounters'])} saved rosters; no pregenerated PCs.")
    if not args.apply:
        return
    base = "https://" + os.environ["REPLIT_DEV_DOMAIN"]
    existing_campaigns = request(base, "/api/campaigns")
    campaign = next((item for item in existing_campaigns if item["name"] == TITLE), None)
    description = (
        "Beastbound Press adventure for 3–4 players, D&D 5e (2014), one 4–6-hour session. "
        "Rescue the carnival's captives before dawn. Imported from The Hollow Carnival Final PDF. "
        "Three printed combat encounters plus ally/captive and townsfolk reference rosters; pregenerated PCs excluded. "
        "Un-statted civilians use clearly labelled Commoner tracker baselines, not printed module stats. "
        "The optional Painted Gate group starts at 2 (count unspecified in source); adjust as needed. "
        "The Carousel has 1 Gilded Stallion and 2 horses. Quill starts at full strength; apply rescued-captive penalties as played. "
        "Un-statted puppets, mirror guardians, phantom audience, and the Impresario remain reference-only profiles. "
        "The PDF's inconsistent captive ledger names are preserved separately rather than silently merged."
    )
    if campaign is None:
        campaign = request(base, "/api/campaigns", "POST", {"name": TITLE, "edition": "5e", "description": description})
    elif "Imported from The Hollow Carnival Final PDF" not in (campaign.get("description") or ""):
        raise RuntimeError("A campaign already uses this name but is not this module import; refusing to change it.")
    path = f"/api/campaigns/{campaign['id']}"
    existing_profiles = request(base, path + "/homebrew-bestiary")
    names = {item["name"] for item in existing_profiles}
    missing = [profile for profile in payload["profiles"] if profile["monster"]["name"] not in names]
    if missing:
        request(base, path + "/homebrew-bestiary/import", "POST", {"profiles": [item["monster"] for item in missing]})
    if args.enrich_profiles:
        by_name = {item["monster"]["name"]: item["monster"] for item in payload["profiles"]}
        for existing in existing_profiles:
            if existing["name"] in by_name and not existing.get("profileData"):
                request(base, path + f"/homebrew-bestiary/{existing['id']}/profile",
                        "PATCH", by_name[existing["name"]])
    existing_encounters = request(base, path + "/prepared-encounters")
    encounter_names = {item["name"] for item in existing_encounters}
    for encounter in payload["encounters"]:
        if encounter["name"] not in encounter_names:
            request(base, path + "/prepared-encounters", "POST", encounter)
    saved_profiles = request(base, path + "/homebrew-bestiary")
    saved_encounters = request(base, path + "/prepared-encounters")
    characters = request(base, path + "/characters")
    assert len(saved_profiles) >= len(payload["profiles"])
    assert all(profile["monster"]["name"] in {item["name"] for item in saved_profiles} for profile in payload["profiles"])
    assert len({item["name"] for item in saved_profiles}) == len(saved_profiles), "Duplicate profile"
    assert len(characters) == 0, "Unexpected campaign player characters"
    for encounter in saved_encounters:
        assert all(row["combatantType"] != "pc" and row["name"] not in PREGENS for row in encounter["data"]["combatants"])
    # The import is additive; neither shared content nor any other campaign is changed.
    assert {item["id"] for item in existing_campaigns}.issubset(
        {item["id"] for item in request(base, "/api/campaigns")}
    )
    print(json.dumps({"campaignId": campaign["id"], "campaign": TITLE,
                      "profiles": len(saved_profiles), "savedRosters": len(saved_encounters),
                      "playerCharacters": len(characters)}, indent=2))


if __name__ == "__main__":
    main()
