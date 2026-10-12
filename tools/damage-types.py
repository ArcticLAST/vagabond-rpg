"""Tag NPC Actions with a damage type (and a Relic (+N)) inferred from their names.

The rulebook gives statblock attacks no formal damage types, so this reads them from the Action's name:
  - a "(+N)" prefix, as in "(+2) Longsword", is a Relic weapon of that (+N) dealing Physical damage;
  - Dragon breaths by colour: Red Fire, Blue Shock, Green Poison, White Cold, Black Acid;
  - elemental words in the name (Fire, Flame, Frost, Ice, Lightning, Acid, Venom, ...);
  - anything else is Physical, except Casts, which are Magic.
Only Actions that roll damage (not healing) and have no type yet are changed.

Usage: python3 tools/damage-types.py [pack source dirs...]   (default: src/packs/bestiary src/packs/humanlike)
"""
import json, os, re, sys

BREATH = {"red": "fire", "blue": "shock", "green": "poison", "white": "cold", "black": "acid"}
KEYWORDS = [
    ("fire", r"fire|flame|hellfire|flare|magma|steam"),
    ("cold", r"frost|\bice\b|cold|blizzard|freez|chill"),
    ("shock", r"lightning|shock|\bzap\b|electric|levin"),
    ("acid", r"acid|caustic"),
    ("poison", r"poison|venom|noxious|toxic|\bgas\b|spore"),
]


def infer(name, action_type):
    """Return (damageType, relic) for an Action."""
    base = re.sub(r"^[A-Za-z ]+\d+:\s*", "", name).strip()   # "Dominator 1: (+3) Flaming Sword"
    relic = re.match(r"^\(\+(\d+)\)", base)
    if relic: return "physical", int(relic.group(1))
    breath = re.match(r"^(red|blue|green|white|black) breath", base, re.I)
    if breath: return BREATH[breath.group(1).lower()], 0
    for key, pattern in KEYWORDS:
        if re.search(pattern, base, re.I): return key, 0
    return ("magic" if action_type == "cast" else "physical"), 0


def tag_file(path):
    raw = open(path, encoding="utf-8").read()
    doc = json.loads(raw)
    changed = 0
    for item in doc.get("items", []):
        s = item.get("system", {})
        if item.get("type") != "action" or not s.get("damage") or s.get("damageType") or s.get("healing"): continue
        s["damageType"], relic = infer(item["name"], s.get("actionType", ""))
        if relic: s["relic"] = relic
        changed += 1
    if changed:
        text = json.dumps(doc, indent=2, ensure_ascii="\\u" in raw)
        open(path, "w", encoding="utf-8").write(text + ("\n" if raw.endswith("\n") else ""))
    return changed


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dirs = sys.argv[1:] or [os.path.join(root, "src/packs/bestiary"), os.path.join(root, "src/packs/humanlike")]
    total = 0
    for d in dirs:
        for fn in sorted(os.listdir(d)):
            if fn.endswith(".json"): total += tag_file(os.path.join(d, fn))
    print("Damage types set on", total, "Actions")
