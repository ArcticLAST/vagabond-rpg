import { ItemDataModel, int, str } from "./item-base.mjs";

/**
 * Worn Armor (p. 76). Only the best equipped Armor counts.
 */
export default class ArmorData extends ItemDataModel {

  /** @override */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      ...this.physicalFields(),
      armorType: str("light"),
      rating: int(1, { min: 0 }),
      might: int(2, { min: 0 }),
      metal: str(""),
      bonus: int(0)
    };
  }

  /** @override */
  prepareDerivedData() {
    const metal = CONFIG.VAGABOND.metals[this.metal] ?? {};
    this.equipSlots = Math.max(0, this.slots + (metal.slots ?? 0));
    this.metalBonus = metal.bonus ?? 0;
    this.total = this.rating + this.bonus + this.metalBonus;
  }

  /** @override */
  get chatTags() {
    const cfg = CONFIG.VAGABOND;
    return [
      game.i18n.localize(cfg.armorTypes[this.armorType]?.label ?? ""),
      `${game.i18n.localize("VAGABOND.Armor")} ${this.total}`,
      `${game.i18n.localize("VAGABOND.Stat.mit")} ${this.might}`
    ].filter(Boolean);
  }
}
