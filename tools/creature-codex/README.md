# Creature Codex (standalone)

A browser page for designing Vagabond creatures outside Foundry: live statblock, Threat Level math (p. 111),
quick build to a target TL, Bestiary templates, and a saved codex.

Build the page (inlines the Bestiary and Humanlike statblocks from `src/packs`):

    python3 tools/creature-codex/build-bestiary.py > /tmp/bestiary.json
    python3 -c "import sys;t=open('tools/creature-codex/template.html').read();b=open('/tmp/bestiary.json').read().replace('</','<\\\\/');open('creature-codex.html','w').write(t.replace('/*BESTIARY*/[]',b))"
