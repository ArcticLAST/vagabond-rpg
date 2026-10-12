"""Correct the Bestiary and Humanlike statblocks after they are built from the rulebook text.

Two kinds of correction, both safe to run more than once:

1. Saves read from the Action text. Heroes make Reflex Saves to avoid Enemy Actions unless the statblock says
   otherwise (p. 14), so an attack that reads "7 (2d6) and pass [Endure] or be Sickened" is avoided with Reflex,
   and the Endure Save is a second Save made by a Being it hits. That second Save goes in effectSaves; the Save
   to avoid the Action stays in save. Casts, Actions, and Abilities that print no Save have none (the Angel's
   Command is "take 4 (d6+1) or obey", with no Save), so their first "pass [Save]" is their save, if any. A Save
   named in the tags ("| Endure", "| Endure or Reflex") always wins.
2. Fixes found by comparing every statblock with the rulebook (vagabond-system-qa/bestiary-audit.md), and the
   damage and healing that some Abilities and Actions only print in their text.

Combos are never attacks: they say which of the Being's attacks it makes with one Action ("8×Claw" is eight Claw
attacks), so a Combo has no damage or Save of its own.

Usage: python3 tools/bestiary-corrections.py [pack source dirs...]   (default: src/packs/bestiary src/packs/humanlike)
"""
import copy, json, os, re, sys

SAVES = ("endure", "reflex", "will")
ATTACKS = ("melee", "ranged", "attack")
COMBO_IMG = "icons/skills/melee/maneuver-sword-katana-yellow.webp"
ABILITY_IMG = "icons/svg/aura.svg"

LEADS_WITH_DAMAGE = re.compile(r"^\s*\d+\s*(?:\(|and\b|,)", re.I)
PASS = re.compile(r"\bpass\s+(?:an?\s+)*\[(Endure|Reflex|Will)\]", re.I)


def plain(html):
    return re.sub(r"<[^>]+>", "", html or "")


def tag_save(tags):
    """The Save named after the '|' in an Action's tags, if any."""
    if "|" not in (tags or ""): return None
    part = tags.split("|", 1)[1].lower()
    found = [s for s in SAVES if s in part]
    if {"endure", "reflex"} <= set(found) and " or " in part: return "endureReflex"
    return found[0] if found else None


def saves_for(sys_):
    """(save, effectSaves) for an Action from its type, tags, and text."""
    kind = sys_.get("actionType")
    text = plain(sys_.get("description"))
    passes = []
    for m in PASS.finditer(text):
        s = m.group(1).lower()
        if s not in passes: passes.append(s)
    if kind == "combo": return "", []
    named = tag_save(sys_.get("tags"))
    if named: primary = named
    elif kind == "ability": primary = passes[0] if passes else ""
    elif kind in ATTACKS: primary = "reflex"
    elif LEADS_WITH_DAMAGE.match(text): primary = ""   # "7 (2d6) and pass [Endure] or ...": the damage lands, then a Save
    else: primary = passes[0] if passes else ""
    covered = {"endure", "reflex"} if primary == "endureReflex" else {primary}
    return primary, [s for s in passes if s not in covered]


# Damage and healing printed only in the text: (creature, action) -> fields to set.
TEXT_DAMAGE = {
    ("Achaierai", "Smoky Escape"): {"damage": "2d6", "average": 7},
    ("Agnar", "Leap"): {"damage": "3d6", "average": 10},
    ("Black Pudding", "Engulfer"): {"damage": "3d8", "average": 13},
    ("Chimera", "Dragon's Bite"): {"damage": "3d4", "average": 7},
    ("Lich", "Dominator 6: Life Disruption"): {"damage": "3d6", "average": 10},
    ("Magmot", "Burrow Burst"): {"damage": "4d8", "average": 18},
    ("Phoenix", "Fiery Revival (1/Day)"): {"damage": "1d10*10", "average": 55, "damageType": "fire"},
    ("Rot Grub", "Flesh Burrow"): {"damage": "d6", "average": 3},
    ("Assassin", "Sneak Attack"): {"damage": "d4", "average": 2},
    ("Spy", "Sneak Attack"): {"damage": "d4", "average": 2},
    # Healing
    ("Couatl", "Restoration"): {"damage": "3d6", "average": 10, "healing": True},
    ("Unicorn", "Heal"): {"damage": "2d6", "average": 7, "healing": True},
    ("Acolyte", "Cure Wounds"): {"damage": "d6", "average": 3, "healing": True},
    ("Druid", "Cure Wounds"): {"damage": "d6", "average": 3, "healing": True},
    ("Apothecary", "Health Potion"): {"damage": "d6+1", "average": 4, "healing": True},
    ("Efreeti", "Regenerate II"): {"damage": "2d8", "average": 9, "healing": True},
    ("Lindworm", "Regenerate I"): {"damage": "2d8", "average": 9, "healing": True},
    ("Oni", "Regenerate II"): {"damage": "2d8", "average": 9, "healing": True},
    ("Pit Fiend", "Regenerate III"): {"damage": "3d8", "average": 13, "healing": True},
    ("Stolas Demon", "Regenerate III"): {"damage": "3d8", "average": 13, "healing": True},
    ("Tarrasque", "Regenerate II"): {"damage": "2d8", "average": 9, "healing": True},
    ("Troll", "Lesser Regenerate I"): {"damage": "d8", "average": 4, "healing": True},
    ("Unicorn", "Regenerate I"): {"damage": "d8", "average": 4, "healing": True},
    ("Hydrangean", "Hydra Regrowth"): {"damage": "4", "average": 4, "healing": True},
}

# Actions whose text prints a Save the tags don't: (creature, action) -> fields to set before the save rules run.
ACTION_FIXES = {
    ("Aurumvorax", "Combo"): {"actionType": "combo", "tags": "a Restrained Being", "damage": "", "average": None,
                              "damageType": "", "img": COMBO_IMG},
    ("Stone Colossus", "Combo (A)"): {"actionType": "combo", "img": COMBO_IMG},
    ("Stone Colossus", "Combo (B)"): {"actionType": "combo", "img": COMBO_IMG},
    ("Manticore", "Combo 1 (1/Day)"): {"name": "Combo 1", "actionType": "combo", "recharge": "1/Day", "img": COMBO_IMG},
    ("Manticore", "Combo 2"): {"actionType": "combo", "img": COMBO_IMG},
    ("Crawling Wall", "Immutable"): {"actionType": "ability", "tags": "", "save": "", "img": ABILITY_IMG, "ability": True},
    ("Byakhee", "Instant Transmission (Recharge Cd10 days"): {
        "name": "Instant Transmission", "recharge": "Recharge Cd10 days",
        "strip": r"^<p>Instant Transmission \(Recharge Cd10 days\):\s*"},
    ("Dragon, Hatchling", "Green Breath"): {"replace": (" if failed.", ".")},
}


def fix_actor(doc):
    """Creature-level corrections from the audit."""
    name, s = doc["name"], doc["system"]
    d = s["details"]
    if name == "Aurumvorax":
        d["immune"], d["statusImmunities"] = "Fire, Poison", "Sickened"
    elif name == "Deep One":
        d["immune"], d["statusImmunities"] = "Poison", "Charmed, Paralyzed, Unconscious"
    elif name == "Chimera":
        d["subtype"] = ""
    elif name == "Viper Tree":
        d["zone"] = "frontline"
    elif name == "Hydrangean":
        d["beingType"], d["subtype"] = "primordial", "Plant"
        d["description"] = d["description"].replace("<p>Medium Prmordial (Plant) ", "<p>")
    elif name in ("Golem, Bone", "Necrophidius"):
        d["subtype"] = "Undead"
    elif name == "Gremlin":
        d["subtype"] = "Fae"
    elif name in ("Snake,GiantConstrictor", "Hippopotamus,Behemoth"):
        doc["name"] = doc["prototypeToken"]["name"] = name.replace(",", ", ").replace("GiantConstrictor", "Giant Constrictor")
    elif name in ("Dragon, Ancient", "Dragon, Elder", "Dragon, Young", "Dragon, Hatchling"):
        credit = "<p>This version of the Dragon is inspired by Skerples' from The Monster Overhaul.</p>"
        if credit not in d["description"]: d["description"] += credit
    elif name == "Crab, Giant":
        amph = next((i for i in doc["items"] if i["name"] == "Amphibious"), None)
        if amph and "On-Sight" in amph["system"]["description"]:
            amph["system"]["description"] = "<p>It can breathe air and water.</p>"
            on_sight = copy.deepcopy(amph)
            on_sight["_id"] = derive_id(doc["_id"], "onsight")
            on_sight["_key"] = f"!actors.items!{doc['_id']}.{on_sight['_id']}"
            on_sight["name"] = "On-Sight"
            on_sight["system"]["description"] = "<p>Is Berserk, considers all Beings Enemies.</p>"
            on_sight["system"]["sort"] = amph["system"]["sort"] + 1
            on_sight["sort"] = amph["sort"] + 1
            doc["items"].append(on_sight)


def derive_id(seed, salt):
    """A stable 16-character Foundry id derived from a seed, so reruns produce the same document."""
    import hashlib
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    h = hashlib.sha256(f"{seed}:{salt}".encode()).digest()
    return "".join(chars[b % len(chars)] for b in h[:16])


def rekey(doc, new_id):
    doc["_id"] = new_id
    doc["_key"] = f"!actors!{new_id}"
    for i, item in enumerate(doc["items"]):
        item["_id"] = derive_id(new_id, f"item{i}")
        item["_key"] = f"!actors.items!{new_id}.{item['_id']}"


def split_dog(path, doc):
    """The book prints the Small and Medium Dog as one two-column statblock (p. 127). Return the Small Dog's
    document and turn this one into the Medium Dog."""
    small = copy.deepcopy(doc)
    rekey(small, derive_id(doc["_id"], "small"))
    for dog, (size, tl, hp, morale, speed, bite, avg, text) in (
        (small, ("small", 0.2, 1, 3, 30, "1", 1, "<p>1</p>")),
        (doc, ("medium", 0.5, 4, 7, 40, "d4", 2, "<p>2 (d4)</p>")),
    ):
        dog["name"] = dog["prototypeToken"]["name"] = f"Dog, {size.title()}"
        s = dog["system"]
        s["tl"] = tl
        s["attributes"]["hp"] = {"value": hp, "max": hp}
        s["attributes"]["morale"] = morale
        s["attributes"]["speed"] = {"value": speed, "types": ""}
        s["details"]["size"] = size
        bite_item = next(i for i in dog["items"] if i["name"] == "Bite")
        bite_item["system"].update(damage=bite, average=avg, description=text)
    return small


def fix_items(doc):
    changed = False
    for item in doc.get("items", []):
        if item.get("type") != "action": continue
        s = item["system"]
        before = json.dumps(item, sort_keys=True)
        key = (doc["name"], item["name"])
        fix = dict(ACTION_FIXES.get(key, {}))
        if fix:
            if "name" in fix: item["name"] = fix.pop("name")
            if "img" in fix: item["img"] = fix.pop("img")
            if fix.pop("ability", False): item["sort"] = max(item["sort"], 10000)
            if "strip" in fix: s["description"] = "<p>" + re.sub(fix.pop("strip"), "", s["description"])
            if "replace" in fix:
                old, new = fix.pop("replace")
                s["description"] = s["description"].replace(old, new)
            s.update(fix)
        if key in TEXT_DAMAGE and not s.get("damage"):
            s.update(TEXT_DAMAGE[key])
        if s.get("actionType") == "combo":
            s.update(damage="", average=None, damageType="", relic=0)
        save, effect = saves_for(s)
        s["save"] = save
        s["effectSaves"] = {k: k in effect for k in SAVES}
        s.setdefault("healing", False)
        if json.dumps(item, sort_keys=True) != before: changed = True
    return changed


def grim_reaper():
    """The Grim Reaper the Deck of Many Things' Skull card summons (p. 104). It isn't in the Bestiary chapter."""
    aid = derive_id("grim-reaper", "actor")
    def action(i, name, kind, img, text, sort, **extra):
        iid = derive_id(aid, f"item{i}")
        s = {"description": text, "source": "", "actionType": kind, "tags": extra.pop("tags", ""), "damage": "", "average": None,
             "damageType": "", "relic": 0, "save": "", "recharge": "", "sort": sort,
             "effectSaves": {"endure": False, "reflex": False, "will": False}, "healing": False}
        s.update(extra)
        return {"_id": iid, "_key": f"!actors.items!{aid}.{iid}", "name": name, "type": "action", "img": img, "system": s,
                "effects": [], "folder": None, "sort": sort * 100, "ownership": {"default": 0}, "flags": {}}
    return {
        "_id": aid, "_key": f"!actors!{aid}", "name": "Grim Reaper", "type": "npc", "img": "icons/svg/mystery-man.svg",
        "system": {
            "hd": 0, "tl": 0,
            "attributes": {"hp": {"value": 0, "max": 0}, "armor": 8, "armorTag": "as (+5) Heavy", "morale": 12,
                           "speed": {"value": 60, "types": "Fly, Phase"}},
            "details": {"size": "medium", "beingType": "undead", "subtype": "", "zone": "frontline", "appearing": "Special",
                        "senses": "Allsight, Darksight", "immune": "Cold, Fire, Poison, Shock", "weak": "Physical from Silvered Weapons",
                        "statusImmunities": "Charmed, Confused, Frightened, Paralyzed, Restrained, Sickened",
                        "source": "Vagabond Core Rulebook (Alpha 3), p. 104",
                        "description": "<p>Summoned by the Skull card of the Deck of Many Things to attack the Being that drew it. "
                                       "If any other Being attempts to help them, another grim reaper appears and attacks that Being.</p>"
                                       "<p>HP: half the summoner's. Set its HP when it appears.</p>"}
        },
        "items": [
            action(0, "Scythe", "melee", "icons/skills/melee/strike-slashes-red.webp", "<p>9 (2d8)</p>", 0,
                   tags="Melee Attack", damage="2d8", average=9, damageType="physical", save="reflex"),
            action(1, "Inevitable", "ability", "icons/svg/aura.svg", "<p>Its attacks always hit.</p>", 100),
        ],
        "effects": [], "folder": None, "sort": 0, "ownership": {"default": 0}, "flags": {},
        "prototypeToken": {"name": "Grim Reaper", "displayName": 20, "actorLink": False, "disposition": -1, "width": 1, "height": 1,
                           "texture": {"src": "icons/svg/mystery-man.svg"}, "bar1": {"attribute": "attributes.hp"},
                           "bar2": {"attribute": None}, "sight": {"enabled": False}}
    }


def fix_dir(folder):
    changed = 0
    if os.path.basename(os.path.normpath(folder)) == "bestiary":
        reaper = grim_reaper()
        path = os.path.join(folder, f"grim-reaper-{reaper['_id']}.json")
        if not os.path.exists(path):
            write(path, reaper, "\n")
            changed += 1
    for fn in sorted(os.listdir(folder)):
        if not fn.endswith(".json"): continue
        path = os.path.join(folder, fn)
        raw = open(path, encoding="utf-8").read()
        doc = json.loads(raw)
        if doc.get("type") != "npc": continue
        before, old_name = json.dumps(doc, sort_keys=True), doc["name"]
        fix_actor(doc)
        if doc["name"] == "Dog":
            small = split_dog(path, doc)
            fix_items(small)
            write(os.path.join(folder, f"dog-small-{small['_id']}.json"), small, raw)
            changed += 1
        fix_items(doc)
        if json.dumps(doc, sort_keys=True) != before:
            new_path = path
            if doc["name"] != old_name:
                slug = re.sub(r"[^a-z0-9]+", "-", doc["name"].lower()).strip("-")
                new_path = os.path.join(folder, f"{slug}-{doc['_id']}.json")
            write(new_path, doc, raw)
            if new_path != path: os.remove(path)
            changed += 1
    return changed


def write(path, doc, raw):
    text = json.dumps(doc, indent=2, ensure_ascii="\\u" in raw)
    open(path, "w", encoding="utf-8").write(text + ("\n" if raw.endswith("\n") else ""))


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dirs = sys.argv[1:] or [os.path.join(root, "src/packs/bestiary"), os.path.join(root, "src/packs/humanlike")]
    print("Statblocks corrected:", sum(fix_dir(d) for d in dirs))
