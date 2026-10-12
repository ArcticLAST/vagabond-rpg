import BaseActorSheet from "./base-actor-sheet.mjs";
import * as rules from "../rules.mjs";
import { moveCoins, moveItem, promptQuantity, userHero } from "../transfer.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * A sheet for shared storage: Containers and Vehicles. Players who can observe it can drag Items in and out,
 * use the Take button, and deposit or withdraw coins. Moves they don't own both ends of go through the GM.
 */
export default class StorageSheet extends BaseActorSheet {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["storage"],
    position: { width: 560, height: 640 },
    actions: {
      takeItem: StorageSheet.#onTakeItem,
      deposit: StorageSheet.#onDeposit,
      withdraw: StorageSheet.#onWithdraw,
      toggleLock: StorageSheet.#onToggleLock,
      board: StorageSheet.#onBoard,
      disembark: StorageSheet.#onDisembark,
      openRider: StorageSheet.#onOpenRider
    }
  };

  /** @override */
  static PARTS = {
    header: { template: "systems/vagabond-rpg/templates/actor/storage-header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    cargo: { template: "systems/vagabond-rpg/templates/actor/storage-cargo.hbs", scrollable: [""] },
    description: { template: "systems/vagabond-rpg/templates/actor/storage-description.hbs", scrollable: [""] }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: "cargo", icon: "fa-solid fa-box-open" },
        { id: "description", icon: "fa-solid fa-feather" }
      ],
      initial: "cargo",
      labelPrefix: "VAGABOND.Tab"
    }
  };

  /** Item types storage can hold. */
  static ALLOWED_ITEM_TYPES = ["weapon", "armor", "gear"];

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    context.tabs = this._prepareTabs("primary");
    context.isVehicle = actor.type === "vehicle";
    context.isGM = game.user.isGM;
    context.hero = userHero();
    context.slots = system.slots;
    context.vehicleKinds = CONFIG.VAGABOND.vehicleKinds;
    context.descriptionHTML = await this._enrich(system.details.description);
    context.cargo = [];
    for ( const item of actor.items.contents.sort((a, b) => (a.sort || 0) - (b.sort || 0)) ) {
      const row = await this._prepareItem(item);
      row.slotsTotal = rules.stackSlots(item.system.slots, item.system.quantity ?? 1);
      row.typeLabel = game.i18n.localize(CONFIG.Item.typeLabels[item.type]);
      context.cargo.push(row);
    }
    context.coins = rules.formatCoins((system.currency.g * 100) + system.currency.s + (system.currency.c / 100));
    if ( context.isVehicle ) {
      context.hpBar = system.attributes.hp;
      context.riders = game.actors.filter(a => (a.type === "character") && (a.system.attributes.mount === actor.uuid))
        .map(a => ({ id: a.id, uuid: a.uuid, name: a.name, img: a.img, canRemove: a.isOwner }));
      context.heroAboard = !!context.hero && (context.hero.system.attributes.mount === actor.uuid);
    }
    return context;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( context.tabs?.[partId] ) context.tab = context.tabs[partId];
    return context;
  }

  /* -------------------------------------------- */
  /*  Drag and Drop                               */
  /* -------------------------------------------- */

  /** Anyone who can see storage can drag Items out of it; the move itself checks permissions. */
  /** @override */
  _canDragStart(selector) {
    return this.actor.testUserPermission(game.user, "OBSERVER");
  }

  /** @override */
  _canDragDrop(selector) {
    return this.actor.testUserPermission(game.user, "OBSERVER");
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Move an Item from storage to the user's Hero. */
  static async #onTakeItem(event, target) {
    const item = this._getItem(target);
    const hero = userHero();
    if ( !item || !hero ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Storage.NoHero"));
    const quantity = event.shiftKey ? await promptQuantity(item) : undefined;
    if ( quantity === null ) return;
    return moveItem(item, hero, { quantity });
  }

  static async #onDeposit() {
    const hero = userHero();
    if ( !hero ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Storage.NoHero"));
    const coins = await StorageSheet.#promptCoins("VAGABOND.Storage.Deposit", hero.system.currency);
    if ( coins ) return moveCoins(hero, this.actor, coins);
  }

  static async #onWithdraw() {
    const hero = userHero();
    if ( !hero ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Storage.NoHero"));
    const coins = await StorageSheet.#promptCoins("VAGABOND.Storage.Withdraw", this.actor.system.currency);
    if ( coins ) return moveCoins(this.actor, hero, coins);
  }

  /**
   * Ask for an amount of coins, up to what the purse holds.
   * @param {string} title
   * @param {{g: number, s: number, c: number}} purse
   * @returns {Promise<object|null>}
   */
  static async #promptCoins(title, purse) {
    const field = k => `<label class="coin"><input type="number" name="${k}" value="0" min="0" max="${purse[k]}" step="1">
      <abbr>${k}</abbr> <span class="hint">/ ${purse[k]}</span></label>`;
    return DialogV2.prompt({
      window: { title: game.i18n.localize(title) },
      content: `<div class="vg-coin-dialog">${["g", "s", "c"].map(field).join("")}</div>`,
      ok: {
        label: title,
        callback: (event, button) => Object.fromEntries(["g", "s", "c"].map(k => [k, button.form.elements[k].valueAsNumber || 0]))
      },
      rejectClose: false
    });
  }

  static async #onToggleLock() {
    if ( !this.isEditable ) return;
    return this.actor.update({ "system.locked": !this.actor.system.locked });
  }

  /** The user's Hero boards this Vehicle. */
  static async #onBoard() {
    const hero = userHero();
    if ( !hero ) return ui.notifications.warn(game.i18n.localize("VAGABOND.Storage.NoHero"));
    return hero.setMount(this.actor);
  }

  static async #onDisembark(event, target) {
    const rider = game.actors.get(target.closest("[data-rider-id]")?.dataset.riderId) ?? userHero();
    if ( rider?.isOwner ) return rider.setMount(null);
  }

  static #onOpenRider(event, target) {
    return game.actors.get(target.closest("[data-rider-id]")?.dataset.riderId)?.sheet.render({ force: true });
  }
}
