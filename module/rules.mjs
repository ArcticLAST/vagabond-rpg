/**
 * Pure rules math for Vagabond. Nothing in this file touches Foundry globals, so it can be unit tested
 * in plain Node (see tools/test-rules.mjs).
 */

export const DIE_SIZES = [4, 6, 8, 10, 12];

/**
 * Difficulty of a Skill Check: 20 − (Stat, doubled if Trained). Core Rulebook p. 8.
 * @param {number} stat
 * @param {boolean} trained
 * @returns {number}
 */
export function skillDifficulty(stat, trained) {
  return 20 - (Number(stat) || 0) * (trained ? 2 : 1);
}

/**
 * Difficulty of a Save. Endure: 20 − (MIT × 2). Reflex: 20 − (DEX + AWR) + armor penalty.
 * Will: 20 − (RSN + PRS). Core Rulebook p. 22.
 * @param {string} save                     endure | reflex | will
 * @param {Record<string, number>} stats    Stat values keyed by abbreviation.
 * @param {number} [armorPenalty=0]         Slots occupied by worn Armor (Reflex only).
 * @returns {number}
 */
export function saveDifficulty(save, stats, armorPenalty = 0) {
  const s = k => Number(stats[k]) || 0;
  switch ( save ) {
    case "endure": return 20 - (s("mit") * 2);
    case "reflex": return 20 - (s("dex") + s("awr")) + Math.max(0, armorPenalty);
    case "will": return 20 - (s("rsn") + s("prs"));
    default: return 20;
  }
}

/**
 * Speed from Dexterity: 2-3 → 25', 4-5 → 30', 6-7 → 35'. Values outside the printed table extend the
 * same pattern (5' per 2 points of DEX).
 * @param {number} dex
 * @returns {number}
 */
export function baseSpeed(dex) {
  dex = Number(dex) || 0;
  return 25 + (5 * Math.floor((dex - 2) / 2));
}

/** Crawl Speed is 3 × Speed; Travel Speed is Speed ÷ 5 miles per Shift. */
export function crawlSpeed(speed) {
  return speed * 3;
}

export function travelSpeed(speed) {
  return Math.floor(speed / 5);
}

/**
 * Max HP: MIT × Level (Level 0 counts as Level 1), plus per-level and flat bonuses.
 * At 5 Fatigue a Hero's Max HP is 0.
 */
export function maxHP({ might, level, perLevel = 0, flat = 0, fatigue = 0 }) {
  if ( fatigue >= 5 ) return 0;
  const lvl = Math.max(1, Number(level) || 0);
  return Math.max(0, ((Number(might) || 0) + perLevel) * lvl + flat);
}

/** Inventory Slots: 8 + MIT. */
export function maxSlots(might, bonus = 0) {
  return 8 + (Number(might) || 0) + bonus;
}

/**
 * Cast Max by class progression. "half": 1 + half Level (rounded up). "full": 2 + Level.
 * @param {string} type     none | half | full
 * @param {number} level
 */
export function castMax(type, level) {
  level = Math.max(0, Number(level) || 0);
  if ( type === "half" ) return 1 + Math.ceil(level / 2);
  if ( type === "full" ) return 2 + level;
  return 0;
}

/**
 * Spells known for a Class: base at 1st Level, plus one every `every` Levels after that.
 * Examples: Wizard (4, every 2) knows 4 at L1-2, 5 at L3-4. Druid (2, every 3) knows 3 at L4.
 */
export function spellsKnown(base, every, level) {
  level = Math.max(1, Number(level) || 0);
  if ( !base ) return 0;
  if ( !every ) return base;
  return base + Math.floor((level - 1) / every);
}

/**
 * Alchemical Items an Alchemist can Craft (Alchemy, p. 29): 4, and 1 more every 3 Levels.
 * @param {number} level
 * @returns {number}
 */
export function formulasKnown(level) {
  return spellsKnown(4, 3, level);
}

/**
 * Highest value of Alchemical Item an Alchemist can learn at a Level, in silver (Level × 50s).
 * @param {number} level
 * @returns {number}
 */
export function formulaMaxValue(level) {
  return Math.max(1, Number(level) || 0) * 50;
}

/**
 * Step a die size up or down. Sizes run d4 to d12; steps above d12 become +1 each, and stepping below
 * d4 makes the die a flat 1 that can't explode (p. 7).
 * @param {number} faces    Starting faces (4-12). Use 1 for a flat 1-damage weapon.
 * @param {number} steps    Number of size steps (negative to shrink).
 * @returns {{faces: number|null, flat: number, bonus: number}}  faces null means a flat value.
 */
export function stepDie(faces, steps = 0) {
  faces = Number(faces) || 0;
  if ( faces <= 1 ) {
    if ( steps <= 0 ) return { faces: null, flat: 1, bonus: 0 };
    faces = 4;
    steps -= 1;
  }
  let index = DIE_SIZES.indexOf(faces);
  if ( index < 0 ) return { faces, flat: 0, bonus: 0 };
  index += steps;
  if ( index < 0 ) return { faces: null, flat: 1, bonus: 0 };
  if ( index >= DIE_SIZES.length ) return { faces: 12, flat: 0, bonus: index - (DIE_SIZES.length - 1) };
  return { faces: DIE_SIZES[index], flat: 0, bonus: 0 };
}

/**
 * Parse a die string such as "d8", "2d6", or "1" into a count and faces.
 * @param {string} die
 * @returns {{count: number, faces: number}}  faces 1 means a flat value of `count`.
 */
export function parseDie(die) {
  const text = String(die ?? "").trim().toLowerCase();
  const match = text.match(/^(\d*)d(\d+)$/);
  if ( match ) return { count: Number(match[1] || 1), faces: Number(match[2]) };
  const flat = Number(text);
  if ( Number.isFinite(flat) && flat > 0 ) return { count: flat, faces: 1 };
  return { count: 0, faces: 0 };
}

/**
 * Build a damage formula.
 * @param {object} options
 * @param {number} options.count         Number of dice.
 * @param {number} options.faces         Faces per die (1 for flat damage).
 * @param {number} [options.steps=0]     Die size steps.
 * @param {number} [options.perDie=0]    Flat bonus (or penalty) per damage die.
 * @param {number} [options.flat=0]      Flat bonus added once.
 * @param {boolean|number} [options.explode]  Whether the dice explode: true on their highest value, or a number N to
 *   explode on their N highest values ("two highest values" is 2).
 * @param {number} [options.explodeLow=0]  The dice also explode on this roll or lower (Vehement Magic is 1).
 * @returns {string}
 */
export function damageFormula({ count, faces, steps = 0, perDie = 0, flat = 0, explode = false, explodeLow = 0 }) {
  if ( !count ) return flat ? String(flat) : "0";
  const parts = [];
  if ( faces <= 1 && steps <= 0 ) {
    parts.push(String(count));
  } else {
    const stepped = stepDie(faces, steps);
    if ( stepped.faces === null ) parts.push(String(count * stepped.flat));
    else {
      const top = explode === true ? 1 : Math.max(0, Number(explode) || 0);
      let x = !top ? "" : (top === 1 ? "x" : `x>=${stepped.faces - top + 1}`);
      if ( explodeLow > 0 ) x += `x<=${explodeLow}`;
      parts.push(`${count}d${stepped.faces}${x}`);
      if ( stepped.bonus ) perDie += stepped.bonus;
    }
  }
  const totalPerDie = perDie * count;
  const extra = totalPerDie + flat;
  if ( extra > 0 ) parts.push(`+ ${extra}`);
  else if ( extra < 0 ) parts.push(`- ${Math.abs(extra)}`);
  return parts.join(" ");
}

/**
 * Resolve a Check result.
 * @param {object} options
 * @param {number} options.total        Final roll total.
 * @param {number} options.natural      The unmodified d20 result.
 * @param {number} options.difficulty
 * @param {number} [options.critOn=20]  Lowest natural d20 roll that Crits.
 * @param {boolean} [options.autoFail]  The roll automatically fails (e.g. Incapacitated).
 * @returns {{outcome: "crit"|"pass"|"fail", margin: number}}
 */
export function resolveCheck({ total, natural, difficulty, critOn = 20, autoFail = false }) {
  const margin = total - difficulty;
  if ( autoFail ) return { outcome: "fail", margin };
  if ( natural >= critOn ) return { outcome: "crit", margin };
  return { outcome: total >= difficulty ? "pass" : "fail", margin };
}

/**
 * Favor and Hinder cancel 1-for-1 and don't stack (p. 8).
 * @param {number} favor   Number of Favor sources.
 * @param {number} hinder  Number of Hinder sources.
 * @returns {-1|0|1}
 */
export function netFavor(favor, hinder) {
  return Math.sign((favor || 0) - (hinder || 0));
}

/**
 * Mana cost of a Casting (p. 91).
 * @param {object} options
 * @param {{cost: number, upcast: number}} options.delivery
 * @param {number} [options.deliverySteps=0]  Number of Delivery upcast steps.
 * @param {boolean} options.damage            Cast to deal damage.
 * @param {boolean} options.effect            Cast for its effect.
 * @param {number} [options.extraDice=0]      Extra damage dice (1 Mana each).
 * @param {number} [options.discount=0]       Flat Mana discount.
 * @returns {number}
 */
export function castCost({ delivery, deliverySteps = 0, damage, effect, extraDice = 0, discount = 0 }) {
  let cost = (delivery?.cost ?? 0) + ((delivery?.upcast ?? 0) * Math.max(0, deliverySteps));
  if ( damage && effect ) cost += 1;
  if ( damage ) cost += Math.max(0, extraDice);
  return Math.max(0, cost - Math.max(0, discount));
}

/**
 * Apply Armor to incoming damage. Armor reduces damage; damage minimum is 0 (p. 8).
 */
export function applyArmor(damage, armor, { ignoreArmor = false } = {}) {
  damage = Math.max(0, Number(damage) || 0);
  if ( ignoreArmor ) return damage;
  // Negative Armor (a Vulnerability curse) increases damage taken.
  armor = Number(armor) || 0;
  if ( armor < 0 ) return damage ? damage - armor : 0;
  return Math.max(0, damage - armor);
}

/**
 * Average HP from Hit Dice: HD × 4.5 rounded down; Small Beings have 1 HP per HD (p. 109).
 */
export function hpFromHD(hd, size = "medium") {
  hd = Number(hd) || 0;
  if ( size === "small" ) return hd;
  return Math.floor(hd * 4.5);
}

/**
 * Format a value in silver as gold, silver, and copper (100c = 1s, 100s = 1g).
 * @param {number} silver
 * @returns {string}
 */
export function formatCoins(silver) {
  const totalCopper = Math.round((Number(silver) || 0) * 100);
  if ( !totalCopper ) return "—";
  const g = Math.floor(totalCopper / 10000);
  const s = Math.floor((totalCopper % 10000) / 100);
  const c = totalCopper % 100;
  return [g ? `${g}g` : "", s ? `${s}s` : "", c ? `${c}c` : ""].filter(Boolean).join(" ");
}

/**
 * Parse a price such as "1g 60s", "50s", "5c", or "2g" into silver.
 * @param {string} text
 * @returns {number}
 */
export function parseCoins(text) {
  let silver = 0;
  for ( const [, amount, unit] of String(text).replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*([gsc])/gi) ) {
    const n = Number(amount);
    if ( unit.toLowerCase() === "g" ) silver += n * 100;
    else if ( unit.toLowerCase() === "s" ) silver += n;
    else silver += n / 100;
  }
  return Math.round(silver * 100) / 100;
}

/**
 * Slots occupied by a stack of Items. Items listed at 0 Slots occupy 1 Slot per 10 (p. 74).
 */
export function stackSlots(slots, quantity = 1) {
  slots = Number(slots) || 0;
  quantity = Math.max(0, Number(quantity) || 0);
  if ( !quantity ) return 0;
  if ( slots <= 0 ) return Math.ceil(quantity / 10);
  return slots * quantity;
}

/* -------------------------------------------- */
/*  Hero creation and leveling (p. 20, 27)      */
/* -------------------------------------------- */

/**
 * Extra Trainings a Hero picks from Reason: half RSN, rounded up (p. 20).
 * @param {number} rsn
 * @returns {number}
 */
export function reasonTrainings(rsn) {
  return Math.ceil((Number(rsn) || 0) / 2);
}

/**
 * Assign a Stat Array to Stats, highest values to the listed priority Stats first.
 * @param {number[]} array        Six values.
 * @param {string[]} priority     Stat keys in the order they should receive the highest values.
 * @param {string[]} allStats     Every Stat key.
 * @returns {Record<string, number>}  Stat key to index in the array.
 */
export function autoAssign(array, priority, allStats) {
  const order = [...new Set([...priority, ...allStats])];
  const indices = array.map((v, i) => i).sort((a, b) => array[b] - array[a]);
  return Object.fromEntries(order.map((k, n) => [k, indices[n]]));
}

/**
 * What a Hero earns by reaching a Level (p. 27): a Stat increase on even Levels and a Perk on odd Levels after 1.
 * @param {number} level   The Level being reached.
 * @returns {{statIncrease: number, perks: number}}
 */
export function levelRewards(level) {
  return {
    statIncrease: (level % 2 === 0) ? 1 : 0,
    perks: ((level > 1) && (level % 2 === 1)) ? 1 : 0
  };
}

/**
 * Check a Perk's printed Prerequisites (p. 64) against a Hero. Clauses the text doesn't make checkable count as met.
 * @param {string} text                    e.g. "Stat: DEX 4+ | Trained: Finesse or Melee"
 * @param {object} hero
 * @param {Record<string, number>} hero.stats   Stat values by key (mit, dex, ...).
 * @param {string[]} hero.trained                Trained Skill names, any case.
 * @param {string[]} hero.spells                 Known Spell names, any case.
 * @returns {{met: boolean, unmet: string[]}}
 */
export function checkPrerequisites(text, { stats = {}, trained = [], spells = [] } = {}) {
  const lower = a => a.map(x => String(x).toLowerCase().trim());
  const skills = new Set(lower(trained));
  const known = new Set(lower(spells));
  const unmet = [];
  for ( const part of String(text ?? "").split("|").map(p => p.trim()).filter(Boolean) ) {
    const [kind, ...rest] = part.split(":");
    const body = rest.join(":").trim();
    let ok = true;
    switch ( kind.trim().toLowerCase() ) {
      case "stat": {
        const m = body.match(/^(MIT|DEX|AWR|RSN|PRS|LUK)\s+(\d+)\+?$/i);
        if ( m ) ok = (stats[m[1].toLowerCase()] ?? 0) >= Number(m[2]);
        // "Chosen Stat <7" (Advancement): some Stat must still be below the cap.
        const chosen = body.match(/^chosen stat\s*<\s*(\d+)$/i);
        if ( chosen ) ok = Object.values(stats).some(v => (v ?? 0) < Number(chosen[1]));
        break;
      }
      case "trained":
        ok = body.split("&").every(clause => {
          const names = lower(clause.replace(/\beither\b/i, "").split(/,|\bor\b/)).filter(Boolean);
          return names.some(n => skills.has(n));
        });
        break;
      case "spell": {
        if ( /^any$/i.test(body) ) ok = known.size > 0;
        else if ( /^[A-Z][\w']*(\s+or\s+[A-Z][\w']*)*$/.test(body) ) ok = lower(body.split(/\bor\b/)).some(n => known.has(n));
        // Descriptions such as "any Object-creating Spell" can't be checked: they need at least one Spell.
        else ok = known.size > 0;
        break;
      }
    }
    if ( !ok ) unmet.push(part);
  }
  return { met: !unmet.length, unmet };
}

/**
 * How many times a Perk can be taken, read from its text: "multiple times" (no limit), "up to N times", "twice", or
 * once otherwise.
 * @param {string} text   The Perk's description.
 * @returns {number}      Infinity when there's no limit.
 */
export function perkLimit(text) {
  const plain = String(text ?? "").replace(/<[^>]+>/g, " ");
  if ( /multiple times/i.test(plain) ) return Infinity;
  const words = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  const upTo = plain.match(/up to (\w+) times/i);
  if ( upTo ) return Number(upTo[1]) || words[upTo[1].toLowerCase()] || 1;
  if ( /\btwice\b/i.test(plain) ) return 2;
  return 1;
}

/**
 * Average of a damage formula, rounded down as statblocks print it: "2d6" -> 7, "d10" -> 5, "d6+1" -> 4 (p. 109).
 * Exploding dice ("2d12!") count as plain dice. Returns null for formulas it can't read.
 * @param {string} formula
 * @returns {number|null}
 */
export function averageDamage(formula) {
  const text = String(formula ?? "").replace(/\s+/g, "").replace(/!/g, "").toLowerCase();
  if ( !text ) return null;
  let total = 0;
  for ( const term of text.match(/[+-]?[^+-]+/g) ?? [] ) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const dice = body.match(/^(\d*)d(\d+)$/);
    if ( dice ) total += sign * (Number(dice[1] || 1) * (Number(dice[2]) + 1) / 2);
    else if ( /^\d+$/.test(body) ) total += sign * Number(body);
    else return null;
  }
  return Math.max(0, Math.floor(total));
}

/**
 * Threat Level from Armor, HP, and average damage per Round (p. 111): TL = (2×Armor + HP/10) / 4 + DPR/6,
 * rounded to the nearest tenth.
 * @param {{armor: number, hp: number, dpr: number}} options
 * @returns {number}
 */
export function threatLevel({ armor = 0, hp = 0, dpr = 0 } = {}) {
  const a = 2 * (Number(armor) || 0);
  const b = (Number(hp) || 0) / 10;
  const c = (Number(dpr) || 0) / 6;
  return Math.round((((a + b) / 4) + c) * 10) / 10;
}

/* -------------------------------------------- */
/*  Damage types                                */
/* -------------------------------------------- */

/**
 * Damage types. The rules leave weapon damage vague (p. 6), so Weapons deal Physical damage by default; Blunt, Pierce,
 * and Slash are kinds of Physical damage for the Beings that care (p. 115-180). Spells deal their Damage Base.
 */
export const DAMAGE_TYPES = ["physical", "blunt", "pierce", "slash", "acid", "cold", "fire", "poison", "shock", "magic"];
export const PHYSICAL_DAMAGE = ["physical", "blunt", "pierce", "slash"];

const METAL_WORDS = { silvered: "silver", silver: "silver", adamant: "adamant", adamantine: "adamant", "cold iron": "coldIron" };

/**
 * Read a statblock's Immune or Weak text into rules, e.g. "Cold, Poison; Physical from non-Relics and Relic Weapons
 * weaker than (+2)" or "Blunt; Silvered Weapons". Text the system can't apply (such as "damage from axes") is skipped.
 * @param {string} text
 * @returns {{type?: string, metal?: string, nonRelic?: boolean, relicBelow?: number}[]}
 */
export function parseDamageTraits(text) {
  const out = [];
  const body = String(text ?? "").split(/Status Immun/i)[0];
  for ( const segment of body.split(";") ) {
    for ( const raw of segment.split(",") ) {
      const item = raw.trim().replace(/\.$/, "");
      if ( !item ) continue;
      const metal = item.match(/^(?:physical from\s+)?(silvered|silver|adamant|adamantine|cold iron)(?: weapons)?$/i);
      if ( metal ) { out.push({ metal: METAL_WORDS[metal[1].toLowerCase()] }); continue; }
      const m = item.match(/^(\w+)(?:\s+from\s+(.+))?$/i);
      if ( !m || !DAMAGE_TYPES.includes(m[1].toLowerCase()) ) continue;
      const rule = { type: m[1].toLowerCase() };
      const cond = (m[2] ?? "").toLowerCase();
      const below = cond.match(/weaker than \(\+(\d+)\)/);
      if ( below ) rule.relicBelow = Number(below[1]);
      else if ( cond.includes("non-relic") ) rule.nonRelic = true;
      out.push(rule);
    }
  }
  return out;
}

/**
 * Whether a damage instance matches an Immune or Weak rule.
 * @param {object} rule                  From parseDamageTraits.
 * @param {object} damage
 * @param {string} damage.type           A DAMAGE_TYPES key.
 * @param {boolean} [damage.relic]       Dealt by a Relic.
 * @param {number} [damage.bonus]        The Relic's (+N).
 * @param {string} [damage.metal]        The Weapon's metal.
 * @returns {boolean}
 */
export function damageMatches(rule, { type, relic = false, bonus = 0, metal = "" } = {}) {
  if ( rule.metal ) return !!metal && (rule.metal === metal);
  const typeOk = (rule.type === "physical") ? PHYSICAL_DAMAGE.includes(type) : (rule.type === type);
  if ( !typeOk ) return false;
  if ( rule.relicBelow !== undefined ) return !relic || (bonus < rule.relicBelow);
  if ( rule.nonRelic ) return !relic;
  return true;
}

/**
 * How a Being's Immune and Weak text treats a damage instance.
 * @param {{immune?: string, weak?: string}} traits
 * @param {object} damage   See damageMatches.
 * @returns {"immune"|"weak"|null}
 */
export function damageResponse({ immune = "", weak = "" } = {}, damage = {}) {
  if ( !damage?.type ) return null;
  if ( parseDamageTraits(immune).some(r => damageMatches(r, damage)) ) return "immune";
  if ( parseDamageTraits(weak).some(r => damageMatches(r, damage)) ) return "weak";
  return null;
}

const BREATH_TYPES = { red: "fire", blue: "shock", green: "poison", white: "cold", black: "acid" };
const DAMAGE_KEYWORDS = [
  ["fire", /fire|flame|hellfire|flare|magma|steam/i],
  ["cold", /frost|\bice\b|cold|blizzard|freez|chill/i],
  ["shock", /lightning|shock|\bzap\b|electric|levin/i],
  ["acid", /acid|caustic/i],
  ["poison", /poison|venom|noxious|toxic|\bgas\b|spore/i]
];

/**
 * Infer an NPC Action's damage type from its name, for Actions that don't set one (the same rules as
 * tools/damage-types.py): "(+2) Longsword" is a +2 Relic dealing Physical damage, dragon breaths go by colour,
 * elemental words set the type, other Casts are Magic, and everything else is Physical.
 * @param {string} name
 * @param {string} actionType
 * @returns {{type: string, relic: number}}
 */
export function inferActionDamage(name, actionType) {
  const base = String(name ?? "").replace(/^[A-Za-z ]+\d+:\s*/, "").trim();
  const relic = base.match(/^\(\+(\d+)\)/);
  if ( relic ) return { type: "physical", relic: Number(relic[1]) };
  const breath = base.match(/^(red|blue|green|white|black) breath/i);
  if ( breath ) return { type: BREATH_TYPES[breath[1].toLowerCase()], relic: 0 };
  for ( const [type, re] of DAMAGE_KEYWORDS ) if ( re.test(base) ) return { type, relic: 0 };
  return { type: actionType === "cast" ? "magic" : "physical", relic: 0 };
}

/* -------------------------------------------- */
/*  NPC Action Saves, Combos, and dice in text  */
/* -------------------------------------------- */

const SAVE_KEYS = ["endure", "reflex", "will"];

/**
 * Saves an NPC Action forces, read from its type, tags, and text (matches tools/bestiary-corrections.py).
 * Heroes make Reflex Saves to avoid Enemy Actions unless the statblock says otherwise (p. 14), so an attack that
 * reads "7 (2d6) and pass [Endure] or be Sickened" is avoided with Reflex, and Endure is a second Save made by a
 * Being it hits. Casts, Actions, and Abilities that print no Save have none (the Angel's Command is "take 4 (d6+1)
 * or obey"), so their first "pass [Save]" is their Save, if any. A Save named in the tags always wins.
 * @param {object} action
 * @param {string} action.actionType
 * @param {string} [action.tags]
 * @param {string} [action.text]   The Action's description (HTML or plain).
 * @returns {{save: string, effect: string[]}}
 */
export function actionSaves({ actionType, tags = "", text = "" } = {}) {
  if ( actionType === "combo" ) return { save: "", effect: [] };
  const plain = String(text).replace(/<[^>]+>/g, "");
  const passes = [];
  for ( const [, s] of plain.matchAll(/\bpass\s+(?:an?\s+)*\[(Endure|Reflex|Will)\]/gi) ) {
    if ( !passes.includes(s.toLowerCase()) ) passes.push(s.toLowerCase());
  }
  let named = null;
  if ( String(tags).includes("|") ) {
    const part = String(tags).split("|").slice(1).join("|").toLowerCase();
    const found = SAVE_KEYS.filter(s => part.includes(s));
    named = (found.includes("endure") && found.includes("reflex") && part.includes(" or ")) ? "endureReflex" : (found[0] ?? null);
  }
  let primary;
  if ( named ) primary = named;
  else if ( ["melee", "ranged", "attack"].includes(actionType) ) primary = "reflex";
  else if ( /^\s*\d+\s*(?:\(|and\b|,)/i.test(plain) ) primary = "";   // "7 (2d6) and pass [Endure]": damage lands, then a Save
  else primary = passes[0] ?? "";
  const covered = primary === "endureReflex" ? ["endure", "reflex"] : [primary];
  return { save: primary, effect: passes.filter(s => !covered.includes(s)) };
}

/**
 * The Save keys a save option stands for: "endureReflex" is either Endure or Reflex, the Being's choice.
 * @param {string} save
 * @returns {string[]}
 */
export function saveKeys(save) {
  if ( save === "endureReflex" ) return ["endure", "reflex"];
  return SAVE_KEYS.includes(save) ? [save] : [];
}

/**
 * The attacks a Combo names: "2×Claw and 1×Bite" is two Claw attacks and one Bite, "3 (d6)×Eyebeam" is a
 * rolled number of Eyebeams. Each part is matched to one of the Being's Actions by name (singular or plural, or
 * by its last word when only one Action shares it). An Action named in more than one option gets no count.
 * @param {string} text           The Combo's description.
 * @param {string[]} actionNames  Names of the Being's other Actions.
 * @returns {{name: string, count: string}[]}
 */
export function comboParts(text, actionNames = []) {
  const plain = String(text).replace(/<[^>]+>/g, "");
  const norm = s => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  const names = actionNames.map(n => ({ name: n, key: norm(n) })).sort((a, b) => b.key.length - a.key.length);
  const parts = [];
  for ( const m of plain.matchAll(/(\d+(?:\s*\([^)]*\))?)\s*×\s*([^,.;]+?)(?=\s*(?:,|\.|;|\band\b|\bor\b|$))/g) ) {
    const said = norm(m[2]);
    const last = said.split(" ").pop().replace(/e?s$/, "");
    const byLast = names.filter(n => n.key.split(" ").pop().replace(/e?s$/, "") === last);
    const hit = names.find(n => (said === n.key) || (said === `${n.key}s`) || (said === `${n.key}es`)
      || (said.replace(/s$/, "") === n.key) || said.startsWith(`${n.key} `))
      ?? (byLast.length === 1 ? byLast[0] : null);
    if ( !hit ) continue;
    const seen = parts.find(p => p.name === hit.name);
    if ( seen ) seen.count = "";   // Named in more than one option ("1×Fish and 1×Claw, or 2×Claw"): no single count.
    else parts.push({ name: hit.name, count: m[1].replace(/\s+/g, " ") });
  }
  return parts;
}

/**
 * Make the dice printed in statblock text clickable: "takes 18 (4d8) damage" becomes an inline roll of 4d8.
 * Countdown dice ("Cd6") and averages like "1/2 (1/d4)" are left alone.
 * @param {string} html
 * @returns {string}
 */
export function inlineDice(html) {
  return String(html ?? "").replace(/(\b\d+\s*)\((\d*d\d+(?:\s*[+\-×x*]\s*\d+)?)(?=[,)])/g, (all, lead, dice) => {
    const formula = dice.replace(/\s+/g, "").replace(/[×x]/g, "*").replace(/^d/, "1d");
    return `${lead}([[/r ${formula}]]{${dice}}`;
  });
}

/**
 * Pickable Immune, Weak, and Status Immunity entries for the Creature Builder. Each is [key, statblock text]; the
 * text is what the statblock shows and what parseDamageTraits reads. Anything else goes in a free "Other" entry.
 */
export const TRAIT_OPTIONS = {
  immune: [
    ["physical", "Physical"], ["physicalNonRelic", "Physical from non-Relics"], ["blunt", "Blunt"], ["pierce", "Pierce"],
    ["slash", "Slash"], ["acid", "Acid"], ["cold", "Cold"], ["fire", "Fire"], ["poison", "Poison"], ["shock", "Shock"],
    ["magic", "Magic"]
  ],
  weak: [
    ["physical", "Physical"], ["blunt", "Blunt"], ["pierce", "Pierce"], ["slash", "Slash"], ["acid", "Acid"],
    ["cold", "Cold"], ["fire", "Fire"], ["poison", "Poison"], ["shock", "Shock"], ["magic", "Magic"],
    ["silvered", "Silvered weapons"], ["adamant", "Adamant weapons"], ["coldIron", "Cold Iron weapons"]
  ],
  statusImmunities: [
    ["berserk", "Berserk"], ["blinded", "Blinded"], ["burning", "Burning"], ["charmed", "Charmed"],
    ["confused", "Confused"], ["dazed", "Dazed"], ["fatigued", "Fatigued"], ["frightened", "Frightened"],
    ["incapacitated", "Incapacitated"], ["paralyzed", "Paralyzed"], ["prone", "Prone"], ["restrained", "Restrained"],
    ["sickened", "Sickened"], ["suffocating", "Suffocating"], ["unconscious", "Unconscious"]
  ]
};

/** Other spellings found in statblocks, by the option they mean. */
const TRAIT_ALIASES = {
  "physical from non-relic": "physicalNonRelic", "physical from non-relic weapons": "physicalNonRelic",
  silver: "silvered", "silver weapons": "silvered", "physical from silvered weapons": "silvered", silvered: "silvered", adamant: "adamant", adamantine: "adamant",
  "adamantine weapons": "adamant", "cold iron": "coldIron",
  fatigue: "fatigued", blindness: "blinded", sufffocating: "suffocating"
};

/**
 * Split a statblock Immune, Weak, or Status Immunities line into picked options and leftover text.
 * @param {"immune"|"weak"|"statusImmunities"} field
 * @param {string} text
 * @returns {{keys: string[], other: string}}
 */
export function splitTraits(field, text) {
  const options = TRAIT_OPTIONS[field] ?? [];
  const keys = [];
  const other = [];
  for ( const raw of String(text ?? "").split(/[;,]/) ) {
    const entry = raw.trim().replace(/\.$/, "");
    if ( !entry ) continue;
    const low = entry.toLowerCase();
    const key = options.find(([k, t]) => (t.toLowerCase() === low) || (k.toLowerCase() === low))?.[0] ?? TRAIT_ALIASES[low];
    if ( key && options.some(([k]) => k === key) ) { if ( !keys.includes(key) ) keys.push(key); }
    else other.push(entry);
  }
  return { keys, other: other.join(", ") };
}

/**
 * Write picked options and leftover text back as a statblock line, in the options' order.
 * @param {"immune"|"weak"|"statusImmunities"} field
 * @param {string[]} keys
 * @param {string} [other]
 * @returns {string}
 */
export function joinTraits(field, keys, other = "") {
  const picked = (TRAIT_OPTIONS[field] ?? []).filter(([k]) => keys.includes(k)).map(([, t]) => t);
  const extra = String(other ?? "").trim();
  return [...picked, ...(extra ? [extra] : [])].join(", ");
}
