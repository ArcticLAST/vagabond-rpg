import { isStorage, moveItem, PHYSICAL_TYPES, promptQuantity, storeNewItem } from "../transfer.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const TextEditor = () => foundry.applications.ux.TextEditor.implementation;

/**
 * Shared behaviour for Vagabond Actor sheets: item and effect controls, rolling, and drops.
 */
export default class BaseActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    // Parchment sheets always use Foundry's light theme so core text colors stay dark on paper.
    classes: ["vagabond", "sheet", "actor", "themed", "theme-light"],
    form: { submitOnChange: true },
    window: { resizable: true },
    actions: {
      useItem: BaseActorSheet.#onUseItem,
      editItem: BaseActorSheet.#onEditItem,
      deleteItem: BaseActorSheet.#onDeleteItem,
      createItem: BaseActorSheet.#onCreateItem,
      toggleEquip: BaseActorSheet.#onToggleEquip,
      toggleDescription: BaseActorSheet.#onToggleDescription,
      adjustQuantity: BaseActorSheet.#onAdjustQuantity,
      adjustUses: BaseActorSheet.#onAdjustUses,
      rollSave: BaseActorSheet.#onRollSave,
      createEffect: BaseActorSheet.#onCreateEffect,
      editEffect: BaseActorSheet.#onEditEffect,
      deleteEffect: BaseActorSheet.#onDeleteEffect,
      toggleEffect: BaseActorSheet.#onToggleEffect,
      toggleMode: BaseActorSheet.#onToggleMode
    }
  };

  /**
   * Sheet modes: play (locked) and edit.
   * @enum {number}
   */
  static MODES = { PLAY: 1, EDIT: 2 };

  /** @type {number} */
  _mode = BaseActorSheet.MODES.PLAY;

  /** Item ids whose descriptions are expanded. */
  _expanded = new Set();

  /** Whether the sheet is in edit mode. */
  get isEditMode() {
    return this.isEditable && (this._mode === BaseActorSheet.MODES.EDIT);
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    Object.assign(context, {
      actor,
      system: actor.system,
      source: actor.system._source,
      config: CONFIG.VAGABOND,
      editable: this.isEditable,
      editMode: this.isEditMode,
      owner: actor.isOwner,
      limited: actor.limited,
      rollData: actor.getRollData()
    });
    context.effects = this._prepareEffects();
    return context;
  }

  /**
   * Enrich an HTML field for display.
   * @param {string} html
   * @returns {Promise<string>}
   */
  async _enrich(html) {
    return TextEditor().enrichHTML(html ?? "", {
      secrets: this.actor.isOwner, rollData: this.actor.getRollData(), relativeTo: this.actor
    });
  }

  /**
   * Build the row data shared by every item list.
   * @param {Item} item
   * @returns {Promise<object>}
   */
  async _prepareItem(item) {
    const expanded = this._expanded.has(item.id);
    return {
      item,
      id: item.id,
      name: item.name,
      img: item.img,
      system: item.system,
      tags: item.system.chatTags ?? [],
      expanded,
      description: expanded ? await TextEditor().enrichHTML(item.system.description ?? "", {
        secrets: item.isOwner, rollData: item.getRollData(), relativeTo: item
      }) : ""
    };
  }

  /**
   * Group Active Effects into temporary, passive, and inactive (as dnd5e does).
   * @returns {object[]}
   */
  _prepareEffects() {
    const categories = {
      temporary: { label: "VAGABOND.Effect.Temporary", type: "temporary", effects: [] },
      passive: { label: "VAGABOND.Effect.Passive", type: "passive", effects: [] },
      inactive: { label: "VAGABOND.Effect.Inactive", type: "inactive", effects: [] }
    };
    for ( const effect of this.actor.allApplicableEffects() ) {
      const row = {
        id: effect.id,
        uuid: effect.uuid,
        parentId: effect.parent === this.actor ? "" : effect.parent.id,
        name: effect.name,
        img: effect.img,
        disabled: effect.disabled,
        source: effect.parent === this.actor ? "" : effect.parent.name,
        duration: effect.duration?.label ?? ""
      };
      if ( effect.disabled ) categories.inactive.effects.push(row);
      else if ( effect.isTemporary ) categories.temporary.effects.push(row);
      else categories.passive.effects.push(row);
    }
    return Object.values(categories);
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    if ( this.isEditable ) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "header-control icon fa-solid fa-lock vg-mode-toggle";
      toggle.dataset.action = "toggleMode";
      toggle.dataset.tooltip = "VAGABOND.Sheet.ToggleEdit";
      toggle.setAttribute("aria-label", game.i18n.localize("VAGABOND.Sheet.ToggleEdit"));
      (this.window.title ?? this.window.header?.firstElementChild)?.before(toggle);
    }
    return frame;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.classList.toggle("edit-mode", this.isEditMode);
    const toggle = this.window.header?.querySelector(".vg-mode-toggle");
    if ( toggle ) {
      toggle.classList.toggle("fa-lock", !this.isEditMode);
      toggle.classList.toggle("fa-lock-open", this.isEditMode);
    }
    // Select-on-focus for numeric inputs, like dnd5e.
    for ( const input of this.element.querySelectorAll("input[type=number], input[data-dtype=Number]") ) {
      input.addEventListener("focus", () => input.select());
    }
    // Delta inputs: "+3" or "-2" adjusts the current value.
    for ( const input of this.element.querySelectorAll("input.delta") ) {
      input.addEventListener("change", this._onDeltaChange.bind(this), { capture: true });
    }
  }

  /**
   * Allow resource inputs to take relative values such as +5 or -3.
   * @param {Event} event
   */
  _onDeltaChange(event) {
    const input = event.currentTarget;
    const value = input.value.trim();
    if ( !/^[+-]\d+$/.test(value) ) return;
    const current = foundry.utils.getProperty(this.actor, input.name) ?? 0;
    input.value = Number(current) + Number(value);
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** @override */
  async _onDropItem(event, item) {
    const source = (item.parent instanceof Actor) ? item.parent : null;
    if ( source === this.actor ) return this.actor.isOwner ? super._onDropItem(event, item) : null;

    // Putting physical Items into storage, or taking them out, moves them rather than copying (Shift: choose how many).
    if ( PHYSICAL_TYPES.includes(item.type) && (isStorage(this.actor) || isStorage(source)) ) {
      if ( !source ) return storeNewItem(item, this.actor);
      const quantity = event.shiftKey ? await promptQuantity(item) : undefined;
      if ( quantity === null ) return null;
      return moveItem(item, this.actor, { quantity });
    }

    if ( !this.actor.isOwner ) return null;
    const allowed = this.constructor.ALLOWED_ITEM_TYPES;
    if ( allowed && !allowed.includes(item.type) ) {
      ui.notifications.warn(game.i18n.format("VAGABOND.Sheet.ItemNotAllowed", {
        type: game.i18n.localize(CONFIG.Item.typeLabels[item.type])
      }));
      return null;
    }
    return this._onDropItemCreate(item);
  }

  /**
   * Create a dropped Item on this Actor.
   * @param {Item} item
   * @returns {Promise<Item[]>}
   */
  async _onDropItemCreate(item) {
    const data = item.toObject();
    delete data._id;
    return this.actor.createEmbeddedDocuments("Item", [data]);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /**
   * Get the Item for an action target.
   * @param {HTMLElement} target
   * @returns {Item|undefined}
   */
  _getItem(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return this.actor.items.get(id);
  }

  /**
   * Get the Active Effect for an action target, including effects on Items.
   * @param {HTMLElement} target
   * @returns {ActiveEffect|undefined}
   */
  _getEffect(target) {
    const row = target.closest("[data-effect-id]");
    if ( !row ) return;
    const { effectId, parentId } = row.dataset;
    const parent = parentId ? this.actor.items.get(parentId) : this.actor;
    return parent?.effects.get(effectId);
  }

  static async #onUseItem(event, target) {
    return this._getItem(target)?.use({ event });
  }

  static #onEditItem(event, target) {
    return this._getItem(target)?.sheet.render({ force: true });
  }

  static async #onDeleteItem(event, target) {
    const item = this._getItem(target);
    return item?.deleteDialog?.() ?? item?.delete();
  }

  static async #onCreateItem(event, target) {
    const { type, ...rest } = target.dataset;
    const data = {
      name: game.i18n.format("VAGABOND.Sheet.NewItem", { type: game.i18n.localize(CONFIG.Item.typeLabels[type]) }),
      type,
      system: {}
    };
    if ( rest.category ) data.system.category = rest.category;
    if ( rest.actionType ) data.system.actionType = rest.actionType;
    const [item] = await this.actor.createEmbeddedDocuments("Item", [data]);
    return item?.sheet.render({ force: true });
  }

  static async #onToggleEquip(event, target) {
    const item = this._getItem(target);
    if ( !item ) return;
    return item.update({ "system.equipped": !item.system.equipped });
  }

  static #onToggleDescription(event, target) {
    const item = this._getItem(target);
    if ( !item ) return;
    if ( this._expanded.has(item.id) ) this._expanded.delete(item.id);
    else this._expanded.add(item.id);
    return this.render();
  }

  static async #onAdjustQuantity(event, target) {
    const item = this._getItem(target);
    if ( !item ) return;
    const delta = Number(target.dataset.delta) || 0;
    return item.update({ "system.quantity": Math.max(0, item.system.quantity + delta) });
  }

  static async #onAdjustUses(event, target) {
    const item = this._getItem(target);
    if ( !item ) return;
    const delta = Number(target.dataset.delta) || 0;
    return item.update({ "system.uses.value": Math.clamp(item.system.uses.value + delta, 0, item.system.uses.max) });
  }

  static async #onRollSave(event, target) {
    return this.actor.rollSave(target.dataset.save, { event });
  }

  static async #onCreateEffect(event, target) {
    const type = target.dataset.effectType;
    return this.actor.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("VAGABOND.Effect.New"),
      img: "icons/svg/aura.svg",
      disabled: type === "inactive",
      duration: type === "temporary" ? { rounds: 1 } : {}
    }]).then(([e]) => e?.sheet.render({ force: true }));
  }

  static #onEditEffect(event, target) {
    return this._getEffect(target)?.sheet.render({ force: true });
  }

  static async #onDeleteEffect(event, target) {
    return this._getEffect(target)?.delete();
  }

  static async #onToggleEffect(event, target) {
    const effect = this._getEffect(target);
    return effect?.update({ disabled: !effect.disabled });
  }

  static #onToggleMode(event, target) {
    this._mode = this.isEditMode ? BaseActorSheet.MODES.PLAY : BaseActorSheet.MODES.EDIT;
    return this.render();
  }
}
