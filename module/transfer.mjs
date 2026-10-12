/**
 * Moving Items and coins between Actors, including shared storage that a player does not own.
 *
 * Storage is any Container or Vehicle Actor, or a Being with a Cargo capacity (a pack animal or mount). Players who can
 * at least observe unlocked storage can put things in and take things out. When a player does not own both ends of a
 * move, the active GM's client carries it out over the system socket after checking that player's permissions.
 */

const SOCKET = "system.vagabond-rpg";

/** Item types that take up Slots and can be stored. */
export const PHYSICAL_TYPES = ["weapon", "armor", "gear"];

/* -------------------------------------------- */
/*  Permissions                                 */
/* -------------------------------------------- */

/**
 * Whether an Actor is shared storage.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isStorage(actor) {
  if ( !actor ) return false;
  if ( ["container", "vehicle"].includes(actor.type) ) return true;
  return (actor.type === "npc") && ((actor.system.cargo?.max ?? 0) > 0);
}

/**
 * Whether a user may take Items out of, or put Items into, an Actor.
 * @param {Actor} actor
 * @param {User} user
 * @returns {boolean}
 */
export function canAccess(actor, user) {
  if ( !actor ) return false;
  if ( user.isGM || actor.testUserPermission(user, "OWNER") ) return true;
  return isStorage(actor) && !actor.system.locked && actor.testUserPermission(user, "OBSERVER");
}

/* -------------------------------------------- */
/*  Client API                                  */
/* -------------------------------------------- */

/**
 * The Hero a user acts for when taking Items or coins out of storage: their assigned character, else (for players) the
 * first Hero they own.
 * @returns {Actor|null}
 */
export function userHero() {
  if ( game.user.character ) return game.user.character;
  if ( game.user.isGM ) return null;
  return game.actors.find(a => (a.type === "character") && a.isOwner) ?? null;
}

/**
 * Ask how many of a stack to move.
 * @param {Item} item
 * @returns {Promise<number|null>}
 */
export async function promptQuantity(item) {
  const max = item.system.quantity ?? 1;
  if ( max <= 1 ) return max;
  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("VAGABOND.Storage.HowMany", { name: item.name }) },
    content: `<div class="form-group"><label>${game.i18n.localize("VAGABOND.Quantity")}</label>
      <input type="number" name="quantity" value="${max}" min="1" max="${max}" step="1" autofocus></div>`,
    ok: { label: "VAGABOND.Storage.Move", callback: (event, button) => button.form.elements.quantity.valueAsNumber },
    rejectClose: false
  });
}


/**
 * Move an owned Item (or part of its stack) to another Actor.
 * @param {Item} item           An Item on an Actor.
 * @param {Actor} target
 * @param {object} [options]
 * @param {number} [options.quantity]  How many to move; the whole stack by default.
 * @returns {Promise<boolean>}  Whether the move was carried out or sent to the GM.
 */
export async function moveItem(item, target, { quantity } = {}) {
  const source = item.parent;
  if ( !(source instanceof Actor) || (source === target) ) return false;
  if ( !PHYSICAL_TYPES.includes(item.type) ) {
    ui.notifications.warn(game.i18n.localize("VAGABOND.Storage.OnlyPhysical"));
    return false;
  }
  const request = { action: "move", itemUuid: item.uuid, targetUuid: target.uuid, quantity };
  if ( !canAccess(source, game.user) || !canAccess(target, game.user) ) {
    ui.notifications.warn(game.i18n.localize(source.system.locked || target.system.locked
      ? "VAGABOND.Storage.Locked" : "VAGABOND.Storage.NoPermission"));
    return false;
  }
  if ( source.isOwner && target.isOwner ) return !!(await doMove(item, target, quantity));
  return relay(request);
}

/**
 * Put a new copy of an Item (from the sidebar or a compendium) into storage the user can access.
 * @param {Item} item
 * @param {Actor} target
 * @returns {Promise<boolean>}
 */
export async function storeNewItem(item, target) {
  if ( !PHYSICAL_TYPES.includes(item.type) ) {
    ui.notifications.warn(game.i18n.localize("VAGABOND.Storage.OnlyPhysical"));
    return false;
  }
  if ( !canAccess(target, game.user) ) {
    ui.notifications.warn(game.i18n.localize(target.system.locked ? "VAGABOND.Storage.Locked" : "VAGABOND.Storage.NoPermission"));
    return false;
  }
  const data = item.toObject();
  if ( target.isOwner ) return !!(await addItem(target, data));
  return relay({ action: "create", itemData: data, targetUuid: target.uuid });
}

/**
 * Move coins between two Actors that have a currency purse.
 * @param {Actor} source
 * @param {Actor} target
 * @param {{g: number, s: number, c: number}} coins
 * @returns {Promise<boolean>}
 */
export async function moveCoins(source, target, coins) {
  if ( !canAccess(source, game.user) || !canAccess(target, game.user) ) {
    ui.notifications.warn(game.i18n.localize("VAGABOND.Storage.NoPermission"));
    return false;
  }
  if ( source.isOwner && target.isOwner ) return doCoins(source, target, coins);
  return relay({ action: "coins", sourceUuid: source.uuid, targetUuid: target.uuid, coins });
}

/**
 * Give one of a Hero's Studied dice to an Ally.
 * @param {Actor} source
 * @param {Actor} target
 * @returns {Promise<boolean>}
 */
export async function giveStudied(source, target) {
  if ( !source.isOwner || ((source.system.attributes.studied ?? 0) < 1) ) return false;
  if ( target.isOwner ) return doGiveStudied(source, target);
  return relay({ action: "studied", sourceUuid: source.uuid, targetUuid: target.uuid });
}

/**
 * Ask the active GM to carry out a request.
 * @param {object} request
 * @returns {boolean}
 */
function relay(request) {
  if ( !game.users.activeGM ) {
    ui.notifications.warn(game.i18n.localize("VAGABOND.Storage.NeedGM"));
    return false;
  }
  game.socket.emit(SOCKET, { ...request, userId: game.user.id });
  return true;
}

/* -------------------------------------------- */
/*  Socket                                      */
/* -------------------------------------------- */

/** Listen for relayed requests (handled by the active GM) and notices (shown to the requesting player). */
export function registerSocket() {
  game.socket.on(SOCKET, async message => {
    if ( message.action === "notice" ) {
      if ( message.userId === game.user.id ) ui.notifications.warn(game.i18n.localize(message.key));
      return;
    }
    if ( !game.user.isActiveGM ) return;
    const user = game.users.get(message.userId);
    if ( !user ) return;
    try {
      const key = await handleRequest(message, user);
      if ( key ) game.socket.emit(SOCKET, { action: "notice", userId: user.id, key });
    } catch ( err ) {
      console.error("Vagabond | Relayed request failed", err);
    }
  });
}

/**
 * Carry out a relayed request after checking the requesting user's permissions.
 * @param {object} message
 * @param {User} user
 * @returns {Promise<string|void>}  A localization key to send back when the request is refused.
 */
async function handleRequest(message, user) {
  const target = await fromUuid(message.targetUuid);
  if ( !(target instanceof Actor) ) return "VAGABOND.Storage.Missing";
  switch ( message.action ) {
    case "move": {
      const item = await fromUuid(message.itemUuid);
      const source = item?.parent;
      if ( !(source instanceof Actor) ) return "VAGABOND.Storage.Missing";
      if ( !PHYSICAL_TYPES.includes(item.type) ) return "VAGABOND.Storage.OnlyPhysical";
      if ( !canAccess(source, user) || !canAccess(target, user) ) return "VAGABOND.Storage.NoPermission";
      await doMove(item, target, message.quantity);
      return;
    }
    case "create": {
      if ( !PHYSICAL_TYPES.includes(message.itemData?.type) ) return "VAGABOND.Storage.OnlyPhysical";
      if ( !isStorage(target) || !canAccess(target, user) ) return "VAGABOND.Storage.NoPermission";
      await addItem(target, message.itemData);
      return;
    }
    case "coins": {
      const source = await fromUuid(message.sourceUuid);
      if ( !(source instanceof Actor) ) return "VAGABOND.Storage.Missing";
      if ( !canAccess(source, user) || !canAccess(target, user) ) return "VAGABOND.Storage.NoPermission";
      if ( !(await doCoins(source, target, message.coins)) ) return "VAGABOND.Storage.NotEnoughCoins";
      return;
    }
    case "studied": {
      const source = await fromUuid(message.sourceUuid);
      if ( !source?.testUserPermission(user, "OWNER") || (target.type !== "character") ) return "VAGABOND.Storage.NoPermission";
      await doGiveStudied(source, target);
      return;
    }
  }
}

/* -------------------------------------------- */
/*  Operations                                  */
/* -------------------------------------------- */

/**
 * Add Item data to an Actor, stacking it onto a matching unequipped Item when there is one.
 * @param {Actor} target
 * @param {object} data   Item source data.
 * @returns {Promise<Item|undefined>}
 */
async function addItem(target, data, op = {}) {
  data = foundry.utils.deepClone(data);
  delete data._id;
  delete data.folder;
  delete data.sort;
  delete data.ownership;
  if ( data.system && ("equipped" in data.system) ) data.system.equipped = false;
  const qty = data.system?.quantity ?? 1;
  const match = target.items.find(i => (i.type === data.type) && (i.name === data.name) && ("quantity" in i.system)
    && !i.system.equipped && ((i.system.uses?.value ?? 0) === (data.system?.uses?.value ?? 0)));
  if ( match ) {
    await match.update({ "system.quantity": match.system.quantity + qty }, op);
    return match;
  }
  const [created] = await target.createEmbeddedDocuments("Item", [data], op);
  return created;
}

/**
 * Move an Item between two Actors.
 * @param {Item} item
 * @param {Actor} target
 * @param {number} [quantity]
 * @returns {Promise<Item|undefined>}
 */
async function doMove(item, target, quantity) {
  const total = item.system.quantity ?? 1;
  const qty = Math.clamp(Math.floor(quantity ?? total) || total, 1, Math.max(total, 1));
  const data = item.toObject();
  if ( "quantity" in item.system ) data.system.quantity = qty;
  const source = item.parent;
  const created = await addItem(target, data, { vagabondVia: game.i18n.format("VAGABOND.SheetLog.From", { name: source?.name ?? "" }) });
  if ( !created ) return;
  const op = { vagabondVia: game.i18n.format("VAGABOND.SheetLog.To", { name: target.name }) };
  if ( ("quantity" in item.system) && (qty < total) ) await item.update({ "system.quantity": total - qty }, op);
  else await item.delete(op);
  return created;
}

/**
 * Move coins, failing if the source purse cannot cover them. Coins are not converted between denominations.
 * @returns {Promise<boolean>}
 */
async function doCoins(source, target, coins) {
  const from = source.system.currency;
  const to = target.system.currency;
  if ( !from || !to ) return false;
  const amount = Object.fromEntries(["g", "s", "c"].map(k => [k, Math.max(0, Math.floor(Number(coins?.[k]) || 0))]));
  if ( ["g", "s", "c"].some(k => amount[k] > from[k]) ) return false;
  if ( !(amount.g || amount.s || amount.c) ) return false;
  await source.update(Object.fromEntries(["g", "s", "c"].map(k => [`system.currency.${k}`, from[k] - amount[k]])),
    { vagabondVia: game.i18n.format("VAGABOND.SheetLog.To", { name: target.name }) });
  await target.update(Object.fromEntries(["g", "s", "c"].map(k => [`system.currency.${k}`, to[k] + amount[k]])),
    { vagabondVia: game.i18n.format("VAGABOND.SheetLog.From", { name: source.name }) });
  return true;
}

/**
 * Move one Studied die from one Hero to another.
 * @returns {Promise<boolean>}
 */
async function doGiveStudied(source, target) {
  const have = source.system.attributes.studied ?? 0;
  if ( (have < 1) || (target.type !== "character") ) return false;
  await source.update({ "system.attributes.studied": have - 1 }, { vagabondLog: false });
  await target.update({ "system.attributes.studied": (target.system.attributes.studied ?? 0) + 1 }, { vagabondLog: false });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: source }),
    content: `<div class="vagabond chat-card"><p><i class="fa-solid fa-book-open"></i> ${game.i18n.format("VAGABOND.Studied.Given", {
      name: source.name, target: target.name })}</p></div>`
  });
  return true;
}
