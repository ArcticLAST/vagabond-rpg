import * as rules from "../rules.mjs";
import { featureMods } from "../class-features.mjs";

const {
  BooleanField, HTMLField, NumberField, SchemaField, StringField
} = foundry.data.fields;

/** A non-negative integer field with a default. */
const int = (initial = 0, options = {}) => new NumberField({
  required: true, nullable: false, integer: true, initial, ...options
});

/**
 * Combat Speed and Travel miles per Shift of a Mount or Vehicle, read from source data so it doesn't depend on the order
 * Actors are prepared in.
 * @param {Actor} mount
 * @returns {{speed: number, travel: number}}
 */
export function mountSpeeds(mount) {
  const a = mount.system._source.attributes ?? {};
  const speed = (mount.type === "vehicle") ? (a.speed ?? 0) : (a.speed?.value ?? 0);
  return { speed, travel: a.travel || rules.travelSpeed(speed) };
}

/**
 * Data model for player Heroes.
 */
export default class CharacterData extends foundry.abstract.TypeDataModel {

  /** @override */
  static LOCALIZATION_PREFIXES = ["VAGABOND.Character"];

  /** @override */
  static defineSchema() {
    const cfg = CONFIG.VAGABOND;
    const stats = {};
    for ( const key of Object.keys(cfg.stats) ) {
      stats[key] = new SchemaField({ value: int(4, { min: 0, max: 12 }) });
    }
    const skills = {};
    for ( const key of Object.keys(cfg.skills) ) {
      skills[key] = new SchemaField({ trained: new BooleanField({ initial: false }) });
    }
    const saves = {};
    for ( const key of Object.keys(cfg.saves) ) {
      saves[key] = new SchemaField({});
    }
    const dieSteps = {};
    for ( const key of [...cfg.attackSkills, "spell"] ) dieSteps[key] = int(0);

    return {
      stats: new SchemaField(stats),
      skills: new SchemaField(skills),
      saves: new SchemaField(saves),
      attributes: new SchemaField({
        hp: new SchemaField({ value: int(4, { min: 0 }) }),
        mana: new SchemaField({ value: int(0, { min: 0 }) }),
        luck: new SchemaField({ value: int(4, { min: 0 }) }),
        fatigue: int(0, { min: 0, max: 5 }),
        studied: int(0, { min: 0 }),
        // Sheet roll setting: -1 Hinder, 0 Normal, 1 Favor. Applies to every Check until changed.
        favor: int(0, { min: -1, max: 1 }),
        // Spend a Studied die for Favor on the next d20 roll (p. 19); cleared once used.
        studiedArmed: new BooleanField({ initial: false }),
        // The Mount or Vehicle this Hero is riding, by UUID (p. 13).
        mount: new StringField({ required: true, blank: true, initial: "" }),
        castingSkill: new StringField({ required: true, blank: true, initial: "" })
      }),
      details: new SchemaField({
        level: int(1, { min: 0 }),
        xp: int(0, { min: 0 }),
        size: new StringField({ required: true, initial: "medium" }),
        beingType: new StringField({ required: true, initial: "humanlike" }),
        biography: new HTMLField(),
        notes: new HTMLField()
      }),
      currency: new SchemaField({
        g: int(0, { min: 0 }),
        s: int(0, { min: 0 }),
        c: int(0, { min: 0 })
      }),
      bonuses: new SchemaField({
        hp: int(0),
        hpPerLevel: int(0),
        mana: int(0),
        castMax: int(0),
        armor: int(0),
        speed: int(0),
        speedMin: int(0),
        slots: int(0),
        reflexPenalty: int(0),
        luckOnRest: int(0),
        critAttack: int(0),
        critCast: int(0),
        critSave: int(0),
        damagePerDie: int(0),
        spellDamagePerDie: int(0),
        dieStep: new SchemaField(dieSteps)
      })
    };
  }

  /* -------------------------------------------- */

  /**
   * The Class item on this Hero, if any.
   * @type {Item|undefined}
   */
  get classItem() {
    return this.parent.items.find(i => i.type === "class");
  }

  /**
   * The Ancestry item on this Hero, if any.
   * @type {Item|undefined}
   */
  get ancestryItem() {
    return this.parent.items.find(i => i.type === "ancestry");
  }

  /**
   * The Mount or Vehicle this Hero is riding, if it still exists.
   * @type {Actor|null}
   */
  get mountActor() {
    if ( !this.attributes.mount ) return null;
    try {
      const actor = fromUuidSync(this.attributes.mount);
      return (actor instanceof Actor) && (actor !== this.parent) ? actor : null;
    } catch {
      return null;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    // Values derived later are set here so Active Effects can target them with ADD/OVERRIDE.
    this.attributes.hp.max = 0;
    this.attributes.mana.max = 0;
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    const cfg = CONFIG.VAGABOND;
    const actor = this.parent;
    const level = this.details.level;
    const statValues = Object.fromEntries(Object.entries(this.stats).map(([k, v]) => [k, v.value]));
    const has = id => actor.statuses?.has(id);

    // Class Features that scale with Level add to the same bonuses Active Effects use.
    const fx = this.featureMods = featureMods(actor);
    const b = this.bonuses;
    b.speed += fx.bonuses.speed;
    b.slots += fx.bonuses.slots;
    b.luckOnRest += fx.bonuses.luckOnRest;
    b.critAttack += fx.bonuses.critAttack;
    b.critCast += fx.bonuses.critCast;
    b.dieStep.spell += fx.bonuses.spellDieStep;

    // Stats
    for ( const [key, stat] of Object.entries(this.stats) ) {
      stat.label = cfg.stats[key].label;
      stat.abbr = cfg.stats[key].abbr;
    }

    // Inventory and Armor
    const items = actor.items;
    let slotsUsed = 0;
    let slotsBonus = 0;
    let equippedWeaponSlots = 0;
    let worn = null;
    for ( const item of items ) {
      const s = item.system;
      if ( !("slots" in s) ) continue;
      const qty = "quantity" in s ? s.quantity : 1;
      slotsUsed += rules.stackSlots(s.slots, qty);
      if ( (item.type === "weapon") && s.equipped ) equippedWeaponSlots += s.equipSlots ?? s.slots;
      if ( (item.type === "armor") && s.equipped && (!worn || (s.total > worn.system.total)) ) worn = item;
      if ( (item.type === "gear") && s.equipped ) slotsBonus += s.slotsBonus ?? 0;
    }
    const fatigue = this.attributes.fatigue;
    slotsUsed += fatigue;
    const slotsMax = rules.maxSlots(statValues.mit, this.bonuses.slots + slotsBonus);
    this.attributes.slots = {
      value: slotsUsed,
      max: slotsMax,
      pct: slotsMax ? Math.clamp(Math.round((slotsUsed / slotsMax) * 100), 0, 100) : 100,
      full: slotsUsed >= slotsMax,
      over: slotsUsed > slotsMax
    };
    this.attributes.equippedWeaponSlots = equippedWeaponSlots;
    this.attributes.weaponsOverLimit = equippedWeaponSlots > 3;

    const armorRating = worn ? worn.system.total : 0;
    // Cursed Armor with a negative total (Armor of Vulnerability) grants no Armor and adds to Attack damage taken.
    const armorTotal = armorRating + this.bonuses.armor;
    this.attributes.armor = armorRating < 0 ? Math.min(0, armorTotal) : Math.max(0, armorTotal);
    this.attributes.wornArmor = worn ?? null;
    this.attributes.armorPenalty = worn ? Math.max(0, worn.system.slots - this.bonuses.reflexPenalty) : 0;
    this.attributes.armorTooHeavy = worn ? (statValues.mit < worn.system.might) : false;

    // Skills
    for ( const [key, skill] of Object.entries(this.skills) ) {
      const def = cfg.skills[key];
      skill.stat = def.stat;
      skill.label = def.label;
      skill.difficulty = rules.skillDifficulty(statValues[def.stat], skill.trained);
    }

    // Saves
    for ( const [key, save] of Object.entries(this.saves) ) {
      save.label = cfg.saves[key].label;
      save.difficulty = rules.saveDifficulty(key, statValues, key === "reflex" ? this.attributes.armorPenalty : 0);
    }

    // Hit Points
    const hp = this.attributes.hp;
    hp.max = rules.maxHP({
      might: statValues.mit, level, perLevel: this.bonuses.hpPerLevel, flat: this.bonuses.hp + (hp.max || 0), fatigue
    });
    if ( fatigue >= 5 ) hp.value = 0;
    hp.pct = hp.max ? Math.clamp(Math.round((hp.value / hp.max) * 100), 0, 100) : 0;

    // Magic
    const cls = this.classItem?.system;
    const mana = this.attributes.mana;
    mana.max = Math.max(0, ((cls?.mana.perLevel ?? 0) * level) + this.bonuses.mana + (mana.max || 0));
    mana.pct = mana.max ? Math.clamp(Math.round((mana.value / mana.max) * 100), 0, 100) : 0;
    this.attributes.castMax = rules.castMax(cls?.castMax ?? "none", level) + this.bonuses.castMax;
    this.attributes.spellsKnown = {
      value: actor.itemTypes.spell?.length ?? 0,
      // Spells beyond the Class's count: Magical Secret, and Ancestry Traits or Class Features that teach one
      // (Naturally Attuned).
      max: (cls ? rules.spellsKnown(cls.spells.base, cls.spells.every, level) : 0)
        + (actor.itemTypes.perk?.filter(p => /^magical secret\b/i.test(p.name)).length ?? 0)
        + grantedSpellChoices(actor, level)
    };
    this.attributes.isCaster = !!(cls?.mana.perLevel) || (this.attributes.spellsKnown.value > 0);
    const castKey = this.attributes.castingSkill || cls?.castingSkill || "arcana";
    this.attributes.cast = {
      skill: castKey,
      label: cfg.skills[castKey]?.label ?? castKey,
      difficulty: this.skills[castKey]?.difficulty ?? 20
    };

    // Extra Trainings at Level 1: half Reason, rounded up (p. 20).
    this.attributes.bonusTrainings = Math.ceil(statValues.rsn / 2);
    this.attributes.trainedCount = Object.values(this.skills).filter(s => s.trained).length;

    // Luck
    this.attributes.luck.max = statValues.luk;

    // Speed
    const base = rules.baseSpeed(statValues.dex);
    // speedMin: "Speed becomes 30' if it was previously lower" (Boots of the Hare's Lesser Speed).
    const speed = Math.max(0, base + this.bonuses.speed, this.bonuses.speedMin);
    const immobile = has("restrained") || has("paralyzed") || has("unconscious") || has("incapacitated")
      || this.attributes.armorTooHeavy;
    this.attributes.speed = {
      base,
      value: immobile ? 0 : speed,
      crawl: rules.crawlSpeed(speed),
      travel: rules.travelSpeed(speed),
      immobile
    };

    // A rider uses their controlled Mount's Speed instead of their own (p. 13). Vehicles work the same way.
    const mount = this.mountActor;
    if ( mount ) {
      const ms = mountSpeeds(mount);
      Object.assign(this.attributes.speed, {
        own: this.attributes.speed.value,
        value: ms.speed,
        crawl: rules.crawlSpeed(ms.speed),
        travel: ms.travel,
        mounted: true
      });
    }

    // Crits
    this.attributes.crit = {
      attack: 20 - this.bonuses.critAttack,
      cast: 20 - this.bonuses.critCast,
      save: 20 - this.bonuses.critSave
    };

    // Conditions summary used by rolls
    this.attributes.canRush = (fatigue < 3) && !this.attributes.slots.full;
    this.attributes.isVulnerable = cfg.vulnerableStatuses.some(s => has(s)) || this.attributes.armorTooHeavy;
    this.attributes.isIncapacitated = cfg.incapacitatedStatuses.some(s => has(s));
  }

  /* -------------------------------------------- */

  /**
   * Roll data for formulas: stats by abbreviation, level, and a few derived numbers.
   * @returns {object}
   */
  getRollData() {
    const data = {};
    for ( const [k, v] of Object.entries(this.stats) ) data[k] = v.value;
    data.level = this.details.level;
    data.lvl = this.details.level;
    data.armor = this.attributes.armor;
    data.castMax = this.attributes.castMax;
    data.groupInit = 2;
    return data;
  }
}

/**
 * Spells a Hero learns from Ancestry Traits and Class Features beyond their Class's count (e.g. Naturally Attuned).
 * @param {Actor} actor
 * @param {number} level
 * @returns {number}
 */
function grantedSpellChoices(actor, level) {
  let n = 0;
  for ( const item of actor.items ) {
    const rows = item.type === "ancestry" ? item.system.traits : (item.type === "class" ? item.system.features : null);
    for ( const row of rows ?? [] ) {
      if ( (item.type === "class") && ((row.level ?? 1) > level) ) continue;
      n += Number(row.grants?.spellChoices) || 0;
    }
  }
  return n;
}
