"""Correct PDF-extraction mistakes in the bestiary text (rules/bestiary_raw.json) and rebuild src/packs/bestiary.

Fixes merged Actions, broken lines, rolled tables (Dominator, Eyebeam, Reality Warp), Type tables (Dragons, Goblin,
Kobold, Giant), section-intro text that leaked into Abilities, glued words, and the Giant Poisonous Snake that was
swallowed by the Pit Viper. Checked against the Alpha 3 PDF, pp. 118-180.

Usage: python3 fix-bestiary.py <scratch dir holding tools/prep_content.py, icon_map.json, rules/bestiary_raw.json>
"""
import copy, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = sys.argv[1]
sys.path.insert(0, os.path.join(SCRATCH, "tools"))
os.chdir(SCRATCH)
import prep_content as pc  # noqa: E402

raw = json.load(open("rules/bestiary_raw.json"))
by = {b["name"]: b for b in raw}

# ---- Text fixes applied to every string -------------------------------------------------
GLUE = [
    (r"MagicWardII:\s*It", "Magic Ward II: It"),
    ("theirMaxHPlastswhiletheyareSickenedbythisdisease.", "their Max HP lasts while they are Sickened by this disease."),
]
# Section intros that leaked into the last Ability before them.
CUT = [" Odd, often magical creatures", " FAE Fae embody", " Beings who are truly alien", " When a being dies and its soul",
       " AftertheSparkofCreation", " The creatures one would normally see in our mortal realm"]
# Credits that belong in the description.
CREDITS = [" The Agnar was originally created by", " This version of the Dragon is inspired by", " The Vigzud was originally created by"]

ENTRY = re.compile(r"(?<!\(\+\d\)\s)(?:(?<=[.)]\s)|(?<=[A-Za-z]\s)(?=\(\+\d\)))(?=(?:\d\s+)?(?:\(\+\d\)\s+)?[A-Z][A-Za-z'\-]*(?:\s+(?:of|the|[A-Z][A-Za-z'\-]*))*\s*"
                   r"\[[^\]]+\](?:\s*\([^)]*\))?\s*:)")

def fix_list(lines, credits):
    out = []
    for s in lines:
        s = pc.clean(s)
        for a, b in GLUE: s = re.sub(a, b, s)
        for c in CUT:
            if c in s: s = s[:s.index(c)]
        for c in CREDITS:
            if c in s: credits.append(s[s.index(c):].strip()); s = s[:s.index(c)]
        s = re.sub(r"\s+", " ", s).strip()
        s = re.sub(r"(?<=\.) (?=Magic Ward [IVX]+:)", "¶", s)
        if out and out[-1].count("[") > out[-1].count("]"): out[-1] += " " + s  # entry broken over two lines
        else: out.append(s)
    split = []
    for s in out:
        parts = [p.strip() for p in s.split("¶")]
        for p in parts: split.extend(x.strip() for x in ENTRY.split(p) if x.strip())
    return split

def number(lines, prefix):
    out = [re.sub(r"^(\d)\s+", lambda m: f"{prefix} {m.group(1)}: ", s) for s in lines]
    # Table rows of a Cast list only their Save ("1 Charm [Will]"): they are Casts with that Save.
    out = [re.sub(r"^(%s \d: [^\[]+)\[(Will|Endure|Reflex)\]" % prefix, r"\1[Cast | \2]", s) for s in out]
    return [re.sub(r"^(%s \d: [^\[]+)\[(?!Cast|Melee|Ranged|Remote)" % prefix, r"\1[Cast, ", s) if prefix != "Dominator" else s for s in out]

def breath_rows(rows):
    """'Red [Far Cone]: 28 (8d6), and Burning (Cd6) if failed Fire' -> a Breath Attack Action with its Immunity."""
    out = []
    for r in rows:
        m = re.match(r"^(Red|Blue|Green|White|Black) \[(.+?)\]: (.*?)\s*(?:if failed\s+)?(Fire|Shock|Poison|Cold|Acid)$", r)
        assert m, r
        color, area, effect, immune = m.groups()
        tags = f"Attack, {area}" if "|" in area else f"Attack, {area} | 1/2 dmg on pass"
        out.append(f"{color} Breath [{tags}]: {effect} if failed. {color} dragons are Immune to {immune}.")
    return out

# ---- Per-creature corrections (done before the generic pass) ----------------------------
def pre(b):
    n = b["name"]
    A, B = b["actions"], b["abilities"]
    if n in ("Angel", "Lich"):
        A[0] = "Dominator: 2 Actions as below (d6 to determine)."
    if n == "Ghost": A[0] = A[0].replace("+1 Fatigue Posession [", "+1 Fatigue¶Posession [")
    if n == "Kelpie": A[0] = A[0].replace("Restrained Enlure [", "Restrained¶Enlure [")
    if n == "Catoblepas": A[0] = A[0].replace("1×Death Ray Death Ray [", "1×Death Ray¶Death Ray [")
    if n == "Dragon Turtle": A[:] = [a.replace("1×Bite Steam Breath [", "1×Bite¶Steam Breath [") for a in A]
    if n == "Golem, Iron": A[0] = A[0].replace("2×Greatsword Poison Breath [", "2×Greatsword¶Poison Breath [")
    if n == "Sphinx": A[:] = [a.replace("of its choice Roar [", "of its choice¶Roar [") for a in A]
    if n == "Lich": A[1] = A[1].replace("equal to the damage 2 Disintegrate", "equal to the damage¶2 Disintegrate")
    if n == "Agnar":
        A[0] = ("Spin-Thrash [Cast, Aura Near | Endure] (3/Day): 9 (2d8), deals half on a pass and heals this Being for the "
                "damage roll. It can only use this Action while at or below half HP.")
    if n == "Golem, Flesh": A[1] = "Slam [Melee Attack]: 9 (2d8) (+2 if this Being is Berserk)"
    if n == "Dungeonheart":
        s = re.sub(r"\s+", " ", pc.clean(A[0]))
        A[0] = re.sub(r" (\d) (?=[A-Z])", lambda m: ("; " if m.group(1) != "1" else " ") + m.group(1) + " ", s)
    if n == "False Hydra":
        B[1] = ("Multiple Heads: It starts with one head, but grows another as it consumes humanoid Beings. Each time it grows a "
                "new head, it gains 3 HD (13 HP), and its stats change as shown below (Beings consumed: heads, Size, TL): "
                "3: 2 heads, Medium, TL 4.1; 6: 3 heads, Large, TL 5.6; 9: 4 heads, Large, TL 6.9; 15: 5 heads, Huge, TL 8.2; "
                "24: 6 heads, Huge, TL 9.4.")
    if n.startswith("Dragon, "):
        everything = [pc.clean(s) for s in A + B]
        joined = " ¦ ".join(everything)
        joined = joined.replace("Type Breath Attack Immune Black", "¦ Black").replace(" Type Breath Attack Immune", "")
        joined = joined.replace("Endure or ¦ Reflex]", "Endure or Reflex]")
        joined = joined.replace("and Sickened (Cd4 dmg) Poison", "and Sickened (Cd4 dmg) if failed Poison")
        joined = re.sub(r" This version of the Dragon is inspired by.*$", "", joined)
        parts = [p.strip() for p in joined.split(" ¦ ") if p.strip()]
        rows = [p for p in parts if re.match(r"^(Red|Blue|Green|White|Black) \[", p)]
        rest = [p for p in parts if p not in rows]
        b["actions"] = [p for p in rest if p in [pc.clean(x) for x in A] or "Attack]" in p or p.startswith("Combo")] + breath_rows(rows)
        b["abilities"] = [p for p in rest if p not in b["actions"]]
        b["actions"] = [p.replace("See [Breath Attack] column below.", "Pick the breath for its color from the Breath Actions below.")
                        if p.startswith("Breath Attack") else p for p in b["actions"]]
    if n == "Goblin":
        b["actions"] = [
            "Shortbow (Archer) [Ranged Attack]: 3 (d6)",
            "Apoplex (Mage) [Cast, Remote | Will] (3/Day): Berserk (Cd4)",
            "Flare (Mage) [Cast, 10' Sphere | Reflex] (3/Day): 7 (2d6)",
            "Staff (Mage) [Melee Attack]: 2 (d4)",
            "Dagger (Warrior) [Melee Attack, Thrown]: 2 (d4)"]
        b["abilities"] = ["Sun-Averse: Is Vulnerable while in Sunlight",
                          "Types: Its Actions are determined by its type: Archer, Mage, or Warrior (named in brackets)."]
    if n == "Kobold":
        b["actions"] = [
            "Weapon [Attack]: 3 (d6) or (by Weapon)",
            "Sling (Normal) [Ranged Attack]: 2 (d4)",
            "Dagger (Normal) [Melee Attack, Thrown]: 2 (d4)",
            "Alchemist's Fire (Alchemist) [Melee Attack, Thrown] (5/Day): 3 (d6) and Burning (Cd6)",
            "Dagger (Alchemist) [Melee Attack, Thrown]: 2 (d4)",
            "Spear (Warrior) [Melee Attack, Thrown]: 3 (d6)"]
        b["abilities"] = [
            "Pack Instincts: If one of its Allies is within 5' of a Target of this Being's Attack, that Target is Vulnerable against the Attack.",
            "Types: Normal, Alchemist, or Warrior; each type's Actions are named in brackets. Warrior: Armor 2 [as Leather plus Shield]."]
    if n == "Giant":
        b["actions"] = ["Greatclub [Melee Attack, 10']: 9 (2d8)", "Rock [Ranged Attack]: 9 (2d6)"]
        b["abilities"] = [
            "Types: Cyclops, Hill, or Stone.",
            "One-Eyed (Cyclops): Attacks as if Vulnerable against Targets further than Near.",
            "Armor (Stone): Armor 3 [as (+1) Chain]."]
    return b

NUMBERED = {"Angel": "Dominator", "Lich": "Dominator", "Ogler": "Eyebeam", "Sphinx, Archon": "Reality Warp"}

fixed = []
changed = set()
for b0 in raw:
    b = pre(copy.deepcopy(b0))
    credits = []
    b["actions"] = fix_list(b["actions"], credits)
    b["abilities"] = fix_list(b["abilities"], credits)
    if b["name"] in NUMBERED:
        b["actions"] = number(b["actions"], NUMBERED[b["name"]])
    if credits: b["extra"] = list(b.get("extra", [])) + credits
    if (b["actions"], b["abilities"], b.get("extra")) != (b0["actions"], b0["abilities"], b0.get("extra")): changed.add(b["name"])
    # The Giant Poisonous Snake (p. 131) was read as part of the Pit Viper.
    if b["name"] == "Snake, Pit Viper":
        b["actions"] = ["Bite [Melee Attack]: 2 (d4) and pass [Endure] or become Sickened (Cd6 damage each minute)"]
        fixed.append(b)
        fixed.append({"name": "Snake, Giant Poisonous", "tl": "2.7", "page": 131, "sizeType": "Large Beast",
                      "fields": {"HD": "6 (27 HP)", "Speed": "40'", "Zone": "Midline", "Morale": "9", "# Appearing": "1",
                                 "Armor": "1 [as Leather]"},
                      "desc": ["Over-sized versions of the deadly cobra and viper."],
                      "actions": ["Bite [Melee Attack]: 9 (2d8) and pass [Endure] or become Sickened (Cd6 damage each Minute)."],
                      "abilities": [], "extra": []})
        changed.update({"Snake, Pit Viper", "Snake, Giant Poisonous"})
        continue
    fixed.append(b)

os.makedirs("rules-fixed/rules", exist_ok=True)
json.dump(fixed, open("rules-fixed/rules/bestiary_raw.json", "w"), indent=1, ensure_ascii=False)
pc.OUT = os.path.join(SCRATCH, "bfix", "fixed")
os.chdir("rules-fixed")
pc.build_bestiary()
print(len(changed), "statblocks changed:", sorted(changed))

# ---- Riding Animals (p. 13): Travel miles per Shift and Cargo Slots for those with statblocks -----------------
MOUNTS = {"Elephant": (8, 96), "Horse, Draft": (6, 14), "Horse, Riding": (16, 12), "Horse, War": (8, 16)}
out = os.path.join(pc.OUT, "bestiary")
for fn in os.listdir(out):
    path = os.path.join(out, fn)
    doc = json.load(open(path))
    if doc["name"] not in MOUNTS: continue
    travel, cargo = MOUNTS[doc["name"]]
    doc["system"]["attributes"]["travel"] = travel
    doc["system"]["cargo"] = {"max": cargo}
    if doc["name"].startswith("Horse"):
        doc["img"] = doc["prototypeToken"]["texture"]["src"] = "icons/environment/creatures/horse-brown.webp"
    json.dump(doc, open(path, "w"), indent=2, ensure_ascii=False)
print("Mount data added:", sorted(MOUNTS))

# ---- Audit fixes, Saves read from Action text, and damage printed only in text (see tools/bestiary-corrections.py)
import importlib.util
_spec = importlib.util.spec_from_file_location("bestiary_corrections", os.path.join(HERE, "bestiary-corrections.py"))
_bc = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_bc)
print("Statblocks corrected:", _bc.fix_dir(out))

# ---- Damage types for Actions (see tools/damage-types.py) -----------------------------------------------------
import importlib.util
_spec = importlib.util.spec_from_file_location("damage_types", os.path.join(HERE, "damage-types.py"))
_dt = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_dt)
print("Damage types set on", sum(_dt.tag_file(os.path.join(out, fn)) for fn in os.listdir(out) if fn.endswith(".json")), "Actions")
