import BaseActorSheet from "./base-actor-sheet.mjs";
import CreatureBuilder from "./creature-builder.mjs";
import { inlineDice, joinTraits } from "../rules.mjs";
import { actionFromItem } from "../npc-actions.mjs";

/**
 * A statblock-style sheet for Enemies and other GM-run Beings (p. 108-109).
 */
export default class NPCSheet extends BaseActorSheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["npc"],
    position: { width: 600, height: 720 },
    actions: {
      rollMorale: NPCSheet.#onRollMorale,
      rollHP: NPCSheet.#onRollHP,
      averageHP: NPCSheet.#onAverageHP,
      openCreatureBuilder: NPCSheet.#onOpenCreatureBuilder
    }
  };

  /** @override */
  static PARTS = {
    header: { template: "systems/vagabond-rpg/templates/actor/npc-header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    statblock: { template: "systems/vagabond-rpg/templates/actor/npc-statblock.hbs", scrollable: [""] },
    description: { template: "systems/vagabond-rpg/templates/actor/npc-description.hbs", scrollable: [""] },
    effects: { template: "systems/vagabond-rpg/templates/actor/tab-effects.hbs", scrollable: [""] }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "statblock", icon: "fa-solid fa-dragon" },
        { id: "description", icon: "fa-solid fa-feather" },
        { id: "effects", icon: "fa-solid fa-bolt" }
      ],
      initial: "statblock",
      labelPrefix: "VAGABOND.Tab"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const cfg = CONFIG.VAGABOND;
    context.tabs = this._prepareTabs("primary");
    context.sizes = cfg.sizes;
    context.beingTypes = cfg.beingTypes;
    context.zones = cfg.zones;
    context.descriptionHTML = await this._enrich(system.details.description);
    // In edit mode Immune, Weak, and Status Immunities are picked from options below the fields, as in the Creature Builder.
    if ( context.editMode ) context.traits = CreatureBuilder.traitPickers(this.actor._source.system.details);
    context.traitShown = Object.fromEntries(["appearing", "senses", "immune", "weak", "statusImmunities"].map(f => [f,
      context.editMode ? !CreatureBuilder.TRAIT_FIELDS.includes(f) : !!system.details[f]]));

    const items = this.actor.items.contents.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.actions = [];
    context.abilities = [];
    context.otherItems = [];
    for ( const item of items ) {
      const row = await this._prepareItem(item);
      if ( item.type === "action" ) {
        row.descriptionHTML = await this._enrich(inlineDice(item.system.description));
        (item.system.isAbility ? context.abilities : context.actions).push(row);
      }
      else context.otherItems.push(row);
    }
    context.hpBar = system.attributes.hp;
    context.typeLabel = [
      game.i18n.localize(cfg.sizes[system.details.size] ?? ""),
      game.i18n.localize(cfg.beingTypes[system.details.beingType] ?? ""),
      system.details.subtype ? `(${system.details.subtype})` : ""
    ].filter(Boolean).join(" ");
    return context;
  }

  /** @override */
  _getHeaderControls() {
    const controls = super._getHeaderControls();
    if ( this.isEditable ) controls.unshift({
      icon: "fa-solid fa-dragon", label: "VAGABOND.CreatureBuilder.OpenHint", action: "openCreatureBuilder"
    });
    return controls;
  }

  /** Pack animals and Mounts with Cargo work as shared storage for anyone who can see them. */
  /** @override */
  _canDragStart(selector) {
    return (super._canDragStart?.(selector) ?? this.isEditable) || this.#sharedCargo;
  }

  /** @override */
  _canDragDrop(selector) {
    return (super._canDragDrop?.(selector) ?? this.isEditable) || this.#sharedCargo;
  }

  get #sharedCargo() {
    return (this.actor.system.cargo?.max > 0) && this.actor.testUserPermission(game.user, "OBSERVER");
  }

  /**
   * Weapons, Spells, Perks, and Features dropped here become statblock Actions and Abilities.
   * Hold Shift while dropping to keep the Item as it is instead.
   * @override
   */
  async _onDropItem(event, item) {
    this._keepItem = event.shiftKey;
    try { return await super._onDropItem(event, item); }
    finally { this._keepItem = false; }
  }

  /** @override */
  async _onDropItemCreate(item) {
    const data = this._keepItem ? null : actionFromItem(item, this.actor);
    if ( !data ) return super._onDropItemCreate(item);
    const created = await this.actor.createEmbeddedDocuments("Item", [data]);
    ui.notifications.info(game.i18n.format("VAGABOND.NPC.ItemToAction", {
      name: item.name, type: game.i18n.localize(CONFIG.VAGABOND.npcActionTypes[data.system.actionType])
    }));
    return created;
  }

  static #onOpenCreatureBuilder() {
    new CreatureBuilder({ actor: this.actor }).render({ force: true });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    for ( const el of this.element.querySelectorAll("[data-trait]") ) el.addEventListener("change", this.#onTraitChange.bind(this));
  }

  /** Rewrite an Immune, Weak, or Status Immunities line after one of its options or its Other entry changes. */
  async #onTraitChange(event) {
    event.stopPropagation();
    const field = event.currentTarget.dataset.trait;
    const box = this.element.querySelector(`.trait-picker[data-trait-field="${field}"]`);
    const keys = [...box.querySelectorAll("input[type=checkbox]:checked")].map(el => el.value);
    const other = box.querySelector("input[data-trait-other]")?.value ?? "";
    return this.actor.update({ [`system.details.${field}`]: joinTraits(field, keys, other) });
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( context.tabs?.[partId] ) context.tab = context.tabs[partId];
    return context;
  }

  static async #onRollMorale() {
    return this.actor.rollMorale();
  }

  static async #onRollHP() {
    return this.actor.rollHitPoints();
  }

  static async #onAverageHP() {
    const hp = this.actor.system.attributes.averageHP;
    return this.actor.update({ "system.attributes.hp.value": hp, "system.attributes.hp.max": hp });
  }
}
