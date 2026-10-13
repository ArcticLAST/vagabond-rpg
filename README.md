# Vagabond (Alpha 3) for Foundry VTT

An unofficial Foundry Virtual Tabletop game system for **Vagabond: Pulp Fantasy RPG**. It is built from scratch against the *Core Rulebook v3 Alpha 3* playtest PDF, and its structure follows the dnd5e system: DataModels, ApplicationV2 sheets, and compendium packs built from JSON sources.

- **System id:** `vagabond-rpg`. This id is chosen so it does not collide with the existing community system.
- **Foundry:** v13 minimum, verified for v14.

## Install

1. Copy this folder to `{userData}/Data/systems/vagabond-rpg/`. You can also unzip `vagabond-rpg.zip` there. The folder name must match the id.
2. Restart Foundry and create a world using **Vagabond (Alpha 3)**.
3. The compendiums appear under the **Vagabond** folder in the Compendium tab.

## What's in it

### Hero sheet

The header shows:
- HP and Mana bars. You can type `+5` or `-3` into them.
- Luck, Armor, Speed, and Fatigue pips. Spend or gain Luck right on the sheet.
- Sheet change notes: when a Hero's Mana, Luck, Studied dice, Stats, Skill Training, Coins, Level, or XP change, or Items are added, removed, or change quantity, a chat note lists each change as before → after and names the user who made it (a light guard against unfair edits). The Hero Builder and Casting don't post them (Spell cards show Mana before and after instead); moves between Heroes and storage say where things went. A world setting shows them to everyone, whispers them to the GM, or turns them off.
- Readied Spells: the bookmark on a Spell (Magic tab) readies it, and readied Spells show under Attacks on the Skills tab with Cast and Post buttons.
- Rest and Breather buttons.

The sidebar holds the six Stats and the three Saves. Saves show their Difficulty, and you can click a Save to roll it.

The sheet has these tabs:

| Tab | Contents |
|---|---|
| Skills | All 14 Skills with a Trained toggle and live Difficulty, plus your equipped weapons as attacks. |
| Inventory | Slots meter, coins, weapons, armor, and gear by category. Has equip toggles and quantity and uses steppers. |
| Magic | Casting Skill, Difficulty, Mana, Cast Max, and Spells Known against the class limit. |
| Features | Class features up to your Level (later ones shown locked), Ancestry traits, Perks, and other features. |
| Effects | Active Effects, grouped as temporary, passive, and inactive. |
| Biography | Biography and notes. |

The padlock in the title bar switches between play mode and edit mode.

Dropping a **Class** or **Ancestry** replaces the old one and applies its Trainings. An Ancestry also sets Size and Being Type, and a Class also sets the casting Skill.

### Derived numbers

| Value | Rule |
|---|---|
| Difficulty | 20 − Stat, with the Stat doubled if Trained. |
| Endure | 20 − 2×MIT |
| Reflex | 20 − (DEX+AWR), plus worn Armor's Slots |
| Will | 20 − (RSN+PRS) |
| Max HP | MIT × Level. It is 0 at 5 Fatigue. |
| Slots | 8 + MIT, plus equipped containers. Each Fatigue fills a Slot, and 0-Slot items count as 1 Slot per 10. |
| Speed | 25/30/35 by DEX. Crawl and Travel are derived from it. |
| Max Mana, Cast Max, Spells Known | Taken from the Class. |

The sheet warns you about:
- Armor that is too heavy for your Might (you are Restrained).
- More than 3 Slots of equipped weapons.
- Going over your Slots.
- Fatigue limits.

### Hero builder and leveling

A Hero with no Class shows a **Build Hero** button in the header. It walks through:
1. **Ancestry** and **Class**, with their Traits, Key Stats, Trainings, and 1st-Level Features.
2. **Stats**: pick one of the 8 Stat Arrays. The highest values go to your Class's Key Stats, and you can reassign them freely. Human Strong Potential adds +1 here.
3. **Trainings**: Class and Ancestry Trainings are locked in, and you pick half your Reason (rounded up), plus any Traits grant.
4. **Spells** for casters, including required ones such as the Druid's Polymorph. An Elf's Naturally Attuned Spell is picked here too, along with which of the chosen Spells it is and the Skill (any Skill) to Cast it with.
5. **Perk**: your creation Perk, plus any granted picks. Perks your Class grants (for example Bookworm for Wizards) are added for you.
   - Perks whose prerequisites you don't meet are locked.
   - Class Features that bend the rules are followed: Well-Versed (Bard) ignores Stat minimums. Fighting Style and Survivalist each grant a Perk with a combat or Survival Training prerequisite, ignoring the rest, and the builder marks those Perks "Allowed by …". Occultist's Perk needs the Mysticism prerequisite.
   - Perks you can take again (Magical Secret, Tough, Advancement, Silver Tongued up to 4 times, and so on) stay available until their limit.
   - Some Perks ask for a choice:
     - Magical Secret: a Spell, and the Skill to Cast it with (Arcana, Influence, or Mysticism).
     - Advancement: a Stat below 7, which goes up by 1.
     - New Training: a Skill to become Trained in.
     - Cryptozoologist: a Being Type.
   - The choice is applied and added to the Perk's name, for example "Magical Secret (Fireball)". A Magical Secret Spell remembers its Skill (**Cast With** on the Spell sheet, which offers every Skill) and raises Spells Known by one, as does Naturally Attuned.
6. **Review**: name the Hero and pick a **Starting Pack** (your Class's recommended packs are listed first), or take 3g to spend instead. The pack's Weapons, Armor, and Gear are listed with quantities and the Wealth left over.

Once a Hero has a Class, the button becomes **Level Up**. It shows the new Features, HP, Mana, and Cast Max, then asks only for what that Level needs:
- a Stat +1 (max 7) on even Levels;
- a Perk on odd Levels after 1st, plus repeat grants such as the Fighter's Fighting Style at 4th and 8th;
- a new Training if Reason went up enough;
- new Spells when Spells Known grows.

What each Class Feature or Ancestry Trait grants lives on that row's **Hero builder grants** in the item sheet, so homebrew Classes and Ancestries work too.

### Rolls

There is no roll prompt. The header has a standing **Hinder / Normal / Favor** setting that every Check uses until you change it. There are no situational bonuses. Luck is spent and gained from the sheet, not by rolls. Click a card's result to show or hide the individual dice; cards don't change size on hover.

Statuses add Favor and Hinder automatically, and they cancel against the sheet setting. The card names the status behind each change, such as "Prone: Hinder" or "Target: Blinded (Vulnerable)":
- **Confused**: Hinders the Being's own Checks and Saves.
- **Vulnerable** (also implied by Blinded, Restrained, Incapacitated, Paralyzed, and Unconscious): Hinders the Being's attacks and its Saves against attacks.
- **Prone**: Hinders Reflex Saves.
- **Target is Vulnerable**: attacks against it are Favored. If the target is Prone, melee attacks are Favored.
- **Target is Invisible**: attacks against it are Hindered.
- **Incapacitated**: auto-fails MIT and DEX Checks and Reflex Saves.
- **Unconscious target**: Close attacks against it always Crit.

Chat cards show the total against the Difficulty with a Crit, Pass, or Fail badge.
- On a Crit, the card offers a choice: **Gain 1 Luck**, or for attacks and damaging Casts, **Crit damage**. The normal **Damage** button is still there. The choice can be used once; the card then says which was taken.
- **Fluke** spends 1 Luck to reroll the d20.

**Weapons:**
- The attack uses your best Skill among the weapon's types.
- Keen lowers the crit range, and Vicious adds a die on a Crit. Both apply only if you're Trained.
- A Versatile weapon wielded two-handed steps its die up one size. Metals also change the die.
- A Crit adds the attack Stat to damage.
- Frightened applies −2 per damage die, and the damage card says so.

**Casting** (p. 91): clicking a Spell opens the casting window.
- The top of the window always shows the **Spell Cost**, your **Cast Max**, and your Mana. It turns red when the cost goes over either.
- Step 1 is the **Delivery**: pick one of its buttons (each shows its base cost), then **Upcast Delivery** to grow it. Nothing else shows until a Delivery is picked.
- Step 2: tick **Damage**, **Effect**, or both (both costs 1 Mana). Damage adds **extra damage dice** at 1 Mana per d6. Effect adds **Upcast Effect** for the Spell's own Upcast options, with the Spell's upcast text shown under it.
- Tick **Focus** to keep it active.
- Finish with **Roll Cast Check** (unwilling Beings or complex Objects) or **Post Spell**. Neither works while the cost is over your Mana or Cast Max. Spending even 1 Mana makes the Casting **upcast**.
- Casting spends the Mana, rolls the Cast Check if chosen, and posts the Spell. The card shows the Delivery, Mana, and Upcast tags, a damage dice count already set, and a **Keep Focus (1 Mana)** button for the rounds when Focus costs Mana.
- The chat icon on a Spell row just shows the Spell in chat, without spending Mana.

**Damage types.** The rulebook has no formal damage types, but Immune and Weak entries name them, so the system uses: Physical (with Blunt, Pierce, and Slash as kinds of Physical), Acid, Cold, Fire, Poison, Shock, and Magic.
- Weapons deal Physical damage unless their sheet sets another type.
- A Weapon is a **Relic** when its Relic box is ticked or it has a Magic Bonus. Relic damage shows as "Relic (+N)". Relics from the compendium and the Relic Builder are ticked.
- Spells deal their Damage Base.
- NPC Actions have a Damage Type and a Relic (+N) field. The Bestiary and Humanlike NPCs were tagged from their names: "(+2) Longsword" is Physical Relic +2, dragon breaths go by colour (Red Fire, Blue Shock, Green Poison, White Cold, Black Acid), elemental words such as Fire, Frost, Lightning, Acid, and Venom set the type, other attacks are Physical, and other Casts are Magic. The type shows next to the Action on the statblock.
- The damage card reads "7 Fire damage", with tags for Relic (+N), silver, adamant or cold-iron metal, and any status that changed the roll.

**Damage cards** have four apply buttons. They apply to selected tokens, or to targeted tokens if none are selected. **Apply**, **Ignore Armor**, and **Half** check the target's Immune and Weak entries first:
- **Immune** (for example an Angel against a Weapon that isn't at least a +2 Relic) takes no damage.
- **Weak** ignores Armor.
- A note says which happened. Entries the system can't read, such as "damage from axes", are left to the GM.
- **Apply**: reduced by Armor.
- **Ignore Armor**: for Weak, or for damage from a Status.
- **Half**
- **Heal**

### NPCs

NPCs use a statblock sheet with:
- HD, HP, Armor and armor tag, Morale (roll 2d6 against it), Speed and speed types, Zone, # Appearing, Senses, Immune, Weak, and Status Immunities.
- Actions and Abilities. Clicking one posts its card:
  - A **Save** button for the Heroes. Attacks are avoided with Reflex unless the statblock says otherwise (p. 14), so "Endure or Reflex" shows both. Casts, Actions, and Abilities that print no Save have none: the Angel's Command is a choice to take the damage or obey.
  - A second Save button, such as **Endure if Hit**, for attacks that force another Save on a Being they hit ("5 (d10) and pass an [Endure] Save or be Cursed"). The damage card repeats every Save button. The Action sheet's "Saves After a Hit" boxes set these.
  - A **Damage** button, on Abilities too when they deal damage (Smoky Escape, Leap, Fiery Revival). Actions marked **Heals** (Cure Wounds, Regenerate) roll healing instead.
  - A **Combo** is not an attack. It says which attacks the Being makes with one Action, so "8×Claw" means eight Claw attacks. Its card has a button for each attack it names, which posts that attack's card.
- Dice printed in statblock text, such as "takes 18 (4d8) damage" or "aged 10 (d20) years", can be clicked to roll.
- A world setting that chooses between rolling NPC damage and using the printed average.

### Relic and Creature builders

GMs get a **Relic Builder** button at the top of the Items sidebar and a **Creature Builder** button at the top of the Actors sidebar.

The Relic Builder follows the Relic Powers table (p. 100–102):
- Pick a base Weapon, Armor, or Gear item (or none), set the Lore item, and mark it Bound, Consumable, Fabled, or Cursed.
- Pick powers group by group. Tiered powers use a dropdown; Bane, Protection, and similar powers ask for their target; Holding asks for a number of Slots. Custom powers cover anything the table doesn't.
- The Value adds up from the powers (a tenth for Consumables) and can be overridden.
- Weapon and Armor bonuses are written onto the item, Holding adds Item Slots, and Swiftness adds Speed through an Active Effect. Everything else goes into the description.
- Active Effects on Weapons, Armor, and Gear now only apply while the item is equipped.

The Creature Builder follows the statblock rules (p. 109–111):
- Start from scratch or from any Bestiary, Humanlike, or world NPC.
- HP defaults to HD × 4.5 (1 per HD for Small Beings), with a Tougher option for Bosses. Picking an armor tag sets Armor.
- Add, reorder, and remove Actions and Abilities. Each damaging Action shows its average, and the saved text starts with it, as in "7 (2d6)".
- Threat Level is worked out live with the book's formula. DPR is suggested from the best Action or a Combo ("2×Claw and 1×Bite") and can be overridden.
- A side table compares HD, HP, Armor, and DPR with the typical ranges for any Threat Level.
- The NPC sheet has a dragon button in its header that opens the builder on that NPC. Saving updates it in place.

### Class Features

Class Features that scale with Level apply themselves, and the Features tab shows a green tag with each one's current numbers (for example "Applied: Crit on 18+").
- **Applied to the sheet:** Valor, Aggressor, Rover, Deep Pockets, Line Goes Up, Knack, Spell-Slinger.
- **Applied to rolls:**
  - Footloose: Reflex Saves roll two d20s and keep the higher.
  - Rage and Murder Mode: bigger, exploding, bonus damage dice while Berserk.
  - Fisticuffs and Title Holder: Brawl Weapons are Vicious and use d6 (d8 at 10th) that Explode on their two highest values.
  - Wall and Indestructible: Defense Weapon damage.
  - Bad Medicine and Devastator: extra, exploding dice on Ranged Crits.
  - Potency: Alchemical Item damage and healing.
  - Sneak Attack: a button on Favored hits with Finesse, Keen, or Ranged Weapons. Lethal Weapon makes the dice Explode.
  - Vehement Magic (the Perk, or a Sorcerer's Tap): Spell damage dice Explode on a 1, noted on the damage card.
- **Applied when casting:** Sculpt Spell and Paragon's Aura lower the Mana cost in the cast dialog.
- **Shown as numbers only:** thresholds, countdown dice, free Move, Lay on Hands healing, Alchemy formulas, and the other scaling values.

### Studied dice

The **Studied** box in the Hero header holds Studied dice (p. 19).
- **+** Studies: gain a Studied die, plus one for each Bookworm Perk (Wizards get one at 1st Level).
- **Use Studied die** arms one for Favor on your next Check.
- The hand button gives one of your Studied dice to another Hero, as the Leadership Perk allows. It goes through the GM when you don't own that Hero.
- With Heightened Intellect or Heightened Cognition, a failed Check with one of their Skills gets a **Pass with Studied die** button.
- Type in the box to spend dice on anything else (Mix, Prima Materia, Extracurricular, and so on).

### Containers, Mounts, and Vehicles

**Containers** are a new Actor type for chests, stashes, and loot piles.
- Every player can see a new Container. Anyone who can see it can drag Weapons, Armor, and Gear from their sheet onto it, and drag them from it back onto their sheet. One player can store something and another can take it out.
- Hold Shift while dropping to move part of a stack. Matching items stack.
- The hand button on each row takes the item to your Hero, and Deposit and Withdraw move coins.
- When a player doesn't own both ends of a move, the GM's client carries it out after checking that player's permissions. A GM has to be logged in for that.
- The owner or GM can lock a Container so players can only look. A Capacity of 0 means no limit.
- Drop a Container on the scene to get a token players can double-click to open.

**Mounts** (p. 13): drop a Being on a Hero's sheet to ride it. The Hero then uses its Speed and Travel miles, as the rules say. The sidebar shows the Mount, and the button there dismounts.
- The sheet warns if the rider isn't at least one Size smaller than the Mount.
- Beings have a **Cargo** capacity and a **Travel** speed. The Elephant and the Draft, Riding, and War Horses in the Bestiary come with the numbers from the Riding Animals table. A Being with Cargo works like a Container.

**Vehicles** are a new Actor type with HP, Armor, Speed, Travel miles per Shift, Cost, and a Cargo hold that works like a Container. Heroes board one by dropping it on their sheet or with the button on the Vehicle. The Vehicle lists who is aboard, and they use its Speed. The **Vehicles** compendium has the eight vessels from the Water Travel table (p. 17).

### Other systems

- **Initiative:** Heroes act before Enemies.
- **Statuses:** all 18 statuses from the book are on the token HUD, plus Focusing.
- **Burning:** a reminder is whispered to the GM at the start of a Burning combatant's turn.
- **Vision:** every Token sees lit areas. Darksight sees in the dark. Allsight sees Invisible Beings, Blindsight and Echolocation see while Blinded or in Darkness (walls still block them), Seismicsense feels Beings on the ground, and Telepathy senses other Beings through walls. Ranges come from the Senses line ("Seismicsense 60'", "Telepathy (Near)"); with none given, the Sense covers the whole Scene. Heroes get Senses from Ancestry traits, the Infravision Perk, and Equipped Relics (Nightvision, Echolocation, Tremors, Telepathy, True-Seeing). Tokens update when the Senses change; turn this off with the **Token Vision from Senses** setting.

### Compendiums

| Pack | Count | Notes |
|---|---|---|
| Classes | 18 | All Features by Level, Trainings, Key Stats, and casting progression. |
| Ancestries | 7 | Traits, plus Active Effects for Nimble, Scale, Hulking, Tough, and Tricksy. |
| Perks | 109 | Active Effects on Tough, Pack Mule, Secret of Mana, Skirmisher, Treads Lightly, and Marksmanship. Silver Tongued lowers the Crit on Influence Checks by 1 per copy. |
| Spells | 59 | Damage Base and Crit text. |
| Weapons & Armor | 43 weapons, 3 armors | |
| Gear | about 250 | From the price lists. |
| Alchemical Items | 84 | Ranked potions are split into I, II, and III. Healing and Mana potions roll and apply. |
| Starting Packs | 36 | The d66 table (p. 75). Each lists its Items and leftover Wealth, plus the backpack, bedroll, rations, torches, and waterskin every pack includes. Drop one on a Hero to unpack it. |
| Relics | 41 | The Relic List (p. 102–108). Weapons and armor carry their magic bonus; the rest are Gear in the Relics category. Silvering (Dyrnwyn, Peacemaker), Shocktongue (Skyhowel), Loyalty (thrown), the Loyalty Shield's +1 Armor, Lesser Speed, Holding, and the Vulnerability curse work on the sheet; other powers are text. |
| Bestiary | 274 | Statblocks with parsed actions: damage, average, saves, and recharge. The Small and Medium Dog are separate statblocks, and the Grim Reaper from the Deck of Many Things (p. 104) is included. Rolled tables (Dominator, Eyebeam, Reality Warp) are numbered Actions; creature types (Goblin, Kobold, Giant) and dragon breaths are separate Actions named for their type. |
| Humanlike NPCs | 33 | The Humanlike table (p. 112–114). |
| Vehicles | 8 | The Water Travel table (p. 17): Travel miles, Capacity, and Cost. |

## Rules interpretations and gaps

The alpha text leaves some points open. These are the choices made here:

- **Cast Max** is treated as the most Mana you can spend on one casting. The book uses the term but never defines it.
- **Fluke** rerolls the d20 of a Check. The book allows rerolling any unresolved die.
- **Class Features** that are situational (Momentum, Hunter's Mark, Deadeye stacks, Hex, damage reduction, and so on) stay as text. The Features tab shows their current numbers. Add an Active Effect when one matters, for example on `system.bonuses.critAttack`, `system.bonuses.speed`, or `system.bonuses.slots`.
- **Valor and Spell-Slinger** lower the Crit on Saves only when the Save comes from an NPC Action's Save button, which is how the system knows the Save is against an attack or a Cast.
- **Senses that need Focus or only work sometimes** (Telepath, Witchsight, the Helm of Telepathy, Bloodthirsty, Killer Instinct, "Telepathy (fungus only)") aren't applied. Turn the detection mode on in the Token's settings while it applies.
- **Blindsight and Echolocation** don't reveal Invisible Beings; only Allsight does, as the book lists it as the Sense that isn't fooled by invisibility.
- **Sneak Attack** shows its button on any Favored hit with a qualifying Weapon. Keeping it to the first hit each Turn is up to the player.
- **Starting Packs:** Garrote and Ingredients aren't in the price lists, so they have no listed Slots; they are set to 1 Slot. The Fighter's recommended "Harrying" pack doesn't exist in the table and is left out.
- **Relics** without a printed Value (Bag of Devouring, Black Wing, Philosopher's Stone, Standard of the Herald, Undertow, Voidedge) are recorded as 0.
- **Relic powers** beyond Weapon and Armor bonuses, Silvering, damage type, Holding, Swiftness, and Lesser Speed are text. Apply them by hand or with an Active Effect. That includes extra damage dice against some Beings (Evil's Bane, Giants Bane), Burning from Smite, Darksight, Fire Resistance, charges with a Countdown die (Magistaff, Orb of Many Energies), and 1/Day powers.
- **Undertow** uses the Spear's stats, since the weapon table has no Trident. **Peacemaker** uses the Handgun's, for its Revolver.
- **Loyalty Shield:** its "(+1) Shield" adds 1 to Armor while equipped instead of to damage, so its damage card shows Relic (+0).
- **Armor of Vulnerability** is the (-1) version: it grants no Armor and adds 1 to Attack damage taken (set its bonus to -2 or -3 for the others). Damage applied with Ignore Armor skips it.
- **Grim Reaper:** its HP is half the summoner's, so set it when it appears.
- **Threat Level:** the builder uses the formula on p. 111. About 60% of the printed statblocks land within 0.3 of it; the rest differ more, so the builder shows the printed TL next to the formula's when you start from one.
- **NPC Saves:** the rules don't give NPCs Save Difficulties. The sheet uses 20 − TL as a stand-in.
- **Studied dice** don't expire on their own. The book says they last until the next Day, so remove unused ones then.
- **Mounts and Vehicles:** the rules give vessels no HP, Armor, or combat Speed, and list no land vehicles, so those are left for the GM to fill in. The Camel, Mule, and Pony from the Riding Animals table have no statblocks in the Bestiary.
- **Damage types** are this system's reading of Immune and Weak text, since the book defines none. A Weapon set to plain Physical doesn't trigger a Blunt-, Pierce-, or Slash-only entry, so set the type on Weapons where it matters (a Mace to Blunt against Skeletons, for example). The compendium Weapons are left as Physical.
- **Silver Tongued** applies its Crit bonus to every Influence Check; the book limits it to social ones.
- **Not included:** Progress clocks.
- **Bestiary saves** were read from each Action's text: "pass [Endure]" after a hit is a second Save, and an Ability's first "pass [Save]" is its Save. Abilities whose dice are counts rather than damage (Bone Golem limbs, Hydra heads, Ghost aging, Vortex height) have no Damage button; their dice can be clicked in the text. The Crawling Wall's Crush ("3 (d6) for every 5' of Speed remaining") is left to the GM.
- **Book errors kept as printed:** averages that don't match their dice (Elephant Tusk, Giant Rock, Hodag Bite, Giant Weasel Drain, Giant Rat Bite, Young Dragon Tail), HP that doesn't match HD (Aurumvorax, Catoblepas, Magmot), and Combos naming an attack the Being doesn't have (Wererat's Cutlass). The Pit Fiend's "Pit Mace" and Tarrasque's "Horn" Combo buttons find the (+2) Mace and Horns.
- **Compendium text** was extracted from the PDF, and a few two-column layout mix-ups were fixed by hand. If something reads oddly, check the page cited on the item.

Bonuses that Active Effects can target (all under `system.bonuses.`):
- `hp`, `hpPerLevel`, `mana`, `castMax`, `armor`, `speed`, `speedMin` (Speed is at least this), `slots`
- `reflexPenalty`, `luckOnRest`
- `critAttack`, `critCast`, `critSave`
- `damagePerDie`, `spellDamagePerDie`
- `dieStep.melee`, `dieStep.brawl`, `dieStep.finesse`, `dieStep.ranged`, `dieStep.spell`

## Development

```
npm install
npm test              # rules unit tests (module/rules.mjs)
npm run build:packs   # src/packs/*/ JSON -> packs/ LevelDB
npm run unpack -- spells   # pull edits made in Foundry back to JSON
```

Code layout:

| Path | Contents |
|---|---|
| `module/config.mjs` | All static rules data (CONFIG.VAGABOND). |
| `module/rules.mjs` | Pure rules math, unit tested. |
| `module/data/` | Actor and Item DataModels. |
| `module/documents/` | Actor and Item classes: rolls, rest, damage. |
| `module/dice/` | Check engine, dialogs, and status Favor/Hinder. |
| `module/applications/` | ApplicationV2 sheets. |
| `module/chat.mjs` | Chat card buttons. |
| `templates/`, `styles/`, `lang/` | Templates, styles, and localization. |

## License note

The code is yours to license as you like. The compendium text is reproduced from the Vagabond alpha playtest for personal use. Check with Land of the Blind before distributing it publicly.

Icons are from [game-icons.net](https://game-icons.net/) (Lorc, Delapouite, and contributors), used under CC BY 3.0. See `LICENSE-ICONS.md`.
