import { BooleanField, ItemDataModel, NumberField, SchemaField, int, str } from "./item-base.mjs";

const { ArrayField } = foundry.data.fields;

/**
 * Adventuring Gear, Alchemical Items, Relics, Starting Packs, and other Inventory Items (p. 74-88).
 * A Starting Pack (category "kit") lists the Items it unpacks into and the Wealth left over (p. 74-75).
 */
export default class GearData extends ItemDataModel {

  /** @override */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      ...this.physicalFields(),
      category: str("adventuring"),
      alchemicalType: str(""),
      consumable: new BooleanField({ initial: false }),
      slotsBonus: int(0),
      uses: new SchemaField({
        value: int(0, { min: 0 }),
        max: int(0, { min: 0 })
      }),
      roll: new SchemaField({
        formula: str(""),
        type: str(""),
        save: str(""),
        damageType: str("")
      }),
      contents: new ArrayField(new SchemaField({
        uuid: str(""),
        name: str(""),
        quantity: int(1, { min: 1 }),
        value: new NumberField({ required: false, nullable: true, initial: null, min: 0 })
      })),
      wealth: int(0, { min: 0 })
    };
  }

  /** @override */
  prepareDerivedData() {
    this.hasUses = this.uses.max > 0;
    this.hasRoll = !!this.roll.formula;
    this.isKit = this.category === "kit";
  }

  /** @override */
  get chatTags() {
    const cfg = CONFIG.VAGABOND;
    const tags = [game.i18n.localize(cfg.gearCategories[this.category] ?? "")];
    if ( this.alchemicalType ) tags.push(game.i18n.localize(cfg.alchemicalTypes[this.alchemicalType] ?? this.alchemicalType));
    if ( this.hasUses ) tags.push(`${this.uses.value}/${this.uses.max}`);
    return tags.filter(Boolean);
  }
}
