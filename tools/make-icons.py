#!/usr/bin/env python3
"""
Give every compendium entry its category's icon from game-icons.net (CC BY 3.0): one icon per kind of thing
(creatures, weapons, armor, gear, Relics, Spells, ...), not one per entry.

Icons come from the official Iconify package of the set:
    npm pack @iconify-json/game-icons --ignore-scripts && tar -xzf iconify-json-game-icons-*.tgz
    python3 tools/make-icons.py package/icons.json

tools/icon-map.json names the icon for each document type ("defaults"), plus "relic" for the Relics compendium and
"action" for NPC Action items. The script writes those icons to assets/icons/ and points each entry's img (and NPC
token art, Action items, and Active Effects) at them. Run it again after regenerating the bestiary.
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "icons")
PREFIX = "systems/vagabond-rpg/assets/icons/"
# Parchment glyph on a dark leather tile, matching the sheet header.
TILE, GLYPH = "#3a2a1e", "#f1e2c4"


def svg(body):
    body = body.replace('fill="currentColor"', f'fill="{GLYPH}"').replace('stroke="currentColor"', f'stroke="{GLYPH}"')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
            f'<rect width="512" height="512" rx="56" fill="{TILE}"/>'
            f'<g transform="translate(40 40) scale(0.84375)">{body}</g></svg>\n')


def is_placeholder(img):
    """Core Foundry art, or one of ours: anything we may replace."""
    return (not img) or img.startswith("icons/") or img.startswith(PREFIX)


def main(icons_path):
    icons = json.load(open(icons_path))["icons"]
    defaults = json.load(open(os.path.join(ROOT, "tools", "icon-map.json")))["defaults"]
    missing = sorted(n for n in defaults.values() if n not in icons)
    if missing:
        sys.exit(f"unknown icons: {missing}")
    path_of = lambda key: PREFIX + defaults[key] + ".svg"
    changed = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "src", "packs", "*", "*.json"))):
        pack = os.path.basename(os.path.dirname(path))
        data = json.load(open(path))
        key = "relic" if pack == "relics" else data.get("type")
        if key not in defaults:
            continue
        before = json.dumps(data, sort_keys=True)
        img = path_of(key)
        if is_placeholder(data.get("img")):
            data["img"] = img
        token = data.get("prototypeToken")
        if token is not None and is_placeholder(token.get("texture", {}).get("src")):
            token.setdefault("texture", {})["src"] = img
        # Active Effects show their Item's icon.
        for effect in data.get("effects", []):
            if is_placeholder(effect.get("img")):
                effect["img"] = img
        for item in data.get("items", []):
            if is_placeholder(item.get("img")) and item.get("type") in defaults:
                item["img"] = path_of(item["type"])
        if json.dumps(data, sort_keys=True) != before:
            with open(path, "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")
            changed += 1
    os.makedirs(OUT, exist_ok=True)
    used = set(defaults.values())
    for old in glob.glob(os.path.join(OUT, "*.svg")):
        if os.path.basename(old)[:-4] not in used:
            os.remove(old)
    for name in sorted(used):
        with open(os.path.join(OUT, name + ".svg"), "w") as f:
            f.write(svg(icons[name]["body"]))
    print(f"{changed} entries updated, {len(used)} icons written")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "package/icons.json")
