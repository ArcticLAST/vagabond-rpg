import { BooleanField, ItemDataModel, int, str } from "./item-base.mjs";

/**
 * Spells (p. 90-104). Each Spell has a Damage Base, an effect, and a Crit effect. The caster chooses the
 * Delivery and how much Mana to spend when Casting.
 */
export default class SpellData extends ItemDataModel {

  /** @override */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      damageBase: str(""),
      damageDie: int(6, { min: 1 }),
      crit: str(""),
      focus: new BooleanField({ initial: false }),
      noDamage: new BooleanField({ initial: false }),
      delivery: str("remote"),
      // Readied Spells show under Attacks on the Hero's sheet for quick use.
      readied: new BooleanField({ initial: false }),
      // Cast with this Skill instead of the Class's (Magical Secret).
      castSkill: str("")
    };
  }

  /**
   * The Skill this Spell is Cast with when it has its own (Magical Secret), else null for the Hero's usual one.
   * @type {{skill: string, label: string, difficulty: number}|null}
   */
  get castInfo() {
    const skill = this.castSkill;
    const data = skill ? this.parent?.actor?.system.skills?.[skill] : null;
    if ( !data ) return null;
    return { skill, label: CONFIG.VAGABOND.skills[skill]?.label ?? skill, difficulty: data.difficulty ?? 20 };
  }

  /** @override */
  get chatTags() {
    const cfg = CONFIG.VAGABOND;
    const tags = [];
    if ( this.damageBase ) tags.push(game.i18n.localize(cfg.damageBases[this.damageBase] ?? this.damageBase));
    if ( this.focus ) tags.push(game.i18n.localize("VAGABOND.Spell.Focus"));
    if ( this.castSkill ) tags.push(game.i18n.localize(CONFIG.VAGABOND.skills[this.castSkill]?.label ?? this.castSkill));
    return tags;
  }
}
