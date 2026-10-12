import * as rules from "../rules.mjs";
import { BooleanField, ItemDataModel, SchemaField, int, str } from "./item-base.mjs";

/**
 * Weapons (p. 76-77).
 */
export default class WeaponData extends ItemDataModel {

  /** @override */
  static defineSchema() {
    const cfg = CONFIG.VAGABOND;
    const types = {};
    for ( const key of cfg.attackSkills ) types[key] = new BooleanField({ initial: key === "melee" });
    const properties = {};
    for ( const key of Object.keys(cfg.weaponProperties) ) properties[key] = new BooleanField({ initial: false });
    return {
      ...super.defineSchema(),
      ...this.physicalFields(),
      types: new SchemaField(types),
      properties: new SchemaField(properties),
      range: str("close"),
      grip: str("1h"),
      damage: str("d6"),
      twoHanded: new BooleanField({ initial: false }),
      metal: str(""),
      bonus: int(0),
      relic: new BooleanField({ initial: false }),
      damageType: str("physical"),
      crude: new BooleanField({ initial: false })
    };
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    const metal = CONFIG.VAGABOND.metals[this.metal] ?? {};
    this.equipSlots = Math.max(0, this.slots + (metal.slots ?? 0));
    this.isRelic = this.relic || (this.bonus > 0);
    this.attackSkills = CONFIG.VAGABOND.attackSkills.filter(k => this.types[k]);
    this.isRanged = this.types.ranged && !this.types.melee && !this.types.brawl && !this.types.finesse;
    this.effectiveRange = this.properties.long
      ? `${game.i18n.localize(CONFIG.VAGABOND.ranges[this.range] ?? this.range)} ×2`
      : game.i18n.localize(CONFIG.VAGABOND.ranges[this.range] ?? this.range);
  }

  /* -------------------------------------------- */

  /**
   * Die size steps from the grip, metal, and the owner's bonuses for the given Skill.
   * @param {string} [skill]
   * @returns {number}
   */
  dieSteps(skill) {
    let steps = 0;
    if ( (this.grip === "v") && this.twoHanded ) steps += 1;
    steps += CONFIG.VAGABOND.metals[this.metal]?.dieStep ?? 0;
    const bonuses = this.actor?.system.bonuses;
    if ( bonuses && skill ) steps += bonuses.dieStep?.[skill] ?? 0;
    return steps;
  }

  /**
   * The best Skill to attack with: the owner's lowest Difficulty among this Weapon's types.
   * Crude Weapons can also use Craft.
   * @returns {string}
   */
  get bestSkill() {
    const options = [...this.attackSkills];
    if ( this.crude ) options.push("craft");
    const skills = this.actor?.system.skills;
    if ( !skills || !options.length ) return options[0] ?? "melee";
    return options.reduce((best, k) => (skills[k]?.difficulty < skills[best]?.difficulty ? k : best), options[0]);
  }

  /**
   * Whether the owner is Trained with any Skill this Weapon attacks with. Properties only work when
   * Trained, except Thrown (p. 76).
   * @returns {boolean}
   */
  get isTrained() {
    const skills = this.actor?.system.skills;
    if ( !skills ) return true;
    return this.attackSkills.some(k => skills[k]?.trained);
  }

  /**
   * Crit threshold on the Attack Check, applying Keen when Trained.
   * @returns {number}
   */
  get critOn() {
    const base = this.actor?.system.attributes?.crit?.attack ?? 20;
    return base - ((this.properties.keen && this.isTrained) ? 1 : 0);
  }

  /**
   * Build the damage formula for an attack.
   * @param {object} [options]
   * @param {string} [options.skill]       Skill used to attack.
   * @param {boolean} [options.crit]       Whether the attack Crit (adds the Stat, and a die if Vicious).
   * @param {number} [options.extraDice]   Additional dice.
   * @returns {string}
   */
  damageFormula({ skill, crit = false, extraDice = 0 } = {}) {
    const die = rules.parseDie(this.damage);
    const actor = this.actor;
    const fx = actor?.system.featureMods;
    const using = skill ?? this.bestSkill;
    let count = die.count + extraDice;
    let faces = die.faces;
    let steps = die.faces > 1 ? this.dieSteps(using) : 0;
    let perDie = actor?.system.bonuses?.damagePerDie ?? 0;
    let explode = false;

    // Class Features (see module/class-features.mjs).
    const brawl = (using === "brawl") ? fx?.brawl : null;
    if ( brawl?.faces && (faces < brawl.faces) ) faces = brawl.faces;
    if ( brawl?.explodeOn ) explode = 2;
    if ( fx?.berserk ) {
      steps += fx.berserk.steps;
      perDie += fx.berserk.perDie;
      if ( fx.berserk.explode ) explode ||= true;
    }
    if ( fx?.defense && this.properties.defense ) {
      steps += fx.defense.steps;
      const armored = !!actor.system.attributes?.wornArmor && !actor.system.attributes?.isIncapacitated;
      if ( armored ) perDie += fx.defense.perDie;
    }
    if ( crit && (using === "ranged") && fx?.rangedCrit ) {
      count += fx.rangedCrit.extraDice;
      if ( fx.rangedCrit.explode ) explode ||= true;
    }

    const vicious = this.properties.vicious || !!brawl?.vicious;
    if ( crit && vicious && this.isTrained ) count += 1;
    const metal = CONFIG.VAGABOND.metals[this.metal] ?? {};
    let flat = this.bonus + (metal.bonus ?? 0);
    if ( crit && actor ) {
      const stat = CONFIG.VAGABOND.skills[using]?.stat;
      flat += actor.system.stats?.[stat]?.value ?? 0;
    }
    return rules.damageFormula({ count, faces, steps, perDie, flat, explode });
  }

  /**
   * What this Weapon's damage is, for Immune and Weak checks.
   * @type {{type: string, relic: boolean, bonus: number, metal: string}}
   */
  get damageInfo() {
    return { type: this.damageType || "physical", relic: this.relic || (this.bonus > 0), bonus: this.bonus, metal: this.metal };
  }

  /**
   * Whether this Weapon can deal Sneak Attack damage: Finesse, Keen, or Ranged Weapons.
   * @param {string} [skill]
   * @returns {boolean}
   */
  canSneakAttack(skill) {
    const using = skill ?? this.bestSkill;
    return ["finesse", "ranged"].includes(using) || this.attackSkills.some(k => ["finesse", "ranged"].includes(k)) || this.properties.keen;
  }

  /** @override */
  get chatTags() {
    const cfg = CONFIG.VAGABOND;
    const tags = this.attackSkills.map(k => game.i18n.localize(cfg.skills[k].label));
    for ( const [k, v] of Object.entries(this.properties) ) if ( v ) tags.push(game.i18n.localize(cfg.weaponProperties[k].label));
    tags.push(this.effectiveRange, game.i18n.localize(cfg.grips[this.grip] ?? this.grip));
    if ( this.metal ) tags.push(game.i18n.localize(cfg.metals[this.metal]?.label ?? this.metal));
    return tags.filter(Boolean);
  }
}
