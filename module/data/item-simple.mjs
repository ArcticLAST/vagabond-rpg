import { ItemDataModel, int, str } from "./item-base.mjs";
import * as rules from "../rules.mjs";

const { BooleanField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/**
 * Perks (p. 30-38).
 */
export class PerkData extends ItemDataModel {
  /** @override */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      prerequisites: str("")
    };
  }

  /** @override */
  get chatTags() {
    return this.prerequisites ? [this.prerequisites] : [];
  }
}

/**
 * A Class Feature or Ancestry Trait granted to a Hero as its own Item.
 */
export class FeatureData extends ItemDataModel {
  /** @override */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      featureSource: str("class"),
      origin: str(""),
      level: int(1, { min: 0 })
    };
  }

  /** @override */
  get chatTags() {
    const tags = [];
    if ( this.origin ) tags.push(this.origin);
    if ( this.featureSource === "class" ) tags.push(`${game.i18n.localize("VAGABOND.Level")} ${this.level}`);
    return tags;
  }
}

/** A Feature row embedded in a Class or Ancestry. */
const count = () => new NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 });
const featureRow = () => new SchemaField({
  level: new NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 0 }),
  name: new StringField({ required: true, blank: true, initial: "" }),
  description: new HTMLField(),
  // What the Hero builder hands out for this Feature or Trait. Lists are comma-separated names.
  grants: new SchemaField({
    perks: new StringField({ required: true, blank: true, initial: "" }),
    perkChoices: count(),
    trainingChoices: count(),
    spells: new StringField({ required: true, blank: true, initial: "" }),
    spellChoices: count(),
    statIncrease: count(),
    levels: new StringField({ required: true, blank: true, initial: "" })
  })
});

/**
 * Split a comma-separated list of names.
 * @param {string} text
 * @returns {string[]}
 */
export function splitList(text) {
  return String(text ?? "").split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * The Levels at which a Feature row grants its rewards: its listed Levels, or just its own Level.
 * @param {object} row
 * @returns {number[]}
 */
export function grantLevels(row) {
  const listed = splitList(row.grants?.levels).map(Number).filter(Number.isFinite);
  return listed.length ? listed : [row.level];
}

/**
 * Classes (p. 39-71).
 */
export class ClassData extends ItemDataModel {
  /** @override */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      keyStats: new foundry.data.fields.ArrayField(new StringField({ required: true, blank: false })),
      trainings: new foundry.data.fields.ArrayField(new StringField({ required: true, blank: false })),
      trainingChoices: new SchemaField({
        count: int(0, { min: 0 }),
        options: new foundry.data.fields.ArrayField(new StringField({ required: true, blank: false }))
      }),
      castingSkill: str(""),
      castMax: str("none"),
      mana: new SchemaField({ perLevel: int(0, { min: 0 }) }),
      spells: new SchemaField({
        base: int(0, { min: 0 }),
        every: int(0, { min: 0 })
      }),
      playstyle: str(""),
      startingPacks: new HTMLField(),
      features: new foundry.data.fields.ArrayField(featureRow())
    };
  }

  /**
   * Features unlocked at or below a Level, sorted by Level.
   * @param {number} level
   * @returns {object[]}
   */
  featuresAt(level) {
    return this.features.filter(f => f.level <= level).sort((a, b) => a.level - b.level);
  }

  /** @override */
  get chatTags() {
    const cfg = CONFIG.VAGABOND;
    const tags = this.keyStats.map(k => game.i18n.localize(cfg.stats[k]?.label ?? k));
    if ( this.castingSkill ) tags.push(game.i18n.localize(cfg.skills[this.castingSkill]?.label ?? ""));
    return tags;
  }
}

/**
 * Ancestries (p. 23-26).
 */
export class AncestryData extends ItemDataModel {
  /** @override */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      beingType: str("humanlike"),
      size: str("medium"),
      trainings: new foundry.data.fields.ArrayField(new StringField({ required: true, blank: false })),
      traits: new foundry.data.fields.ArrayField(featureRow())
    };
  }

  /** @override */
  get chatTags() {
    const cfg = CONFIG.VAGABOND;
    return [
      game.i18n.localize(cfg.sizes[this.size] ?? ""),
      game.i18n.localize(cfg.beingTypes[this.beingType] ?? "")
    ].filter(Boolean);
  }
}

/**
 * An Action or Ability on an NPC statblock (p. 109), such as
 * "Bite [Melee Attack]: 4 (d8) and pass [Endure] or be Sickened".
 */
export class ActionData extends ItemDataModel {
  /** @override */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      actionType: str("melee"),
      tags: str(""),
      damage: str(""),
      average: new NumberField({ required: true, nullable: true, integer: true, initial: null }),
      damageType: str(""),
      relic: int(0),
      save: str("reflex"),
      // Saves a Being makes after the Action hits it ("7 (2d6) and pass [Endure] or be Sickened").
      effectSaves: new SchemaField({
        endure: new BooleanField(), reflex: new BooleanField(), will: new BooleanField()
      }),
      healing: new BooleanField(),
      recharge: str(""),
      sort: int(0)
    };
  }

  /** @override */
  prepareDerivedData() {
    this.isAbility = this.actionType === "ability";
    this.isCombo = this.actionType === "combo";
    this.saveList = this.isCombo ? [] : rules.saveKeys(this.save);
    this.effectSaveList = this.isCombo ? [] : Object.entries(this.effectSaves ?? {}).filter(([, v]) => v).map(([k]) => k);
    // Damage type and Relic (+N) used by rolls: the Action's own, or read from its name when it has none.
    const inferred = this.damage && !this.damageType ? rules.inferActionDamage(this.parent?.name, this.actionType) : null;
    this.damageInfo = (this.damage && !this.healing && !this.isCombo) ? {
      type: this.damageType || inferred.type,
      relic: (this.relic || inferred?.relic || 0) > 0,
      bonus: this.relic || inferred?.relic || 0
    } : null;
  }

  /** @override */
  get chatTags() {
    const tags = [];
    if ( this.tags ) tags.push(this.tags);
    if ( this.recharge ) tags.push(this.recharge);
    return tags;
  }
}
