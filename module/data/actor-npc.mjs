import * as rules from "../rules.mjs";
import { cargoSlots, slotsMeter } from "./actor-container.mjs";

const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

const int = (initial = 0, options = {}) => new NumberField({
  required: true, nullable: false, integer: true, initial, ...options
});

/**
 * Data model for Beings run by the GM, following the statblock format of the Bestiary (p. 108-109).
 */
export default class NPCData extends foundry.abstract.TypeDataModel {

  /** @override */
  static LOCALIZATION_PREFIXES = ["VAGABOND.NPC"];

  /** @override */
  static defineSchema() {
    return {
      hd: int(1, { min: 0 }),
      tl: new NumberField({ required: true, nullable: false, initial: 1, min: 0 }),
      attributes: new SchemaField({
        hp: new SchemaField({
          value: int(4, { min: 0 }),
          max: int(4, { min: 0 })
        }),
        armor: int(0, { min: 0 }),
        armorTag: new StringField({ required: true, blank: true, initial: "" }),
        morale: new NumberField({ required: false, nullable: true, integer: true, initial: 7, min: 2, max: 12 }),
        speed: new SchemaField({
          value: int(30, { min: 0 }),
          types: new StringField({ required: true, blank: true, initial: "" })
        }),
        // Miles per Shift of Travel when it differs from Speed / 5, as for Riding Animals (p. 13).
        travel: int(0, { min: 0 })
      }),
      // Slots a pack animal or Mount can carry (p. 13); 0 for Beings that don't carry Cargo.
      cargo: new SchemaField({
        max: int(0, { min: 0 })
      }),
      details: new SchemaField({
        size: new StringField({ required: true, initial: "medium" }),
        beingType: new StringField({ required: true, initial: "humanlike" }),
        subtype: new StringField({ required: true, blank: true, initial: "" }),
        zone: new StringField({ required: true, blank: true, initial: "frontline" }),
        appearing: new StringField({ required: true, blank: true, initial: "" }),
        senses: new StringField({ required: true, blank: true, initial: "" }),
        immune: new StringField({ required: true, blank: true, initial: "" }),
        weak: new StringField({ required: true, blank: true, initial: "" }),
        statusImmunities: new StringField({ required: true, blank: true, initial: "" }),
        source: new StringField({ required: true, blank: true, initial: "" }),
        description: new HTMLField()
      })
    };
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    const hp = this.attributes.hp;
    hp.pct = hp.max ? Math.clamp(Math.round((hp.value / hp.max) * 100), 0, 100) : 0;
    this.attributes.averageHP = rules.hpFromHD(this.hd, this.details.size);
    const has = id => this.parent.statuses?.has(id);
    this.attributes.isVulnerable = CONFIG.VAGABOND.vulnerableStatuses.some(s => has(s));
    this.attributes.isIncapacitated = CONFIG.VAGABOND.incapacitatedStatuses.some(s => has(s));
    this.attributes.crit = { attack: 20, cast: 20, save: 20 };
    this.attributes.travelSpeed = this.attributes.travel || rules.travelSpeed(this.attributes.speed.value);
    this.cargo.slots = slotsMeter(cargoSlots(this.parent), this.cargo.max);
  }

  /* -------------------------------------------- */

  /**
   * Roll data for formulas.
   * @returns {object}
   */
  getRollData() {
    return { hd: this.hd, tl: this.tl, armor: this.attributes.armor, groupInit: 1 };
  }
}
