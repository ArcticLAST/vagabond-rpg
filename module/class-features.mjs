import { formulasKnown, formulaMaxValue } from "./rules.mjs";

/**
 * Class Feature automation. Features live on the Class item as rows; a Hero has every row at or below their Level.
 * This module turns the scaling numbers in those Features into bonuses the system applies, and into short "now"
 * notes shown next to each Feature on the sheet. Anything situational stays as text.
 *
 * Most scaling Features improve "now and every 4 Levels hereafter": see {@link tier}.
 */

/**
 * How many times a Feature that starts at `start` and improves every `every` Levels has applied by `level`.
 * @param {number} level
 * @param {number} start
 * @param {number} [every=4]
 * @returns {number}  0 before the Feature is gained.
 */
export function tier(level, start, every = 4) {
  if ( level < start ) return 0;
  return Math.floor((level - start) / every) + 1;
}

/**
 * Names of the Class Features this Hero has at their Level.
 * @param {Actor} actor
 * @returns {Set<string>}
 */
export function unlockedFeatures(actor) {
  const cls = actor?.items?.find(i => i.type === "class");
  const level = actor?.system?.details?.level ?? 0;
  return new Set((cls?.system.features ?? []).filter(f => f.level <= level).map(f => f.name));
}

/**
 * A blank set of Feature modifiers.
 */
export function emptyMods() {
  return {
    bonuses: { speed: 0, slots: 0, luckOnRest: 0, critAttack: 0, critCast: 0, spellDieStep: 0 },
    critVsAttack: 0,          // Lower Crit on Saves against attacks (Valor).
    critVsCast: 0,            // Lower Crit on Saves against Casts (Spell-Slinger).
    reflexTwoDice: false,     // Roll two d20s on Reflex Saves and use the higher (Footloose).
    berserk: null,            // { steps, perDie, explode } while Berserk (Rage, Murder Mode).
    brawl: null,              // { vicious, faces, explodeOn } for Brawl Weapons (Fisticuffs, Title Holder).
    defense: null,            // { steps, perDie, armorOnly } for Defense Weapons (Wall, Indestructible).
    rangedCrit: null,         // { extraDice, explode } on Ranged Crits (Bad Medicine, Devastator).
    sneakAttack: null,        // { dice, explode } (Sneak Attack, Lethal Weapon).
    alchemy: null,            // { perDie, explode } for Alchemical Items (Potency).
    spellExplodeLow: 0,       // Spell damage dice also Explode on this roll or lower (Vehement Magic).
    cast: { upcastDiscount: 0, auraDiscount: 0 }, // Mana discounts (Sculpt Spell, Paragon's Aura).
    notes: {}                 // Feature name -> { key, data } for the sheet.
  };
}

/**
 * Work out every automated effect of the Hero's Class Features.
 * @param {Actor} actor
 * @returns {ReturnType<typeof emptyMods>}
 */
export function featureMods(actor) {
  const mods = emptyMods();
  if ( actor?.type !== "character" ) return mods;
  const has = unlockedFeatures(actor);
  // Vehement Magic: a Perk item, or granted by the Sorcerer's Tap Feature.
  if ( has.has("Tap") || actor.items?.some(i => (i.type === "perk") && (i.name === "Vehement Magic")) ) mods.spellExplodeLow = 1;
  if ( !has.size ) return mods;
  const L = actor.system.details.level;
  const berserk = !!actor.statuses?.has("berserk");
  const note = (name, key, data = {}) => { if ( has.has(name) ) mods.notes[name] = { key, data }; };
  const cd = start8 => (L >= 8 ? "Cd6" : "Cd4");
  const dieUp = (start, faces = 4) => ["d4", "d6", "d8", "d10", "d12"][Math.min(4, [4, 6, 8, 10, 12].indexOf(faces) + tier(L, start) - 1)];

  // ---- Applied automatically -------------------------------------------------------
  if ( has.has("Valor") ) {
    const t = tier(L, 2);
    mods.bonuses.critAttack += t;
    mods.critVsAttack += t;
    note("Valor", "Valor", { n: 20 - t });
  }
  if ( has.has("Aggressor") ) {
    const t = tier(L, 2);
    mods.bonuses.speed += 5 * t;
    note("Aggressor", "Aggressor", { n: 5 * t, first: 10 * t });
  }
  if ( has.has("Rover") ) {
    const t = tier(L, 2);
    mods.bonuses.speed += 5 * t;
    note("Rover", "Speed", { n: 5 * t });
  }
  if ( has.has("Deep Pockets") ) {
    const n = 2 * tier(L, 1, 3);
    mods.bonuses.slots += n;
    note("Deep Pockets", "Slots", { n });
  }
  if ( has.has("Line Goes Up") ) {
    const t = tier(L, 2);
    mods.bonuses.luckOnRest += t;
    note("Line Goes Up", "RestLuck", { n: t });
  }
  if ( has.has("Knack") ) {
    const t = tier(L, 4);
    mods.bonuses.luckOnRest += t;
    note("Knack", "RestLuck", { n: t });
  }
  if ( has.has("Spell-Slinger") ) {
    const t = tier(L, 4);
    mods.bonuses.critCast += t;
    mods.bonuses.spellDieStep += 1;
    mods.critVsCast += t;
    note("Spell-Slinger", "SpellSlinger", { n: 20 - t });
  }
  if ( has.has("Footloose") ) {
    mods.reflexTwoDice = true;
    note("Footloose", "Footloose");
  }
  if ( has.has("Rage") || has.has("Murder Mode") ) {
    const t = has.has("Murder Mode") ? tier(L, 4) : 0;
    if ( berserk ) mods.berserk = { steps: has.has("Rage") ? 1 : 0, perDie: t, explode: t > 0 };
    if ( has.has("Rage") ) note("Rage", berserk ? "RageOn" : "RageOff");
    if ( t ) note("Murder Mode", berserk ? "MurderOn" : "MurderOff", { n: t });
  }
  if ( has.has("Fisticuffs") || has.has("Title Holder") ) {
    const big = L >= 10 ? 8 : 6;
    mods.brawl = {
      vicious: has.has("Fisticuffs"),
      faces: has.has("Title Holder") ? big : 0,
      explodeOn: has.has("Title Holder") ? big - 1 : 0
    };
    note("Fisticuffs", "Fisticuffs");
    note("Title Holder", "TitleHolder", { die: `d${big}`, min: big - 1 });
  }
  if ( has.has("Wall") || has.has("Indestructible") ) {
    mods.defense = { steps: tier(L, 2) * (has.has("Wall") ? 1 : 0), perDie: has.has("Indestructible") ? tier(L, 4) : 0 };
    note("Wall", "Wall", { n: tier(L, 2) });
    note("Indestructible", "Indestructible", { n: tier(L, 4) });
  }
  if ( has.has("Bad Medicine") || has.has("Devastator") ) {
    mods.rangedCrit = { extraDice: has.has("Bad Medicine") ? tier(L, 2) : 0, explode: has.has("Devastator") };
    note("Bad Medicine", "BadMedicine", { n: tier(L, 2) });
  }
  if ( has.has("Sneak Attack") ) {
    const n = Math.ceil(L / 3);
    mods.sneakAttack = { dice: n, explode: has.has("Lethal Weapon") };
    note("Sneak Attack", "SneakAttack", { n });
  }
  if ( has.has("Potency") ) {
    const t = tier(L, 4);
    mods.alchemy = { perDie: t, explode: true };
    note("Potency", "Potency", { n: t });
  }
  if ( has.has("Sculpt Spell") ) {
    mods.cast.upcastDiscount = tier(L, 4);
    note("Sculpt Spell", "SculptSpell", { n: tier(L, 4) });
  }
  if ( has.has("Paragon's Aura") ) {
    mods.cast.auraDiscount = 2;
    note("Paragon's Aura", "ParagonsAura", { n: tier(L, 4) });
  }

  // ---- Shown as numbers only ----------------------------------------------------------
  note("Alchemy", "Alchemy", { n: formulasKnown(L), max: formulaMaxValue(L) });
  note("Eureka", "Eureka", { n: 15 - tier(L, 2) + 1 });
  note("Overtuned", "Overtuned", { n: 21 - tier(L, 2) + 1 });
  note("Audacity", "Countdown", { die: cd(8) });
  note("Captivator", "Countdown", { die: cd(8) });
  note("Moxie", "Countdown", { die: cd(8) });
  for ( const name of ["Evasive"] ) note(name, "Evasive", { n: 10 + (5 * (tier(L, 2) - 1)) });
  note("Savagery", "Plus", { n: tier(L, 2) });
  note("Tempest Within", "Reduce", { n: tier(L, 4) });
  note("Grit", "Grit", { n: Math.max(0, 3 - tier(L, 4) + 1) });
  note("Lethal Precision", "Plus", { n: tier(L, 4) });
  note("Overheal", "Plus", { n: Math.floor(L / 2) });
  note("Ever-Cure", "Statuses", { n: tier(L, 4) });
  note("Spell Parry", "Exceed", { n: 15 - tier(L, 2) + 1 });
  note("Haymaker", "Exceed", { n: 15 - tier(L, 2) + 1 });
  note("Arcane Surge", "Discount", { n: tier(L, 4) });
  note("Diamond Hands", "DiamondHands", { n: (250 * (5 ** (tier(L, 4) - 1))).toLocaleString() });
  note("Lay on Hands", "LayOnHands", { formula: `${dieUp(2)} + ${L}` });
  note("Quickening", "Quickening", { n: tier(L, 2) - 1 });
  note("Manifold Mind", "Plus", { n: tier(L, 2) });
  note("Widdershins", "Plus", { n: tier(L, 2) });
  note("Grudge Bearer", "Plus", { n: tier(L, 4) });
  return mods;
}

/**
 * Make every die in a formula explode, optionally on a range ("x>=7").
 * @param {string} formula
 * @param {number} [min]  Explode on this face or higher; omit for the highest face.
 * @returns {string}
 */
export function explodeFormula(formula, min) {
  return String(formula).replace(/(\d*d\d+)(?!\d|x)/g, (m) => (min ? `${m}x>=${min}` : `${m}x`));
}
