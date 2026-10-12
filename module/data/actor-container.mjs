import * as rules from "../rules.mjs";

const { BooleanField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

const int = (initial = 0, options = {}) => new NumberField({
  required: true, nullable: false, integer: true, initial, ...options
});

/**
 * Slots taken by the physical Items an Actor carries.
 * @param {Actor} actor
 * @returns {number}
 */
export function cargoSlots(actor) {
  let used = 0;
  for ( const item of actor.items ) {
    const s = item.system;
    if ( !("slots" in s) ) continue;
    used += rules.stackSlots(s.slots, "quantity" in s ? s.quantity : 1);
  }
  return used;
}

/**
 * A Slots meter for a capacity. A capacity of 0 means no limit.
 * @param {number} used
 * @param {number} max
 * @returns {object}
 */
export function slotsMeter(used, max) {
  return {
    value: used,
    max,
    unlimited: !max,
    pct: max ? Math.clamp(Math.round((used / max) * 100), 0, 100) : 0,
    over: !!max && (used > max)
  };
}

/**
 * Shared storage: a chest, stash, or loot pile that several Heroes can put Items into and take them out of.
 */
export default class ContainerData extends foundry.abstract.TypeDataModel {

  /** @override */
  static LOCALIZATION_PREFIXES = ["VAGABOND.Storage"];

  /** @override */
  static defineSchema() {
    return {
      capacity: int(0, { min: 0 }),
      locked: new BooleanField({ initial: false }),
      currency: new SchemaField({
        g: int(0, { min: 0 }),
        s: int(0, { min: 0 }),
        c: int(0, { min: 0 })
      }),
      details: new SchemaField({
        description: new HTMLField()
      })
    };
  }

  /** @override */
  prepareDerivedData() {
    this.slots = slotsMeter(cargoSlots(this.parent), this.capacity);
  }

  /** @returns {object} */
  getRollData() {
    return {};
  }
}

/**
 * A mobile, mountable Object such as a boat (Water Travel, p. 17). Its Cargo works like a Container.
 * Riders and crew are Heroes whose Mount is this Vehicle.
 */
export class VehicleData extends ContainerData {

  /** @override */
  static LOCALIZATION_PREFIXES = ["VAGABOND.Storage", "VAGABOND.Vehicle"];

  /** @override */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      kind: new StringField({ required: true, initial: "land" }),
      attributes: new SchemaField({
        hp: new SchemaField({
          value: int(0, { min: 0 }),
          max: int(0, { min: 0 })
        }),
        armor: int(0, { min: 0 }),
        speed: int(0, { min: 0 }),
        travel: int(0, { min: 0 })
      }),
      cost: new StringField({ required: true, blank: true, initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const hp = this.attributes.hp;
    hp.pct = hp.max ? Math.clamp(Math.round((hp.value / hp.max) * 100), 0, 100) : 0;
  }

  /** @override */
  getRollData() {
    return { armor: this.attributes.armor };
  }
}
