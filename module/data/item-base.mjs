const { BooleanField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/** Integer field helper. */
export const int = (initial = 0, options = {}) => new NumberField({
  required: true, nullable: false, integer: true, initial, ...options
});

/** Blank-able string field helper. */
export const str = (initial = "", options = {}) => new StringField({
  required: true, blank: true, initial, ...options
});

/**
 * Base data model for every Item type: a description and a source citation.
 */
export class ItemDataModel extends foundry.abstract.TypeDataModel {
  /** @override */
  static defineSchema() {
    return {
      description: new HTMLField(),
      source: str()
    };
  }

  /**
   * Fields shared by Items that sit in the Inventory.
   * @returns {object}
   */
  static physicalFields() {
    return {
      quantity: int(1, { min: 0 }),
      slots: int(1, { min: 0 }),
      value: new NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
      equipped: new BooleanField({ initial: false })
    };
  }

  /** The owning Actor, if any. */
  get actor() {
    return this.parent.actor;
  }

  /**
   * Text shown in the "properties" line of chat cards and sheet rows.
   * @type {string[]}
   */
  get chatTags() {
    return [];
  }
}

export { BooleanField, HTMLField, NumberField, SchemaField, StringField };
