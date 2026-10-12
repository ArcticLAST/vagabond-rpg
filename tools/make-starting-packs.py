import json, glob, os, random, string, re
ROOT = "/mnt/project-files/vagabond-system/src/packs"
SRC = "Vagabond Core Rulebook (Alpha 3), p. {}"
def rid():
    return "".join(random.choice(string.ascii_letters + string.digits) for _ in range(16))
def slug(n): return re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")

# --- Missing gear the Starting Packs need (added to the gear pack) ---
GEAR_BLANK = {"quantity": 1, "slots": 1, "value": 0, "equipped": False, "category": "adventuring", "alchemicalType": "",
              "consumable": False, "slotsBonus": 0, "uses": {"value": 0, "max": 0}, "roll": {"formula": "", "type": "", "save": ""}}
NEW_GEAR = [
    ("Costume", 50, 1, "adventuring", "<p><em>Clothing, Hygiene, &amp; Textiles</em></p>", 79, "icons/svg/item-bag.svg"),
    ("Makeup kit", 50, 1, "tool", "<p><em>Clothing, Hygiene, &amp; Textiles</em></p>", 79, "icons/svg/item-bag.svg"),
    ("Mirror", 10, 1, "adventuring", "<p><em>Clothing, Hygiene, &amp; Textiles</em></p>", 79, "icons/svg/item-bag.svg"),
    ("Blacksmithing Tools", 50, 2, "tool", "<p><em>Smithy</em></p>", 82, "icons/tools/smithing/anvil.webp"),
    ("Quiver", 10, 1, "ammunition", "<p>Ammunition container. You don't track every piece of mundane ammo: if you have a container (quiver, box, etc.), you have ammunition.</p>", 76, "icons/weapons/ammunition/arrows-fletching.webp"),
    ("Bolt case", 10, 1, "ammunition", "<p>Ammunition container. You don't track every piece of mundane ammo: if you have a container (quiver, box, etc.), you have ammunition.</p>", 76, "icons/weapons/ammunition/arrows-fletching.webp"),
    ("Box of bullets", 10, 1, "ammunition", "<p>Ammunition container. You don't track every piece of mundane ammo: if you have a container (quiver, box, etc.), you have ammunition.</p>", 76, "icons/weapons/ammunition/shot-round-blue.webp"),
    ("Box of shells", 10, 1, "ammunition", "<p>Ammunition container. You don't track every piece of mundane ammo: if you have a container (quiver, box, etc.), you have ammunition.</p>", 76, "icons/weapons/ammunition/shot-round-blue.webp"),
    ("Garrote", 0, 1, "adventuring", "<p>Listed in the Spy Starting Pack. The price lists give no Cost or Slots for it; Slots set to 1 (carried in one hand).</p>", 75, "icons/svg/item-bag.svg"),
    ("Ingredients", 0, 1, "adventuring", "<p>Cooking ingredients, listed in the Cook Starting Pack as \"ingredients (1g)\". The price lists give no Slots for it; Slots set to 1.</p>", 75, "icons/svg/item-bag.svg"),
]

def load(pack):
    out = {}
    for f in glob.glob(f"{ROOT}/{pack}/*.json"):
        d = json.load(open(f)); out[d["name"].lower()] = (pack, d["_id"], d)
    return out

gear = load("gear")
for name, value, slots, cat, desc, page, img in NEW_GEAR:
    if name.lower() in gear: continue
    i = rid()
    d = {"_id": i, "_key": f"!items!{i}", "name": name, "type": "gear", "img": img,
         "system": {"description": desc, "source": SRC.format(page), **{**GEAR_BLANK, "value": value, "slots": slots, "category": cat}},
         "effects": [], "folder": None, "sort": 0, "ownership": {"default": 0}, "flags": {}}
    json.dump(d, open(f"{ROOT}/gear/{slug(name)}-{i}.json", "w"), indent=2)
gear = load("gear")
idx = {**load("alchemical-items"), **load("weapons-armor"), **gear}

PACK_ID = {"gear": "gear", "alchemical-items": "alchemical-items", "weapons-armor": "weapons-armor"}
ALIAS = {
    "l. armor": "armor, light", "l.armor": "armor, light", "m. armor": "armor, medium", "h. armor": "armor, heavy",
    "caestus": "caestus/gauntlet", "rope": "rope (50')", "lockpicks": "lockpick", "loaded dice": "dice set, loaded",
    "loaded dice set": "dice set, loaded", "playing cards": "cards, deck, playing", "marked deck": "cards, deck, marked",
    "tarot cards": "cards, deck, tarot", "flour bag": "flour (1 lb. bag)", "perfume": "perfume (vial)",
    "bottle of common wine": "wine, common, bottle of", "incense": "incense (stick)", "holy water": "holy water",
    "anointing oil": "oil, anointing", "lute": "portable instruments, lute", "scroll case": "case, map/scroll",
    "map case": "case, map/scroll", "quill": "quill", "ink": "ink, writing (1 oz)", "parchment": "parchment (1 sheet)",
    "shield": "shield", "standard shield": "shield", "greatshield": "shield, great", "hooded lantern": "lantern, hooded",
    "sawed off shotgun": "shotgun, sawn-off", "blank book": "book, blank", "scribe tools": "scribing tools",
    "sheet music book": "book, sheet music", "formal clothes": "clothes, formal", "signet ring": "ring, crest/signet",
    "basic poison": "poison, basic", "light crossbow": "crossbow, light", "oil": "oil, flask", "med kit": "med kit",
    "bullets": "box of bullets", "rations": "rations (1 day)", "torches": "torch", "torch": "torch",
}
COMMON = [("backpack", 1), ("bedroll", 1), ("rations", 5), ("torch", 2), ("waterskin", 1)]

ROWS = """11|Alchemist|alchemy tools, materials (1g), l. armor|87s
12|Assassin|alchemy tools, materials (1g), dagger (2), basic poison, l. armor|60s
13|Astronomer|trinket, telescope, astrolabe, map case|7s
14|Blacksmith|warhammer, h. armor, blacksmithing tools, materials (50s)|47s
15|Bounty Hunter|rifle, handgun, box of bullets, rope, manacles, lockpicks (3), l. armor|15s
16|Brawler|caestus (2), m. armor, tankard|1g 46s
21|Charlatan|club, dagger, l. armor, loaded dice, playing cards|2g 34s
22|Conman|dagger (2), l. armor, loaded dice set, marked deck|1g 50s
23|Cook|cooking tools, ingredients (1g), flour bag, mess kit, iron pan|76s
24|Courtesan|perfume, dagger (2), makeup kit, bottle of common wine|1g 63s
25|Devout|trinket, incense (20), l. armor, holy water, anointing oil|91s
26|Entertainer|shortsword, l. armor, costume, lute|61s
31|Envoy|shortsword, l. armor, scroll case, quill, ink, parchment (10)|1g 45s
32|Fortune Teller|trinket, tarot cards, dagger (2), l. armor|1g 15s
33|Gladiator|poleblade, shield, l. armor|95s
34|Hermit|staff, herbalism tools, materials (50s), hooded lantern, tarot cards|1g 5s
35|Highwayman|sawed off shotgun, box of shells, l. armor, dagger (2)|45s
36|Investigator|handgun, box of bullets, dagger (2), magnifying glass, l. armor|1g 15s
41|Knight|longsword, standard shield, h. armor|20s
42|Mage|trinket (2), robe, blank book, scribe tools|31s
43|Miner|light hammer (2), pickaxe, jeweler tools, l. armor|1g 55s
44|Monk|katar (2), staff, l. armor|1g 85s
45|Musician|lute, sheet music book, shortsword, l. armor|75s
46|Noble|shortsword, handgun, bullets, formal clothes, mirror, signet ring|5s
51|Nomad|staff, dagger (2), shortbow, quiver|1g 75s
52|Occultist|trinket, dagger (2), herbalism tools, materials (1g)|65s
53|Physician|med kit, herbalism tools, materials (50s), antitoxin (2)|35s
54|Scout|longbow, quiver, l. armor, compass|1g 25s
55|Seaman|handgun, box of bullets, shortsword, l. armor, net|1g 55s
56|Sellsword|longsword, shield, m. armor|95s
61|Sentinel|greatshield, h. armor|35s
62|Spy|dagger, garrote, makeup kit, l. armor, formal clothes|1g 55s
63|Trapper|longbow, quiver, hunting trap, leatherworking tools, l. armor|24s
64|Tinker|tinker tools, materials (1g), crossbow, bolt case|60s
65|Warrior|greataxe, javelin (2), l. armor|74s
66|Watchman|club, light crossbow, bolt case, m. armor, hooded lantern, oil|33s"""
# The book prints some entries in combined form; these are the book's original wording, kept for the description.
PRINTED = {"Devout": "trinket, incense (20 sticks), l. armor, holy water, anointing oil",
           "Envoy": "shortsword, l. armor, scroll case, quill and ink, parchment (10)",
           "Noble": "shortsword, handgun and bullets, formal clothes, mirror, signet ring"}

def coins(t):
    g = re.search(r"(\d+)g", t); s = re.search(r"(\d+)s", t)
    return (int(g.group(1)) * 100 if g else 0) + (int(s.group(1)) if s else 0)

def entry(token):
    m = re.match(r"^(.*?)\s*\((.+)\)$", token.strip())
    name, extra = (m.group(1), m.group(2)) if m else (token.strip(), None)
    qty, value = 1, None
    if extra:
        if re.fullmatch(r"\d+", extra): qty = int(extra)
        else: value = coins(extra)
    key = ALIAS.get(name.lower(), name.lower())
    if key not in idx: raise SystemExit(f"unresolved: {token!r} -> {key!r}")
    pack, iid, d = idx[key]
    e = {"uuid": f"Compendium.vagabond-rpg.{pack}.Item.{iid}", "name": d["name"], "quantity": qty}
    e["value"] = value
    return e

os.makedirs(f"{ROOT}/starting-packs", exist_ok=True)
for f in glob.glob(f"{ROOT}/starting-packs/*.json"): os.remove(f)
for row in ROWS.split("\n"):
    d66, name, items, wealth = row.split("|")
    contents = [entry(t) for t in items.split(",")] + [entry(f"{n} ({q})" if q > 1 else n) for n, q in COMMON]
    i = rid()
    printed = PRINTED.get(name, items)
    desc = (f"<p><strong>d66 {d66[0]}-{d66[1]}.</strong> {printed[0].upper() + printed[1:]}.</p>"
            f"<p>Also includes a backpack, bedroll, 5 days of rations, 2 torches, and a waterskin. Each pack spends the 3g of Starting Wealth; remaining Wealth: <strong>{wealth}</strong>.</p>"
            "<p>Drop this pack on a Hero to unpack its Items and Wealth.</p>")
    d = {"_id": i, "_key": f"!items!{i}", "name": f"Starting Pack: {name}", "type": "gear", "img": "icons/containers/bags/pack-leather-white-tan.webp",
         "system": {"description": desc, "source": SRC.format(75), **{**GEAR_BLANK, "slots": 0, "value": 300, "category": "kit"},
                    "contents": contents, "wealth": coins(wealth)},
         "effects": [], "folder": None, "sort": int(d66) * 100, "ownership": {"default": 0}, "flags": {}}
    json.dump(d, open(f"{ROOT}/starting-packs/{slug(name)}-{i}.json", "w"), indent=2)
print("ok", len(ROWS.split("\n")))
