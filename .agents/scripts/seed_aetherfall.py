import os, psycopg2

DATABASE_URL = os.environ["DATABASE_URL"]
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

SOURCE = "Aetherfall: Book I"
SYSTEM = "5e"
EDITION = "5e2014"

# ── helper ────────────────────────────────────────────────────────────────────
def mid(slug):
    return f"aetherfall_book1_{slug}"

def insert_monster(m):
    cur.execute("""
        INSERT INTO bestiary_monsters
          (monster_id, system_key, edition_key, source_book,
           name, size, creature_type, alignment,
           armor_class, armor_notes,
           hit_dice_count, hit_die_size, printed_average_hp,
           str_score, str_mod, dex_score, dex_mod,
           con_score, con_mod, int_score, int_mod,
           wis_score, wis_mod, cha_score, cha_mod,
           challenge_rating)
        VALUES (%(id)s,%(sys)s,%(ed)s,%(src)s,
                %(name)s,%(size)s,%(type)s,%(align)s,
                %(ac)s,%(acn)s,
                %(hdc)s,%(hds)s,%(hp)s,
                %(str)s,%(strm)s,%(dex)s,%(dexm)s,
                %(con)s,%(conm)s,%(int)s,%(intm)s,
                %(wis)s,%(wism)s,%(cha)s,%(cham)s,
                %(cr)s)
        ON CONFLICT (monster_id) DO UPDATE SET
          name=EXCLUDED.name, printed_average_hp=EXCLUDED.printed_average_hp
    """, {**m, "sys": SYSTEM, "ed": EDITION, "src": SOURCE})

def insert_trait(monster_id, order, ttype, name, desc):
    tid = f"{monster_id}_trait_{order}"
    cur.execute("""
        INSERT INTO bestiary_monster_traits
          (trait_id, monster_id, trait_order, trait_type, trait_name, trait_description)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON CONFLICT (trait_id) DO UPDATE SET trait_description=EXCLUDED.trait_description
    """, (tid, monster_id, order, ttype, name, desc))

def insert_action(monster_id, order, category, name, desc,
                  atk_bonus=None, reach=None, range_norm=None, range_long=None,
                  recharge_min=None, recharge_max=None):
    aid = f"{monster_id}_action_{order}"
    cur.execute("""
        INSERT INTO bestiary_monster_actions
          (action_id, monster_id, action_order, action_category,
           action_name, action_description,
           attack_bonus, reach_ft, range_normal_ft, range_long_ft,
           recharge_min, recharge_max)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (action_id) DO UPDATE SET action_description=EXCLUDED.action_description
    """, (aid, monster_id, order, category, name, desc,
          atk_bonus, reach, range_norm, range_long,
          recharge_min, recharge_max))

# ── 1. ASHBORN GOBLIN ─────────────────────────────────────────────────────────
m = mid("ashborn_goblin")
insert_monster(dict(id=m, name="Ashborn Goblin", size="Small", type="Humanoid (goblinoid)",
    align="unaligned", ac=13, acn="ash-crusted hide", hdc=2, hds=6, hp=11,
    str=12, strm=1, dex=14, dexm=2, con=14, conm=2, int=8, intm=-1,
    wis=8, wism=-1, cha=5, cham=-3, cr="1/2"))
insert_trait(m, 1, "passive", "Driven",
    "Cannot be frightened and will not flee. It moves toward the nearest creature it can perceive and attacks. It has no Nimble Escape.")
insert_trait(m, 2, "passive", "Ashfall",
    "On death it collapses into ash. Each creature within 5 feet makes a DC 11 Constitution save or is blinded until the end of its next turn.")
insert_action(m, 1, "action", "Multiattack", "One bite and one claws attack.")
insert_action(m, 2, "action", "Bite",
    "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.",
    atk_bonus=4, reach=5)
insert_action(m, 3, "action", "Claws",
    "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) slashing damage.",
    atk_bonus=4, reach=5)
insert_action(m, 4, "action", "Ash-Mark (instead of Multiattack)",
    "One creature within 5 feet that is below its hit point maximum makes a DC 12 Constitution save or gains 1 stage of Blighted.")

# ── 2. ASHBORN ORC ────────────────────────────────────────────────────────────
m = mid("ashborn_orc")
insert_monster(dict(id=m, name="Ashborn Orc", size="Medium", type="Humanoid (orc)",
    align="unaligned", ac=14, acn="hide fused to the flesh", hdc=4, hds=8, hp=30,
    str=16, strm=3, dex=12, dexm=1, con=17, conm=3, int=5, intm=-3,
    wis=9, wism=-1, cha=6, cham=-2, cr="1"))
insert_trait(m, 1, "passive", "Driven",
    "As the Ashborn Goblin. It retains Aggressive — as a bonus action it moves up to its speed toward a hostile creature it can see.")
insert_trait(m, 2, "passive", "Ashfall",
    "5 ft., DC 11 Constitution. On death it collapses into ash. Each creature within 5 feet makes a DC 11 Constitution save or is blinded until the end of its next turn.")
insert_action(m, 1, "action", "Multiattack", "One greataxe attack and one bite or claws attack.")
insert_action(m, 2, "action", "Greataxe",
    "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage. The haft has grown into the hand and cannot be disarmed.",
    atk_bonus=5, reach=5)
insert_action(m, 3, "action", "Bite",
    "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 3) piercing damage.",
    atk_bonus=5, reach=5)
insert_action(m, 4, "action", "Claws",
    "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 3) slashing damage.",
    atk_bonus=5, reach=5)
insert_action(m, 5, "action", "Ash-Mark (instead of Multiattack)",
    "DC 13 Constitution, 1 stage of Blighted.")

# ── 3. ASHBORN HOBGOBLIN ──────────────────────────────────────────────────────
m = mid("ashborn_hobgoblin")
insert_monster(dict(id=m, name="Ashborn Hobgoblin", size="Medium", type="Humanoid (goblinoid)",
    align="unaligned", ac=17, acn="ash-fused plate", hdc=4, hds=8, hp=22,
    str=13, strm=1, dex=12, dexm=1, con=16, conm=3, int=9, intm=-1,
    wis=10, wism=0, cha=7, cham=-2, cr="1"))
insert_trait(m, 1, "passive", "Martial Advantage (1/Turn)",
    "Deals an extra 7 (2d6) damage to a creature it hits if that creature is within 5 feet of an ally of the hobgoblin that is not incapacitated.")
insert_trait(m, 2, "passive", "Discipline Retained",
    "Ashborn hobgoblins give orders, hold formation, and drive the Driven forward. Where you find one, the chaos in front of it is not chaos at all.")
insert_trait(m, 3, "passive", "Ashfall",
    "5 ft., DC 11 Constitution. On death it collapses into ash.")
insert_action(m, 1, "action", "Multiattack", "One longsword attack and one bite attack.")
insert_action(m, 2, "action", "Longsword",
    "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 1) slashing damage.",
    atk_bonus=3, reach=5)
insert_action(m, 3, "action", "Bite",
    "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) piercing damage.",
    atk_bonus=3, reach=5)
insert_action(m, 4, "action", "Ash-Mark (instead of Multiattack)",
    "DC 12 Constitution, 1 stage of Blighted.")

# ── 4. ASHBORN BUGBEAR ────────────────────────────────────────────────────────
m = mid("ashborn_bugbear")
insert_monster(dict(id=m, name="Ashborn Bugbear", size="Medium", type="Humanoid (goblinoid)",
    align="unaligned", ac=17, acn="ash-crusted hide, shield", hdc=6, hds=8, hp=45,
    str=15, strm=2, dex=14, dexm=2, con=17, conm=3, int=8, intm=-1,
    wis=11, wism=0, cha=7, cham=-2, cr="3"))
insert_trait(m, 1, "passive", "Brute",
    "A melee weapon deals one extra die of damage when the bugbear hits with it (included below).")
insert_trait(m, 2, "passive", "Surprise Attack",
    "If it surprises a creature and hits it during the first round of combat, the target takes an extra 7 (2d6) damage.")
insert_trait(m, 3, "passive", "Patient",
    "The ash has taken its fear without taking its cunning. An ambush predator that infects — the most dangerous thing in a warband short of a shaman.")
insert_trait(m, 4, "passive", "Ashfall",
    "5 ft., DC 11 Constitution. On death it collapses into ash.")
insert_action(m, 1, "action", "Multiattack", "One morningstar, one bite, and one claws attack.")
insert_action(m, 2, "action", "Morningstar",
    "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 11 (2d8 + 2) piercing damage.",
    atk_bonus=4, reach=5)
insert_action(m, 3, "action", "Bite",
    "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 9 (2d6 + 2) piercing damage.",
    atk_bonus=4, reach=5)
insert_action(m, 4, "action", "Claws",
    "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) slashing damage.",
    atk_bonus=4, reach=5)
insert_action(m, 5, "action", "Ash-Mark (instead of Multiattack)",
    "DC 13 Constitution, 1 stage of Blighted.")

# ── 5. ASHBORN OGRE ───────────────────────────────────────────────────────────
m = mid("ashborn_ogre")
insert_monster(dict(id=m, name="Ashborn Ogre", size="Large", type="Giant",
    align="unaligned", ac=12, acn="ash plating", hdc=9, hds=10, hp=76,
    str=19, strm=4, dex=8, dexm=-1, con=17, conm=3, int=4, intm=-3,
    wis=7, wism=-2, cha=5, cham=-3, cr="3"))
insert_trait(m, 1, "passive", "Ashfall",
    "10 ft., DC 11 Constitution. On death it collapses into ash.")
insert_action(m, 1, "action", "Multiattack", "One greatclub attack and one bite attack.")
insert_action(m, 2, "action", "Greatclub",
    "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.",
    atk_bonus=6, reach=5)
insert_action(m, 3, "action", "Bite",
    "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) piercing damage.",
    atk_bonus=6, reach=5)
insert_action(m, 4, "action", "Claws",
    "Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 9 (2d4 + 4) slashing damage.",
    atk_bonus=6, reach=10)
insert_action(m, 5, "action", "Ash-Mark (instead of Multiattack)",
    "One creature within 10 feet below its hit point maximum makes a DC 14 Constitution save or gains 2 stages of Blighted.")

# ── 6. ASHBORN TROLL ──────────────────────────────────────────────────────────
m = mid("ashborn_troll")
insert_monster(dict(id=m, name="Ashborn Troll", size="Large", type="Giant",
    align="unaligned", ac=16, acn="ash-hardened hide", hdc=10, hds=10, hp=115,
    str=18, strm=4, dex=13, dexm=1, con=22, conm=6, int=5, intm=-3,
    wis=9, wism=-1, cha=6, cham=-2, cr="6"))
insert_trait(m, 1, "passive", "Ash-Fed Regeneration",
    "The troll regains 15 hit points at the start of its turn. If it takes acid or fire damage this trait does not function at the start of its next turn — and the suppressed regeneration vents. Each creature within 10 feet immediately makes a DC 14 Constitution save or gains 1 stage of Blighted. The troll dies only if it starts its turn with 0 hit points and does not regenerate.")
insert_trait(m, 2, "passive", "Keen Smell",
    "Advantage on Perception checks relying on smell.")
insert_trait(m, 3, "passive", "Ashfall",
    "10 ft., DC 11 Constitution. On death it collapses into ash.")
insert_action(m, 1, "action", "Multiattack", "One bite and two claws attacks.")
insert_action(m, 2, "action", "Bite",
    "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) piercing damage.",
    atk_bonus=7, reach=5)
insert_action(m, 3, "action", "Claws",
    "Melee Weapon Attack: +7 to hit, reach 10 ft., one target. Hit: 9 (2d4 + 4) slashing damage.",
    atk_bonus=7, reach=10)
insert_action(m, 4, "action", "Ash-Mark (instead of Multiattack)",
    "DC 16 Constitution, 2 stages of Blighted, reach 10 ft.")

# ── 7. ASHBORN DRAGON ────────────────────────────────────────────────────────
m = mid("ashborn_dragon")
insert_monster(dict(id=m, name="Ashborn Dragon", size="Huge", type="Dragon",
    align="unaligned", ac=18, acn="natural armor, ash-fused scale", hdc=17, hds=12, hp=212,
    str=25, strm=7, dex=10, dexm=0, con=23, conm=6, int=6, intm=-2,
    wis=11, wism=0, cha=8, cham=-1, cr="16"))
insert_trait(m, 1, "passive", "Legendary Resistance (3/Day)",
    "If it fails a saving throw, it can choose to succeed instead.")
insert_trait(m, 2, "passive", "Ash Shroud",
    "At the start of each of its turns, each creature within 15 feet makes a DC 19 Constitution save or gains 1 stage of Blighted. A creature that succeeds is immune to this trait for 24 hours.")
insert_trait(m, 3, "passive", "Ashfall",
    "15 ft., DC 11 Constitution. On death it collapses into ash.")
insert_action(m, 1, "action", "Multiattack", "One bite and two claws attacks.")
insert_action(m, 2, "action", "Bite",
    "Melee Weapon Attack: +12 to hit, reach 10 ft., one target. Hit: 18 (2d10 + 7) piercing plus 9 (2d8) necrotic damage.",
    atk_bonus=12, reach=10)
insert_action(m, 3, "action", "Claws",
    "Melee Weapon Attack: +12 to hit, reach 5 ft., one target. Hit: 14 (2d6 + 7) slashing damage.",
    atk_bonus=12, reach=5)
insert_action(m, 4, "action", "Tail",
    "Melee Weapon Attack: +12 to hit, reach 15 ft., one target. Hit: 16 (2d8 + 7) bludgeoning damage.",
    atk_bonus=12, reach=15)
insert_action(m, 5, "action", "Ash Breath (Recharge 5–6)",
    "A 60-foot cone of choking grey ash. Each creature makes a DC 19 Constitution save. Failure: 45 (10d8) necrotic damage and 3 stages of Blighted. Success: half damage and 1 stage. The area is heavily obscured until the end of the dragon's next turn.",
    recharge_min=5, recharge_max=6)
insert_action(m, 6, "action", "Ash-Mark (instead of Multiattack)",
    "DC 19 Constitution, 3 stages of Blighted.")
insert_action(m, 7, "legendary", "Detect",
    "The dragon makes a Wisdom (Perception) check.")
insert_action(m, 8, "legendary", "Tail Attack",
    "The dragon makes one tail attack.")
insert_action(m, 9, "legendary", "Cinder Sweep (Costs 2 Actions)",
    "Each creature within 15 feet makes a DC 20 Dexterity save or takes 14 (2d6 + 7) bludgeoning damage, is knocked prone, and gains 1 stage of Blighted. The dragon then flies up to half its speed.")

# ── 8. ASHBORN GOBLIN SHAMAN ─────────────────────────────────────────────────
m = mid("ashborn_goblin_shaman")
insert_monster(dict(id=m, name="Ashborn Goblin Shaman", size="Small", type="Humanoid (goblinoid)",
    align="unaligned", ac=13, acn="ash-crusted hide", hdc=4, hds=6, hp=27,
    str=12, strm=1, dex=14, dexm=2, con=14, conm=2, int=10, intm=0,
    wis=10, wism=0, cha=8, cham=-1, cr="2"))
insert_trait(m, 1, "passive", "Ashfall",
    "5 ft., DC 11 Constitution. On death it collapses into ash.")
insert_action(m, 1, "action", "Ashen Word",
    "Ranged 60 ft., one creature. The target makes a DC 13 Constitution save or takes necrotic damage and gains 1 stage of Blighted (half damage on success, no stage).",
    range_norm=60)
insert_action(m, 2, "bonus", "Cinder Veil",
    "A 20-foot sphere of swirling ash centred on the shaman becomes heavily obscured until the start of its next turn. Ashborn ignore it.")
insert_action(m, 3, "bonus", "Rouse the Ash (30 ft.)",
    "One ashborn within 30 feet regains hit points equal to 2d6 and immediately makes one attack as a reaction.")

# ── 9. ASHBORN ORC SHAMAN ────────────────────────────────────────────────────
m = mid("ashborn_orc_shaman")
insert_monster(dict(id=m, name="Ashborn Orc Shaman", size="Medium", type="Humanoid (orc)",
    align="unaligned", ac=14, acn="hide fused to the flesh", hdc=7, hds=8, hp=52,
    str=16, strm=3, dex=12, dexm=1, con=17, conm=3, int=10, intm=0,
    wis=11, wism=0, cha=8, cham=-1, cr="3"))
insert_trait(m, 1, "passive", "Ashfall",
    "5 ft., DC 11 Constitution. On death it collapses into ash.")
insert_action(m, 1, "action", "Ashen Word",
    "Ranged 60 ft., one creature. The target makes a DC 14 Constitution save or takes necrotic damage and gains 1 stage of Blighted (half damage on success, no stage).",
    range_norm=60)
insert_action(m, 2, "bonus", "Cinder Veil",
    "A 20-foot sphere of swirling ash centred on the shaman becomes heavily obscured until the start of its next turn. Ashborn ignore it.")
insert_action(m, 3, "bonus", "Rouse the Ash (30 ft.)",
    "One ashborn within 30 feet regains hit points equal to 3d6 and immediately makes one attack as a reaction.")

# ── 10. ASHBORN BUGBEAR SHAMAN ────────────────────────────────────────────────
m = mid("ashborn_bugbear_shaman")
insert_monster(dict(id=m, name="Ashborn Bugbear Shaman", size="Medium", type="Humanoid (goblinoid)",
    align="unaligned", ac=17, acn="ash-crusted hide, shield", hdc=10, hds=8, hp=82,
    str=15, strm=2, dex=14, dexm=2, con=17, conm=3, int=10, intm=0,
    wis=11, wism=0, cha=8, cham=-1, cr="4"))
insert_trait(m, 1, "passive", "Wreathed",
    "Creatures starting their turn within 5 feet of the shaman make a DC 15 Constitution save or gain 1 stage of Blighted.")
insert_trait(m, 2, "passive", "Ashfall",
    "5 ft., DC 11 Constitution. On death it collapses into ash.")
insert_action(m, 1, "action", "Ashen Word",
    "Ranged 60 ft., one creature. The target makes a DC 15 Constitution save or takes necrotic damage and gains 1 stage of Blighted (half damage on success, no stage).",
    range_norm=60)
insert_action(m, 2, "bonus", "Cinder Veil",
    "A 20-foot sphere of swirling ash centred on the shaman becomes heavily obscured until the start of its next turn. Ashborn ignore it.")
insert_action(m, 3, "bonus", "Rouse the Ash (30 ft.)",
    "One ashborn within 30 feet regains hit points equal to 4d6 and immediately makes one attack as a reaction.")

# ── 11. STONEBOUND PEACEKEEPER ────────────────────────────────────────────────
m = mid("stonebound_peacekeeper")
insert_monster(dict(id=m, name="Stonebound Peacekeeper", size="Medium", type="Humanoid",
    align="lawful evil", ac=17, acn="half plate", hdc=6, hds=8, hp=45,
    str=16, strm=3, dex=11, dexm=0, con=16, conm=3, int=10, intm=0,
    wis=12, wism=1, cha=9, cham=-1, cr="2"))
insert_trait(m, 1, "passive", "Marble Flesh",
    "Resistance to nonmagical bludgeoning, piercing, and slashing damage while above half hit points.")
insert_trait(m, 2, "passive", "Order without Fear",
    "Immune to the frightened condition.")
insert_trait(m, 3, "passive", "Slow Fracture",
    "At 0 hit points it becomes an inert statue rather than falling prone. A DC 13 Medicine or Arcana check reveals traces of living tissue inside the stone.")
insert_action(m, 1, "action", "Multiattack", "The peacekeeper makes two halberd attacks.")
insert_action(m, 2, "action", "Halberd",
    "Melee Weapon Attack: +5 to hit, reach 10 ft., one target. Hit: 8 (1d10 + 3) slashing damage.",
    atk_bonus=5, reach=10)
insert_action(m, 3, "action", "Command Silence (Recharge 5–6)",
    "Each enemy within 15 feet makes a DC 12 Wisdom save or cannot speak above a whisper and cannot cast spells with verbal components until the end of its next turn.",
    recharge_min=5, recharge_max=6)

# ── 12. NIGHT CUSTODIAN ───────────────────────────────────────────────────────
m = mid("night_custodian")
insert_monster(dict(id=m, name="Night Custodian", size="Medium", type="Humanoid",
    align="any lawful alignment", ac=14, acn="reinforced coat", hdc=4, hds=8, hp=18,
    str=12, strm=1, dex=14, dexm=2, con=10, conm=0, int=11, intm=0,
    wis=13, wism=1, cha=10, cham=0, cr="1/4"))
insert_trait(m, 1, "passive", "Civic Access",
    "Advantage on checks to navigate service tunnels, municipal yards, and closed streets in Calladris.")
insert_trait(m, 2, "passive", "Trained Non-Disclosure",
    "Advantage on saving throws against being charmed or compelled to reveal night routes.")
insert_action(m, 1, "action", "Hooked Pole",
    "Melee Weapon Attack: +3 to hit, reach 10 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage, and the target makes a DC 11 Strength save or is pulled 5 feet.",
    atk_bonus=3, reach=10)
insert_action(m, 2, "action", "Ash Flask",
    "Ranged Weapon Attack: +4 to hit, range 20/60 ft., one target. Hit: The target is blinded until the end of its next turn unless it succeeds on a DC 11 Constitution save.",
    atk_bonus=4, range_norm=20, range_long=60)

conn.commit()
cur.close()
conn.close()
print("✅ Seeded 12 Aetherfall monsters into bestiary_monsters + traits + actions.")
